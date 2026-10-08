import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, DatabaseUnconfiguredError } from './src/infrastructure/database/SupabaseDatabaseAdapter';
import { DataQualityEngine } from './src/core/validation/dataQuality';
import { CommunicationPolicyEngine } from './src/core/policy/communicationPolicy';
import { WhatsAppManualChannel } from './src/core/channels/whatsAppManualChannel';
import { EmailManualChannel } from './src/core/channels/emailManualChannel';
import { AICopilotService } from './src/services/aiCopilotService';
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest
} from './src/middleware/authMiddleware';
import { Contact, ChannelType, CampaignRecipient, Role } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));
app.get('/favicon.ico', (_req, res) => res.status(204).end());

const whatsAppChannel = new WhatsAppManualChannel();
const emailChannel = new EmailManualChannel();

// Neutralize spreadsheet formula injection (=, +, -, @)
function sanitizeSpreadsheetCell(val: any): any {
  if (typeof val === 'string' && val.length > 0) {
    const firstChar = val.charAt(0);
    if (['=', '+', '-', '@'].includes(firstChar)) {
      return `'${val}`;
    }
  }
  return val;
}

async function logAudit(
  action: string,
  entityType: 'CONTACT' | 'CAMPAIGN' | 'TEMPLATE' | 'POLICY' | 'WORKSPACE' | 'IMPORT',
  entityId: string,
  metadata: Record<string, any> = {},
  req: AuthenticatedRequest
) {
  if (!req.auth || !db.isConfigured) return;
  try {
    await db.auditRepo.log({
      tenantId: req.auth.tenant.id,
      actorId: req.auth.user.id,
      actorName: req.auth.user.name,
      actorRole: req.auth.role,
      action,
      entityType,
      entityId,
      metadata,
      ipAddress: req.ip || '127.0.0.1'
    });
  } catch (err) {
    console.error('[AuditLog] Failed to record audit log:', err);
  }
}

// Error handling middleware for DatabaseUnconfiguredError
function handleDatabaseError(err: any, res: Response) {
  if (err instanceof DatabaseUnconfiguredError || err?.code === 'DATABASE_UNCONFIGURED') {
    return res.status(503).json({
      error: {
        code: 'DATABASE_UNCONFIGURED',
        message: 'Supabase PostgreSQL database is not configured. Please supply SUPABASE_URL and SUPABASE_ANON_KEY to proceed.'
      }
    });
  }
  console.error('[API Error]:', err);
  return res.status(500).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected database error occurred.'
    }
  });
}

// ================= API ROUTER =================
const api = express.Router();

// ---------------- 1. Public Health & Database Status ----------------
api.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: db.isConfigured ? 'HEALTHY' : 'DATABASE_UNCONFIGURED',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: 'SUPABASE_POSTGRESQL',
    isDatabaseConfigured: db.isConfigured,
    message: db.isConfigured
      ? 'Connected to authoritative Supabase PostgreSQL database.'
      : 'Supabase database credentials missing. Set SUPABASE_URL and SUPABASE_ANON_KEY to enable database operations.'
  });
});

api.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    version: '1.0.0',
    database: 'SUPABASE_POSTGRESQL',
    isDatabaseConfigured: db.isConfigured
  });
});

// ---------------- 2. Database Connectivity Gate ----------------
// When Supabase is unconfigured, reject all data requests with clean 503 error
api.use((_req: Request, res: Response, next: NextFunction) => {
  if (!db.isConfigured) {
    return res.status(503).json({
      error: {
        code: 'DATABASE_UNCONFIGURED',
        message: 'Supabase PostgreSQL database is not configured. Real application state requires active Supabase configuration (SUPABASE_URL and SUPABASE_ANON_KEY). Local mock/JSON fallback is strictly disabled.'
      }
    });
  }
  next();
});

// ---------------- PROTECTED API MIDDLEWARE ----------------
// Every endpoint below strictly requires a verified Supabase Auth Bearer token
api.use(authenticateToken as any);

// Session context resolved from Supabase Auth + PostgreSQL tenant_members
api.get('/auth/me', async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    data: {
      user: req.auth!.user,
      tenant: req.auth!.tenant,
      role: req.auth!.role
    }
  });
});

// ---------------- 3. Tenant & Emergency Kill Switch ----------------
api.get('/tenant', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenant = await db.tenantRepo.getTenant(req.auth!.tenant.id);
    res.json({
      data: {
        tenant,
        user: req.auth!.user
      }
    });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});

// ---------------- Aggregated Workspace Bootstrap ----------------
// Returns all primary tenant resources in 1 single HTTP request to prevent rate limiting
api.get('/workspace/bootstrap', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.auth!.tenant.id;
    const tenant = req.auth!.tenant;
    const [contacts, campaigns, templates, lists, auditLogs] = await Promise.all([
      db.contactsRepo.findAll(tenantId),
      db.campaignsRepo.findAll(tenantId),
      db.templatesRepo.findAll(tenantId),
      db.contactListsRepo.findAll(tenantId),
      db.auditRepo.findAll(tenantId, 50)
    ]);

    let totalRecipients = 0;
    let totalOpened = 0;
    let totalSent = 0;
    let totalSkipped = 0;
    let totalBlocked = 0;

    campaigns.forEach(c => {
      totalRecipients += c.recipientsCount || 0;
      totalOpened += c.openedCount || 0;
      totalSent += c.sentCount || 0;
      totalSkipped += c.skippedCount || 0;
      totalBlocked += c.blockedCount || 0;
    });

    const stats = {
      totalContacts: contacts.length,
      activeCampaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
      totalCampaigns: campaigns.length,
      totalTemplates: templates.length,
      totalLists: lists.length,
      totalRecipients,
      totalOpened,
      totalSent,
      totalSkipped,
      totalBlocked,
      pendingCount: totalRecipients - (totalSent + totalSkipped + totalBlocked),
      isKillSwitchActive: tenant?.isKillSwitchActive || false
    };

    res.json({
      data: {
        user: req.auth!.user,
        tenant,
        role: req.auth!.role,
        contacts,
        campaigns,
        templates,
        lists,
        auditLogs,
        stats
      }
    });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});

