/**
 * ReachOut OS - Inbound WhatsApp Webhook & 24h Customer Service Window Engine
 * Authoritative compliance processor for inbound customer interactions,
 * real-time 24h customer service window resets, and automated opt-out ingestion.
 */

import { db } from '../../infrastructure/database/SupabaseDatabaseAdapter';
import { DataQualityEngine } from '../validation/dataQuality';
import { Contact, ChannelType } from '../../types';

export interface InboundPayload {
  senderPhone: string;
  messageText: string;
  senderName?: string;
  channel?: ChannelType;
  rawPayload?: any;
  tenantId?: string;
}

export interface InboundProcessResult {
  success: boolean;
  isOptOutTrigger: boolean;
  contactId?: string;
  contactName?: string;
  phone: string;
  windowOpenedUntil?: string;
  actionTaken: 'WINDOW_OPENED' | 'OPT_OUT_ENFORCED' | 'CONTACT_NOT_FOUND';
  message: string;
}

export class InboundWebhookService {
  // Authoritative Meta WhatsApp Opt-Out Keyword Registry
  private static OPT_OUT_PATTERNS = [
    /\bstop\b/i,
    /\bunsubscribe\b/i,
    /\bcancel\b/i,
    /\bquit\b/i,
    /\bopt[\s\-_]*out\b/i,
    /\bdon'?t\s*message\b/i,
    /\bno\s*offers\b/i,
    /\bremove\s*me\b/i,
    /\bblock\b/i,
    /\bdnd\b/i,
    /\bleave\s*me\s*alone\b/i,
    /\bstop\s*promos\b/i
  ];

  /**
   * Verifies if inbound message text triggers an automated opt-out
   */
  public static isOptOutTrigger(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const clean = text.trim();
    return this.OPT_OUT_PATTERNS.some(regex => regex.test(clean));
  }

  /**
   * Extracts clean phone, sender, and text from Meta Graph API webhook format
   */
  public static parseMetaWebhookBody(body: any): InboundPayload[] {
    const results: InboundPayload[] = [];
    if (!body) return results;

    // 1. Direct standard simplified payload
    if (body.senderPhone || body.phone) {
      results.push({
        senderPhone: String(body.senderPhone || body.phone),
        messageText: String(body.messageText || body.text || body.message || ''),
        senderName: body.senderName || body.name,
        channel: body.channel || 'WHATSAPP',
        rawPayload: body,
        tenantId: body.tenantId
      });
      return results;
    }

    // 2. Official Meta WhatsApp Business API webhook structure
    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;
      const contacts = value?.contacts;

      if (Array.isArray(messages) && messages.length > 0) {
        messages.forEach((msg: any) => {
          const from = msg.from;
          let text = '';
          if (msg.type === 'text') {
            text = msg.text?.body || '';
          } else if (msg.type === 'button') {
            text = msg.button?.text || msg.button?.payload || '';
          } else if (msg.type === 'interactive') {
            text = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
          } else {
            text = `[${msg.type} message received]`;
          }

          const matchedContact = contacts?.find((c: any) => c.wa_id === from);

          results.push({
            senderPhone: from,
            messageText: text,
            senderName: matchedContact?.profile?.name || undefined,
            channel: 'WHATSAPP',
            rawPayload: msg
          });
        });
      }
    } catch (err) {
      console.warn('[InboundWebhookService] Error parsing Meta webhook structure:', err);
    }

