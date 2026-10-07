import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import {
  Contact,
  ContactList,
  Campaign,
  CampaignRecipient,
  MessageTemplate,
  AuditLogEntry,
  Tenant,
  User,
  TimelineEvent,
  Role,
  ChannelType
} from '../../types';
import {
  IContactRepository,
  ICampaignRepository,
  ITemplateRepository,
  IContactListRepository,
  IAuditRepository,
  ITenantRepository
} from './repositoryInterfaces';

export class DatabaseUnconfiguredError extends Error {
  code = 'DATABASE_UNCONFIGURED';
  constructor(message = 'Supabase PostgreSQL database is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in environment secrets.') {
    super(message);
    this.name = 'DatabaseUnconfiguredError';
  }
}

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: Role;
  createdAt: string;
}

export class SupabaseDatabaseAdapter {
  private client: SupabaseClient | null = null;
  public readonly isConfigured: boolean;

  constructor(config?: { url?: string; key?: string; forceUnconfigured?: boolean }) {
    const defaultUrl = 'https://cxzynykcdxadhhkjsmgs.supabase.co';
    const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4enlueWtjZHhhZGhoa2pzbWdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNjU3ODQsImV4cCI6MjEwNjg0MTc4NH0.agjrQeFqscfKF5aN9rUkl4sgL1J_mjU7il3sL6olTjI';
    const rawUrl = config?.url || process.env.SUPABASE_URL || defaultUrl;
    const supabaseUrl = config?.forceUnconfigured ? undefined : (rawUrl.includes('your-project-ref') ? defaultUrl : rawUrl);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('your-supabase') ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined;
    const rawKey = config?.key || serviceKey || process.env.SUPABASE_ANON_KEY || defaultKey;
    const supabaseKey = config?.forceUnconfigured ? undefined : (rawKey.includes('your-supabase') ? defaultKey : rawKey);

    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project-ref') && !supabaseKey.includes('your-supabase')) {
      this.client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      this.isConfigured = true;
      console.log(`[SupabaseDatabaseAdapter] Connected to Supabase PostgreSQL at ${supabaseUrl}`);
    } else {
      this.client = null;
      this.isConfigured = false;
      console.warn('[SupabaseDatabaseAdapter] WARNING: Supabase credentials not configured in environment. Database operations will reject cleanly.');
    }
  }

  private getClient(): SupabaseClient {
    if (!this.client || !this.isConfigured) {
      throw new DatabaseUnconfiguredError();
    }
    return this.client;
  }

  // ============================================================================
  // CONTACTS REPOSITORY (PostgreSQL backed, strict tenant scoping)
  // ============================================================================
  contactsRepo: IContactRepository = {
    findAll: async (tenantId: string, search?: string, tag?: string, listId?: string, status?: string) => {
      const client = this.getClient();

      let listMemberIds: string[] | null = null;
      if (listId) {
        // Query normalized junction table contact_list_members
        const { data: listMembers, error: listErr } = await client
          .from('contact_list_members')
          .select('contact_id')
          .eq('list_id', listId)
          .eq('tenant_id', tenantId);
        if (listErr) throw listErr;
        if (listMembers && listMembers.length > 0) {
          listMemberIds = listMembers.map((m: any) => m.contact_id);
        } else {
          return [];
        }
      }

      // Supabase / PostgREST limits single queries to 1,000 rows by default.
      // Auto-paginate in batches to retrieve all matching contacts without truncation.
      const allRows: any[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = client
          .from('contacts')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('display_name', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (search) {
          query = query.or(`display_name.ilike.%${search}%,company_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`);
        }
        if (tag) {
          query = query.contains('tags', [tag]);
        }
        if (status) {
          query = query.eq('status', status);
        }
        if (listMemberIds && listMemberIds.length > 0) {
          query = query.in('id', listMemberIds);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allRows.push(...data);
          if (data.length < PAGE_SIZE) {
            hasMore = false;
          } else {
            from += PAGE_SIZE;
          }
        } else {
          hasMore = false;
        }
      }

      return allRows.map(row => this.mapDbContactToDomain(row));
    },

    findById: async (id: string, tenantId?: string) => {
      const client = this.getClient();
      let query = client.from('contacts').select('*').eq('id', id);
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return this.mapDbContactToDomain(data);
    },

    create: async (contactData) => {
      const client = this.getClient();
      const insertPayload = {
        tenant_id: contactData.tenantId,
        first_name: contactData.firstName,
        last_name: contactData.lastName,
        display_name: contactData.displayName,
        company_name: contactData.companyName,
        job_title: contactData.jobTitle,
        phone: contactData.phone,
        email: contactData.email,
        city: contactData.city,
        state: contactData.state,
        country: contactData.country,
        status: contactData.status,
        source: contactData.source,
        lead_status: contactData.leadStatus,
        notes: contactData.notes,
        tags: contactData.tags,
        custom_fields: contactData.customFields,
        is_globally_blocked: contactData.isGloballyBlocked,
        blocked_reason: contactData.blockedReason
      };

      const { data, error } = await client
        .from('contacts')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;
      return this.mapDbContactToDomain(data);
    },

    update: async (id: string, updatesOrTenantId: any, tenantIdOrUpdates?: any) => {
      let updates: Partial<Contact>;
      let tenantId: string | undefined;
      if (typeof updatesOrTenantId === 'string') {
        tenantId = updatesOrTenantId;
        updates = tenantIdOrUpdates || {};
      } else {
        updates = updatesOrTenantId || {};
        tenantId = tenantIdOrUpdates;
      }

      const client = this.getClient();
      const dbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
      if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
      if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
      if (updates.companyName !== undefined) dbUpdates.company_name = updates.companyName;
      if (updates.jobTitle !== undefined) dbUpdates.job_title = updates.jobTitle;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.city !== undefined) dbUpdates.city = updates.city;
      if (updates.state !== undefined) dbUpdates.state = updates.state;
      if (updates.country !== undefined) dbUpdates.country = updates.country;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.leadStatus !== undefined) dbUpdates.lead_status = updates.leadStatus;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.customFields !== undefined) dbUpdates.custom_fields = updates.customFields;
      if (updates.isGloballyBlocked !== undefined) dbUpdates.is_globally_blocked = updates.isGloballyBlocked;
      if (updates.blockedReason !== undefined) dbUpdates.blocked_reason = updates.blockedReason;
      if (updates.lastInteractionAt !== undefined) dbUpdates.last_interaction_at = updates.lastInteractionAt;
      if (updates.lastMessageSentAt !== undefined) dbUpdates.last_message_sent_at = updates.lastMessageSentAt;

      let query = client.from('contacts').update(dbUpdates).eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);

      const { data, error } = await query.select().single();
      if (error) throw error;
      return this.mapDbContactToDomain(data);
    },

    delete: async (id: string, tenantId?: string) => {
      const client = this.getClient();
      // Clean up junction and child records to guarantee referential safety
      let clmQuery = client.from('contact_list_members').delete().eq('contact_id', id);
      if (tenantId) clmQuery = clmQuery.eq('tenant_id', tenantId);
      await clmQuery;

      let tmQuery = client.from('contact_timeline').delete().eq('contact_id', id);
      if (tenantId) tmQuery = tmQuery.eq('tenant_id', tenantId);
      await tmQuery;

      let crQuery = client.from('campaign_recipients').delete().eq('contact_id', id);
      if (tenantId) crQuery = crQuery.eq('tenant_id', tenantId);
      await crQuery;

      let query = client.from('contacts').delete().eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { error } = await query;
      if (error) throw error;
    },

    bulkCreate: async (contactsData) => {
      const client = this.getClient();
      const E164_REGEX = /^\+[1-9][0-9]{7,14}$/;
      const insertRows = contactsData
        .filter(c => c && c.phone && E164_REGEX.test(c.phone.trim()))
        .map(c => ({
          tenant_id: c.tenantId,
          first_name: c.firstName,
          last_name: c.lastName,
          display_name: c.displayName,
          company_name: c.companyName,
          job_title: c.jobTitle,
          phone: c.phone.trim(),
          email: c.email,
          city: c.city,
          state: c.state,
          country: c.country,
          status: c.status,
          source: c.source,
          lead_status: c.leadStatus || 'LEAD',
          notes: c.notes,
          tags: c.tags,
          custom_fields: c.customFields,
          is_globally_blocked: c.isGloballyBlocked
        }));

      // Deduplicate rows within this batch by (tenant_id, phone) to prevent PostgreSQL constraint collision
      const uniqueMap = new Map<string, any>();
      for (const row of insertRows) {
        const key = `${row.tenant_id}:${row.phone}`;
        uniqueMap.set(key, row);
      }
      const uniqueRows = Array.from(uniqueMap.values());

      let totalCreated = 0;
      const chunkSize = 200;
      for (let i = 0; i < uniqueRows.length; i += chunkSize) {
        const chunk = uniqueRows.slice(i, i + chunkSize);
        const { data, error } = await client
          .from('contacts')
          .upsert(chunk, { onConflict: 'tenant_id, phone' })
          .select('id');

        if (error) throw error;
        totalCreated += data ? data.length : chunk.length;
      }

      return {
        created: totalCreated,
        updated: 0,
        skipped: contactsData.length - uniqueRows.length
      };
    },

    addTimelineEvent: async (eventData) => {
      const client = this.getClient();

      // Resolve tenant_id
      let resolvedTenantId = eventData.tenantId;
      if (!resolvedTenantId) {
        const { data: c } = await client
          .from('contacts')
          .select('tenant_id')
          .eq('id', eventData.contactId)
          .maybeSingle();
        resolvedTenantId = c?.tenant_id || 'a0000000-0000-0000-0000-000000000001';
      }

      // Resolve actor_id (must be a valid UUID in tenant_members)
      let resolvedActorId = eventData.actorId;
      const isUuid = typeof resolvedActorId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedActorId);
      if (!isUuid) {
        const { data: member } = await client
          .from('tenant_members')
          .select('user_id')
          .eq('tenant_id', resolvedTenantId)
          .limit(1)
          .maybeSingle();
        resolvedActorId = member?.user_id || '7f2b33ed-ef19-44fc-a04d-1f54051b07c4';
      }

      const actorName = eventData.actorName || eventData.actor || 'System / Operator';

      const { data, error } = await client
        .from('contact_timeline')
        .insert({
          contact_id: eventData.contactId,
          tenant_id: resolvedTenantId,
          event_type: eventData.eventType,
          actor_id: resolvedActorId,
          actor_name: actorName,
          description: eventData.description,
          campaign_name: eventData.campaignName || null,
          metadata: eventData.metadata || {}
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        contactId: data.contact_id,
        tenantId: data.tenant_id,
        eventType: data.event_type,
        actor: data.actor_name,
        actorId: data.actor_id,
        actorName: data.actor_name,
        description: data.description,
        campaignName: data.campaign_name,
        metadata: data.metadata,
        createdAt: data.created_at
      };
    },

    getTimeline: async (contactId: string) => {
      const client = this.getClient();
      const { data, error } = await client
        .from('contact_timeline')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(d => ({
        id: d.id,
        contactId: d.contact_id,
        tenantId: d.tenant_id,
        eventType: d.event_type,
        actor: d.actor_name || d.actor || 'System',
        actorId: d.actor_id,
        actorName: d.actor_name,
        description: d.description,
        campaignName: d.campaign_name,
        metadata: d.metadata,
        createdAt: d.created_at
      }));
    }
  };

  // ============================================================================
  // CAMPAIGNS REPOSITORY (PostgreSQL backed, strict tenant scoping)
  // ============================================================================
  campaignsRepo: ICampaignRepository = {
    findAll: async (tenantId: string) => {
      const client = this.getClient();
      const { data, error } = await client
        .from('campaigns')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(this.mapDbCampaignToDomain);
    },

    findById: async (id: string, tenantId?: string) => {
      const client = this.getClient();
      let query = client.from('campaigns').select('*').eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return this.mapDbCampaignToDomain(data);
    },

    create: async (campaignData) => {
      const client = this.getClient();

      let createdBy = campaignData.createdBy;
      if (!createdBy) {
        const { data: member } = await client.from('tenant_members').select('user_id').eq('tenant_id', campaignData.tenantId).limit(1).maybeSingle();
        createdBy = member?.user_id;
      }

      const payload = {
        tenant_id: campaignData.tenantId,
        name: campaignData.name,
        description: campaignData.description || 'Standard Campaign',
        channel: campaignData.channel || 'WHATSAPP',
        status: campaignData.status || 'DRAFT',
        target_list_id: campaignData.targetListId || null,
        target_list_name: campaignData.targetListName || 'Default Audience',
        template_id: campaignData.templateId || null,
        template_version: campaignData.templateVersion || 1,
        template_snapshot: campaignData.templateSnapshot || { name: campaignData.name, body: '' },
        is_dry_run: campaignData.isDryRun ?? false,
        assigned_operator: campaignData.assignedOperator || createdBy,
        created_by: createdBy,
        recipients_count: 0,
        sent_count: 0,
        opened_count: 0,
        skipped_count: 0,
        blocked_count: 0
      };

      const { data, error } = await client
        .from('campaigns')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return this.mapDbCampaignToDomain(data);
    },

    update: async (id: string, updatesOrTenantId: any, tenantIdOrUpdates?: any) => {
      let updates: Partial<Campaign>;
      let tenantId: string | undefined;
      if (typeof updatesOrTenantId === 'string') {
        tenantId = updatesOrTenantId;
        updates = tenantIdOrUpdates || {};
      } else {
        updates = updatesOrTenantId || {};
        tenantId = tenantIdOrUpdates;
      }

      const client = this.getClient();
      const dbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.approvedBy !== undefined) {
        const isUuid = typeof updates.approvedBy === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updates.approvedBy);
        dbUpdates.approved_by = isUuid ? updates.approvedBy : null;
      }
      if (updates.approvedAt !== undefined) dbUpdates.approved_at = updates.approvedAt;
      if (updates.startedAt !== undefined) dbUpdates.started_at = updates.startedAt;
      if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt;
      if (updates.recipientsCount !== undefined) dbUpdates.recipients_count = updates.recipientsCount;
      if (updates.sentCount !== undefined) dbUpdates.sent_count = updates.sentCount;
      if (updates.openedCount !== undefined) dbUpdates.opened_count = updates.openedCount;
      if (updates.skippedCount !== undefined) dbUpdates.skipped_count = updates.skippedCount;
      if (updates.blockedCount !== undefined) dbUpdates.blocked_count = updates.blockedCount;

      let query = client.from('campaigns').update(dbUpdates).eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);

      const { data, error } = await query.select().single();
      if (error) throw error;
      return this.mapDbCampaignToDomain(data);
    },

    updateStatus: async (id: string, tenantId: string, status: any) => {
      return this.campaignsRepo.update(id, { status }, tenantId);
    },

    getRecipients: async (campaignId: string) => {
      const client = this.getClient();
      const allRows: any[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await client
          .from('campaign_recipients')
          .select('*')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (data && data.length > 0) {
          allRows.push(...data);
          if (data.length < PAGE_SIZE) {
            hasMore = false;
          } else {
            from += PAGE_SIZE;
          }
        } else {
          hasMore = false;
        }
      }

      return allRows.map(row => this.mapDbRecipientToDomain(row));
    },

    getRecipientById: async (recipientId: string) => {
      const client = this.getClient();
      const { data, error } = await client
        .from('campaign_recipients')
        .select('*')
        .eq('id', recipientId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return this.mapDbRecipientToDomain(data);
    },

    updateRecipient: async (recipientId: string, updates: Partial<CampaignRecipient>) => {
      const client = this.getClient();
      const dbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.claimedByOperator !== undefined) {
        const isUuid = typeof updates.claimedByOperator === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updates.claimedByOperator);
        dbUpdates.claimed_by_operator = isUuid ? updates.claimedByOperator : null;
      }
      if (updates.claimedAt !== undefined) dbUpdates.claimed_at = updates.claimedAt;
      if (updates.openedAt !== undefined) dbUpdates.opened_at = updates.openedAt;
      if (updates.userSentAt !== undefined) dbUpdates.user_sent_at = updates.userSentAt;
      if (updates.skippedAt !== undefined) dbUpdates.skipped_at = updates.skippedAt;
      if (updates.skipReason !== undefined) dbUpdates.skip_reason = updates.skipReason;
      if (updates.policyNotes !== undefined) dbUpdates.policy_notes = updates.policyNotes;

      const { data, error } = await client
        .from('campaign_recipients')
        .update(dbUpdates)
        .eq('id', recipientId)
        .select()
        .single();

      if (error) throw error;

      // Recalculate campaign metrics in database in parallel
      const campaignId = data.campaign_id;
      const [
        { count: sentCount },
        { count: openedCount },
        { count: skippedCount },
        { count: blockedCount }
      ] = await Promise.all([
        client.from('campaign_recipients').select('*', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'USER_SENT'),
        client.from('campaign_recipients').select('*', { count: 'exact', head: true }).eq('campaign_id', campaignId).in('status', ['OPENED', 'USER_SENT']),
        client.from('campaign_recipients').select('*', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'SKIPPED'),
        client.from('campaign_recipients').select('*', { count: 'exact', head: true }).eq('campaign_id', campaignId).in('status', ['BLOCKED', 'OPTED_OUT'])
      ]);

      await client.from('campaigns').update({
        sent_count: sentCount || 0,
        opened_count: openedCount || 0,
        skipped_count: skippedCount || 0,
        blocked_count: blockedCount || 0,
        updated_at: new Date().toISOString()
      }).eq('id', campaignId);

      return this.mapDbRecipientToDomain(data);
    },

    addRecipients: async (recipientsData: Array<Omit<CampaignRecipient, 'id' | 'createdAt'>>, tenantId?: string) => {
      if (!recipientsData || recipientsData.length === 0) return 0;
      const client = this.getClient();

      // Ensure tenant_id is always resolved
      let resolvedTenantId = tenantId;
      if (!resolvedTenantId && (recipientsData[0] as any)?.tenantId) {
        resolvedTenantId = (recipientsData[0] as any).tenantId;
      }
      if (!resolvedTenantId && recipientsData[0]?.campaignId) {
        const { data: camp } = await client
          .from('campaigns')
          .select('tenant_id')
          .eq('id', recipientsData[0].campaignId)
          .maybeSingle();
        if (camp?.tenant_id) {
          resolvedTenantId = camp.tenant_id;
        }
      }

      const insertRows = recipientsData.map(r => ({
        tenant_id: (r as any).tenantId || resolvedTenantId,
        campaign_id: r.campaignId,
        contact_id: r.contactId,
        contact_name: r.contactName,
        company_name: r.companyName || '',
        channel: r.channel,
        channel_address: r.channelAddress,
        resolved_message: r.resolvedMessage,
        resolved_subject: r.resolvedSubject,
        attachment_name: r.attachmentName,
        status: r.status || 'READY'
      }));

      // Insert in chunks of 250 to ensure reliable delivery even with 1,800+ recipients
      const CHUNK_SIZE = 250;
      let insertedCount = 0;
      for (let i = 0; i < insertRows.length; i += CHUNK_SIZE) {
        const chunk = insertRows.slice(i, i + CHUNK_SIZE);
        const { data, error } = await client
          .from('campaign_recipients')
          .insert(chunk)
          .select('id');

        if (error) throw error;
        insertedCount += data ? data.length : chunk.length;
      }

      return insertedCount;
    },

    delete: async (id: string, tenantId?: string) => {
      const client = this.getClient();
      // Delete recipients first to be explicit across all FK setups
      let recQuery = client.from('campaign_recipients').delete().eq('campaign_id', id);
      if (tenantId) recQuery = recQuery.eq('tenant_id', tenantId);
      await recQuery;

      let campQuery = client.from('campaigns').delete().eq('id', id);
      if (tenantId) campQuery = campQuery.eq('tenant_id', tenantId);
      const { error } = await campQuery;
      if (error) throw error;
    }
  };

  // ============================================================================
  // TEMPLATES REPOSITORY
  // ============================================================================
  templatesRepo: ITemplateRepository = {
    findAll: async (tenantId: string) => {
      const client = this.getClient();
      const { data, error } = await client
        .from('message_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(this.mapDbTemplateToDomain);
    },

    findById: async (id: string, tenantId?: string) => {
      const client = this.getClient();
      let query = client.from('message_templates').select('*').eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return this.mapDbTemplateToDomain(data);
    },

    create: async (data) => {
      const client = this.getClient();
      let createdBy = data.createdBy;
      if (!createdBy || typeof createdBy !== 'string' || createdBy.includes(' ')) {
        const { data: member } = await client.from('tenant_members').select('user_id').eq('tenant_id', data.tenantId).limit(1).maybeSingle();
        createdBy = member?.user_id || '7f2b33ed-ef19-44fc-a04d-1f54051b07c4';
      }

      const payload = {
        tenant_id: data.tenantId,
        name: data.name,
        channel: data.channel,
        subject: data.subject || '',
        body: data.body,
        version: 1,
        available_variables: data.availableVariables || [],
        attachment_name: data.attachmentName || null,
        attachment_size: data.attachmentSize || null,
        attachment_type: data.attachmentType || null,
        category: data.category || 'INTRODUCTION',
        created_by: createdBy
      };

      const { data: created, error } = await client
        .from('message_templates')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return this.mapDbTemplateToDomain(created);
    },

    update: async (id: string, updatesOrTenantId: any, tenantIdOrUpdates?: any) => {
      let updates: Partial<MessageTemplate>;
      let tenantId: string | undefined;
      if (typeof updatesOrTenantId === 'string') {
        tenantId = updatesOrTenantId;
        updates = tenantIdOrUpdates || {};
      } else {
        updates = updatesOrTenantId || {};
        tenantId = tenantIdOrUpdates;
      }

      const client = this.getClient();
      // Increment version on update
      const { data: existing, error: getErr } = await client.from('message_templates').select('version').eq('id', id).single();
      if (getErr) throw getErr;

      const nextVersion = (existing?.version || 1) + 1;
      const dbUpdates: Record<string, any> = {
        version: nextVersion,
        updated_at: new Date().toISOString()
      };

      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.subject !== undefined) dbUpdates.subject = updates.subject;
      if (updates.body !== undefined) dbUpdates.body = updates.body;
      if (updates.availableVariables !== undefined) dbUpdates.available_variables = updates.availableVariables;
      if (updates.attachmentName !== undefined) dbUpdates.attachment_name = updates.attachmentName;
      if (updates.category !== undefined) dbUpdates.category = updates.category;

      let query = client.from('message_templates').update(dbUpdates).eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);

      const { data, error } = await query.select().single();
      if (error) throw error;
      return this.mapDbTemplateToDomain(data);
    },

    delete: async (id: string, tenantId?: string) => {
      const client = this.getClient();
      let query = client.from('message_templates').delete().eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { error } = await query;
      if (error) throw error;
    }
  };

  // ============================================================================
  // CONTACT LISTS REPOSITORY (Junction Table contact_list_members Normalized)
  // ============================================================================
  contactListsRepo: IContactListRepository = {
    findAll: async (tenantId: string) => {
      const client = this.getClient();
      const { data, error } = await client
        .from('contact_lists')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const listIds = data.map(l => l.id);

      // Paginate contact_list_members retrieval to support large lists (1,800+ members)
      const allMembers: any[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: members, error: memErr } = await client
          .from('contact_list_members')
          .select('list_id, contact_id')
          .in('list_id', listIds)
          .range(from, from + PAGE_SIZE - 1);

        if (memErr) throw memErr;
        if (members && members.length > 0) {
          allMembers.push(...members);
          if (members.length < PAGE_SIZE) {
            hasMore = false;
          } else {
            from += PAGE_SIZE;
          }
        } else {
          hasMore = false;
        }
      }

      const memberMap = new Map<string, string[]>();
      allMembers.forEach((m: any) => {
        const arr = memberMap.get(m.list_id) || [];
        arr.push(m.contact_id);
        memberMap.set(m.list_id, arr);
      });

      return data.map(l => ({
        id: l.id,
        tenantId: l.tenant_id,
        name: l.name,
        description: l.description || '',
        type: l.type,
        rules: l.rules,
        contactIds: memberMap.get(l.id) || [],
        createdAt: l.created_at
      }));
    },

    findById: async (id: string, tenantId?: string) => {
      const client = this.getClient();
      let query = client.from('contact_lists').select('*').eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const allMembers: any[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: members, error: memErr } = await client
          .from('contact_list_members')
          .select('contact_id')
          .eq('list_id', id)
          .range(from, from + PAGE_SIZE - 1);

        if (memErr) throw memErr;
        if (members && members.length > 0) {
          allMembers.push(...members);
          if (members.length < PAGE_SIZE) {
            hasMore = false;
          } else {
            from += PAGE_SIZE;
          }
        } else {
          hasMore = false;
        }
      }

      return {
        id: data.id,
        tenantId: data.tenant_id,
        name: data.name,
        description: data.description || '',
        type: data.type,
        rules: data.rules,
        contactIds: allMembers.map((m: any) => m.contact_id),
        createdAt: data.created_at
      };
    },

    create: async (data) => {
      const client = this.getClient();
      const payload = {
        tenant_id: data.tenantId,
        name: data.name,
        description: data.description || '',
        type: data.type,
        rules: data.rules
      };

      const { data: created, error } = await client
        .from('contact_lists')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      if (data.contactIds && data.contactIds.length > 0) {
        const memberRows = data.contactIds.map(cid => ({
          tenant_id: data.tenantId,
          list_id: created.id,
          contact_id: cid
        }));
        const CHUNK_SIZE = 200;
        for (let i = 0; i < memberRows.length; i += CHUNK_SIZE) {
          const chunk = memberRows.slice(i, i + CHUNK_SIZE);
          await client.from('contact_list_members').insert(chunk);
        }
      }

      return {
        id: created.id,
        tenantId: created.tenant_id,
        name: created.name,
        description: created.description || '',
        type: created.type,
        rules: created.rules,
        contactIds: data.contactIds || [],
        createdAt: created.created_at
      };
    },

    update: async (id: string, updates: Partial<ContactList>, tenantId?: string) => {
      const client = this.getClient();
      const dbUpdates: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.rules !== undefined) dbUpdates.rules = updates.rules;

      let query = client.from('contact_lists').update(dbUpdates).eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);

      const { data, error } = await query.select().single();
      if (error) throw error;

      if (updates.contactIds !== undefined) {
        await client.from('contact_list_members').delete().eq('list_id', id);
        if (updates.contactIds.length > 0) {
          const memberRows = updates.contactIds.map(cid => ({
            tenant_id: data.tenant_id,
            list_id: id,
            contact_id: cid
          }));
          await client.from('contact_list_members').insert(memberRows);
        }
      }

      const { data: members } = await client
        .from('contact_list_members')
        .select('contact_id')
        .eq('list_id', id);

      return {
        id: data.id,
        tenantId: data.tenant_id,
        name: data.name,
        description: data.description || '',
        type: data.type,
        rules: data.rules,
        contactIds: (members || []).map((m: any) => m.contact_id),
        createdAt: data.created_at
      };
    },

    delete: async (id: string, tenantId?: string) => {
      const client = this.getClient();
      await client.from('contact_list_members').delete().eq('list_id', id);
      let query = client.from('contact_lists').delete().eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { error } = await query;
      if (error) throw error;
    }
  };

  // ============================================================================
  // AUDIT LOG REPOSITORY (Cryptographic SHA-256 Hash Chain in PostgreSQL)
  // ============================================================================
  auditRepo: IAuditRepository = {
    log: async (entryData) => {
      const client = this.getClient();
      const createdAt = new Date().toISOString();

      // Retrieve previous entry hash from PostgreSQL
      const { data: latest } = await client
        .from('audit_logs')
        .select('entry_hash')
        .eq('tenant_id', entryData.tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const previousHash = latest?.entry_hash || '0000000000000000000000000000000000000000000000000000000000000000';
      const payload = `${previousHash}|${createdAt}|${entryData.tenantId}|${entryData.actorId}|${entryData.action}|${entryData.entityId}|${JSON.stringify(entryData.metadata || {})}`;
      const entryHash = crypto.createHash('sha256').update(payload).digest('hex');

      const { data, error } = await client
        .from('audit_logs')
        .insert({
          tenant_id: entryData.tenantId,
          actor_id: entryData.actorId,
          actor_name: entryData.actorName,
          actor_role: entryData.actorRole,
          action: entryData.action,
          entity_type: entryData.entityType,
          entity_id: entryData.entityId,
          metadata: entryData.metadata || {},
          ip_address: entryData.ipAddress || '127.0.0.1',
          previous_hash: previousHash,
          entry_hash: entryHash,
          created_at: createdAt
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        tenantId: data.tenant_id,
        actorId: data.actor_id,
        actorName: data.actor_name,
        actorRole: data.actor_role,
        action: data.action,
        entityType: data.entity_type,
        entityId: data.entity_id,
        metadata: data.metadata,
        ipAddress: data.ip_address,
        previousHash: data.previous_hash,
        entryHash: data.entry_hash,
        createdAt: data.created_at
      };
    },

    findAll: async (tenantId: string, limit = 100) => {
      const client = this.getClient();
      const { data, error } = await client
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(d => ({
        id: d.id,
        tenantId: d.tenant_id,
        actorId: d.actor_id,
        actorName: d.actor_name,
        actorRole: d.actor_role,
        action: d.action,
        entityType: d.entity_type,
        entityId: d.entity_id,
        metadata: d.metadata,
        ipAddress: d.ip_address,
        previousHash: d.previous_hash,
        entryHash: d.entry_hash,
        createdAt: d.created_at
      }));
    }
  };

  // ============================================================================
  // TENANT & MEMBERSHIP REPOSITORY
  // ============================================================================
  tenantRepo: ITenantRepository = {
    getTenant: async (id: string) => {
      const client = this.getClient();
      const { data, error } = await client.from('tenants').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return this.mapDbTenantToDomain(data);
    },

    updateKillSwitch: async (id: string, isActive: boolean, reason?: string, by?: string) => {
      const client = this.getClient();
      const payload: Record<string, any> = {
        is_kill_switch_active: isActive,
        kill_switch_reason: reason,
        kill_switch_triggered_at: isActive ? new Date().toISOString() : null,
        kill_switch_triggered_by: isActive ? by : null,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await client
        .from('tenants')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return this.mapDbTenantToDomain(data);
    },

    toggleKillSwitch: async (id: string, isActive: boolean, reason?: string, by?: string) => {
      return this.tenantRepo.updateKillSwitch(id, isActive, reason, by);
    },

    getCurrentUser: async () => {
      throw new Error('getCurrentUser must be resolved through verified Supabase Auth context.');
    },

    switchUserRole: async () => {
      throw new Error('Role modification must be performed through verified database migrations or tenant_members updates.');
    }
  };

  // ============================================================================
  // AUTHENTICATION & MEMBERSHIP RESOLUTION
  // ============================================================================
  async validateAuthToken(token: string): Promise<{ user: User; memberships: Array<TenantMember & { tenant: Tenant }> } | null> {
    const client = this.getClient();

    // 1. Verify token with Supabase Auth
    const { data: authData, error: authError } = await client.auth.getUser(token);
    if (authError || !authData.user) {
      return null;
    }

    const authUser = authData.user;
    const userId = authUser.id;
    const email = authUser.email || '';

    // 2. Fetch user profile from PostgreSQL users table
    const { data: userProfile } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const name = userProfile?.name || authUser.user_metadata?.full_name || email.split('@')[0];
    const avatarUrl = userProfile?.avatar_url || authUser.user_metadata?.avatar_url;

    // 3. Fetch tenant memberships from PostgreSQL tenant_members join tenants
    const { data: memberRows, error: memberErr } = await client
      .from('tenant_members')
      .select('id, tenant_id, role, created_at, tenants(*)')
      .eq('user_id', userId);

    if (memberErr || !memberRows || memberRows.length === 0) {
      try {
        const cleanSlug = (email.split('@')[0] || 'workspace').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
        const uniqueSlug = `${cleanSlug}-${userId.slice(0, 8)}`;
        const tenantName = name ? `${name}'s Workspace` : 'Primary Workspace';

        const { data: createdTenant } = await client
          .from('tenants')
          .insert({
            name: tenantName,
            slug: uniqueSlug,
            status: 'ACTIVE'
          })
          .select()
          .maybeSingle();

        if (createdTenant) {
          await client
            .from('users')
            .upsert({
              id: userId,
              email,
              name: name || email.split('@')[0],
              avatar_url: avatarUrl
            }, { onConflict: 'id' });

          await client
            .from('tenant_members')
            .insert({
              tenant_id: createdTenant.id,
              user_id: userId,
              role: 'OWNER'
            });

          return {
            user: { id: userId, email, name, role: 'OWNER', avatarUrl },
            memberships: [{
              id: crypto.randomUUID(),
              tenantId: createdTenant.id,
              userId,
              role: 'OWNER',
              createdAt: new Date().toISOString(),
              tenant: this.mapDbTenantToDomain(createdTenant)
            }]
          };
        }
      } catch (autoErr) {
        console.warn('[validateAuthToken] Auto-provision workspace notice:', autoErr);
      }

      return {
        user: { id: userId, email, name, role: 'VIEWER', avatarUrl },
        memberships: []
      };
    }

    const memberships = memberRows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId,
      role: row.role as Role,
      createdAt: row.created_at,
      tenant: this.mapDbTenantToDomain(row.tenants)
    }));

    return {
      user: {
        id: userId,
        email,
        name,
        role: memberships[0].role,
        avatarUrl
      },
      memberships
    };
  }

  // Helper Mappers between PostgreSQL snake_case and Domain camelCase
  private mapDbContactToDomain(row: any): Contact {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      displayName: row.display_name,
      companyName: row.company_name || '',
      jobTitle: row.job_title || '',
      phone: row.phone,
      email: row.email || '',
      city: row.city || '',
      state: row.state || 'Telangana',
      country: row.country || 'India',
      status: row.status,
      source: row.source,
      leadStatus: row.lead_status,
      notes: row.notes || '',
      tags: row.tags || [],
      customFields: row.custom_fields || {},
      channelAddresses: [
        { id: `addr-${row.id}-1`, channelType: 'WHATSAPP', address: row.phone, isPrimary: true, isVerified: true },
        { id: `addr-${row.id}-2`, channelType: 'EMAIL', address: row.email, isPrimary: true, isVerified: !!row.email }
      ],
      preferences: {
        WHATSAPP: { channel: 'WHATSAPP', marketingAllowed: true, transactionalAllowed: true },
        EMAIL: { channel: 'EMAIL', marketingAllowed: true, transactionalAllowed: true },
        SMS: { channel: 'SMS', marketingAllowed: true, transactionalAllowed: true }
      },
      isGloballyBlocked: row.is_globally_blocked || false,
      blockedReason: row.blocked_reason,
      lastInteractionAt: row.last_interaction_at,
      lastMessageSentAt: row.last_message_sent_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDbCampaignToDomain(row: any): Campaign {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description || '',
      channel: row.channel,
      status: row.status,
      targetListId: row.target_list_id,
      targetListName: row.target_list_name,
      templateId: row.template_id,
      templateVersion: row.template_version,
      templateSnapshot: row.template_snapshot,
      isDryRun: row.is_dry_run || false,
      assignedOperator: row.assigned_operator,
      createdBy: row.created_by,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      recipientsCount: row.recipients_count || 0,
      sentCount: row.sent_count || 0,
      openedCount: row.opened_count || 0,
      skippedCount: row.skipped_count || 0,
      blockedCount: row.blocked_count || 0,
      createdAt: row.created_at
    };
  }

  private mapDbRecipientToDomain(row: any): CampaignRecipient {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      campaignId: row.campaign_id,
      contactId: row.contact_id,
      contactName: row.contact_name,
      companyName: row.company_name,
      channel: row.channel,
      channelAddress: row.channel_address,
      resolvedMessage: row.resolved_message,
      resolvedSubject: row.resolved_subject,
      attachmentName: row.attachment_name,
      status: row.status,
      claimedByOperator: row.claimed_by_operator,
      claimedAt: row.claimed_at,
      openedAt: row.opened_at,
      userSentAt: row.user_sent_at,
      skippedAt: row.skipped_at,
      skipReason: row.skip_reason,
      policyNotes: row.policy_notes,
      createdAt: row.created_at
    };
  }

  private mapDbTemplateToDomain(row: any): MessageTemplate {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      channel: row.channel,
      subject: row.subject,
      body: row.body,
      version: row.version,
      availableVariables: row.available_variables || [],
      attachmentName: row.attachment_name,
      attachmentSize: row.attachment_size,
      attachmentType: row.attachment_type,
      category: row.category,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDbListToDomain(row: any): ContactList {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description || '',
      type: row.type,
      rules: row.rules,
      contactIds: row.contact_ids || [],
      createdAt: row.created_at
    };
  }

  private mapDbTenantToDomain(row: any): Tenant {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      timezone: row.timezone || 'Asia/Kolkata',
      isKillSwitchActive: row.is_kill_switch_active || false,
      killSwitchReason: row.kill_switch_reason,
      killSwitchTriggeredAt: row.kill_switch_triggered_at,
      killSwitchTriggeredBy: row.kill_switch_triggered_by,
      createdAt: row.created_at
    };
  }
}

// Global Supabase database singleton
export const db = new SupabaseDatabaseAdapter();