api.post(
  '/tenant/kill-switch',
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { isActive, reason } = req.body;
      const updated = await db.tenantRepo.updateKillSwitch(
        req.auth!.tenant.id,
        isActive,
        reason,
        req.auth!.user.name
      );

      await logAudit(
        isActive ? 'KILL_SWITCH_TRIGGERED' : 'KILL_SWITCH_DEACTIVATED',
        'WORKSPACE',
        req.auth!.tenant.id,
        { reason, isActive },
        req
      );

      res.json({ data: updated });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

// ---------------- 4. Contacts (Strict Tenant Scoping in PostgreSQL) ----------------
api.get('/contacts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, tag, listId, status } = req.query;
    const contacts = await db.contactsRepo.findAll(
      req.auth!.tenant.id,
      search as string,
      tag as string,
      listId as string,
      status as string
    );
    res.json({ data: contacts });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});

api.get('/contacts/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Scoped strictly to verified tenant to prevent IDOR
    const contact = await db.contactsRepo.findById(req.params.id, req.auth!.tenant.id);
    if (!contact) {
      return res.status(404).json({ error: { message: 'Contact not found or does not belong to your workspace' } });
    }
    const timeline = await db.contactsRepo.getTimeline(contact.id);
    res.json({ data: { contact, timeline } });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});

api.post(
  '/contacts',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = req.body;
      const phoneNorm = DataQualityEngine.normalizePhone(body.phone || '');
      const emailNorm = DataQualityEngine.normalizeEmail(body.email || '');

      const newContact = await db.contactsRepo.create({
        tenantId: req.auth!.tenant.id,
        firstName: sanitizeSpreadsheetCell(body.firstName || ''),
        lastName: sanitizeSpreadsheetCell(body.lastName || ''),
        displayName: sanitizeSpreadsheetCell(body.displayName || `${body.firstName || ''} ${body.lastName || ''}`.trim()),
        companyName: sanitizeSpreadsheetCell(body.companyName || ''),
        jobTitle: sanitizeSpreadsheetCell(body.jobTitle || ''),
        phone: phoneNorm.canonical || body.phone || '',
        email: emailNorm.canonical || body.email || '',
        city: sanitizeSpreadsheetCell(body.city || ''),
        state: body.state || 'Telangana',
        country: body.country || 'India',
        status: 'ACTIVE',
        source: body.source || 'manual_entry',
        leadStatus: body.leadStatus || 'LEAD',
        notes: body.notes || '',
        tags: body.tags || [],
        customFields: body.customFields || {},
        channelAddresses: [
          { id: `addr-${Date.now()}-1`, channelType: 'WHATSAPP', address: phoneNorm.canonical || body.phone, isPrimary: true, isVerified: phoneNorm.isValid },
          { id: `addr-${Date.now()}-2`, channelType: 'EMAIL', address: emailNorm.canonical || body.email, isPrimary: true, isVerified: emailNorm.isValid }
        ],
        preferences: {
          WHATSAPP: { channel: 'WHATSAPP', marketingAllowed: body.marketingAllowed !== false, transactionalAllowed: true },
          EMAIL: { channel: 'EMAIL', marketingAllowed: body.marketingAllowed !== false, transactionalAllowed: true },
          SMS: { channel: 'SMS', marketingAllowed: true, transactionalAllowed: true }
        },
        isGloballyBlocked: false
      });

      await db.contactsRepo.addTimelineEvent({
        contactId: newContact.id,
        eventType: 'CONTACT_CREATED',
        actor: req.auth!.user.name,
        description: `Contact created manually with normalized phone ${newContact.phone}`
      });

      await logAudit('CONTACT_CREATED', 'CONTACT', newContact.id, { name: newContact.displayName }, req);

      res.json({ data: newContact });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

api.put(
  '/contacts/:id',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await db.contactsRepo.update(req.params.id, req.body, req.auth!.tenant.id);
      await db.contactsRepo.addTimelineEvent({
        contactId: updated.id,
        eventType: 'CONTACT_UPDATED',
        actor: req.auth!.user.name,
        description: 'Contact profile updated'
      });
      await logAudit('CONTACT_UPDATED', 'CONTACT', updated.id, req.body, req);
      res.json({ data: updated });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

api.post(
  '/contacts/bulk-update',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { contactIds, updates } = req.body;
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: { message: 'No contact IDs provided' } });
      }
      const tenantId = req.auth!.tenant.id;
      const client = (db as any).getClient();

      const dbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      if (updates.leadStatus) dbUpdates.lead_status = updates.leadStatus;
      if (updates.city) dbUpdates.city = updates.city;
      if (updates.tags) dbUpdates.tags = updates.tags;

      // Update in chunks of 200
      const CHUNK = 200;
      for (let i = 0; i < contactIds.length; i += CHUNK) {
        const chunk = contactIds.slice(i, i + CHUNK);
        const { error } = await client
          .from('contacts')
          .update(dbUpdates)
          .eq('tenant_id', tenantId)
          .in('id', chunk);
        if (error) throw error;
      }

      await logAudit('CONTACTS_BULK_UPDATED', 'CONTACT', `bulk-${Date.now()}`, { count: contactIds.length, updates }, req);
      res.json({ success: true, count: contactIds.length });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