    return results;
  }

  /**
   * Authoritatively processes inbound message in PostgreSQL:
   * - Resets 24h Customer Service Window (now + 24 hours)
   * - OR triggers instant opt-out suppression (Rule WA-OPTOUT-001)
   */
  public static async processInbound(
    payload: InboundPayload,
    forcedTenantId?: string
  ): Promise<InboundProcessResult> {
    if (!db || !db.isConfigured) {
      return {
        success: false,
        isOptOutTrigger: false,
        phone: payload.senderPhone,
        actionTaken: 'CONTACT_NOT_FOUND',
        message: 'Database unconfigured'
      };
    }

    const norm = DataQualityEngine.normalizePhone(payload.senderPhone);
    const canonicalPhone = norm.canonical || payload.senderPhone.replace(/[^\d+]/g, '');
    const isOptOut = this.isOptOutTrigger(payload.messageText);
    const client = (db as any).getClient();

    // 1. Locate matching contact in PostgreSQL (search across tenant or by forcedTenantId)
    let contactQuery = client.from('contacts').select('*');
    if (forcedTenantId) {
      contactQuery = contactQuery.eq('tenant_id', forcedTenantId);
    }
    // Search canonical phone, last 10 digits, or raw phone
    const clean10 = canonicalPhone.slice(-10);
    contactQuery = contactQuery.or(`phone.eq.${canonicalPhone},phone.ilike.%${clean10}%`);

    const { data: matchedContacts, error: findErr } = await contactQuery.limit(1);

    if (findErr) {
      console.error('[InboundWebhookService] Error finding contact:', findErr);
    }

    const contact: Contact | null = matchedContacts?.[0] ? (db as any).mapDbContactToDomain(matchedContacts[0]) : null;

    const tenantId = contact?.tenantId || forcedTenantId || 'default';
    const nowIso = new Date().toISOString();
    const windowExpiryIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // 2. Process according to Opt-Out vs Regular Message
    if (isOptOut) {
      // 🔴 HARD RULE WA-OPTOUT-001: Immediate suppression
      if (contact) {
        const updatedPrefs = {
          ...contact.preferences,
          WHATSAPP: {
            channel: 'WHATSAPP' as const,
            marketingAllowed: false,
            transactionalAllowed: false,
            optedOutAt: nowIso,
            optOutReason: `Inbound customer request: "${payload.messageText.substring(0, 60)}"`
          }
        };

        await client
          .from('contacts')
          .update({
            preferences: updatedPrefs,
            status: 'OPTED_OUT',
            last_interaction_at: nowIso,
            last_inbound_message_at: nowIso,
            updated_at: nowIso
          })
          .eq('id', contact.id);

        // Immediately cascade suppression to any active campaign recipients
        await client
          .from('campaign_recipients')
          .update({
            status: 'BLOCKED',
            policy_notes: `Suppressed: Inbound customer opt-out received on ${new Date().toLocaleDateString()}`,
            updated_at: nowIso
          })
          .eq('contact_id', contact.id)
          .neq('status', 'USER_SENT');

        // Automatically pause/exit active follow-up cadences
        try {
          if ((db as any).cadencesRepo?.autoExitOnReply) {
            await (db as any).cadencesRepo.autoExitOnReply(canonicalPhone, contact.tenantId);
          }
        } catch (_) {}

        // Add to customer timeline
        await db.contactsRepo.addTimelineEvent({
          contactId: contact.id,
          tenantId: contact.tenantId,
          eventType: 'OPT_OUT_RECEIVED',
          actor: 'Customer (Inbound WhatsApp)',
          description: `Customer triggered opt-out via text: "${payload.messageText}"`
        });

        // Record immutable audit log
        await db.auditRepo.log({
          tenantId: contact.tenantId,
          actorId: '00000000-0000-0000-0000-000000000000',
          actorName: 'Inbound WhatsApp Webhook',
          actorRole: 'OPERATOR',
          action: 'CONTACT_INBOUND_OPTOUT_RECORDED',
          entityType: 'CONTACT',
          entityId: contact.id,
          metadata: {
            phone: canonicalPhone,
            messageText: payload.messageText,
            ruleId: 'WA-OPTOUT-001'
          },
          ipAddress: '127.0.0.1'
        });
      }

      // Log inbound message record
      try {
        await client.from('inbound_messages').insert({
          tenant_id: tenantId,
          contact_id: contact?.id || null,
          channel: 'WHATSAPP',
          sender_address: canonicalPhone,
          sender_name: payload.senderName || contact?.displayName,
          message_type: 'text',
          message_body: payload.messageText,
          raw_payload: payload.rawPayload || {},
          is_opt_out_trigger: true,
          window_opened_until: null,
          received_at: nowIso
        });
      } catch (_) {}

      return {
        success: true,
        isOptOutTrigger: true,
        contactId: contact?.id,
        contactName: contact?.displayName,
        phone: canonicalPhone,
        actionTaken: 'OPT_OUT_ENFORCED',
        message: `Opt-out processed for ${canonicalPhone}. WhatsApp marketing suppressed and active dispatches blocked.`
      };
    } else {
      // 🟢 24-HOUR CUSTOMER SERVICE WINDOW RESET (Rule WA-WINDOW-001)
      if (contact) {
        await client
          .from('contacts')
          .update({
            last_inbound_message_at: nowIso,
            customer_service_window_expires_at: windowExpiryIso,
            last_interaction_at: nowIso,
            updated_at: nowIso
          })
          .eq('id', contact.id);

        // Add to customer timeline
        await db.contactsRepo.addTimelineEvent({
          contactId: contact.id,
          tenantId: contact.tenantId,
          eventType: 'INBOUND_MESSAGE_RECEIVED',
          actor: payload.senderName || contact.displayName || 'Customer (Inbound WhatsApp)',
          description: `Customer replied: "${payload.messageText.substring(0, 100)}${payload.messageText.length > 100 ? '...' : ''}"`
        });

        // Automatically pause/exit active follow-up cadences on reply
        try {
          if ((db as any).cadencesRepo?.autoExitOnReply) {
            await (db as any).cadencesRepo.autoExitOnReply(canonicalPhone, contact.tenantId);
          }
        } catch (_) {}

        // Record audit entry
        await db.auditRepo.log({
          tenantId: contact.tenantId,
          actorId: '00000000-0000-0000-0000-000000000000',
          actorName: 'Inbound WhatsApp Webhook',
          actorRole: 'OPERATOR',
          action: 'INBOUND_WHATSAPP_MESSAGE_RECEIVED',
          entityType: 'CONTACT',
          entityId: contact.id,
          metadata: {
            phone: canonicalPhone,
            messageText: payload.messageText,
            windowOpenedUntil: windowExpiryIso,
            ruleId: 'WA-WINDOW-001'
          },
          ipAddress: '127.0.0.1'
        });
      }

      // Log inbound message record
      try {
        await client.from('inbound_messages').insert({
          tenant_id: tenantId,
          contact_id: contact?.id || null,
          channel: 'WHATSAPP',
          sender_address: canonicalPhone,
          sender_name: payload.senderName || contact?.displayName,
          message_type: 'text',
          message_body: payload.messageText,
          raw_payload: payload.rawPayload || {},
          is_opt_out_trigger: false,
          window_opened_until: windowExpiryIso,
          received_at: nowIso
        });
      } catch (_) {}

      return {
        success: true,
        isOptOutTrigger: false,
        contactId: contact?.id,
        contactName: contact?.displayName,
        phone: canonicalPhone,
        windowOpenedUntil: windowExpiryIso,
        actionTaken: contact ? 'WINDOW_OPENED' : 'CONTACT_NOT_FOUND',
        message: contact 
          ? `Inbound message recorded. 24-hour Customer Service Window opened until ${new Date(windowExpiryIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
          : `Inbound message received from unrecorded contact ${canonicalPhone}.`
      };
    }
  }
}