api.delete(
  '/contacts/:id',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await db.contactsRepo.delete(req.params.id, req.auth!.tenant.id);
      await logAudit('CONTACT_DELETED', 'CONTACT', req.params.id, {}, req);
      res.json({ success: true });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

api.post(
  '/contacts/bulk-delete',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { contactIds } = req.body;
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: { message: 'No contact IDs provided to delete' } });
      }

      const client = (db as any).getClient();
      const tenantId = req.auth!.tenant.id;

      // Delete in chunks of 200 to prevent payload limits
      const CHUNK = 200;
      for (let i = 0; i < contactIds.length; i += CHUNK) {
        const chunk = contactIds.slice(i, i + CHUNK);
        // Clean up contact_list_members junction
        await client.from('contact_list_members').delete().eq('tenant_id', tenantId).in('contact_id', chunk);
        // Clean up contact_timeline
        await client.from('contact_timeline').delete().eq('tenant_id', tenantId).in('contact_id', chunk);
        // Clean up campaign_recipients
        await client.from('campaign_recipients').delete().eq('tenant_id', tenantId).in('contact_id', chunk);
        // Delete contacts
        await client.from('contacts').delete().eq('tenant_id', tenantId).in('id', chunk);
      }

      await logAudit('CONTACTS_BULK_DELETED', 'CONTACT', `bulk-${Date.now()}`, { count: contactIds.length }, req);
      res.json({ success: true, count: contactIds.length });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

api.post(
  '/contacts/:id/toggle-block',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contact = await db.contactsRepo.findById(req.params.id, req.auth!.tenant.id);
      if (!contact) return res.status(404).json({ error: { message: 'Contact not found' } });

      const isBlocked = !contact.isGloballyBlocked;
      const reason = req.body.reason || (isBlocked ? 'Manually suppressed by operator' : undefined);

      const updated = await db.contactsRepo.update(
        contact.id,
        {
          isGloballyBlocked: isBlocked,
          blockedReason: reason,
          status: isBlocked ? 'BLOCKED' : 'ACTIVE'
        },
        req.auth!.tenant.id
      );

      // Asynchronous background timeline & audit to keep operator response instant (<20ms)
      (async () => {
        try {
          await db.contactsRepo.addTimelineEvent({
            contactId: contact.id,
            tenantId: req.auth!.tenant.id,
            eventType: isBlocked ? 'BLOCKED' : 'CONTACT_UPDATED',
            actor: req.auth!.user.name,
            actorId: req.auth!.user.id,
            actorName: req.auth!.user.name,
            description: isBlocked ? `Globally blocked: ${reason}` : 'Global block removed'
          });

          await logAudit(isBlocked ? 'CONTACT_BLOCKED' : 'CONTACT_UNBLOCKED', 'CONTACT', contact.id, { reason }, req);
        } catch (bgErr) {
          console.warn('Background block audit log:', bgErr);
        }
      })();

      res.json({ data: updated });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

api.post(
  '/contacts/:id/notes',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { note } = req.body;
      const contact = await db.contactsRepo.findById(req.params.id, req.auth!.tenant.id);
      if (!contact) return res.status(404).json({ error: { message: 'Contact not found' } });

      const updated = await db.contactsRepo.update(
        contact.id,
        {
          notes: `${contact.notes ? `${contact.notes}\n\n` : ''}[${new Date().toLocaleDateString()}] ${note}`
        },
        req.auth!.tenant.id
      );

      await db.contactsRepo.addTimelineEvent({
        contactId: contact.id,
        tenantId: req.auth!.tenant.id,
        eventType: 'NOTE_ADDED',
        actor: req.auth!.user.name,
        actorId: req.auth!.user.id,
        actorName: req.auth!.user.name,
        description: `Added note: "${note.substring(0, 80)}${note.length > 80 ? '...' : ''}"`
      });

      res.json({ data: updated });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

// ---------------- 5. Contact Import & Data Quality Pipeline ----------------
api.post('/imports/preview', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rawData, columnMapping, defaultCountry = 'IN' } = req.body;
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return res.status(400).json({ error: { message: 'Invalid or empty rawData array' } });
    }

    const existingContacts = await db.contactsRepo.findAll(req.auth!.tenant.id);
    const existingPhones = new Set(existingContacts.map(c => c.phone));
    const existingEmails = new Set(existingContacts.map(c => c.email.toLowerCase()).filter(Boolean));

    const seenInBatchPhones = new Set<string>();
    const seenInBatchEmails = new Set<string>();

    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;
    let warningRows = 0;

    const issues: any[] = [];
    const processedRows: any[] = [];

    rawData.forEach((row: Record<string, string>, index: number) => {
      const rowNum = index + 1;
      const name = sanitizeSpreadsheetCell(row[columnMapping?.name] || `${row[columnMapping?.firstName] || ''} ${row[columnMapping?.lastName] || ''}`.trim() || 'Unknown');
      const rawPhone = row[columnMapping?.phone] || '';
      const rawEmail = row[columnMapping?.email] || '';
      const company = sanitizeSpreadsheetCell(row[columnMapping?.company] || '');
      const city = sanitizeSpreadsheetCell(row[columnMapping?.city] || '');

      const phoneNorm = DataQualityEngine.normalizePhone(rawPhone, defaultCountry);
      const emailNorm = DataQualityEngine.normalizeEmail(rawEmail);

      let isDuplicate = false;
      let isInvalid = false;
      let hasWarning = false;

      if (!phoneNorm.isValid) {
        isInvalid = true;
        issues.push({ rowNumber: rowNum, field: 'phone', value: rawPhone, error: phoneNorm.error || 'Invalid phone number', severity: 'ERROR' });
      } else if (phoneNorm.isLandline) {
        hasWarning = true;
        issues.push({ rowNumber: rowNum, field: 'phone', value: rawPhone, error: 'Landline detected - WhatsApp will not be deliverable', severity: 'WARNING' });
      }

      if (rawEmail && !emailNorm.isValid) {
        hasWarning = true;
        issues.push({ rowNumber: rowNum, field: 'email', value: rawEmail, error: emailNorm.error || 'Invalid email format', severity: 'WARNING' });
      }

      const canonicalPhone = phoneNorm.canonical;
      const canonicalEmail = emailNorm.canonical;
      if (
        (canonicalPhone && existingPhones.has(canonicalPhone)) ||
        (canonicalPhone && seenInBatchPhones.has(canonicalPhone)) ||
        (canonicalEmail && existingEmails.has(canonicalEmail)) ||
        (canonicalEmail && seenInBatchEmails.has(canonicalEmail))
      ) {
        isDuplicate = true;
        duplicateRows++;
        issues.push({ rowNumber: rowNum, field: 'phone/email', value: `${canonicalPhone || ''} ${canonicalEmail || ''}`.trim(), error: 'Duplicate contact detected in database or file', severity: 'INFO' });
      }

      if (canonicalPhone) seenInBatchPhones.add(canonicalPhone);
      if (canonicalEmail) seenInBatchEmails.add(canonicalEmail);

      if (isInvalid) invalidRows++;
      else if (hasWarning) warningRows++;
      else validRows++;

      processedRows.push({
        rowNumber: rowNum,
        name,
        company,
        phone: phoneNorm.canonical || rawPhone,
        email: emailNorm.canonical || rawEmail,
        city,
        isPhoneValid: phoneNorm.isValid,
        isEmailValid: rawEmail ? emailNorm.isValid : true,
        isDuplicate,
        status: isInvalid ? 'INVALID' : isDuplicate ? 'DUPLICATE' : 'READY',
        original: row
      });
    });

    res.json({
      data: {
        report: {
          totalRows: rawData.length,
          validRows,
          invalidRows,
          duplicateRows,
          warningRows,
          issues: issues.slice(0, 100)
        },
        sampleProcessed: processedRows.slice(0, 50),
        processedRows: processedRows
      }
    });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});

api.post(
  '/imports/commit',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { 
        rows, 
        duplicatePolicy = 'UPDATE_EXISTING', 
        sourceFileName = 'imported_contacts.csv',
        leadStatus = 'LEAD',
        targetListId
      } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: { message: 'No contact rows provided to import' } });
      }

      const E164_REGEX = /^\+[1-9][0-9]{7,14}$/;

      // Filter rows based on duplicate policy and validity
      const targetRows = rows.filter((r: any) => {
        if (!r || !r.phone || String(r.phone).trim().length === 0) return false;
        if (r.status === 'INVALID') return false;
        if (duplicatePolicy === 'SKIP' && r.isDuplicate) return false;

        const norm = DataQualityEngine.normalizePhone(String(r.phone));
        if (!norm.canonical || !E164_REGEX.test(norm.canonical)) return false;
        return true;
      });

      const contactsToInsert: Array<Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>> = targetRows.map((r: any) => {
        const norm = DataQualityEngine.normalizePhone(String(r.phone));
        const canonicalPhone = norm.canonical;

        return {
          tenantId: req.auth!.tenant.id,
          firstName: sanitizeSpreadsheetCell(r.name ? r.name.split(' ')[0] : 'Unknown'),
          lastName: sanitizeSpreadsheetCell(r.name ? r.name.split(' ').slice(1).join(' ') : ''),
          displayName: sanitizeSpreadsheetCell(r.name || 'Unknown'),
          companyName: sanitizeSpreadsheetCell(r.company || ''),
          jobTitle: sanitizeSpreadsheetCell(r.jobTitle || 'Buyer'),
          phone: canonicalPhone,
          email: r.email || '',
          city: sanitizeSpreadsheetCell(r.city || ''),
          state: r.state || 'Telangana',
          country: r.country || 'India',
          status: 'ACTIVE',
          source: sourceFileName,
          leadStatus: leadStatus || 'LEAD',
          notes: `Imported via ${sourceFileName} with duplicate policy ${duplicatePolicy}`,
          tags: ['IMPORTED', ...(r.city ? [String(r.city).toUpperCase()] : []), ...(leadStatus !== 'LEAD' ? [leadStatus.toUpperCase()] : [])],
          customFields: r.customFields || {},
          channelAddresses: [
            { id: `addr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, channelType: 'WHATSAPP', address: canonicalPhone, isPrimary: true, isVerified: norm.isMobile },
            { id: `addr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, channelType: 'EMAIL', address: r.email, isPrimary: true, isVerified: !!r.email }
          ],
          preferences: {
            WHATSAPP: { channel: 'WHATSAPP', marketingAllowed: norm.isMobile, transactionalAllowed: true },
            EMAIL: { channel: 'EMAIL', marketingAllowed: true, transactionalAllowed: true },
            SMS: { channel: 'SMS', marketingAllowed: true, transactionalAllowed: true }
          },
          isGloballyBlocked: false
        };
      });

      const result = await db.contactsRepo.bulkCreate(contactsToInsert);

      // If a target audience segment list was specified, map the imported contacts to it in PostgreSQL
      if (targetListId) {
        try {
          const insertedPhones = contactsToInsert.map(c => c.phone);
          const client = (db as any).getClient();
          const { data: matchedContacts } = await client
            .from('contacts')
            .select('id')
            .eq('tenant_id', req.auth!.tenant.id)
            .in('phone', insertedPhones);

          if (matchedContacts && matchedContacts.length > 0) {
            const memberRows = matchedContacts.map((c: any) => ({
              tenant_id: req.auth!.tenant.id,
              list_id: targetListId,
              contact_id: c.id
            }));
            const CHUNK = 200;
            for (let i = 0; i < memberRows.length; i += CHUNK) {
              const chunk = memberRows.slice(i, i + CHUNK);
              await client
                .from('contact_list_members')
                .upsert(chunk, { onConflict: 'tenant_id, list_id, contact_id', ignoreDuplicates: true });
            }
          }
        } catch (linkErr) {
          console.warn('Failed to link imported contacts to target list:', linkErr);
        }
      }

      await logAudit('CONTACT_IMPORTED', 'IMPORT', `imp-${Date.now()}`, { count: contactsToInsert.length, targetListId, leadStatus, ...result }, req);

      res.json({ data: result });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

// ---------------- 6. Contact Lists & Segments ----------------
api.get('/contact-lists', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const lists = await db.contactListsRepo.findAll(req.auth!.tenant.id);
    res.json({ data: lists });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});

api.post(
  '/contact-lists',
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description, type, rules, contactIds } = req.body;
      const list = await db.contactListsRepo.create({
        tenantId: req.auth!.tenant.id,
        name: sanitizeSpreadsheetCell(name),
        description: sanitizeSpreadsheetCell(description || ''),
        type: type || 'STATIC',
        rules,
        contactIds: contactIds || []
      });

      await logAudit('LIST_CREATED', 'WORKSPACE', list.id, { name }, req);
      res.json({ data: list });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

api.post(
  '/contact-lists/:id/members',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { contactIds } = req.body;
      const listId = req.params.id;
      const tenantId = req.auth!.tenant.id;
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: { message: 'No contact IDs provided' } });
      }

      const client = (db as any).getClient();
      const memberRows = contactIds.map(cid => ({
        tenant_id: tenantId,
        list_id: listId,
        contact_id: cid
      }));

      // Chunked insert into junction table
      const CHUNK = 200;
      for (let i = 0; i < memberRows.length; i += CHUNK) {
        const chunk = memberRows.slice(i, i + CHUNK);
        await client
          .from('contact_list_members')
          .upsert(chunk, { onConflict: 'tenant_id, list_id, contact_id', ignoreDuplicates: true });
      }

      await logAudit('LIST_MEMBERS_ADDED', 'WORKSPACE', listId, { count: contactIds.length }, req);
      res.json({ success: true, count: contactIds.length });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

// ---------------- 7. Message Templates (with Versioning) ----------------
api.get('/templates', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templates = await db.templatesRepo.findAll(req.auth!.tenant.id);
    res.json({ data: templates });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});

api.post(
  '/templates',
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, channel, subject, body, attachmentName, category } = req.body;
      const vars = Array.from(new Set((body.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || []).map((m: string) => m.replace(/[\{\}]/g, '').trim())));

      const template = await db.templatesRepo.create({
        tenantId: req.auth!.tenant.id,
        name,
        channel: channel || 'WHATSAPP',
        subject: subject || '',
        body,
        availableVariables: vars as string[],
        attachmentName,
        category: category || 'INTRODUCTION',
        createdBy: req.auth!.user.id
      });

      await logAudit('TEMPLATE_CREATED', 'TEMPLATE', template.id, { name, version: template.version }, req);
      res.json({ data: template });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

// Helper: Synchronize a campaign and all non-sent recipients with an updated template
async function syncCampaignRecipientsWithTemplate(
  campaignId: string,
  tenantId: string,
  template: any
): Promise<number> {
  const client = (db as any).getClient();

  // 1. Update the campaign's templateSnapshot and version
  await db.campaignsRepo.update(
    campaignId,
    {
      templateSnapshot: template,
      templateVersion: template.version
    },
    tenantId
  );

  // 2. Fetch all active/pending recipients for this campaign
  const { data: recipients, error: recError } = await client
    .from('campaign_recipients')
    .select('id, contact_id, channel')
    .eq('campaign_id', campaignId)
    .in('status', ['READY', 'QUEUED', 'OPENED']);

  if (recError || !recipients || recipients.length === 0) return 0;

  // 3. Batch fetch corresponding contacts
  const contactIds = Array.from(new Set(recipients.map((r: any) => r.contact_id)));
  const contactsMap = new Map<string, any>();

  const CHUNK = 200;
  for (let i = 0; i < contactIds.length; i += CHUNK) {
    const chunkIds = contactIds.slice(i, i + CHUNK);
    const { data: contactsData } = await client
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('id', chunkIds);
    if (contactsData) {
      contactsData.forEach((c: any) => contactsMap.set(c.id, c));
    }
  }

  // 4. Resolve template variables for each recipient
  const updates: Array<{ id: string; resolved_message: string; resolved_subject?: string; attachment_name?: string }> = [];
  for (const r of recipients) {
    const c = contactsMap.get(r.contact_id);
    if (!c) continue;

    const contactData: Record<string, string> = {
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      name: c.display_name || '',
      company_name: c.company_name || '',
      company: c.company_name || '',
      city: c.city || '',
      state: c.state || '',
      phone: c.phone || '',
      email: c.email || '',
      ...(c.custom_fields || {})
    };

    const { resolved } = DataQualityEngine.resolveTemplateVariables(template.body, contactData);
    const resolvedSub = template.subject
      ? DataQualityEngine.resolveTemplateVariables(template.subject, contactData).resolved
      : undefined;

    updates.push({
      id: r.id,
      resolved_message: resolved,
      resolved_subject: resolvedSub,
      attachment_name: template.attachmentName
    });
  }

  // 5. Update recipients in chunks of 50
  const UPDATE_CHUNK = 50;
  for (let i = 0; i < updates.length; i += UPDATE_CHUNK) {
    const chunk = updates.slice(i, i + UPDATE_CHUNK);
    await Promise.all(
      chunk.map(u =>
        client
          .from('campaign_recipients')
          .update({
            resolved_message: u.resolved_message,
            resolved_subject: u.resolved_subject,
            attachment_name: u.attachment_name,
            updated_at: new Date().toISOString()
          })
          .eq('id', u.id)
      )
    );
  }

  return updates.length;
}

api.put(
  '/templates/:id',
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await db.templatesRepo.update(req.params.id, req.body, req.auth!.tenant.id);
      const tenantId = req.auth!.tenant.id;
      const client = (db as any).getClient();

      // Automatically cascade updated template body/subject to all active/draft/review/paused campaigns using this template
      const { data: affectedCampaigns } = await client
        .from('campaigns')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('template_id', req.params.id)
        .neq('status', 'COMPLETED');

      let syncedRecipientsCount = 0;
      if (affectedCampaigns && affectedCampaigns.length > 0) {
        for (const camp of affectedCampaigns) {
          syncedRecipientsCount += await syncCampaignRecipientsWithTemplate(camp.id, tenantId, updated);
        }
      }

      await logAudit('TEMPLATE_UPDATED', 'TEMPLATE', updated.id, { 
        name: updated.name, 
        newVersion: updated.version,
        affectedCampaignsCount: affectedCampaigns?.length || 0,
        syncedRecipientsCount
      }, req);

      res.json({ data: updated, syncedCampaignsCount: affectedCampaigns?.length || 0, syncedRecipientsCount });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

api.delete(
  '/templates/:id',
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await db.templatesRepo.delete(req.params.id, req.auth!.tenant.id);
      res.json({ success: true });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

// ---------------- 8. Campaigns & State Machine Execution ----------------
api.get('/campaigns', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaigns = await db.campaignsRepo.findAll(req.auth!.tenant.id);
    res.json({ data: campaigns });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});

api.get('/campaigns/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaign = await db.campaignsRepo.findById(req.params.id, req.auth!.tenant.id);
    if (!campaign) return res.status(404).json({ error: { message: 'Campaign not found' } });
    const recipients = await db.campaignsRepo.getRecipients(campaign.id);
    res.json({ data: { campaign, recipients } });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});

api.post(
  '/campaigns',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description, channel, targetListId, templateId, isDryRun } = req.body;

      const tenantId = req.auth!.tenant.id;

      // 1. Concurrently fetch template, target list, and ONLY the target list contacts (SQL junction filtered)
      const [template, targetList, targetContacts] = await Promise.all([
        db.templatesRepo.findById(templateId, tenantId),
        db.contactListsRepo.findById(targetListId, tenantId),
        db.contactsRepo.findAll(tenantId, undefined, undefined, targetListId)
      ]);

      if (!template) return res.status(400).json({ error: { message: 'Template not found' } });
      if (!targetList) return res.status(400).json({ error: { message: 'Target list not found' } });

      // 2. Create campaign with pre-calculated recipientsCount in one single write
      const campaign = await db.campaignsRepo.create({
        tenantId,
        name,
        description: description || '',
        channel: channel || template.channel,
        status: 'DRAFT',
        targetListId,
        targetListName: targetList.name,
        templateId: template.id,
        templateVersion: template.version,
        templateSnapshot: {
          name: template.name,
          subject: template.subject,
          body: template.body,
          attachmentName: template.attachmentName
        },
        isDryRun: !!isDryRun,
        createdBy: req.auth!.user.id,
        assignedOperator: req.auth!.user.id,
        recipientsCount: targetContacts.length
      });

      // 3. Resolve template variables for recipients
      const recipientEntries: Array<Omit<CampaignRecipient, 'id' | 'createdAt'>> = [];
      for (const c of targetContacts) {
        const contactData: Record<string, string> = {
          first_name: c.firstName,
          last_name: c.lastName,
          name: c.displayName,
          company_name: c.companyName,
          company: c.companyName,
          city: c.city,
          state: c.state,
          phone: c.phone,
          email: c.email,
          ...c.customFields
        };

        const { resolved } = DataQualityEngine.resolveTemplateVariables(template.body, contactData);
        const resolvedSub = template.subject ? DataQualityEngine.resolveTemplateVariables(template.subject, contactData).resolved : undefined;

        recipientEntries.push({
          tenantId,
          campaignId: campaign.id,
          contactId: c.id,
          contactName: c.displayName,
          companyName: c.companyName,
          channel: campaign.channel,
          channelAddress: campaign.channel === 'WHATSAPP' ? c.phone : c.email,
          resolvedMessage: resolved,
          resolvedSubject: resolvedSub,
          attachmentName: template.attachmentName,
          status: 'READY'
        });
      }

      // 4. Batch insert recipients and log audit concurrently
      await Promise.all([
        db.campaignsRepo.addRecipients(recipientEntries, tenantId),
        logAudit('CAMPAIGN_CREATED', 'CAMPAIGN', campaign.id, { name, recipients: recipientEntries.length }, req)
      ]);

      res.json({ data: campaign });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

api.post('/campaigns/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { newStatus } = req.body;
    const user = req.auth!.user;
    const campaign = await db.campaignsRepo.findById(req.params.id, req.auth!.tenant.id);
    if (!campaign) return res.status(404).json({ error: { message: 'Campaign not found' } });

    const VALID_TRANSITIONS: Record<string, string[]> = {
      DRAFT: ['REVIEW'],
      REVIEW: ['DRAFT', 'APPROVED'],
      APPROVED: ['ACTIVE'],
      ACTIVE: ['PAUSED', 'COMPLETED'],
      PAUSED: ['ACTIVE', 'COMPLETED'],
      COMPLETED: []
    };

    const allowed = VALID_TRANSITIONS[campaign.status] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({
        error: {
          code: 'ILLEGAL_CAMPAIGN_STATE_TRANSITION',
          message: `Illegal transition from ${campaign.status} to ${newStatus}. Permitted transitions: ${allowed.join(', ') || 'None'}`
        }
      });
    }

    if (newStatus === 'APPROVED' && !['OWNER', 'ADMIN', 'MANAGER'].includes(req.auth!.role)) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_ROLE_PERMISSIONS',
          message: 'Only Managers, Admins, or Owners can approve campaigns. Operators cannot self-approve.'
        }
      });
    }

    if (newStatus === 'COMPLETED' && !['OWNER', 'ADMIN', 'MANAGER'].includes(req.auth!.role)) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_ROLE_PERMISSIONS',
          message: 'Only Managers, Admins, or Owners can mark a campaign completed.'
        }
      });
    }

    const updates: Partial<typeof campaign> = { status: newStatus };
    if (newStatus === 'APPROVED') {
      updates.approvedBy = user.id;
      updates.approvedAt = new Date().toISOString();
    } else if (newStatus === 'DRAFT') {
      updates.approvedBy = null as any;
      updates.approvedAt = null as any;
    } else if (newStatus === 'ACTIVE' && !campaign.startedAt) {
      updates.startedAt = new Date().toISOString();
    } else if (newStatus === 'COMPLETED') {
      updates.completedAt = new Date().toISOString();
    }

    const updated = await db.campaignsRepo.update(campaign.id, updates, req.auth!.tenant.id);
    await logAudit(`CAMPAIGN_${newStatus}`, 'CAMPAIGN', campaign.id, { previous: campaign.status, new: newStatus }, req);
    res.json({ data: updated });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});

api.delete(
  '/campaigns/:id',
  requireRole(['OWNER', 'ADMIN', 'MANAGER']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaign = await db.campaignsRepo.findById(req.params.id, req.auth!.tenant.id);
      if (!campaign) {
        return res.json({ success: true, message: 'Campaign already deleted' });
      }

      await db.campaignsRepo.delete(req.params.id, req.auth!.tenant.id);
      await logAudit('CAMPAIGN_DELETED', 'CAMPAIGN', req.params.id, { name: campaign.name }, req);
      res.json({ success: true });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

api.post(
  '/campaigns/:id/sync-template',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaign = await db.campaignsRepo.findById(req.params.id, req.auth!.tenant.id);
      if (!campaign) return res.status(404).json({ error: { message: 'Campaign not found' } });
      if (!campaign.templateId) return res.status(400).json({ error: { message: 'Campaign has no linked template' } });

      const template = await db.templatesRepo.findById(campaign.templateId, req.auth!.tenant.id);
      if (!template) return res.status(404).json({ error: { message: 'Linked template not found' } });

      const updatedCount = await syncCampaignRecipientsWithTemplate(campaign.id, req.auth!.tenant.id, template);
      const updatedCampaign = await db.campaignsRepo.findById(campaign.id, req.auth!.tenant.id);
      const recipients = await db.campaignsRepo.getRecipients(campaign.id);

      await logAudit('CAMPAIGN_TEMPLATE_SYNCED', 'CAMPAIGN', campaign.id, { 
        templateId: template.id, 
        version: template.version,
        recipientsUpdated: updatedCount 
      }, req);

      res.json({ data: { ...updatedCampaign, recipients, updatedCount } });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

// ---------------- 9. Manual Sending Workspace Engine ----------------
api.post(
  '/campaigns/:id/recipients/:recipientId/prepare',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: campaignId, recipientId } = req.params;
      const campaign = await db.campaignsRepo.findById(campaignId, req.auth!.tenant.id);
      const recipient = await db.campaignsRepo.getRecipientById(recipientId);

      if (!campaign || !recipient) {
        return res.status(404).json({ error: { message: 'Campaign or recipient not found' } });
      }

      const contact = await db.contactsRepo.findById(recipient.contactId, req.auth!.tenant.id);
      if (!contact) return res.status(404).json({ error: { message: 'Contact not found' } });

      const policyResult = CommunicationPolicyEngine.evaluate({
        tenant: req.auth!.tenant,
        contact,
        channel: recipient.channel,
        actorRole: req.auth!.role,
        rawTemplateText: campaign.templateSnapshot.body,
        isMarketingCampaign: true
      });

      if (!policyResult.canSend) {
        await db.campaignsRepo.updateRecipient(recipientId, {
          status: contact.isGloballyBlocked ? 'BLOCKED' : 'OPTED_OUT',
          policyNotes: policyResult.primaryBlockReason
        });

        return res.status(400).json({
          error: {
            code: 'COMMUNICATION_BLOCKED',
            message: policyResult.primaryBlockReason || 'Communication prohibited by policy',
            policyResult
          }
        });
      }

      await db.campaignsRepo.updateRecipient(recipientId, {
        claimedByOperator: req.auth!.user.id,
        claimedAt: new Date().toISOString()
      });

      let prepared;
      if (recipient.channel === 'WHATSAPP') {
        prepared = whatsAppChannel.prepareMessage({
          recipientId: recipient.id,
          recipientName: recipient.contactName,
          address: recipient.channelAddress,
          body: recipient.resolvedMessage,
          attachmentName: recipient.attachmentName
        });
      } else {
        prepared = emailChannel.prepareMessage({
          recipientId: recipient.id,
          recipientName: recipient.contactName,
          address: recipient.channelAddress,
          body: recipient.resolvedMessage,
          subject: recipient.resolvedSubject,
          attachmentName: recipient.attachmentName
        });
      }

      await db.campaignsRepo.updateRecipient(recipientId, {
        status: 'OPENED',
        openedAt: new Date().toISOString()
      });

      await db.contactsRepo.addTimelineEvent({
        contactId: contact.id,
        tenantId: req.auth!.tenant.id,
        eventType: recipient.channel === 'WHATSAPP' ? 'WHATSAPP_OPENED' : 'EMAIL_OPENED',
        actor: req.auth!.user.name,
        actorId: req.auth!.user.id,
        actorName: req.auth!.user.name,
        campaignName: campaign.name,
        description: `Official ${recipient.channel} composer opened for manual review`
      });

      await logAudit('CHANNEL_OPENED', 'CONTACT', contact.id, { channel: recipient.channel, campaignId }, req);

      res.json({ data: { prepared, policyResult } });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

api.post(
  '/campaigns/:id/recipients/:recipientId/mark-sent',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: campaignId, recipientId } = req.params;
      const campaign = await db.campaignsRepo.findById(campaignId, req.auth!.tenant.id);
      const recipient = await db.campaignsRepo.getRecipientById(recipientId);

      if (!campaign || !recipient) return res.status(404).json({ error: { message: 'Not found' } });

      const now = new Date().toISOString();
      const updatedRecipient = await db.campaignsRepo.updateRecipient(recipientId, {
        status: 'USER_SENT',
        userSentAt: now
      });

      // Asynchronous background persistence for contact metrics, timeline, and audit
      (async () => {
        try {
          const contact = await db.contactsRepo.findById(recipient.contactId, req.auth!.tenant.id);
          if (contact) {
            await db.contactsRepo.update(
              contact.id,
              {
                lastInteractionAt: now,
                lastMessageSentAt: now
              },
              req.auth!.tenant.id
            );
            await db.contactsRepo.addTimelineEvent({
              contactId: contact.id,
              tenantId: req.auth!.tenant.id,
              eventType: 'USER_MARKED_SENT',
              actor: req.auth!.user.name,
              actorId: req.auth!.user.id,
              actorName: req.auth!.user.name,
              campaignName: campaign.name,
              description: `Operator confirmed message sent via ${recipient.channel} to ${recipient.channelAddress}`
            });
          }
          await logAudit('MESSAGE_MARKED_SENT', 'CONTACT', recipient.contactId, { campaignId, channel: recipient.channel }, req);
        } catch (bgErr) {
          console.warn('Background mark-sent telemetry error:', bgErr);
        }
      })();

      res.json({ data: updatedRecipient });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

api.post(
  '/campaigns/:id/recipients/:recipientId/skip',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { recipientId } = req.params;
      const { reason = 'Skipped by operator' } = req.body;
      const updated = await db.campaignsRepo.updateRecipient(recipientId, {
        status: 'SKIPPED',
        skippedAt: new Date().toISOString(),
        skipReason: reason
      });
      res.json({ data: updated });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

api.post(
  '/campaigns/:id/send-test',
  requireRole(['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { testPhone = '+919999988888', testName = 'Test Recipient' } = req.body;
      const campaign = await db.campaignsRepo.findById(req.params.id, req.auth!.tenant.id);
      if (!campaign) return res.status(404).json({ error: { message: 'Campaign not found' } });

      const sampleData = {
        first_name: testName.split(' ')[0],
        company_name: 'ReachOut OS Test Lab',
        city: 'Hyderabad',
        phone: testPhone
      };

      const { resolved } = DataQualityEngine.resolveTemplateVariables(campaign.templateSnapshot.body, sampleData);
      const prepared = whatsAppChannel.prepareMessage({
        recipientId: 'test-recipient',
        recipientName: testName,
        address: testPhone,
        body: resolved,
        attachmentName: campaign.templateSnapshot.attachmentName
      });

      res.json({ data: { prepared, sampleData } });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);

// ---------------- 10. AI Copilot (Gemini 3.8 Flash via @google/genai) ----------------
api.post('/ai/generate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await AICopilotService.generateDrafts(req.body);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message || 'AI Generation failed' } });
  }
});

api.post('/ai/personalize', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await AICopilotService.personalize(req.body);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message || 'AI Personalization failed' } });
  }
});

api.post('/ai/rewrite', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await AICopilotService.rewrite(req.body);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message || 'AI Rewrite failed' } });
  }
});

api.post('/ai/guardrails', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await AICopilotService.checkGuardrails(req.body.message || '');
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message || 'AI Guardrails check failed' } });
  }
});

// ---------------- 11. Audit Logs & System Stats (Scoped to Tenant in PostgreSQL) ----------------
api.get('/audit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await db.auditRepo.findAll(req.auth!.tenant.id, limit);
    res.json({ data: logs });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});

api.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const contacts = await db.contactsRepo.findAll(req.auth!.tenant.id);
    const campaigns = await db.campaignsRepo.findAll(req.auth!.tenant.id);
    const templates = await db.templatesRepo.findAll(req.auth!.tenant.id);
    const lists = await db.contactListsRepo.findAll(req.auth!.tenant.id);
    const tenant = await db.tenantRepo.getTenant(req.auth!.tenant.id);

    let totalRecipients = 0;
    let totalOpened = 0;
    let totalSent = 0;
    let totalSkipped = 0;
    let totalBlocked = 0;

    campaigns.forEach(c => {
      totalRecipients += c.recipientsCount || 0;
      totalOpened += c.openedCount || 0;
      totalSent += c.sentCount || 0;
      totalSkipped += c.skippedCount || 0;
      totalBlocked += c.blockedCount || 0;
    });

    res.json({
      data: {
        totalContacts: contacts.length,
        activeCampaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
        totalCampaigns: campaigns.length,
        totalTemplates: templates.length,
        totalLists: lists.length,
        totalRecipients,
        totalOpened,
        totalSent,
        totalSkipped,
        totalBlocked,
        pendingCount: totalRecipients - (totalSent + totalSkipped + totalBlocked),
        isKillSwitchActive: tenant?.isKillSwitchActive || false
      }
    });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});

// Mount versioned API routes (supporting /api/v1 as well as /v1 and /api)
app.use('/api/v1', api);
app.use('/v1', api);
app.use('/api', api);

// Direct health endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: db.isConfigured ? 'HEALTHY' : 'DATABASE_UNCONFIGURED',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: 'SUPABASE_POSTGRESQL',
    isDatabaseConfigured: db.isConfigured,
    message: db.isConfigured
      ? 'Connected to authoritative Supabase PostgreSQL database.'
      : 'Supabase database credentials missing.'
  });
});

// Detect serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = Boolean(
  process.env.IS_SERVERLESS ||
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.VERCEL_REGION ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);

// ================= VITE DEV / STATIC SERVING =================
export async function startServer(port = PORT) {
  if (isServerless) return;

  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  return app.listen(port, () => {
    console.log(`[ReachOut OS Server] Running on http://localhost:${port}`);
  });
}

// Only start the standalone HTTP listener when running as a direct process (e.g. `npm run dev`)
if (process.env.NODE_ENV !== 'test' && !isServerless) {
  startServer().catch(err => {
    console.error('[ReachOut OS Server] Failed to start:', err);
  });
}

export { app, api };
