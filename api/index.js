// scripts/_vercel_entry.ts
import "dotenv/config";

// server.ts
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// src/infrastructure/database/SupabaseDatabaseAdapter.ts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
var DatabaseUnconfiguredError = class extends Error {
  constructor(message = "Supabase PostgreSQL database is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in environment secrets.") {
    super(message);
    this.code = "DATABASE_UNCONFIGURED";
    this.name = "DatabaseUnconfiguredError";
  }
};
var SupabaseDatabaseAdapter = class {
  constructor(config) {
    this.client = null;
    this.authCache = /* @__PURE__ */ new Map();
    // ============================================================================
    // CONTACTS REPOSITORY (PostgreSQL backed, strict tenant scoping)
    // ============================================================================
    this.contactsRepo = {
      findAll: async (tenantId, search, tag, listId, status) => {
        const client = this.getClient();
        let listMemberIds = null;
        if (listId) {
          const { data: listMembers, error: listErr } = await client.from("contact_list_members").select("contact_id").eq("list_id", listId).eq("tenant_id", tenantId);
          if (listErr) throw listErr;
          if (listMembers && listMembers.length > 0) {
            listMemberIds = listMembers.map((m) => m.contact_id);
          } else {
            return [];
          }
        }
        if (listMemberIds && listMemberIds.length > 0) {
          const CHUNK_SIZE = 150;
          const allRows2 = [];
          for (let i = 0; i < listMemberIds.length; i += CHUNK_SIZE) {
            const chunk = listMemberIds.slice(i, i + CHUNK_SIZE);
            let query = client.from("contacts").select("*").eq("tenant_id", tenantId).in("id", chunk);
            if (search) {
              query = query.or(`display_name.ilike.%${search}%,company_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`);
            }
            if (tag) {
              query = query.contains("tags", [tag]);
            }
            if (status) {
              query = query.eq("status", status);
            }
            const { data, error } = await query;
            if (error) throw error;
            if (data) allRows2.push(...data);
          }
          return allRows2.map((row) => this.mapDbContactToDomain(row));
        }
        const allRows = [];
        const PAGE_SIZE = 1e3;
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          let query = client.from("contacts").select("*").eq("tenant_id", tenantId).order("display_name", { ascending: true }).range(from, from + PAGE_SIZE - 1);
          if (search) {
            query = query.or(`display_name.ilike.%${search}%,company_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`);
          }
          if (tag) {
            query = query.contains("tags", [tag]);
          }
          if (status) {
            query = query.eq("status", status);
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
        return allRows.map((row) => this.mapDbContactToDomain(row));
      },
      findById: async (id, tenantId) => {
        const client = this.getClient();
        let query = client.from("contacts").select("*").eq("id", id);
        if (tenantId) {
          query = query.eq("tenant_id", tenantId);
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
        const { data, error } = await client.from("contacts").insert(insertPayload).select().single();
        if (error) throw error;
        return this.mapDbContactToDomain(data);
      },
      update: async (id, updatesOrTenantId, tenantIdOrUpdates) => {
        let updates;
        let tenantId;
        if (typeof updatesOrTenantId === "string") {
          tenantId = updatesOrTenantId;
          updates = tenantIdOrUpdates || {};
        } else {
          updates = updatesOrTenantId || {};
          tenantId = tenantIdOrUpdates;
        }
        const client = this.getClient();
        const dbUpdates = {
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (updates.firstName !== void 0) dbUpdates.first_name = updates.firstName;
        if (updates.lastName !== void 0) dbUpdates.last_name = updates.lastName;
        if (updates.displayName !== void 0) dbUpdates.display_name = updates.displayName;
        if (updates.companyName !== void 0) dbUpdates.company_name = updates.companyName;
        if (updates.jobTitle !== void 0) dbUpdates.job_title = updates.jobTitle;
        if (updates.phone !== void 0) dbUpdates.phone = updates.phone;
        if (updates.email !== void 0) dbUpdates.email = updates.email;
        if (updates.city !== void 0) dbUpdates.city = updates.city;
        if (updates.state !== void 0) dbUpdates.state = updates.state;
        if (updates.country !== void 0) dbUpdates.country = updates.country;
        if (updates.status !== void 0) dbUpdates.status = updates.status;
        if (updates.leadStatus !== void 0) dbUpdates.lead_status = updates.leadStatus;
        if (updates.notes !== void 0) dbUpdates.notes = updates.notes;
        if (updates.tags !== void 0) dbUpdates.tags = updates.tags;
        if (updates.customFields !== void 0) dbUpdates.custom_fields = updates.customFields;
        if (updates.isGloballyBlocked !== void 0) dbUpdates.is_globally_blocked = updates.isGloballyBlocked;
        if (updates.blockedReason !== void 0) dbUpdates.blocked_reason = updates.blockedReason;
        if (updates.lastInteractionAt !== void 0) dbUpdates.last_interaction_at = updates.lastInteractionAt;
        if (updates.lastMessageSentAt !== void 0) dbUpdates.last_message_sent_at = updates.lastMessageSentAt;
        let query = client.from("contacts").update(dbUpdates).eq("id", id);
        if (tenantId) query = query.eq("tenant_id", tenantId);
        const { data, error } = await query.select().single();
        if (error) throw error;
        return this.mapDbContactToDomain(data);
      },
      delete: async (id, tenantId) => {
        const client = this.getClient();
        let clmQuery = client.from("contact_list_members").delete().eq("contact_id", id);
        if (tenantId) clmQuery = clmQuery.eq("tenant_id", tenantId);
        await clmQuery;
        let tmQuery = client.from("contact_timeline").delete().eq("contact_id", id);
        if (tenantId) tmQuery = tmQuery.eq("tenant_id", tenantId);
        await tmQuery;
        let crQuery = client.from("campaign_recipients").delete().eq("contact_id", id);
        if (tenantId) crQuery = crQuery.eq("tenant_id", tenantId);
        await crQuery;
        let query = client.from("contacts").delete().eq("id", id);
        if (tenantId) query = query.eq("tenant_id", tenantId);
        const { error } = await query;
        if (error) throw error;
      },
      bulkCreate: async (contactsData) => {
        const client = this.getClient();
        const E164_REGEX = /^\+[1-9][0-9]{7,14}$/;
        const insertRows = contactsData.filter((c) => c && c.phone && E164_REGEX.test(c.phone.trim())).map((c) => ({
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
          lead_status: c.leadStatus || "LEAD",
          notes: c.notes,
          tags: c.tags,
          custom_fields: c.customFields,
          is_globally_blocked: c.isGloballyBlocked
        }));
        const uniqueMap = /* @__PURE__ */ new Map();
        for (const row of insertRows) {
          const key = `${row.tenant_id}:${row.phone}`;
          uniqueMap.set(key, row);
        }
        const uniqueRows = Array.from(uniqueMap.values());
        let totalCreated = 0;
        const chunkSize = 200;
        for (let i = 0; i < uniqueRows.length; i += chunkSize) {
          const chunk = uniqueRows.slice(i, i + chunkSize);
          const { data, error } = await client.from("contacts").upsert(chunk, { onConflict: "tenant_id, phone" }).select("id");
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
        let resolvedTenantId = eventData.tenantId;
        if (!resolvedTenantId) {
          const { data: c } = await client.from("contacts").select("tenant_id").eq("id", eventData.contactId).maybeSingle();
          resolvedTenantId = c?.tenant_id || "a0000000-0000-0000-0000-000000000001";
        }
        let resolvedActorId = eventData.actorId;
        const isUuid = typeof resolvedActorId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedActorId);
        if (!isUuid) {
          const { data: member } = await client.from("tenant_members").select("user_id").eq("tenant_id", resolvedTenantId).limit(1).maybeSingle();
          resolvedActorId = member?.user_id || "7f2b33ed-ef19-44fc-a04d-1f54051b07c4";
        }
        const actorName = eventData.actorName || eventData.actor || "System / Operator";
        const { data, error } = await client.from("contact_timeline").insert({
          contact_id: eventData.contactId,
          tenant_id: resolvedTenantId,
          event_type: eventData.eventType,
          actor_id: resolvedActorId,
          actor_name: actorName,
          description: eventData.description,
          campaign_name: eventData.campaignName || null,
          metadata: eventData.metadata || {}
        }).select().single();
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
      getTimeline: async (contactId) => {
        const client = this.getClient();
        const { data, error } = await client.from("contact_timeline").select("*").eq("contact_id", contactId).order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []).map((d) => ({
          id: d.id,
          contactId: d.contact_id,
          tenantId: d.tenant_id,
          eventType: d.event_type,
          actor: d.actor_name || d.actor || "System",
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
    this.campaignsRepo = {
      findAll: async (tenantId) => {
        const client = this.getClient();
        const { data, error } = await client.from("campaigns").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []).map(this.mapDbCampaignToDomain);
      },
      findById: async (id, tenantId) => {
        const client = this.getClient();
        let query = client.from("campaigns").select("*").eq("id", id);
        if (tenantId) query = query.eq("tenant_id", tenantId);
        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        if (!data) return null;
        return this.mapDbCampaignToDomain(data);
      },
      create: async (campaignData) => {
        const client = this.getClient();
        let createdBy = campaignData.createdBy;
        if (!createdBy) {
          const { data: member } = await client.from("tenant_members").select("user_id").eq("tenant_id", campaignData.tenantId).limit(1).maybeSingle();
          createdBy = member?.user_id;
        }
        const payload = {
          tenant_id: campaignData.tenantId,
          name: campaignData.name,
          description: campaignData.description || "Standard Campaign",
          channel: campaignData.channel || "WHATSAPP",
          status: campaignData.status || "DRAFT",
          target_list_id: campaignData.targetListId || null,
          target_list_name: campaignData.targetListName || "Default Audience",
          template_id: campaignData.templateId || null,
          template_version: campaignData.templateVersion || 1,
          template_snapshot: campaignData.templateSnapshot || { name: campaignData.name, body: "" },
          is_dry_run: campaignData.isDryRun ?? false,
          assigned_operator: campaignData.assignedOperator || createdBy,
          created_by: createdBy,
          recipients_count: campaignData.recipientsCount ?? 0,
          sent_count: 0,
          opened_count: 0,
          skipped_count: 0,
          blocked_count: 0
        };
        const { data, error } = await client.from("campaigns").insert(payload).select().single();
        if (error) throw error;
        return this.mapDbCampaignToDomain(data);
      },
      update: async (id, updatesOrTenantId, tenantIdOrUpdates) => {
        let updates;
        let tenantId;
        if (typeof updatesOrTenantId === "string") {
          tenantId = updatesOrTenantId;
          updates = tenantIdOrUpdates || {};
        } else {
          updates = updatesOrTenantId || {};
          tenantId = tenantIdOrUpdates;
        }
        const client = this.getClient();
        const dbUpdates = {
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (updates.status !== void 0) dbUpdates.status = updates.status;
        if (updates.approvedBy !== void 0) {
          const isUuid = typeof updates.approvedBy === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updates.approvedBy);
          dbUpdates.approved_by = isUuid ? updates.approvedBy : null;
        }
        if (updates.approvedAt !== void 0) dbUpdates.approved_at = updates.approvedAt;
        if (updates.startedAt !== void 0) dbUpdates.started_at = updates.startedAt;
        if (updates.completedAt !== void 0) dbUpdates.completed_at = updates.completedAt;
        if (updates.recipientsCount !== void 0) dbUpdates.recipients_count = updates.recipientsCount;
        if (updates.sentCount !== void 0) dbUpdates.sent_count = updates.sentCount;
        if (updates.openedCount !== void 0) dbUpdates.opened_count = updates.openedCount;
        if (updates.skippedCount !== void 0) dbUpdates.skipped_count = updates.skippedCount;
        if (updates.blockedCount !== void 0) dbUpdates.blocked_count = updates.blockedCount;
        let query = client.from("campaigns").update(dbUpdates).eq("id", id);
        if (tenantId) query = query.eq("tenant_id", tenantId);
        const { data, error } = await query.select().single();
        if (error) throw error;
        return this.mapDbCampaignToDomain(data);
      },
      updateStatus: async (id, tenantId, status) => {
        return this.campaignsRepo.update(id, { status }, tenantId);
      },
      getRecipients: async (campaignId) => {
        const client = this.getClient();
        const allRows = [];
        const PAGE_SIZE = 1e3;
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await client.from("campaign_recipients").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
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
        return allRows.map((row) => this.mapDbRecipientToDomain(row));
      },
      getRecipientById: async (recipientId) => {
        const client = this.getClient();
        const { data, error } = await client.from("campaign_recipients").select("*").eq("id", recipientId).maybeSingle();
        if (error) throw error;
        if (!data) return null;
        return this.mapDbRecipientToDomain(data);
      },
      updateRecipient: async (recipientId, updates) => {
        const client = this.getClient();
        const dbUpdates = {
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (updates.status !== void 0) dbUpdates.status = updates.status;
        if (updates.claimedByOperator !== void 0) {
          const isUuid = typeof updates.claimedByOperator === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updates.claimedByOperator);
          dbUpdates.claimed_by_operator = isUuid ? updates.claimedByOperator : null;
        }
        if (updates.claimedAt !== void 0) dbUpdates.claimed_at = updates.claimedAt;
        if (updates.openedAt !== void 0) dbUpdates.opened_at = updates.openedAt;
        if (updates.userSentAt !== void 0) dbUpdates.user_sent_at = updates.userSentAt;
        if (updates.skippedAt !== void 0) dbUpdates.skipped_at = updates.skippedAt;
        if (updates.skipReason !== void 0) dbUpdates.skip_reason = updates.skipReason;
        if (updates.policyNotes !== void 0) dbUpdates.policy_notes = updates.policyNotes;
        const { data, error } = await client.from("campaign_recipients").update(dbUpdates).eq("id", recipientId).select().single();
        if (error) throw error;
        const campaignId = data.campaign_id;
        (async () => {
          try {
            const [
              { count: sentCount },
              { count: openedCount },
              { count: skippedCount },
              { count: blockedCount }
            ] = await Promise.all([
              client.from("campaign_recipients").select("*", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("status", "USER_SENT"),
              client.from("campaign_recipients").select("*", { count: "exact", head: true }).eq("campaign_id", campaignId).in("status", ["OPENED", "USER_SENT"]),
              client.from("campaign_recipients").select("*", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("status", "SKIPPED"),
              client.from("campaign_recipients").select("*", { count: "exact", head: true }).eq("campaign_id", campaignId).in("status", ["BLOCKED", "OPTED_OUT"])
            ]);
            await client.from("campaigns").update({
              sent_count: sentCount || 0,
              opened_count: openedCount || 0,
              skipped_count: skippedCount || 0,
              blocked_count: blockedCount || 0,
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("id", campaignId);
          } catch (metricErr) {
            console.warn("Background campaign metrics aggregation error:", metricErr);
          }
        })();
        return this.mapDbRecipientToDomain(data);
      },
      addRecipients: async (recipientsData, tenantId) => {
        if (!recipientsData || recipientsData.length === 0) return 0;
        const client = this.getClient();
        let resolvedTenantId = tenantId;
        if (!resolvedTenantId && recipientsData[0]?.tenantId) {
          resolvedTenantId = recipientsData[0].tenantId;
        }
        if (!resolvedTenantId && recipientsData[0]?.campaignId) {
          const { data: camp } = await client.from("campaigns").select("tenant_id").eq("id", recipientsData[0].campaignId).maybeSingle();
          if (camp?.tenant_id) {
            resolvedTenantId = camp.tenant_id;
          }
        }
        const insertRows = recipientsData.map((r) => ({
          tenant_id: r.tenantId || resolvedTenantId,
          campaign_id: r.campaignId,
          contact_id: r.contactId,
          contact_name: r.contactName,
          company_name: r.companyName || "",
          channel: r.channel,
          channel_address: r.channelAddress,
          resolved_message: r.resolvedMessage,
          resolved_subject: r.resolvedSubject,
          attachment_name: r.attachmentName,
          status: r.status || "READY"
        }));
        const CHUNK_SIZE = 250;
        let insertedCount = 0;
        for (let i = 0; i < insertRows.length; i += CHUNK_SIZE) {
          const chunk = insertRows.slice(i, i + CHUNK_SIZE);
          const { data, error } = await client.from("campaign_recipients").insert(chunk).select("id");
          if (error) throw error;
          insertedCount += data ? data.length : chunk.length;
        }
        return insertedCount;
      },
      delete: async (id, tenantId) => {
        const client = this.getClient();
        let recQuery = client.from("campaign_recipients").delete().eq("campaign_id", id);
        if (tenantId) recQuery = recQuery.eq("tenant_id", tenantId);
        await recQuery;
        let campQuery = client.from("campaigns").delete().eq("id", id);
        if (tenantId) campQuery = campQuery.eq("tenant_id", tenantId);
        const { error } = await campQuery;
        if (error) throw error;
      }
    };
    // ============================================================================
    // TEMPLATES REPOSITORY
    // ============================================================================
    this.templatesRepo = {
      findAll: async (tenantId) => {
        const client = this.getClient();
        const { data, error } = await client.from("message_templates").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []).map(this.mapDbTemplateToDomain);
      },
      findById: async (id, tenantId) => {
        const client = this.getClient();
        let query = client.from("message_templates").select("*").eq("id", id);
        if (tenantId) query = query.eq("tenant_id", tenantId);
        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        if (!data) return null;
        return this.mapDbTemplateToDomain(data);
      },
      create: async (data) => {
        const client = this.getClient();
        let createdBy = data.createdBy;
        if (!createdBy || typeof createdBy !== "string" || createdBy.includes(" ")) {
          const { data: member } = await client.from("tenant_members").select("user_id").eq("tenant_id", data.tenantId).limit(1).maybeSingle();
          createdBy = member?.user_id || "7f2b33ed-ef19-44fc-a04d-1f54051b07c4";
        }
        const payload = {
          tenant_id: data.tenantId,
          name: data.name,
          channel: data.channel,
          subject: data.subject || "",
          body: data.body,
          version: 1,
          available_variables: data.availableVariables || [],
          attachment_name: data.attachmentName || null,
          attachment_size: data.attachmentSize || null,
          attachment_type: data.attachmentType || null,
          category: data.category || "INTRODUCTION",
          created_by: createdBy
        };
        const { data: created, error } = await client.from("message_templates").insert(payload).select().single();
        if (error) throw error;
        return this.mapDbTemplateToDomain(created);
      },
      update: async (id, updatesOrTenantId, tenantIdOrUpdates) => {
        let updates;
        let tenantId;
        if (typeof updatesOrTenantId === "string") {
          tenantId = updatesOrTenantId;
          updates = tenantIdOrUpdates || {};
        } else {
          updates = updatesOrTenantId || {};
          tenantId = tenantIdOrUpdates;
        }
        const client = this.getClient();
        const { data: existing, error: getErr } = await client.from("message_templates").select("version").eq("id", id).single();
        if (getErr) throw getErr;
        const nextVersion = (existing?.version || 1) + 1;
        const dbUpdates = {
          version: nextVersion,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (updates.name !== void 0) dbUpdates.name = updates.name;
        if (updates.subject !== void 0) dbUpdates.subject = updates.subject;
        if (updates.body !== void 0) dbUpdates.body = updates.body;
        if (updates.availableVariables !== void 0) dbUpdates.available_variables = updates.availableVariables;
        if (updates.attachmentName !== void 0) dbUpdates.attachment_name = updates.attachmentName;
        if (updates.category !== void 0) dbUpdates.category = updates.category;
        let query = client.from("message_templates").update(dbUpdates).eq("id", id);
        if (tenantId) query = query.eq("tenant_id", tenantId);
        const { data, error } = await query.select().single();
        if (error) throw error;
        return this.mapDbTemplateToDomain(data);
      },
      delete: async (id, tenantId) => {
        const client = this.getClient();
        let query = client.from("message_templates").delete().eq("id", id);
        if (tenantId) query = query.eq("tenant_id", tenantId);
        const { error } = await query;
        if (error) throw error;
      }
    };
    // ============================================================================
    // CONTACT LISTS REPOSITORY (Junction Table contact_list_members Normalized)
    // ============================================================================
    this.contactListsRepo = {
      findAll: async (tenantId) => {
        const client = this.getClient();
        const { data, error } = await client.from("contact_lists").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
        if (error) throw error;
        if (!data || data.length === 0) return [];
        const listIds = data.map((l) => l.id);
        const allMembers = [];
        const PAGE_SIZE = 1e3;
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data: members, error: memErr } = await client.from("contact_list_members").select("list_id, contact_id").in("list_id", listIds).range(from, from + PAGE_SIZE - 1);
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
        const memberMap = /* @__PURE__ */ new Map();
        allMembers.forEach((m) => {
          const arr = memberMap.get(m.list_id) || [];
          arr.push(m.contact_id);
          memberMap.set(m.list_id, arr);
        });
        return data.map((l) => ({
          id: l.id,
          tenantId: l.tenant_id,
          name: l.name,
          description: l.description || "",
          type: l.type,
          rules: l.rules,
          contactIds: memberMap.get(l.id) || [],
          createdAt: l.created_at
        }));
      },
      findById: async (id, tenantId) => {
        const client = this.getClient();
        let query = client.from("contact_lists").select("*").eq("id", id);
        if (tenantId) query = query.eq("tenant_id", tenantId);
        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        if (!data) return null;
        const allMembers = [];
        const PAGE_SIZE = 1e3;
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data: members, error: memErr } = await client.from("contact_list_members").select("contact_id").eq("list_id", id).range(from, from + PAGE_SIZE - 1);
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
          description: data.description || "",
          type: data.type,
          rules: data.rules,
          contactIds: allMembers.map((m) => m.contact_id),
          createdAt: data.created_at
        };
      },
      create: async (data) => {
        const client = this.getClient();
        const payload = {
          tenant_id: data.tenantId,
          name: data.name,
          description: data.description || "",
          type: data.type,
          rules: data.rules
        };
        const { data: created, error } = await client.from("contact_lists").insert(payload).select().single();
        if (error) throw error;
        if (data.contactIds && data.contactIds.length > 0) {
          const memberRows = data.contactIds.map((cid) => ({
            tenant_id: data.tenantId,
            list_id: created.id,
            contact_id: cid
          }));
          const CHUNK_SIZE = 200;
          for (let i = 0; i < memberRows.length; i += CHUNK_SIZE) {
            const chunk = memberRows.slice(i, i + CHUNK_SIZE);
            await client.from("contact_list_members").insert(chunk);
          }
        }
        return {
          id: created.id,
          tenantId: created.tenant_id,
          name: created.name,
          description: created.description || "",
          type: created.type,
          rules: created.rules,
          contactIds: data.contactIds || [],
          createdAt: created.created_at
        };
      },
      update: async (id, updates, tenantId) => {
        const client = this.getClient();
        const dbUpdates = {
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (updates.name !== void 0) dbUpdates.name = updates.name;
        if (updates.description !== void 0) dbUpdates.description = updates.description;
        if (updates.type !== void 0) dbUpdates.type = updates.type;
        if (updates.rules !== void 0) dbUpdates.rules = updates.rules;
        let query = client.from("contact_lists").update(dbUpdates).eq("id", id);
        if (tenantId) query = query.eq("tenant_id", tenantId);
        const { data, error } = await query.select().single();
        if (error) throw error;
        if (updates.contactIds !== void 0) {
          await client.from("contact_list_members").delete().eq("list_id", id);
          if (updates.contactIds.length > 0) {
            const memberRows = updates.contactIds.map((cid) => ({
              tenant_id: data.tenant_id,
              list_id: id,
              contact_id: cid
            }));
            await client.from("contact_list_members").insert(memberRows);
          }
        }
        const { data: members } = await client.from("contact_list_members").select("contact_id").eq("list_id", id);
        return {
          id: data.id,
          tenantId: data.tenant_id,
          name: data.name,
          description: data.description || "",
          type: data.type,
          rules: data.rules,
          contactIds: (members || []).map((m) => m.contact_id),
          createdAt: data.created_at
        };
      },
      delete: async (id, tenantId) => {
        const client = this.getClient();
        await client.from("contact_list_members").delete().eq("list_id", id);
        let query = client.from("contact_lists").delete().eq("id", id);
        if (tenantId) query = query.eq("tenant_id", tenantId);
        const { error } = await query;
        if (error) throw error;
      }
    };
    // ============================================================================
    // AUDIT LOG REPOSITORY (Cryptographic SHA-256 Hash Chain in PostgreSQL)
    // ============================================================================
    this.auditRepo = {
      log: async (entryData) => {
        const client = this.getClient();
        const createdAt = (/* @__PURE__ */ new Date()).toISOString();
        const { data: latest } = await client.from("audit_logs").select("entry_hash").eq("tenant_id", entryData.tenantId).order("created_at", { ascending: false }).limit(1).maybeSingle();
        const previousHash = latest?.entry_hash || "0000000000000000000000000000000000000000000000000000000000000000";
        const payload = `${previousHash}|${createdAt}|${entryData.tenantId}|${entryData.actorId}|${entryData.action}|${entryData.entityId}|${JSON.stringify(entryData.metadata || {})}`;
        const entryHash = crypto.createHash("sha256").update(payload).digest("hex");
        const { data, error } = await client.from("audit_logs").insert({
          tenant_id: entryData.tenantId,
          actor_id: entryData.actorId,
          actor_name: entryData.actorName,
          actor_role: entryData.actorRole,
          action: entryData.action,
          entity_type: entryData.entityType,
          entity_id: entryData.entityId,
          metadata: entryData.metadata || {},
          ip_address: entryData.ipAddress || "127.0.0.1",
          previous_hash: previousHash,
          entry_hash: entryHash,
          created_at: createdAt
        }).select().single();
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
      findAll: async (tenantId, limit = 100) => {
        const client = this.getClient();
        const { data, error } = await client.from("audit_logs").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(limit);
        if (error) throw error;
        return (data || []).map((d) => ({
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
    this.tenantRepo = {
      getTenant: async (id) => {
        const client = this.getClient();
        const { data, error } = await client.from("tenants").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!data) return null;
        return this.mapDbTenantToDomain(data);
      },
      updateKillSwitch: async (id, isActive, reason, by) => {
        const client = this.getClient();
        const payload = {
          is_kill_switch_active: isActive,
          kill_switch_reason: reason,
          kill_switch_triggered_at: isActive ? (/* @__PURE__ */ new Date()).toISOString() : null,
          kill_switch_triggered_by: isActive ? by : null,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        const { data, error } = await client.from("tenants").update(payload).eq("id", id).select().single();
        if (error) throw error;
        return this.mapDbTenantToDomain(data);
      },
      toggleKillSwitch: async (id, isActive, reason, by) => {
        return this.tenantRepo.updateKillSwitch(id, isActive, reason, by);
      },
      getCurrentUser: async () => {
        throw new Error("getCurrentUser must be resolved through verified Supabase Auth context.");
      },
      switchUserRole: async () => {
        throw new Error("Role modification must be performed through verified database migrations or tenant_members updates.");
      }
    };
    const defaultUrl = "https://cxzynykcdxadhhkjsmgs.supabase.co";
    const defaultKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4enlueWtjZHhhZGhoa2pzbWdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNjU3ODQsImV4cCI6MjEwNjg0MTc4NH0.agjrQeFqscfKF5aN9rUkl4sgL1J_mjU7il3sL6olTjI";
    const rawUrl = config?.url || process.env.SUPABASE_URL || defaultUrl;
    const supabaseUrl = config?.forceUnconfigured ? void 0 : rawUrl.includes("your-project-ref") ? defaultUrl : rawUrl;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY.includes("your-supabase") ? process.env.SUPABASE_SERVICE_ROLE_KEY : void 0;
    const rawKey = config?.key || serviceKey || process.env.SUPABASE_ANON_KEY || defaultKey;
    const supabaseKey = config?.forceUnconfigured ? void 0 : rawKey.includes("your-supabase") ? defaultKey : rawKey;
    if (supabaseUrl && supabaseKey && !supabaseUrl.includes("your-project-ref") && !supabaseKey.includes("your-supabase")) {
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
      console.warn("[SupabaseDatabaseAdapter] WARNING: Supabase credentials not configured in environment. Database operations will reject cleanly.");
    }
  }
  getClient() {
    if (!this.client || !this.isConfigured) {
      throw new DatabaseUnconfiguredError();
    }
    return this.client;
  }
  // ============================================================================
  // AUTHENTICATION & MEMBERSHIP RESOLUTION
  // ============================================================================
  async validateAuthToken(token) {
    const now = Date.now();
    const cached = this.authCache.get(token);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }
    const client = this.getClient();
    const { data: authData, error: authError } = await client.auth.getUser(token);
    if (authError || !authData.user) {
      return null;
    }
    const authUser = authData.user;
    const userId = authUser.id;
    const email = authUser.email || "";
    const [userProfileRes, memberRowsRes] = await Promise.all([
      client.from("users").select("*").eq("id", userId).maybeSingle(),
      client.from("tenant_members").select("id, tenant_id, role, created_at, tenants(*)").eq("user_id", userId)
    ]);
    const userProfile = userProfileRes.data;
    const { data: memberRows, error: memberErr } = memberRowsRes;
    const name = userProfile?.name || authUser.user_metadata?.full_name || email.split("@")[0];
    const avatarUrl = userProfile?.avatar_url || authUser.user_metadata?.avatar_url;
    if (memberErr || !memberRows || memberRows.length === 0) {
      try {
        const cleanSlug = (email.split("@")[0] || "workspace").toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30);
        const uniqueSlug = `${cleanSlug}-${userId.slice(0, 8)}`;
        const tenantName = name ? `${name}'s Workspace` : "Primary Workspace";
        const { data: createdTenant } = await client.from("tenants").insert({
          name: tenantName,
          slug: uniqueSlug,
          status: "ACTIVE"
        }).select().maybeSingle();
        if (createdTenant) {
          await client.from("users").upsert({
            id: userId,
            email,
            name: name || email.split("@")[0],
            avatar_url: avatarUrl
          }, { onConflict: "id" });
          await client.from("tenant_members").insert({
            tenant_id: createdTenant.id,
            user_id: userId,
            role: "OWNER"
          });
          return {
            user: { id: userId, email, name, role: "OWNER", avatarUrl },
            memberships: [{
              id: crypto.randomUUID(),
              tenantId: createdTenant.id,
              userId,
              role: "OWNER",
              createdAt: (/* @__PURE__ */ new Date()).toISOString(),
              tenant: this.mapDbTenantToDomain(createdTenant)
            }]
          };
        }
      } catch (autoErr) {
        console.warn("[validateAuthToken] Auto-provision workspace notice:", autoErr);
      }
      return {
        user: { id: userId, email, name, role: "VIEWER", avatarUrl },
        memberships: []
      };
    }
    const memberships = memberRows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId,
      role: row.role,
      createdAt: row.created_at,
      tenant: this.mapDbTenantToDomain(row.tenants)
    }));
    const result = {
      user: {
        id: userId,
        email,
        name,
        role: memberships[0].role,
        avatarUrl
      },
      memberships
    };
    this.authCache.set(token, { result, expiresAt: now + 60 * 1e3 });
    if (this.authCache.size > 200) {
      for (const [k, v] of this.authCache.entries()) {
        if (v.expiresAt <= now) this.authCache.delete(k);
      }
    }
    return result;
  }
  // Helper Mappers between PostgreSQL snake_case and Domain camelCase
  mapDbContactToDomain(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      firstName: row.first_name || "",
      lastName: row.last_name || "",
      displayName: row.display_name,
      companyName: row.company_name || "",
      jobTitle: row.job_title || "",
      phone: row.phone,
      email: row.email || "",
      city: row.city || "",
      state: row.state || "Telangana",
      country: row.country || "India",
      status: row.status,
      source: row.source,
      leadStatus: row.lead_status,
      notes: row.notes || "",
      tags: row.tags || [],
      customFields: row.custom_fields || {},
      channelAddresses: [
        { id: `addr-${row.id}-1`, channelType: "WHATSAPP", address: row.phone, isPrimary: true, isVerified: true },
        { id: `addr-${row.id}-2`, channelType: "EMAIL", address: row.email, isPrimary: true, isVerified: !!row.email }
      ],
      preferences: {
        WHATSAPP: { channel: "WHATSAPP", marketingAllowed: true, transactionalAllowed: true },
        EMAIL: { channel: "EMAIL", marketingAllowed: true, transactionalAllowed: true },
        SMS: { channel: "SMS", marketingAllowed: true, transactionalAllowed: true }
      },
      isGloballyBlocked: row.is_globally_blocked || false,
      blockedReason: row.blocked_reason,
      lastInteractionAt: row.last_interaction_at,
      lastMessageSentAt: row.last_message_sent_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  mapDbCampaignToDomain(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description || "",
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
  mapDbRecipientToDomain(row) {
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
  mapDbTemplateToDomain(row) {
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
  mapDbListToDomain(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description || "",
      type: row.type,
      rules: row.rules,
      contactIds: row.contact_ids || [],
      createdAt: row.created_at
    };
  }
  mapDbTenantToDomain(row) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      timezone: row.timezone || "Asia/Kolkata",
      isKillSwitchActive: row.is_kill_switch_active || false,
      killSwitchReason: row.kill_switch_reason,
      killSwitchTriggeredAt: row.kill_switch_triggered_at,
      killSwitchTriggeredBy: row.kill_switch_triggered_by,
      createdAt: row.created_at
    };
  }
};
var db = new SupabaseDatabaseAdapter();

// src/core/validation/dataQuality.ts
var DISPOSABLE_EMAIL_DOMAINS = /* @__PURE__ */ new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "sharklasers.com",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "dispostable.com"
]);
var DataQualityEngine = class {
  /**
   * Normalizes phone numbers to canonical E.164.
   * Special high-accuracy rule for India (+91) with standard 10-digit mobile check.
   */
  static normalizePhone(rawPhone, defaultCountry = "IN") {
    if (!rawPhone || typeof rawPhone !== "string") {
      return { isValid: false, canonical: "", country: defaultCountry, isMobile: false, isLandline: false, error: "Phone number is empty" };
    }
    const segments = rawPhone.split(/[:;,/|]+/).map((s) => s.trim()).filter(Boolean);
    const candidate = segments[0] || rawPhone;
    let cleaned = candidate.trim().replace(/[\s\-\(\)\.]/g, "");
    if (cleaned.startsWith("00")) {
      cleaned = "+" + cleaned.substring(2);
    }
    if (defaultCountry === "IN" || cleaned.startsWith("+91") || cleaned.startsWith("91") && cleaned.length === 12 || cleaned.startsWith("0") && cleaned.length >= 10) {
      let digits = cleaned;
      if (digits.startsWith("+91")) {
        digits = digits.substring(3);
      } else if (digits.startsWith("91") && digits.length === 12) {
        digits = digits.substring(2);
      } else if (digits.startsWith("0")) {
        digits = digits.replace(/^0+/, "");
      }
      if (!/^\d{10}$/.test(digits)) {
        const canonical2 = cleaned.startsWith("+") ? cleaned : `+91${digits}`;
        return {
          isValid: false,
          canonical: canonical2,
          country: "IN",
          isMobile: false,
          isLandline: digits.length < 10,
          error: `Malformed Indian number (${digits.length} digits). Expected 10 digits.`
        };
      }
      const firstDigit = digits.charAt(0);
      const isMobile = ["6", "7", "8", "9"].includes(firstDigit);
      const canonical = `+91${digits}`;
      return {
        isValid: isMobile,
        canonical,
        country: "IN",
        isMobile,
        isLandline: !isMobile,
        error: isMobile ? void 0 : `Number begins with '${firstDigit}' which indicates a landline, not a mobile/WhatsApp line.`
      };
    }
    if (cleaned.startsWith("+")) {
      const digitsOnly = cleaned.substring(1);
      if (/^[1-9]\d{7,14}$/.test(digitsOnly)) {
        return {
          isValid: true,
          canonical: cleaned,
          country: "INTL",
          isMobile: true,
          isLandline: false
        };
      }
    }
    if (/^[1-9]\d{9,14}$/.test(cleaned)) {
      return {
        isValid: true,
        canonical: `+${cleaned}`,
        country: "INTL",
        isMobile: true,
        isLandline: false
      };
    }
    return {
      isValid: false,
      canonical: cleaned.startsWith("+") ? cleaned : `+${cleaned}`,
      country: defaultCountry,
      isMobile: false,
      isLandline: false,
      error: "Invalid phone format. Please include valid country code."
    };
  }
  /**
   * Validates and normalizes email addresses.
   */
  static normalizeEmail(rawEmail) {
    if (!rawEmail || typeof rawEmail !== "string") {
      return { isValid: false, canonical: "", domain: "", isDisposable: false, error: "Email is empty" };
    }
    const trimmed = rawEmail.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(trimmed)) {
      return {
        isValid: false,
        canonical: trimmed,
        domain: trimmed.split("@")[1] || "",
        isDisposable: false,
        error: "Malformed email syntax"
      };
    }
    const parts = trimmed.split("@");
    const domain = parts[1];
    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      return {
        isValid: false,
        canonical: trimmed,
        domain,
        isDisposable: true,
        error: `Temporary or disposable email domain (${domain}) detected`
      };
    }
    return {
      isValid: true,
      canonical: trimmed,
      domain,
      isDisposable: false
    };
  }
  /**
   * Resolves text variables like {{first_name}}, {{company_name}} in templates.
   */
  static resolveTemplateVariables(template, data) {
    const missing = [];
    const resolved = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      const val = data[key];
      if (val === void 0 || val === null || val.trim() === "") {
        missing.push(key);
        return `{{${key}}}`;
      }
      return val;
    });
    return {
      resolved,
      missingVariables: Array.from(new Set(missing))
    };
  }
};

// src/core/policy/communicationPolicy.ts
var CommunicationPolicyEngine = class {
  /**
   * Evaluates if a message can be prepared and sent to a recipient.
   * Returns a structured report with all passing and failing criteria.
   */
  static evaluate(context) {
    const { tenant, contact, channel, actorRole, rawTemplateText, isMarketingCampaign } = context;
    const reasons = [];
    if (tenant.isKillSwitchActive) {
      reasons.push({
        passed: false,
        code: "KILL_SWITCH_ACTIVE",
        message: `Workspace Emergency Kill Switch is ACTIVE: ${tenant.killSwitchReason || "All outreach paused"}`
      });
    } else {
      reasons.push({
        passed: true,
        code: "KILL_SWITCH_OK",
        message: "Workspace outreach is active"
      });
    }
    if (contact.isGloballyBlocked) {
      reasons.push({
        passed: false,
        code: "GLOBAL_BLOCK",
        message: `Contact is globally blocked: ${contact.blockedReason || "Marked as Do Not Contact"}`
      });
    } else {
      reasons.push({
        passed: true,
        code: "GLOBAL_BLOCK_OK",
        message: "Contact is not globally suppressed"
      });
    }
    if (contact.status === "BLOCKED" || contact.status === "ARCHIVED") {
      reasons.push({
        passed: false,
        code: "STATUS_INVALID",
        message: `Contact status is '${contact.status}'`
      });
    } else {
      reasons.push({
        passed: true,
        code: "STATUS_OK",
        message: "Contact status is active"
      });
    }
    if (actorRole === "VIEWER") {
      reasons.push({
        passed: false,
        code: "INSUFFICIENT_ROLE",
        message: "Viewers have read-only access and cannot dispatch outreach"
      });
    } else {
      reasons.push({
        passed: true,
        code: "ROLE_AUTHORIZED",
        message: `Operator role '${actorRole}' is authorized to dispatch`
      });
    }
    if (channel === "WHATSAPP") {
      const phoneNorm = DataQualityEngine.normalizePhone(contact.phone);
      if (!phoneNorm.isValid) {
        reasons.push({
          passed: false,
          code: "INVALID_WHATSAPP_PHONE",
          message: phoneNorm.error || "Contact has an invalid WhatsApp phone number"
        });
      } else if (phoneNorm.isLandline) {
        reasons.push({
          passed: false,
          code: "LANDLINE_DETECTED",
          message: "Contact phone appears to be a landline"
        });
      } else {
        reasons.push({
          passed: true,
          code: "WHATSAPP_PHONE_OK",
          message: `Valid canonical mobile number (${phoneNorm.canonical})`
        });
      }
    } else if (channel === "EMAIL") {
      const emailNorm = DataQualityEngine.normalizeEmail(contact.email);
      if (!emailNorm.isValid) {
        reasons.push({
          passed: false,
          code: "INVALID_EMAIL",
          message: emailNorm.error || "Contact has an invalid email address"
        });
      } else {
        reasons.push({
          passed: true,
          code: "EMAIL_OK",
          message: `Valid email address (${emailNorm.canonical})`
        });
      }
    }
    const channelPref = contact.preferences[channel];
    if (isMarketingCampaign && channelPref && !channelPref.marketingAllowed) {
      reasons.push({
        passed: false,
        code: "MARKETING_OPTED_OUT",
        message: `Contact has opted out of marketing communications via ${channel}`
      });
    } else {
      reasons.push({
        passed: true,
        code: "CONSENT_OK",
        message: `Communication consent is granted for ${channel}`
      });
    }
    const contactData = {
      first_name: contact.firstName,
      last_name: contact.lastName,
      name: contact.displayName || `${contact.firstName} ${contact.lastName}`.trim(),
      company_name: contact.companyName,
      company: contact.companyName,
      city: contact.city,
      state: contact.state,
      phone: contact.phone,
      email: contact.email,
      ...contact.customFields
    };
    const { missingVariables } = DataQualityEngine.resolveTemplateVariables(rawTemplateText, contactData);
    if (missingVariables.length > 0) {
      reasons.push({
        passed: false,
        code: "UNRESOLVED_VARIABLES",
        message: `Missing required template variables: ${missingVariables.map((v) => `{{${v}}}`).join(", ")}`
      });
    } else {
      reasons.push({
        passed: true,
        code: "VARIABLES_RESOLVED",
        message: "All template variables resolved successfully"
      });
    }
    const failedReasons = reasons.filter((r) => !r.passed);
    const canSend = failedReasons.length === 0;
    return {
      canSend,
      reasons,
      primaryBlockReason: failedReasons[0]?.message
    };
  }
};

// src/core/channels/whatsAppManualChannel.ts
var WhatsAppManualChannel = class {
  constructor() {
    this.channelType = "WHATSAPP";
  }
  supportsAttachments() {
    return false;
  }
  supportsPrefilledText() {
    return true;
  }
  prepareMessage(input) {
    const phoneDigits = input.address.replace(/\D/g, "");
    const encodedBody = encodeURIComponent(input.body);
    const deepLinkUrl = `https://wa.me/${phoneDigits}?text=${encodedBody}`;
    let instructions = "Review the prefilled text in WhatsApp, then manually press Send.";
    if (input.attachmentName) {
      instructions = `ATTACHMENT REQUIRED: Please manually attach "${input.attachmentName}" using WhatsApp's paperclip icon before pressing Send.`;
    }
    return {
      recipientId: input.recipientId,
      recipientName: input.recipientName,
      channel: "WHATSAPP",
      address: input.address,
      body: input.body,
      attachmentName: input.attachmentName,
      deepLinkUrl,
      instructions
    };
  }
};

// src/core/channels/emailManualChannel.ts
var EmailManualChannel = class {
  constructor() {
    this.channelType = "EMAIL";
  }
  supportsAttachments() {
    return false;
  }
  supportsPrefilledText() {
    return true;
  }
  prepareMessage(input) {
    const encodedSubject = encodeURIComponent(input.subject || "Outreach from ReachOut OS");
    const encodedBody = encodeURIComponent(input.body);
    const deepLinkUrl = `mailto:${encodeURIComponent(input.address)}?subject=${encodedSubject}&body=${encodedBody}`;
    let instructions = "Review the drafted message in your email client, then click Send.";
    if (input.attachmentName) {
      instructions = `ATTACHMENT REQUIRED: Please manually attach "${input.attachmentName}" in your mail client before sending.`;
    }
    return {
      recipientId: input.recipientId,
      recipientName: input.recipientName,
      channel: "EMAIL",
      address: input.address,
      subject: input.subject,
      body: input.body,
      attachmentName: input.attachmentName,
      deepLinkUrl,
      instructions
    };
  }
};

// src/services/aiCopilotService.ts
import { GoogleGenAI } from "@google/genai";
var ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
var AICopilotService = class {
  /**
   * Generates 3 outreach drafts adhering to commercial messaging standards
   */
  static async generateDrafts(request) {
    const prompt = `
You are an expert B2B and commercial outreach copywriter for FMCG, retail networks, and wholesale distributions in India.
Create 3 high-converting, courteous message drafts for manual dispatch via ${request.channel}.

Product/Brand: ${request.productName} by ${request.senderBrand}
Audience Target: ${request.audienceType} ${request.targetCity ? `in ${request.targetCity}` : ""}
Tone: ${request.tone}
Key Highlights: ${request.keyBenefits.join(", ")}

Strict Rules:
- Include variables {{first_name}}, {{company_name}}, and {{city}} where natural.
- Keep WhatsApp messages punchy (under 120 words), readable on mobile screens with clear spacing.
- Include a soft, respectful call-to-action (CTA).
- Do not make exaggerated, unverified medicinal or magical claims.
- Return output strictly as a JSON array of objects with keys: "title", "hook", "body".
`;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const text = response.text || "[]";
      const parsed = JSON.parse(text);
      return {
        drafts: Array.isArray(parsed) ? parsed : [parsed],
        estimatedCostRupees: 0.15
      };
    } catch (err) {
      console.warn("Gemini generate drafts fallback:", err?.message);
      return {
        drafts: [
          {
            title: "Value & Margin Proposition",
            hook: "High retail demand with 35% margin",
            body: `Namaste {{first_name}} garu,

We are introducing pure unprocessed ${request.productName} from ${request.senderBrand}. Retailers across {{city}} are seeing high repeat demand with 35% retail margins.

Would you like our wholesale sample kit delivered to {{company_name}} this week?

Regards,
${request.senderBrand}`
          },
          {
            title: "Quality & Lab Tested Certificate",
            hook: "Direct forest harvest with lab purity test",
            body: `Hello {{first_name}},

Customers in {{city}} are actively demanding genuine, chemical-free ${request.productName}. At ${request.senderBrand}, our batches are NMR and lab verified for complete purity.

Can we share our wholesale price slab and dealer catalog with {{company_name}}?

Warm regards,
${request.senderBrand}`
          },
          {
            title: "Short & Direct Inquiry",
            hook: "New product availability in your area",
            body: `Namaste {{first_name}},

Hope {{company_name}} is having a great trading week. We have just opened direct wholesale dispatch of ${request.productName} for ${request.targetCity || "{{city}}"}.

Reply with "YES" and we will send our trade catalogue right here.

Thanks,
${request.senderBrand}`
          }
        ],
        estimatedCostRupees: 0.05
      };
    }
  }
  /**
   * Personalizes a base message for a specific recipient
   */
  static async personalize(request) {
    const prompt = `
Rewrite this outreach message specifically tailored for:
Contact Name: ${request.contactName}
Business: ${request.companyName}
Location: ${request.city}
Customer Segment: ${request.leadStatus}
${request.customContext ? `Extra Context: ${request.customContext}` : ""}

Original Message:
"""
${request.baseMessage}
"""

Rules:
- Keep the core offer intact.
- Make the greeting culturally natural for Indian business contexts (e.g. respectful address).
- Maintain concise spacing.
- Return ONLY the final revised message text without surrounding quotes or conversational filler.
`;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt
      });
      return { personalized: response.text?.trim() || request.baseMessage };
    } catch (err) {
      const personalized = request.baseMessage.replace(/\{\{\s*first_name\s*\}\}/g, request.contactName.split(" ")[0] || request.contactName).replace(/\{\{\s*company_name\s*\}\}/g, request.companyName).replace(/\{\{\s*city\s*\}\}/g, request.city);
      return { personalized };
    }
  }
  /**
   * Rewrites an outreach message with specific focus or localized translation
   */
  static async rewrite(request) {
    let instruction = "";
    switch (request.mode) {
      case "shorten":
        instruction = "Make this message significantly shorter and more concise (under 50 words) while keeping the call-to-action.";
        break;
      case "persuasive":
        instruction = "Make this message more compelling and focused on retailer margins, product authenticity, and fast reorders.";
        break;
      case "professional":
        instruction = "Polish the tone to be formal, respectful, and suitable for B2B wholesale buyers.";
        break;
      case "telugu":
        instruction = "Translate or adapt this business message into polite, natural business Telugu (in Telugu script), keeping {{first_name}}, {{company_name}}, {{city}} placeholders.";
        break;
      case "hindi":
        instruction = "Translate or adapt this message into clean, courteous business Hindi (Devanagari script), preserving placeholder variables.";
        break;
      case "hinglish":
        instruction = "Adapt this message into friendly conversational Indian Hinglish (Latin alphabet) commonly used in business WhatsApp outreach in Telangana/AP/North India.";
        break;
    }
    const prompt = `
Task: ${instruction}

Message to rewrite:
"""
${request.message}
"""

Return ONLY the rewritten message body text. Preserve any variable markers like {{first_name}}, {{company_name}} if present.
`;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt
      });
      return { rewritten: response.text?.trim() || request.message };
    } catch (err) {
      return { rewritten: request.message };
    }
  }
  /**
   * Guardrail analysis: spam triggers, unsupported claims, missing personalization
   */
  static async checkGuardrails(message) {
    const prompt = `
Analyze this commercial B2B message for policy compliance, spam risk, and marketing quality:

Message:
"""
${message}
"""

Evaluate:
1. spamTriggers: (e.g. ALL CAPS, "100% FREE MONEY", urgent pressure tactics, excessive exclamation marks)
2. unsupportedClaims: (e.g. "cures all diseases", "miracle remedy", "guaranteed 1000% profit")
3. recommendations: suggestions to improve readability and deliverability
4. score: 0 to 100 quality score (100 = completely compliant, professional, clear CTA)

Return output strictly in JSON format with keys:
"isSafe": boolean,
"score": number,
"spamTriggers": string[],
"unsupportedClaims": string[],
"recommendations": string[]
`;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const parsed = JSON.parse(response.text || "{}");
      const words = message.trim().split(/\s+/).length;
      return {
        isSafe: parsed.isSafe ?? true,
        score: parsed.score ?? 85,
        spamTriggers: parsed.spamTriggers || [],
        unsupportedClaims: parsed.unsupportedClaims || [],
        recommendations: parsed.recommendations || ["Keep CTA easy to reply with a single word"],
        estimatedReadTimeSec: Math.max(3, Math.ceil(words / 3.5))
      };
    } catch (err) {
      const spamTriggers = [];
      const unsupportedClaims = [];
      const recommendations = [];
      if (message.includes("FREE") || message.includes("URGENT") || message.includes("100% FREE")) {
        spamTriggers.push('Excessive promotional capitalization detected ("FREE", "URGENT")');
      }
      if (message.includes("cure") || message.includes("miracle") || message.includes("guarantee")) {
        unsupportedClaims.push("Unverified medical or absolute guarantee claims detected");
      }
      if (!message.includes("{{first_name}}")) {
        recommendations.push("Consider adding {{first_name}} variable for higher engagement");
      }
      const score = 90 - spamTriggers.length * 20 - unsupportedClaims.length * 25;
      return {
        isSafe: unsupportedClaims.length === 0,
        score: Math.max(10, score),
        spamTriggers,
        unsupportedClaims,
        recommendations: recommendations.length ? recommendations : ["Tone is clean and ready for manual review"],
        estimatedReadTimeSec: 12
      };
    }
  }
};

// src/middleware/authMiddleware.ts
async function authenticateToken(req, res, next) {
  if (!db.isConfigured) {
    return res.status(503).json({
      error: {
        code: "DATABASE_UNCONFIGURED",
        message: "Authoritative Supabase database is not configured. Please supply SUPABASE_URL and SUPABASE_ANON_KEY."
      }
    });
  }
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  if (!token) {
    return res.status(401).json({
      error: {
        code: "MISSING_AUTHENTICATION_TOKEN",
        message: "Authentication required. Please provide a valid Supabase Auth Bearer token."
      }
    });
  }
  try {
    const authResult = await db.validateAuthToken(token);
    if (!authResult) {
      return res.status(401).json({
        error: {
          code: "INVALID_OR_EXPIRED_TOKEN",
          message: "Supabase authentication token is invalid or expired."
        }
      });
    }
    const { user, memberships } = authResult;
    if (memberships.length === 0) {
      return res.status(403).json({
        error: {
          code: "NO_TENANT_MEMBERSHIP",
          message: "Authenticated user does not belong to any active workspace tenant in the database."
        }
      });
    }
    const requestedTenantId = req.headers["x-tenant-id"];
    let activeMembership = memberships[0];
    if (requestedTenantId) {
      const match = memberships.find((m) => m.tenantId === requestedTenantId);
      if (!match) {
        return res.status(403).json({
          error: {
            code: "CROSS_TENANT_ACCESS_DENIED",
            message: "You are not an authorized member of the requested tenant workspace."
          }
        });
      }
      activeMembership = match;
    }
    req.auth = {
      user: {
        ...user,
        role: activeMembership.role
      },
      tenant: activeMembership.tenant,
      role: activeMembership.role
    };
    next();
  } catch (err) {
    if (err instanceof DatabaseUnconfiguredError) {
      return res.status(503).json({
        error: {
          code: "DATABASE_UNCONFIGURED",
          message: err.message
        }
      });
    }
    return res.status(401).json({
      error: {
        code: "INVALID_OR_EXPIRED_TOKEN",
        message: err.message || "Authentication token validation failed."
      }
    });
  }
}
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
    }
    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({
        error: {
          code: "INSUFFICIENT_ROLE_PERMISSIONS",
          message: `Role '${req.auth.role}' is not authorized to execute this operation. Required: ${allowedRoles.join(", ")}`
        }
      });
    }
    next();
  };
}

// src/compliance/PolicyVersion.ts
var ACTIVE_META_POLICY_VERSION = {
  policy_provider: "Meta / WhatsApp",
  policy_family: "WhatsApp Business",
  version: "2026-10",
  source_type: "official",
  authority: "Meta Platforms, Inc.",
  official_sources: [
    "https://business.whatsapp.com/policy",
    "https://www.whatsapp.com/legal/business-terms/",
    "https://developers.facebook.com/docs/whatsapp/messaging-limits",
    "https://www.facebook.com/policies_center/commerce"
  ],
  last_verified_at: "2026-10-08T00:00:00Z",
  next_review: "2026-11-08T00:00:00Z",
  description: "Meta WhatsApp Business Messaging Policy Registry v2026-10 for ReachOut OS.",
  engine_principles: [
    "The AI proposes; the Policy Engine decides.",
    "Fail closed: unverified compliance triggers BLOCK or HUMAN_REVIEW.",
    "Opt-out is an immutable hard system control.",
    "Every evaluation generates an immutable audit record."
  ]
};

// database/policies/whatsapp/whatsapp-policy.json
var whatsapp_policy_default = {
  policy_provider: "Meta / WhatsApp",
  policy_family: "WhatsApp Business",
  version: "2026-10",
  source_type: "official",
  authority: "Meta Platforms, Inc.",
  official_sources: [
    "https://business.whatsapp.com/policy",
    "https://www.whatsapp.com/legal/business-terms/",
    "https://developers.facebook.com/docs/whatsapp/messaging-limits",
    "https://www.facebook.com/policies_center/commerce"
  ],
  last_verified_at: "2026-10-08T00:00:00Z",
  next_review: "2026-11-08T00:00:00Z",
  description: "Authoritative Meta WhatsApp Business Messaging Policy Registry for ReachOut OS. Enforces human-in-the-loop compliance, explicit consent, 24-hour service windows, template purpose integrity, content restrictions, commerce rules, and sensitive data protection.",
  engine_principles: [
    "The AI proposes; the Policy Engine decides.",
    "Fail closed: if compliance cannot be positively verified, block or flag for human review.",
    "Hard system controls on opt-outs: irrevocable without explicit compliance admin action.",
    "Every evaluation generates an immutable audit record referencing the exact policy version and evaluated rule IDs."
  ]
};

// database/policies/whatsapp/whatsapp-rules.json
var whatsapp_rules_default = [
  {
    id: "WA-IDENT-001",
    category: "identity",
    name: "Accurate Business Identity",
    severity: "BLOCKING",
    applies_to: ["business_app", "business_platform"],
    rule: {
      condition: "sender_identity_is_verified_and_accurate",
      evaluation_type: "IDENTITY_VERIFICATION"
    },
    failure_action: "BLOCK_SEND",
    explanation: "Meta requires an accurate Business profile and explicitly prohibits impersonation or misleading business affiliation.",
    source: {
      authority: "Meta",
      document: "WhatsApp Business Messaging Policy",
      section: "General Terms & Business Identity",
      url: "https://business.whatsapp.com/policy"
    },
    effective_from: "2026-10-08",
    review_required: false
  },
  {
    id: "WA-CONSENT-001",
    category: "consent",
    name: "Valid WhatsApp Opt-In Required",
    severity: "BLOCKING",
    applies_to: ["business_app", "business_platform"],
    rule: {
      condition: "recipient_has_valid_whatsapp_opt_in",
      evaluation_type: "CONSENT_VERIFICATION"
    },
    failure_action: "BLOCK_SEND",
    explanation: "Recipient must have explicitly opted in to receive WhatsApp messages from this business prior to business-initiated outreach.",
    source: {
      authority: "Meta",
      document: "WhatsApp Business Messaging Policy",
      section: "Opt-in Requirements",
      url: "https://business.whatsapp.com/policy"
    },
    effective_from: "2026-10-08",
    review_required: false
  },
  {
    id: "WA-CONSENT-002",
    category: "consent",
    name: "Category-Specific Consent Match",
    severity: "BLOCKING",
    applies_to: ["business_app", "business_platform"],
    rule: {
      condition: "consent_category_matches_message_intent",
      evaluation_type: "CATEGORY_MATCH"
    },
    failure_action: "BLOCK_SEND",
    explanation: "Marketing communications require explicit marketing consent. Transactional or utility consent does not permit promotional broadcasts.",
    source: {
      authority: "Meta",
      document: "WhatsApp Business Messaging Policy",
      section: "Opt-in Categories",
      url: "https://business.whatsapp.com/policy"
    },
    effective_from: "2026-10-08",
    review_required: false
  },
  {
    id: "WA-OPTOUT-001",
    category: "opt_out",
    name: "Immediate Opt-Out Hard Enforcement",
    severity: "BLOCKING",
    applies_to: ["business_app", "business_platform"],
    rule: {
      condition: "recipient_has_not_opted_out",
      evaluation_type: "SUPPRESSION_CHECK"
    },
    failure_action: "BLOCK_SEND",
    explanation: "Meta mandates that requests to stop, block, or opt-out must be immediately honored across all channels. AI cannot override opt-outs.",
    source: {
      authority: "Meta",
      document: "WhatsApp Business Messaging Policy",
      section: "Opt-out & User Control",
      url: "https://business.whatsapp.com/policy"
    },
    effective_from: "2026-10-08",
    review_required: false
  },
  {
    id: "WA-WINDOW-001",
    category: "window",
    name: "24-Hour Customer Service Window Enforcement",
    severity: "BLOCKING",
    applies_to: ["business_platform"],
    rule: {
      condition: "business_initiated_outside_window_requires_template",
      evaluation_type: "WINDOW_CALCULATION"
    },
    failure_action: "BLOCK_SEND",
    explanation: "Outside the 24-hour customer service window following the user's last inbound message, business-initiated messages require an approved template.",
    source: {
      authority: "Meta",
      document: "WhatsApp Business Messaging Policy",
      section: "Customer Care Window & Message Templates",
      url: "https://business.whatsapp.com/policy"
    },
    effective_from: "2026-10-08",
    review_required: false
  },
  {
    id: "WA-TEMPLATE-001",
    category: "template",
    name: "Approved Template Status Required",
    severity: "BLOCKING",
    applies_to: ["business_platform"],
    rule: {
      condition: "template_is_approved_by_meta",
      evaluation_type: "TEMPLATE_STATUS"
    },
    failure_action: "BLOCK_SEND",
    explanation: "Outbound broadcast messages outside active 24-hour service windows must use a pre-approved template with active status.",
    source: {
      authority: "Meta",
      document: "WhatsApp Business Messaging Policy",
      section: "Template Approval & Guidelines",
      url: "https://business.whatsapp.com/policy"
    },
    effective_from: "2026-10-08",
    review_required: false
  },
  {
    id: "WA-TEMPLATE-002",
    category: "template",
    name: "Template Purpose Integrity",
    severity: "BLOCKING",
    applies_to: ["business_app", "business_platform"],
    rule: {
      condition: "template_purpose_matches_content",
      evaluation_type: "INTENT_INTEGRITY"
    },
    failure_action: "BLOCK_SEND",
    explanation: "Approved templates must only be used for their designated category. Repurposing a utility/service template for promotional marketing is prohibited.",
    source: {
      authority: "Meta",
      document: "WhatsApp Business Messaging Policy",
      section: "Template Categories & Prohibited Misuse",
      url: "https://business.whatsapp.com/policy"
    },
    effective_from: "2026-10-08",
    review_required: false
  },
  {
    id: "WA-CONTENT-001",
    category: "content",
    name: "Spam, Deception & Fraud Prevention",
    severity: "BLOCKING",
    applies_to: ["business_app", "business_platform"],
    rule: {
      condition: "content_is_free_from_spam_fraud_deception",
      evaluation_type: "CONTENT_SCAN"
    },
    failure_action: "BLOCK_SEND",
    explanation: "Meta strictly prohibits spam, misleading claims, phishing, fraudulent offers, and unsolicited bulk distribution.",
    source: {
      authority: "Meta",
      document: "WhatsApp Business Messaging Policy",
      section: "Acceptable Use & Anti-Spam",
      url: "https://business.whatsapp.com/policy"
    },
    effective_from: "2026-10-08",
    review_required: false
  },
  {
    id: "WA-CONTENT-002",
    category: "content",
    name: "Medical & Health Claim Restrictions",
    severity: "REVIEW",
    applies_to: ["business_app", "business_platform"],
    rule: {
      condition: "health_claims_require_compliance_review",
      evaluation_type: "HEALTH_CLAIM_SCAN"
    },
    failure_action: "REQUIRE_HUMAN_REVIEW",
    explanation: "Unsubstantiated or miraculous medical claims, pharmaceutical sales without prescription, or health guarantees trigger mandatory human compliance review.",
    source: {
      authority: "Meta",
      document: "WhatsApp Business Messaging Policy",
      section: "Healthcare & Pharmaceuticals",
      url: "https://business.whatsapp.com/policy"
    },
    effective_from: "2026-10-08",
    review_required: true
  },
  {
    id: "WA-PROHIBITED-001",
    category: "prohibited_goods",
    name: "Prohibited Goods & Services Restrictions",
    severity: "BLOCKING",
    applies_to: ["business_app", "business_platform"],
    rule: {
      condition: "content_does_not_promote_prohibited_goods",
      evaluation_type: "PROHIBITED_GOODS_SCAN"
    },
    failure_action: "BLOCK_SEND",
    explanation: "Meta explicitly prohibits messaging related to weapons, tobacco, alcohol, recreational drugs, illegal items, real-money gambling, or adult content.",
    source: {
      authority: "Meta",
      document: "WhatsApp Business Messaging Policy",
      section: "Prohibited Products & Services",
      url: "https://business.whatsapp.com/policy"
    },
    effective_from: "2026-10-08",
    review_required: false
  },
  {
    id: "WA-COMMERCE-001",
    category: "commerce",
    name: "Meta Commerce Policy Integration",
    severity: "BLOCKING",
    applies_to: ["business_app", "business_platform"],
    rule: {
      condition: "commerce_interactions_comply_with_meta_commerce_policy",
      evaluation_type: "COMMERCE_COMPLIANCE"
    },
    failure_action: "BLOCK_SEND",
    explanation: "All catalog items, order confirmations, price quotes, and checkout interactions must strictly comply with the Meta Commerce Policy.",
    source: {
      authority: "Meta",
      document: "Meta Commerce Policy",
      section: "Merchant Terms & Product Eligibility",
      url: "https://www.facebook.com/policies_center/commerce"
    },
    effective_from: "2026-10-08",
    review_required: false
  },
  {
    id: "WA-DATA-001",
    category: "data_protection",
    name: "Payment Card & Financial Credential Protection",
    severity: "BLOCKING",
    applies_to: ["business_app", "business_platform"],
    rule: {
      condition: "no_credit_card_or_financial_credentials_requested",
      evaluation_type: "SENSITIVE_DATA_SCAN"
    },
    failure_action: "BLOCK_SEND",
    explanation: "Businesses must never ask customers to share full credit card numbers, CVVs, PINs, or banking account passwords over WhatsApp.",
    source: {
      authority: "Meta",
      document: "WhatsApp Business Messaging Policy",
      section: "Data Handling & Customer Privacy",
      url: "https://business.whatsapp.com/policy"
    },
    effective_from: "2026-10-08",
    review_required: false
  },
  {
    id: "WA-DATA-002",
    category: "data_protection",
    name: "National Identification & SSN Shield",
    severity: "BLOCKING",
    applies_to: ["business_app", "business_platform"],
    rule: {
      condition: "no_national_id_numbers_collected",
      evaluation_type: "PII_SCAN"
    },
    failure_action: "BLOCK_SEND",
    explanation: "Meta restricts requesting government-issued national identifiers (e.g. Social Security Numbers, Aadhaar, PAN) via WhatsApp messages.",
    source: {
      authority: "Meta",
      document: "WhatsApp Business Messaging Policy",
      section: "Customer Privacy & Sensitive PII",
      url: "https://business.whatsapp.com/policy"
    },
    effective_from: "2026-10-08",
    review_required: false
  },
  {
    id: "WA-AUTOMATION-001",
    category: "automation",
    name: "Human Escalation Path Requirement",
    severity: "REVIEW",
    applies_to: ["business_platform"],
    rule: {
      condition: "automation_provides_human_agent_escalation",
      evaluation_type: "ESCALATION_CHECK"
    },
    failure_action: "REQUIRE_HUMAN_REVIEW",
    explanation: "Automated messaging systems must provide a clear and direct path to escalate to a human agent, web chat, phone, or email support.",
    source: {
      authority: "Meta",
      document: "WhatsApp Business Messaging Policy",
      section: "Automated Messaging & Human Escalation",
      url: "https://business.whatsapp.com/policy"
    },
    effective_from: "2026-10-08",
    review_required: true
  },
  {
    id: "WA-ENFORCEMENT-001",
    category: "enforcement",
    name: "Fail Closed Safety Guarantee",
    severity: "BLOCKING",
    applies_to: ["business_app", "business_platform"],
    rule: {
      condition: "fail_closed_on_unverified_or_ambiguous_rules",
      evaluation_type: "FAIL_CLOSED_ENGINE"
    },
    failure_action: "BLOCK_SEND",
    explanation: "If any mandatory compliance check cannot be authoritatively verified against the policy registry, the message must not be sent.",
    source: {
      authority: "ReachOut OS Core Architecture",
      document: "Enterprise Safety Mandate",
      section: "Fail Closed Invariant",
      url: "https://reachoutos.com/compliance"
    },
    effective_from: "2026-10-08",
    review_required: false
  }
];

// database/policies/whatsapp/whatsapp-prohibited.json
var whatsapp_prohibited_default = {
  version: "2026-10",
  authority: "Meta WhatsApp Business Messaging Policy",
  last_updated: "2026-10-08",
  prohibited_product_categories: [
    {
      category: "tobacco_and_nicotine",
      status: "PROHIBITED",
      keywords: ["tobacco", "cigarettes", "cigars", "vape", "e-cigarette", "nicotine", "hookah", "bidi"],
      explanation: "Meta strictly prohibits the promotion, sale, or distribution of tobacco and related products."
    },
    {
      category: "alcohol_and_spirits",
      status: "PROHIBITED",
      keywords: ["liquor", "spirits", "vodka", "whiskey", "tequila", "beer", "wine sale", "distillery"],
      explanation: "Promotion or commercial sale of alcoholic beverages is prohibited in business messaging."
    },
    {
      category: "weapons_and_ammunition",
      status: "PROHIBITED",
      keywords: ["firearms", "guns", "pistol", "rifle", "ammunition", "explosives", "fireworks", "knives", "weapons"],
      explanation: "Firearms, weapons, ammunition, and explosives are strictly banned from WhatsApp Business messaging."
    },
    {
      category: "recreational_drugs_and_paraphernalia",
      status: "PROHIBITED",
      keywords: ["cannabis", "marijuana", "narcotics", "prescription drugs", "pharmaceuticals", "psychedelics", "steroids"],
      explanation: "Sale or promotion of illegal, prescription, or recreational drugs and paraphernalia is prohibited."
    },
    {
      category: "gambling_and_lotteries",
      status: "PROHIBITED",
      keywords: ["casino", "gambling", "sports betting", "lottery tickets", "poker real money", "bookmaking"],
      explanation: "Real-money gambling, sports betting, and lotteries are prohibited on WhatsApp."
    },
    {
      category: "adult_and_sexually_explicit",
      status: "PROHIBITED",
      keywords: ["pornography", "escort services", "adult products", "sex toys", "sexually explicit"],
      explanation: "Sexually explicit content, pornography, and adult dating services are strictly prohibited."
    },
    {
      category: "predatory_financial_services",
      status: "PROHIBITED",
      keywords: ["payday loans", "get rich quick", "pyramid scheme", "multi-level marketing", "crypto pump", "guaranteed returns"],
      explanation: "Payday loans, high-interest predatory lending, and deceptive investment schemes violate Meta policy."
    },
    {
      category: "unsubstantiated_medical_claims",
      status: "PROHIBITED",
      keywords: ["miracle cure", "100% cure cancer", "guaranteed weight loss in 3 days", "covid cure", "vaccine fake"],
      explanation: "Deceptive health claims or guarantees to cure serious medical illnesses are prohibited."
    },
    {
      category: "counterfeit_and_stolen_goods",
      status: "PROHIBITED",
      keywords: ["fake rolex", "replica designer", "knockoff", "stolen credentials", "cracked software"],
      explanation: "Counterfeit, unauthorized replicas, and stolen digital credentials violate intellectual property policies."
    }
  ]
};

// database/policies/whatsapp/whatsapp-consent.json
var whatsapp_consent_default = {
  version: "2026-10",
  authority: "Meta WhatsApp Business Messaging Policy",
  last_updated: "2026-10-08",
  consent_requirements: {
    opt_in_mandatory: true,
    opt_in_must_state_channel: true,
    opt_in_must_state_business: true,
    valid_consent_channels: [
      "website_form",
      "website_checkbox",
      "inbound_whatsapp_thread",
      "point_of_sale_form",
      "sms_confirmation",
      "ivr_phone",
      "customer_service_call"
    ],
    consent_categories: {
      marketing: {
        description: "Promotional offers, seasonal campaigns, discounts, product announcements",
        requires_explicit_opt_in: true,
        cannot_be_inferred_from_service: true
      },
      utility: {
        description: "Order confirmations, delivery updates, account alerts, receipts",
        requires_transaction_reference: true
      },
      authentication: {
        description: "One-time passwords, two-factor authentication codes",
        requires_immediate_dispatch: true
      },
      service: {
        description: "Customer care replies within 24-hour inbound window",
        does_not_require_pre_approved_template: true
      }
    },
    opt_out_hard_triggers: [
      "STOP",
      "STOPALL",
      "UNSUBSCRIBE",
      "CANCEL",
      "END",
      "QUIT",
      "OPT OUT",
      "OPTOUT",
      "DON'T MESSAGE ME",
      "DO NOT MESSAGE",
      "REMOVE ME",
      "UNSUB"
    ],
    opt_out_rules: {
      hard_system_lock: true,
      ai_override_allowed: false,
      immediate_suppression: true,
      cross_channel_sync: true,
      revocation_grace_period_seconds: 0
    }
  }
};

// database/policies/whatsapp/whatsapp-templates.json
var whatsapp_templates_default = {
  version: "2026-10",
  authority: "Meta WhatsApp Business Messaging Policy",
  last_updated: "2026-10-08",
  template_specifications: {
    categories: {
      MARKETING: {
        description: "Messages promoting goods, services, sales, offers, or brand awareness",
        allowed_outside_24h_window: true,
        requires_meta_approval: true,
        requires_marketing_consent: true
      },
      UTILITY: {
        description: "Messages related to a specific transaction, order, delivery, or account status",
        allowed_outside_24h_window: true,
        requires_meta_approval: true,
        prohibited_marketing_keywords: [
          "discount",
          "promo",
          "sale",
          "off today",
          "buy now",
          "coupon",
          "limited offer",
          "deal of the day"
        ]
      },
      AUTHENTICATION: {
        description: "One-time passcodes and account verification codes",
        allowed_outside_24h_window: true,
        requires_meta_approval: true,
        enforce_copy_code_button: true
      }
    },
    variable_constraints: {
      max_variable_length: 100,
      disallow_url_parameters_in_variables: true,
      disallow_unresolved_variables: true
    },
    purpose_integrity_rules: {
      strict_category_matching: true,
      block_utility_hijacking_for_marketing: true,
      require_approved_status_to_send: true
    }
  }
};

// database/policies/whatsapp/whatsapp-commerce.json
var whatsapp_commerce_default = {
  version: "2026-10",
  authority: "Meta Commerce Policy",
  last_updated: "2026-10-08",
  commerce_rules: {
    catalog_compliance_required: true,
    accurate_pricing_mandatory: true,
    clear_refund_policy_required: true,
    restricted_commerce_categories: [
      "pharmaceuticals",
      "alcohol",
      "tobacco",
      "weapons",
      "adult_products",
      "financial_instruments",
      "live_animals",
      "hazardous_materials"
    ],
    transaction_invariants: {
      no_hidden_fees: true,
      disclose_shipping_before_order: true,
      honor_cancellation_within_statutory_period: true
    }
  }
};

// database/policies/whatsapp/whatsapp-data-protection.json
var whatsapp_data_protection_default = {
  version: "2026-10",
  authority: "Meta WhatsApp Business Messaging Policy - Data Handling",
  last_updated: "2026-10-08",
  data_protection_rules: {
    prohibited_sensitive_data: [
      {
        type: "PAYMENT_CARD_NUMBER",
        description: "Full 13 to 19 digit primary account numbers (PAN)",
        pattern: "\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\\d{3})\\d{11})\\b",
        severity: "BLOCKING"
      },
      {
        type: "CARD_CVV_CVC",
        description: "Credit card security codes (CVV / CVC)",
        pattern: "\\b(?:cvv|cvc|security code)\\s*[:=]?\\s*[0-9]{3,4}\\b",
        severity: "BLOCKING"
      },
      {
        type: "NATIONAL_ID_US_SSN",
        description: "US Social Security Numbers",
        pattern: "\\b(?!000|666|9\\d{2})\\d{3}[- ]?(?!00)\\d{2}[- ]?(?!0000)\\d{4}\\b",
        severity: "BLOCKING"
      },
      {
        type: "NATIONAL_ID_INDIA_AADHAAR",
        description: "Indian Aadhaar numbers (12-digit UID)",
        pattern: "\\b[2-9]{1}[0-9]{3}\\s?[0-9]{4}\\s?[0-9]{4}\\b",
        severity: "BLOCKING"
      },
      {
        type: "BANK_ACCOUNT_PASSWORD_PIN",
        description: "Banking PINs and account credentials",
        pattern: "\\b(?:atm pin|netbanking password|upi pin)\\s*[:=]?\\s*\\w+\\b",
        severity: "BLOCKING"
      }
    ],
    privacy_invariants: {
      never_disclose_other_contacts_pii: true,
      anonymize_sensitive_health_records: true,
      block_insecure_credential_requests: true
    }
  }
};

// database/policies/whatsapp/whatsapp-enforcement.json
var whatsapp_enforcement_default = {
  version: "2026-10",
  authority: "Meta WhatsApp Business Messaging Policy - Enforcement Tiering",
  last_updated: "2026-10-08",
  decision_tiers: {
    ALLOW: {
      code: "ALLOW",
      symbol: "\u{1F7E2}",
      description: "All mandatory Meta policy and safety criteria passed without flags.",
      allows_automated_dispatch: true
    },
    HUMAN_REVIEW: {
      code: "HUMAN_REVIEW",
      symbol: "\u{1F7E1}",
      description: "Potential policy ambiguity, regulated claim, or missing metadata requires human review.",
      allows_automated_dispatch: false,
      requires_operator_confirmation: true
    },
    BLOCK: {
      code: "BLOCK",
      symbol: "\u{1F534}",
      description: "Mandatory Meta policy violation detected. Send action is prohibited.",
      allows_automated_dispatch: false,
      ai_override_permitted: false,
      operator_override_permitted: false
    }
  },
  enforcement_invariants: {
    fail_closed: true,
    ai_cannot_override_blocking_rule: true,
    opt_out_is_absolute_lock: true,
    every_evaluation_is_audited: true,
    preserve_historical_policy_versions: true
  }
};

// src/compliance/PolicyRegistry.ts
var PolicyRegistry = class {
  static {
    this.metadata = whatsapp_policy_default || ACTIVE_META_POLICY_VERSION;
  }
  static {
    this.rules = whatsapp_rules_default || [];
  }
  static {
    this.prohibited = whatsapp_prohibited_default;
  }
  static {
    this.consent = whatsapp_consent_default;
  }
  static {
    this.templates = whatsapp_templates_default;
  }
  static {
    this.commerce = whatsapp_commerce_default;
  }
  static {
    this.dataProtection = whatsapp_data_protection_default;
  }
  static {
    this.enforcement = whatsapp_enforcement_default;
  }
  static getMetadata() {
    return this.metadata;
  }
  static getAllRules() {
    return this.rules;
  }
  static getRuleById(id) {
    return this.rules.find((r) => r.id === id);
  }
  static getRulesByCategory(category) {
    return this.rules.filter((r) => r.category === category);
  }
  static getProhibitedCategories() {
    return this.prohibited.prohibited_product_categories;
  }
  static getConsentRules() {
    return this.consent.consent_requirements;
  }
  static getTemplateSpecs() {
    return this.templates.template_specifications;
  }
  static getCommerceRules() {
    return this.commerce.commerce_rules;
  }
  static getDataProtectionRules() {
    return this.dataProtection.data_protection_rules;
  }
  static getEnforcementTiers() {
    return this.enforcement.decision_tiers;
  }
};

// src/compliance/whatsapp/ConsentPolicy.ts
var ConsentPolicy = class {
  static evaluate(context) {
    const evaluations = [];
    const consentRules = PolicyRegistry.getConsentRules();
    const isExplicitlyBlocked = Boolean(context.isGloballyBlocked);
    const hasRevokedConsent = context.consentStatus === "REVOKED";
    const bodyUpper = (context.messageBody || "").trim().toUpperCase();
    const containsOptOutKeyword = consentRules.opt_out_hard_triggers.some(
      (trigger) => bodyUpper === trigger || bodyUpper.startsWith(`${trigger} `) || bodyUpper.endsWith(` ${trigger}`)
    );
    if (isExplicitlyBlocked || hasRevokedConsent) {
      evaluations.push({
        ruleId: "WA-OPTOUT-001",
        category: "opt_out",
        passed: false,
        severity: "BLOCKING",
        reason: "Recipient has previously opted out or is globally suppressed. Meta requires immediate and permanent suppression."
      });
    } else {
      evaluations.push({
        ruleId: "WA-OPTOUT-001",
        category: "opt_out",
        passed: true,
        severity: "BLOCKING",
        reason: "Recipient is not opted out and has not triggered suppression."
      });
    }
    if (context.isMarketing) {
      if (context.consentStatus === "GRANTED") {
        evaluations.push({
          ruleId: "WA-CONSENT-001",
          category: "consent",
          passed: true,
          severity: "BLOCKING",
          reason: "Valid WhatsApp opt-in record verified for recipient."
        });
      } else if (context.consentStatus === "UNKNOWN" || !context.consentStatus) {
        evaluations.push({
          ruleId: "WA-CONSENT-001",
          category: "consent",
          passed: false,
          severity: "BLOCKING",
          reason: "Recipient does not have a recorded WhatsApp opt-in on file. Meta mandates prior opt-in for business messaging."
        });
      } else {
        evaluations.push({
          ruleId: "WA-CONSENT-001",
          category: "consent",
          passed: false,
          severity: "BLOCKING",
          reason: `Recipient consent state is '${context.consentStatus}'. Valid opt-in is required.`
        });
      }
    } else {
      evaluations.push({
        ruleId: "WA-CONSENT-001",
        category: "consent",
        passed: true,
        severity: "BLOCKING",
        reason: "Service or transactional response does not require promotional opt-in."
      });
    }
    if (context.isMarketing && context.consentCategory && context.consentCategory !== "marketing") {
      evaluations.push({
        ruleId: "WA-CONSENT-002",
        category: "consent",
        passed: false,
        severity: "BLOCKING",
        reason: `Consent category '${context.consentCategory}' does not permit promotional marketing broadcasts. Meta requires explicit marketing opt-in.`
      });
    } else {
      evaluations.push({
        ruleId: "WA-CONSENT-002",
        category: "consent",
        passed: true,
        severity: "BLOCKING",
        reason: "Consent category aligns with message intent."
      });
    }
    return evaluations;
  }
};

// src/compliance/whatsapp/WindowPolicy.ts
var WindowPolicy = class _WindowPolicy {
  static {
    this.WINDOW_DURATION_MS = 24 * 60 * 60 * 1e3;
  }
  // 24 Hours in milliseconds
  static evaluate(context) {
    const evaluations = [];
    const now = Date.now();
    let isInsideWindow = false;
    if (context.customerServiceWindowExpiresAt) {
      const expiresAt = new Date(context.customerServiceWindowExpiresAt).getTime();
      if (!isNaN(expiresAt) && expiresAt > now) {
        isInsideWindow = true;
      }
    } else if (context.lastInboundMessageAt) {
      const lastInbound = new Date(context.lastInboundMessageAt).getTime();
      if (!isNaN(lastInbound) && now - lastInbound < _WindowPolicy.WINDOW_DURATION_MS) {
        isInsideWindow = true;
      }
    }
    if (!isInsideWindow) {
      const hasApprovedTemplate = Boolean(context.templateId) && (context.templateStatus === "APPROVED" || !context.templateStatus);
      if (!hasApprovedTemplate) {
        evaluations.push({
          ruleId: "WA-WINDOW-001",
          category: "window",
          passed: false,
          severity: "BLOCKING",
          reason: "Outside 24-hour customer service window: business-initiated messages require a Meta-approved message template."
        });
      } else {
        evaluations.push({
          ruleId: "WA-WINDOW-001",
          category: "window",
          passed: true,
          severity: "BLOCKING",
          reason: "Outside 24-hour window: approved template is designated and valid."
        });
      }
    } else {
      evaluations.push({
        ruleId: "WA-WINDOW-001",
        category: "window",
        passed: true,
        severity: "BLOCKING",
        reason: "Within active 24-hour customer service window: free-form service reply permitted."
      });
    }
    return evaluations;
  }
};

// src/compliance/whatsapp/TemplatePolicy.ts
var TemplatePolicy = class {
  static evaluate(context) {
    const evaluations = [];
    if (!context.templateId && !context.templateCategory) {
      return evaluations;
    }
    const templateSpecs = PolicyRegistry.getTemplateSpecs();
    if (context.templateStatus) {
      const isApproved = context.templateStatus === "APPROVED";
      if (!isApproved) {
        evaluations.push({
          ruleId: "WA-TEMPLATE-001",
          category: "template",
          passed: false,
          severity: "BLOCKING",
          reason: `Template status is '${context.templateStatus}'. Only templates in 'APPROVED' status can be dispatched on WhatsApp.`
        });
      } else {
        evaluations.push({
          ruleId: "WA-TEMPLATE-001",
          category: "template",
          passed: true,
          severity: "BLOCKING",
          reason: "Template is officially approved by Meta."
        });
      }
    } else {
      evaluations.push({
        ruleId: "WA-TEMPLATE-001",
        category: "template",
        passed: true,
        severity: "BLOCKING",
        reason: "Template status verified."
      });
    }
    const category = (context.templateCategory || "").toUpperCase();
    if (category === "UTILITY" || category === "AUTHENTICATION" || category === "SERVICE") {
      const prohibitedKeywords = templateSpecs.categories.UTILITY?.prohibited_marketing_keywords || [];
      const textLower = (context.messageBody || "").toLowerCase();
      const matchedKeyword = prohibitedKeywords.find((kw) => textLower.includes(kw.toLowerCase()));
      if (matchedKeyword) {
        evaluations.push({
          ruleId: "WA-TEMPLATE-002",
          category: "template",
          passed: false,
          severity: "BLOCKING",
          reason: `Template category is '${category}', but message content contains promotional marketing keyword '${matchedKeyword}'. Meta prohibits repurposing non-marketing templates for promotional offers.`
        });
      } else {
        evaluations.push({
          ruleId: "WA-TEMPLATE-002",
          category: "template",
          passed: true,
          severity: "BLOCKING",
          reason: `Template content aligns with designated '${category}' purpose.`
        });
      }
    } else {
      evaluations.push({
        ruleId: "WA-TEMPLATE-002",
        category: "template",
        passed: true,
        severity: "BLOCKING",
        reason: "Template category purpose is compliant."
      });
    }
    return evaluations;
  }
};

// src/compliance/whatsapp/ContentPolicy.ts
var ContentPolicy = class _ContentPolicy {
  static {
    this.FRAUD_PATTERNS = [
      /(?:you(?:'ve| have) won|lottery winner|claim your prize|free money|wire transfer required)/i,
      /(?:urgent[:\s]+account (?:suspended|compromised)|verify your password immediately|enter your secret pin)/i,
      /(?:double your investment|guaranteed daily returns|send bitcoin to receive double)/i
    ];
  }
  static {
    this.REGULATED_HEALTH_PATTERNS = [
      /(?:clinical trial|prescription consultation|dietary supplement therapy|telehealth medical advice|homeopathic remedy|herbal wellness treatment|weight loss supplement)/i
    ];
  }
  static evaluate(context) {
    const evaluations = [];
    const text = context.messageBody || "";
    const isFraudulent = _ContentPolicy.FRAUD_PATTERNS.some((p) => p.test(text));
    if (isFraudulent) {
      evaluations.push({
        ruleId: "WA-CONTENT-001",
        category: "content",
        passed: false,
        severity: "BLOCKING",
        reason: "Message contains indicators of fraudulent offers, phishing deception, or lottery spam. Meta prohibits deceptive practices."
      });
    } else {
      evaluations.push({
        ruleId: "WA-CONTENT-001",
        category: "content",
        passed: true,
        severity: "BLOCKING",
        reason: "Message is free from fraudulent, deceptive, or malicious spam patterns."
      });
    }
    const hasRegulatedHealthClaim = _ContentPolicy.REGULATED_HEALTH_PATTERNS.some((p) => p.test(text));
    if (hasRegulatedHealthClaim) {
      evaluations.push({
        ruleId: "WA-CONTENT-002",
        category: "content",
        passed: false,
        severity: "REVIEW",
        reason: "Message contains regulated medical claims or prescription drug keywords. Meta requires human compliance verification."
      });
    } else {
      evaluations.push({
        ruleId: "WA-CONTENT-002",
        category: "content",
        passed: true,
        severity: "REVIEW",
        reason: "Content complies with healthcare and pharmaceutical communication guidelines."
      });
    }
    return evaluations;
  }
};

// src/compliance/whatsapp/CommercePolicy.ts
var CommercePolicy = class {
  static evaluate(context) {
    const evaluations = [];
    const textLower = (context.messageBody || "").toLowerCase();
    const productCatLower = (context.productCategory || "").toLowerCase();
    const prohibitedCategories = PolicyRegistry.getProhibitedCategories();
    let matchedProhibited = null;
    for (const cat of prohibitedCategories) {
      if (productCatLower && productCatLower.includes(cat.category)) {
        matchedProhibited = {
          category: cat.category,
          matchedKeyword: cat.category,
          explanation: cat.explanation
        };
        break;
      }
      for (const kw of cat.keywords) {
        const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (regex.test(textLower)) {
          matchedProhibited = {
            category: cat.category,
            matchedKeyword: kw,
            explanation: cat.explanation
          };
          break;
        }
      }
      if (matchedProhibited) break;
    }
    if (matchedProhibited) {
      evaluations.push({
        ruleId: "WA-PROHIBITED-001",
        category: "prohibited_goods",
        passed: false,
        severity: "BLOCKING",
        reason: `Message promotes or references prohibited category '${matchedProhibited.category}' (matched keyword: '${matchedProhibited.matchedKeyword}'). ${matchedProhibited.explanation}`
      });
      evaluations.push({
        ruleId: "WA-COMMERCE-001",
        category: "commerce",
        passed: false,
        severity: "BLOCKING",
        reason: "Violation of Meta Commerce Policy: commerce in regulated or prohibited goods is strictly banned."
      });
    } else {
      evaluations.push({
        ruleId: "WA-PROHIBITED-001",
        category: "prohibited_goods",
        passed: true,
        severity: "BLOCKING",
        reason: "Content complies with Meta prohibited goods and services restrictions."
      });
      evaluations.push({
        ruleId: "WA-COMMERCE-001",
        category: "commerce",
        passed: true,
        severity: "BLOCKING",
        reason: "Commercial interactions comply with Meta Commerce guidelines."
      });
    }
    return evaluations;
  }
};

// src/compliance/whatsapp/DataPolicy.ts
var DataPolicy = class _DataPolicy {
  /**
   * Luhn Algorithm validator to eliminate false positives on credit card detection
   */
  static passesLuhn(digitsOnly) {
    if (digitsOnly.length < 13 || digitsOnly.length > 19) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = digitsOnly.length - 1; i >= 0; i--) {
      let digit = parseInt(digitsOnly.charAt(i), 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }
  static evaluate(context) {
    const evaluations = [];
    const text = context.messageBody || "";
    const dataRules = PolicyRegistry.getDataProtectionRules();
    const prohibitedDataTypes = dataRules.prohibited_sensitive_data || [];
    let hasCardViolation = false;
    let cardViolationReason = "";
    let hasNationalIdViolation = false;
    let nationalIdReason = "";
    for (const rule of prohibitedDataTypes) {
      const regex = new RegExp(rule.pattern, "i");
      const match = text.match(regex);
      if (match) {
        if (rule.type === "PAYMENT_CARD_NUMBER") {
          const digitsOnly = match[0].replace(/[\s-]/g, "");
          if (_DataPolicy.passesLuhn(digitsOnly)) {
            hasCardViolation = true;
            cardViolationReason = `Message contains a valid payment card number (${rule.description}). Meta prohibits asking for or transmitting full card numbers.`;
          }
        } else if (rule.type === "CARD_CVV_CVC" || rule.type === "BANK_ACCOUNT_PASSWORD_PIN") {
          hasCardViolation = true;
          cardViolationReason = `Message requests or contains sensitive financial credentials: ${rule.description}.`;
        } else if (rule.type.startsWith("NATIONAL_ID")) {
          hasNationalIdViolation = true;
          nationalIdReason = `Message requests or contains a government-issued national identifier (${rule.description}).`;
        }
      }
    }
    if (hasCardViolation) {
      evaluations.push({
        ruleId: "WA-DATA-001",
        category: "data_protection",
        passed: false,
        severity: "BLOCKING",
        reason: cardViolationReason
      });
    } else {
      evaluations.push({
        ruleId: "WA-DATA-001",
        category: "data_protection",
        passed: true,
        severity: "BLOCKING",
        reason: "No payment cards, CVVs, or financial credentials detected in message."
      });
    }
    if (hasNationalIdViolation) {
      evaluations.push({
        ruleId: "WA-DATA-002",
        category: "data_protection",
        passed: false,
        severity: "BLOCKING",
        reason: nationalIdReason
      });
    } else {
      evaluations.push({
        ruleId: "WA-DATA-002",
        category: "data_protection",
        passed: true,
        severity: "BLOCKING",
        reason: "No prohibited government national identifiers detected."
      });
    }
    return evaluations;
  }
};

// src/compliance/whatsapp/EnforcementPolicy.ts
var EnforcementPolicy = class {
  static aggregate(context, evaluations) {
    const blockingViolations = [];
    const reviewViolations = [];
    const requiredActions = [];
    for (const ev of evaluations) {
      if (!ev.passed) {
        const violation = {
          ruleId: ev.ruleId,
          category: ev.category,
          severity: ev.severity,
          reason: ev.reason,
          sourceUrl: "https://business.whatsapp.com/policy",
          // Blocking violations cannot be overridden by AI or operators
          canHumanOverride: ev.severity === "REVIEW"
        };
        if (ev.severity === "BLOCKING") {
          blockingViolations.push(violation);
          if (ev.ruleId === "WA-CONSENT-001") {
            requiredActions.push("Obtain valid WhatsApp opt-in from recipient before sending");
          } else if (ev.ruleId === "WA-OPTOUT-001") {
            requiredActions.push("Permanently suppress contact and exclude from all future outreach");
          } else if (ev.ruleId === "WA-WINDOW-001") {
            requiredActions.push("Designate a Meta-approved message template for outbound messaging outside 24h window");
          } else if (ev.ruleId === "WA-TEMPLATE-002") {
            requiredActions.push("Remove promotional keywords from utility template or switch to MARKETING template");
          } else if (ev.ruleId === "WA-PROHIBITED-001") {
            requiredActions.push("Remove references to prohibited goods (tobacco, alcohol, weapons, prescription drugs, gambling)");
          } else if (ev.ruleId === "WA-DATA-001") {
            requiredActions.push("Remove payment card numbers, CVVs, and financial account credentials from message");
          } else if (ev.ruleId === "WA-DATA-002") {
            requiredActions.push("Remove national identification numbers (SSN/Aadhaar) from message");
          } else {
            requiredActions.push(`Resolve ${ev.ruleId} policy violation: ${ev.reason}`);
          }
        } else if (ev.severity === "REVIEW") {
          reviewViolations.push(violation);
          requiredActions.push(`Perform operator compliance review on ${ev.ruleId}: ${ev.reason}`);
        }
      }
    }
    let decision = "ALLOW";
    let riskLevel = "LOW";
    let canHumanOverride = true;
    if (blockingViolations.length > 0) {
      decision = "BLOCK";
      riskLevel = "HIGH";
      canHumanOverride = false;
    } else if (reviewViolations.length > 0) {
      decision = "HUMAN_REVIEW";
      riskLevel = "MEDIUM";
      canHumanOverride = true;
    }
    const allViolations = [...blockingViolations, ...reviewViolations];
    return {
      decision,
      confidence: 0.99,
      riskLevel,
      violations: allViolations,
      evaluatedRules: evaluations,
      requiredActions,
      canHumanOverride,
      policyVersion: ACTIVE_META_POLICY_VERSION.version,
      evaluatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      metadata: {
        channel: context.channel,
        contactPhone: context.contactPhone,
        totalRulesEvaluated: evaluations.length,
        blockingCount: blockingViolations.length,
        reviewCount: reviewViolations.length
      }
    };
  }
};

// src/compliance/whatsapp/WhatsAppPolicyEngine.ts
var WhatsAppPolicyEngine = class {
  /**
   * Evaluates a proposed message dispatch against the full Meta policy registry.
   * "The AI proposes; the Policy Engine decides."
   */
  static evaluate(context) {
    const allEvaluations = [];
    allEvaluations.push(...ConsentPolicy.evaluate(context));
    allEvaluations.push(...WindowPolicy.evaluate(context));
    allEvaluations.push(...TemplatePolicy.evaluate(context));
    allEvaluations.push(...ContentPolicy.evaluate(context));
    allEvaluations.push(...CommercePolicy.evaluate(context));
    allEvaluations.push(...DataPolicy.evaluate(context));
    return EnforcementPolicy.aggregate(context, allEvaluations);
  }
};

// src/compliance/PolicyEngine.ts
var PolicyEngine = class {
  /**
   * Evaluates a single message dispatch proposal against authoritative policies.
   */
  static evaluate(context) {
    if (context.channel === "WHATSAPP") {
      return WhatsAppPolicyEngine.evaluate(context);
    }
    const evaluations = WhatsAppPolicyEngine.evaluate({
      ...context,
      channel: "WHATSAPP"
      // Apply universal baseline safety
    });
    return evaluations;
  }
  /**
   * Retrieves active policy metadata and review schedules
   */
  static getActivePolicyMetadata() {
    return PolicyRegistry.getMetadata();
  }
  /**
   * Retrieves all active rules
   */
  static getAllRules() {
    return PolicyRegistry.getAllRules();
  }
};

// src/compliance/audit/ComplianceAuditService.ts
var ComplianceAuditService = class {
  /**
   * Persists a compliance evaluation record in the authoritative audit ledger
   */
  static async recordEvaluation(context, decision, options) {
    if (!db || !db.isConfigured) return;
    try {
      if (db.auditRepo) {
        await db.auditRepo.log({
          tenantId: context.tenantId,
          actorId: options?.actorId || "00000000-0000-0000-0000-000000000000",
          actorName: "WhatsApp Policy Engine",
          actorRole: options?.actorRole || "OPERATOR",
          action: `COMPLIANCE_EVALUATION_${decision.decision}`,
          entityType: "POLICY",
          entityId: options?.recipientId || options?.campaignId || context.contactPhone,
          metadata: {
            policyVersion: decision.policyVersion,
            decision: decision.decision,
            riskLevel: decision.riskLevel,
            violationsCount: decision.violations.length,
            violations: decision.violations.map((v) => ({ ruleId: v.ruleId, reason: v.reason })),
            evaluatedRulesCount: decision.evaluatedRules.length,
            canHumanOverride: decision.canHumanOverride,
            channel: context.channel,
            contactPhone: context.contactPhone,
            isOverride: options?.isOverride || false,
            overrideReason: options?.overrideReason
          },
          ipAddress: "127.0.0.1"
        });
      }
    } catch (err) {
      console.warn("[ComplianceAuditService] Non-blocking audit record warning:", err);
    }
  }
};

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT || 3e3;
app.use(express.json({ limit: "25mb" }));
app.get("/favicon.ico", (_req, res) => res.status(204).end());
var whatsAppChannel = new WhatsAppManualChannel();
var emailChannel = new EmailManualChannel();
function sanitizeSpreadsheetCell(val) {
  if (typeof val === "string" && val.length > 0) {
    const firstChar = val.charAt(0);
    if (["=", "+", "-", "@"].includes(firstChar)) {
      return `'${val}`;
    }
  }
  return val;
}
async function logAudit(action, entityType, entityId, metadata = {}, req) {
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
      ipAddress: req.ip || "127.0.0.1"
    });
  } catch (err) {
    console.error("[AuditLog] Failed to record audit log:", err);
  }
}
function handleDatabaseError(err, res) {
  if (err instanceof DatabaseUnconfiguredError || err?.code === "DATABASE_UNCONFIGURED") {
    return res.status(503).json({
      error: {
        code: "DATABASE_UNCONFIGURED",
        message: "Supabase PostgreSQL database is not configured. Please supply SUPABASE_URL and SUPABASE_ANON_KEY to proceed."
      }
    });
  }
  console.error("[API Error]:", err);
  return res.status(500).json({
    error: {
      code: err.code || "INTERNAL_SERVER_ERROR",
      message: err.message || "An unexpected database error occurred."
    }
  });
}
var api = express.Router();
api.get("/health", (_req, res) => {
  res.json({
    status: db.isConfigured ? "HEALTHY" : "DATABASE_UNCONFIGURED",
    version: "1.0.0",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    database: "SUPABASE_POSTGRESQL",
    isDatabaseConfigured: db.isConfigured,
    message: db.isConfigured ? "Connected to authoritative Supabase PostgreSQL database." : "Supabase database credentials missing. Set SUPABASE_URL and SUPABASE_ANON_KEY to enable database operations."
  });
});
api.get("/", (_req, res) => {
  res.json({
    status: "OK",
    version: "1.0.0",
    database: "SUPABASE_POSTGRESQL",
    isDatabaseConfigured: db.isConfigured
  });
});
api.use((_req, res, next) => {
  if (!db.isConfigured) {
    return res.status(503).json({
      error: {
        code: "DATABASE_UNCONFIGURED",
        message: "Supabase PostgreSQL database is not configured. Real application state requires active Supabase configuration (SUPABASE_URL and SUPABASE_ANON_KEY). Local mock/JSON fallback is strictly disabled."
      }
    });
  }
  next();
});
api.use(authenticateToken);
api.get("/auth/me", async (req, res) => {
  res.json({
    data: {
      user: req.auth.user,
      tenant: req.auth.tenant,
      role: req.auth.role
    }
  });
});
api.get("/tenant", async (req, res) => {
  try {
    const tenant = await db.tenantRepo.getTenant(req.auth.tenant.id);
    res.json({
      data: {
        tenant,
        user: req.auth.user
      }
    });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});
api.get("/workspace/bootstrap", async (req, res) => {
  try {
    const tenantId = req.auth.tenant.id;
    const tenant = req.auth.tenant;
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
    campaigns.forEach((c) => {
      totalRecipients += c.recipientsCount || 0;
      totalOpened += c.openedCount || 0;
      totalSent += c.sentCount || 0;
      totalSkipped += c.skippedCount || 0;
      totalBlocked += c.blockedCount || 0;
    });
    const stats = {
      totalContacts: contacts.length,
      activeCampaigns: campaigns.filter((c) => c.status === "ACTIVE").length,
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
        user: req.auth.user,
        tenant,
        role: req.auth.role,
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
  "/tenant/kill-switch",
  requireRole(["OWNER", "ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      const { isActive, reason } = req.body;
      const updated = await db.tenantRepo.updateKillSwitch(
        req.auth.tenant.id,
        isActive,
        reason,
        req.auth.user.name
      );
      await logAudit(
        isActive ? "KILL_SWITCH_TRIGGERED" : "KILL_SWITCH_DEACTIVATED",
        "WORKSPACE",
        req.auth.tenant.id,
        { reason, isActive },
        req
      );
      res.json({ data: updated });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.get("/contacts", async (req, res) => {
  try {
    const { search, tag, listId, status } = req.query;
    const contacts = await db.contactsRepo.findAll(
      req.auth.tenant.id,
      search,
      tag,
      listId,
      status
    );
    res.json({ data: contacts });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});
api.get("/contacts/:id", async (req, res) => {
  try {
    const contact = await db.contactsRepo.findById(req.params.id, req.auth.tenant.id);
    if (!contact) {
      return res.status(404).json({ error: { message: "Contact not found or does not belong to your workspace" } });
    }
    const timeline = await db.contactsRepo.getTimeline(contact.id);
    res.json({ data: { contact, timeline } });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});
api.post(
  "/contacts",
  requireRole(["OWNER", "ADMIN", "MANAGER", "OPERATOR"]),
  async (req, res) => {
    try {
      const body = req.body;
      const phoneNorm = DataQualityEngine.normalizePhone(body.phone || "");
      const emailNorm = DataQualityEngine.normalizeEmail(body.email || "");
      const newContact = await db.contactsRepo.create({
        tenantId: req.auth.tenant.id,
        firstName: sanitizeSpreadsheetCell(body.firstName || ""),
        lastName: sanitizeSpreadsheetCell(body.lastName || ""),
        displayName: sanitizeSpreadsheetCell(body.displayName || `${body.firstName || ""} ${body.lastName || ""}`.trim()),
        companyName: sanitizeSpreadsheetCell(body.companyName || ""),
        jobTitle: sanitizeSpreadsheetCell(body.jobTitle || ""),
        phone: phoneNorm.canonical || body.phone || "",
        email: emailNorm.canonical || body.email || "",
        city: sanitizeSpreadsheetCell(body.city || ""),
        state: body.state || "Telangana",
        country: body.country || "India",
        status: "ACTIVE",
        source: body.source || "manual_entry",
        leadStatus: body.leadStatus || "LEAD",
        notes: body.notes || "",
        tags: body.tags || [],
        customFields: body.customFields || {},
        channelAddresses: [
          { id: `addr-${Date.now()}-1`, channelType: "WHATSAPP", address: phoneNorm.canonical || body.phone, isPrimary: true, isVerified: phoneNorm.isValid },
          { id: `addr-${Date.now()}-2`, channelType: "EMAIL", address: emailNorm.canonical || body.email, isPrimary: true, isVerified: emailNorm.isValid }
        ],
        preferences: {
          WHATSAPP: { channel: "WHATSAPP", marketingAllowed: body.marketingAllowed !== false, transactionalAllowed: true },
          EMAIL: { channel: "EMAIL", marketingAllowed: body.marketingAllowed !== false, transactionalAllowed: true },
          SMS: { channel: "SMS", marketingAllowed: true, transactionalAllowed: true }
        },
        isGloballyBlocked: false
      });
      await db.contactsRepo.addTimelineEvent({
        contactId: newContact.id,
        eventType: "CONTACT_CREATED",
        actor: req.auth.user.name,
        description: `Contact created manually with normalized phone ${newContact.phone}`
      });
      await logAudit("CONTACT_CREATED", "CONTACT", newContact.id, { name: newContact.displayName }, req);
      res.json({ data: newContact });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.put(
  "/contacts/:id",
  requireRole(["OWNER", "ADMIN", "MANAGER", "OPERATOR"]),
  async (req, res) => {
    try {
      const updated = await db.contactsRepo.update(req.params.id, req.body, req.auth.tenant.id);
      await db.contactsRepo.addTimelineEvent({
        contactId: updated.id,
        eventType: "CONTACT_UPDATED",
        actor: req.auth.user.name,
        description: "Contact profile updated"
      });
      await logAudit("CONTACT_UPDATED", "CONTACT", updated.id, req.body, req);
      res.json({ data: updated });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.post(
  "/contacts/bulk-update",
  requireRole(["OWNER", "ADMIN", "MANAGER", "OPERATOR"]),
  async (req, res) => {
    try {
      const { contactIds, updates } = req.body;
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: { message: "No contact IDs provided" } });
      }
      const tenantId = req.auth.tenant.id;
      const client = db.getClient();
      const dbUpdates = {
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (updates.leadStatus) dbUpdates.lead_status = updates.leadStatus;
      if (updates.city) dbUpdates.city = updates.city;
      if (updates.tags) dbUpdates.tags = updates.tags;
      const CHUNK = 200;
      for (let i = 0; i < contactIds.length; i += CHUNK) {
        const chunk = contactIds.slice(i, i + CHUNK);
        const { error } = await client.from("contacts").update(dbUpdates).eq("tenant_id", tenantId).in("id", chunk);
        if (error) throw error;
      }
      await logAudit("CONTACTS_BULK_UPDATED", "CONTACT", `bulk-${Date.now()}`, { count: contactIds.length, updates }, req);
      res.json({ success: true, count: contactIds.length });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.delete(
  "/contacts/:id",
  requireRole(["OWNER", "ADMIN", "MANAGER", "OPERATOR"]),
  async (req, res) => {
    try {
      await db.contactsRepo.delete(req.params.id, req.auth.tenant.id);
      await logAudit("CONTACT_DELETED", "CONTACT", req.params.id, {}, req);
      res.json({ success: true });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.post(
  "/contacts/bulk-delete",
  requireRole(["OWNER", "ADMIN", "MANAGER", "OPERATOR"]),
  async (req, res) => {
    try {
      const { contactIds } = req.body;
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: { message: "No contact IDs provided to delete" } });
      }
      const client = db.getClient();
      const tenantId = req.auth.tenant.id;
      const CHUNK = 200;
      for (let i = 0; i < contactIds.length; i += CHUNK) {
        const chunk = contactIds.slice(i, i + CHUNK);
        await client.from("contact_list_members").delete().eq("tenant_id", tenantId).in("contact_id", chunk);
        await client.from("contact_timeline").delete().eq("tenant_id", tenantId).in("contact_id", chunk);
        await client.from("campaign_recipients").delete().eq("tenant_id", tenantId).in("contact_id", chunk);
        await client.from("contacts").delete().eq("tenant_id", tenantId).in("id", chunk);
      }
      await logAudit("CONTACTS_BULK_DELETED", "CONTACT", `bulk-${Date.now()}`, { count: contactIds.length }, req);
      res.json({ success: true, count: contactIds.length });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.post(
  "/contacts/:id/toggle-block",
  requireRole(["OWNER", "ADMIN", "MANAGER", "OPERATOR"]),
  async (req, res) => {
    try {
      const contact = await db.contactsRepo.findById(req.params.id, req.auth.tenant.id);
      if (!contact) return res.status(404).json({ error: { message: "Contact not found" } });
      const isBlocked = !contact.isGloballyBlocked;
      const reason = req.body.reason || (isBlocked ? "Manually suppressed by operator" : void 0);
      const updated = await db.contactsRepo.update(
        contact.id,
        {
          isGloballyBlocked: isBlocked,
          blockedReason: reason,
          status: isBlocked ? "BLOCKED" : "ACTIVE"
        },
        req.auth.tenant.id
      );
      (async () => {
        try {
          const client = db.getClient();
          if (isBlocked) {
            await client.from("campaign_recipients").update({
              status: "BLOCKED",
              policy_notes: `Globally blocked: ${reason || "Suppressed by operator"}`,
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("contact_id", contact.id).neq("status", "USER_SENT");
          } else {
            await client.from("campaign_recipients").update({
              status: "READY",
              policy_notes: null,
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("contact_id", contact.id).eq("status", "BLOCKED");
          }
          await db.contactsRepo.addTimelineEvent({
            contactId: contact.id,
            tenantId: req.auth.tenant.id,
            eventType: isBlocked ? "BLOCKED" : "CONTACT_UPDATED",
            actor: req.auth.user.name,
            actorId: req.auth.user.id,
            actorName: req.auth.user.name,
            description: isBlocked ? `Globally blocked: ${reason}` : "Global block removed"
          });
          await logAudit(isBlocked ? "CONTACT_BLOCKED" : "CONTACT_UNBLOCKED", "CONTACT", contact.id, { reason }, req);
        } catch (bgErr) {
          console.warn("Background block audit log:", bgErr);
        }
      })();
      res.json({ data: updated });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.post(
  "/contacts/:id/notes",
  requireRole(["OWNER", "ADMIN", "MANAGER", "OPERATOR"]),
  async (req, res) => {
    try {
      const { note } = req.body;
      const contact = await db.contactsRepo.findById(req.params.id, req.auth.tenant.id);
      if (!contact) return res.status(404).json({ error: { message: "Contact not found" } });
      const updated = await db.contactsRepo.update(
        contact.id,
        {
          notes: `${contact.notes ? `${contact.notes}

` : ""}[${(/* @__PURE__ */ new Date()).toLocaleDateString()}] ${note}`
        },
        req.auth.tenant.id
      );
      await db.contactsRepo.addTimelineEvent({
        contactId: contact.id,
        tenantId: req.auth.tenant.id,
        eventType: "NOTE_ADDED",
        actor: req.auth.user.name,
        actorId: req.auth.user.id,
        actorName: req.auth.user.name,
        description: `Added note: "${note.substring(0, 80)}${note.length > 80 ? "..." : ""}"`
      });
      res.json({ data: updated });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.post("/imports/preview", async (req, res) => {
  try {
    const { rawData, columnMapping, defaultCountry = "IN" } = req.body;
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return res.status(400).json({ error: { message: "Invalid or empty rawData array" } });
    }
    const existingContacts = await db.contactsRepo.findAll(req.auth.tenant.id);
    const existingPhones = new Set(existingContacts.map((c) => c.phone));
    const existingEmails = new Set(existingContacts.map((c) => c.email.toLowerCase()).filter(Boolean));
    const seenInBatchPhones = /* @__PURE__ */ new Set();
    const seenInBatchEmails = /* @__PURE__ */ new Set();
    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;
    let warningRows = 0;
    const issues = [];
    const processedRows = [];
    rawData.forEach((row, index) => {
      const rowNum = index + 1;
      const name = sanitizeSpreadsheetCell(row[columnMapping?.name] || `${row[columnMapping?.firstName] || ""} ${row[columnMapping?.lastName] || ""}`.trim() || "Unknown");
      const rawPhone = row[columnMapping?.phone] || "";
      const rawEmail = row[columnMapping?.email] || "";
      const company = sanitizeSpreadsheetCell(row[columnMapping?.company] || "");
      const city = sanitizeSpreadsheetCell(row[columnMapping?.city] || "");
      const phoneNorm = DataQualityEngine.normalizePhone(rawPhone, defaultCountry);
      const emailNorm = DataQualityEngine.normalizeEmail(rawEmail);
      let isDuplicate = false;
      let isInvalid = false;
      let hasWarning = false;
      if (!phoneNorm.isValid) {
        isInvalid = true;
        issues.push({ rowNumber: rowNum, field: "phone", value: rawPhone, error: phoneNorm.error || "Invalid phone number", severity: "ERROR" });
      } else if (phoneNorm.isLandline) {
        hasWarning = true;
        issues.push({ rowNumber: rowNum, field: "phone", value: rawPhone, error: "Landline detected - WhatsApp will not be deliverable", severity: "WARNING" });
      }
      if (rawEmail && !emailNorm.isValid) {
        hasWarning = true;
        issues.push({ rowNumber: rowNum, field: "email", value: rawEmail, error: emailNorm.error || "Invalid email format", severity: "WARNING" });
      }
      const canonicalPhone = phoneNorm.canonical;
      const canonicalEmail = emailNorm.canonical;
      if (canonicalPhone && existingPhones.has(canonicalPhone) || canonicalPhone && seenInBatchPhones.has(canonicalPhone) || canonicalEmail && existingEmails.has(canonicalEmail) || canonicalEmail && seenInBatchEmails.has(canonicalEmail)) {
        isDuplicate = true;
        duplicateRows++;
        issues.push({ rowNumber: rowNum, field: "phone/email", value: `${canonicalPhone || ""} ${canonicalEmail || ""}`.trim(), error: "Duplicate contact detected in database or file", severity: "INFO" });
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
        status: isInvalid ? "INVALID" : isDuplicate ? "DUPLICATE" : "READY",
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
        processedRows
      }
    });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});
api.post(
  "/imports/commit",
  requireRole(["OWNER", "ADMIN", "MANAGER", "OPERATOR"]),
  async (req, res) => {
    try {
      const {
        rows,
        duplicatePolicy = "UPDATE_EXISTING",
        sourceFileName = "imported_contacts.csv",
        leadStatus = "LEAD",
        targetListId
      } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: { message: "No contact rows provided to import" } });
      }
      const E164_REGEX = /^\+[1-9][0-9]{7,14}$/;
      const targetRows = rows.filter((r) => {
        if (!r || !r.phone || String(r.phone).trim().length === 0) return false;
        if (r.status === "INVALID") return false;
        if (duplicatePolicy === "SKIP" && r.isDuplicate) return false;
        const norm = DataQualityEngine.normalizePhone(String(r.phone));
        if (!norm.canonical || !E164_REGEX.test(norm.canonical)) return false;
        return true;
      });
      const contactsToInsert = targetRows.map((r) => {
        const norm = DataQualityEngine.normalizePhone(String(r.phone));
        const canonicalPhone = norm.canonical;
        return {
          tenantId: req.auth.tenant.id,
          firstName: sanitizeSpreadsheetCell(r.name ? r.name.split(" ")[0] : "Unknown"),
          lastName: sanitizeSpreadsheetCell(r.name ? r.name.split(" ").slice(1).join(" ") : ""),
          displayName: sanitizeSpreadsheetCell(r.name || "Unknown"),
          companyName: sanitizeSpreadsheetCell(r.company || ""),
          jobTitle: sanitizeSpreadsheetCell(r.jobTitle || "Buyer"),
          phone: canonicalPhone,
          email: r.email || "",
          city: sanitizeSpreadsheetCell(r.city || ""),
          state: r.state || "Telangana",
          country: r.country || "India",
          status: "ACTIVE",
          source: sourceFileName,
          leadStatus: leadStatus || "LEAD",
          notes: `Imported via ${sourceFileName} with duplicate policy ${duplicatePolicy}`,
          tags: ["IMPORTED", ...r.city ? [String(r.city).toUpperCase()] : [], ...leadStatus !== "LEAD" ? [leadStatus.toUpperCase()] : []],
          customFields: r.customFields || {},
          channelAddresses: [
            { id: `addr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, channelType: "WHATSAPP", address: canonicalPhone, isPrimary: true, isVerified: norm.isMobile },
            { id: `addr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, channelType: "EMAIL", address: r.email, isPrimary: true, isVerified: !!r.email }
          ],
          preferences: {
            WHATSAPP: { channel: "WHATSAPP", marketingAllowed: norm.isMobile, transactionalAllowed: true },
            EMAIL: { channel: "EMAIL", marketingAllowed: true, transactionalAllowed: true },
            SMS: { channel: "SMS", marketingAllowed: true, transactionalAllowed: true }
          },
          isGloballyBlocked: false
        };
      });
      const result = await db.contactsRepo.bulkCreate(contactsToInsert);
      if (targetListId) {
        try {
          const insertedPhones = contactsToInsert.map((c) => c.phone);
          const client = db.getClient();
          const { data: matchedContacts } = await client.from("contacts").select("id").eq("tenant_id", req.auth.tenant.id).in("phone", insertedPhones);
          if (matchedContacts && matchedContacts.length > 0) {
            const memberRows = matchedContacts.map((c) => ({
              tenant_id: req.auth.tenant.id,
              list_id: targetListId,
              contact_id: c.id
            }));
            const CHUNK = 200;
            for (let i = 0; i < memberRows.length; i += CHUNK) {
              const chunk = memberRows.slice(i, i + CHUNK);
              await client.from("contact_list_members").upsert(chunk, { onConflict: "tenant_id, list_id, contact_id", ignoreDuplicates: true });
            }
          }
        } catch (linkErr) {
          console.warn("Failed to link imported contacts to target list:", linkErr);
        }
      }
      await logAudit("CONTACT_IMPORTED", "IMPORT", `imp-${Date.now()}`, { count: contactsToInsert.length, targetListId, leadStatus, ...result }, req);
      res.json({ data: result });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.get("/contact-lists", async (req, res) => {
  try {
    const lists = await db.contactListsRepo.findAll(req.auth.tenant.id);
    res.json({ data: lists });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});
api.post(
  "/contact-lists",
  requireRole(["OWNER", "ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      const { name, description, type, rules, contactIds } = req.body;
      const list = await db.contactListsRepo.create({
        tenantId: req.auth.tenant.id,
        name: sanitizeSpreadsheetCell(name),
        description: sanitizeSpreadsheetCell(description || ""),
        type: type || "STATIC",
        rules,
        contactIds: contactIds || []
      });
      await logAudit("LIST_CREATED", "WORKSPACE", list.id, { name }, req);
      res.json({ data: list });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.post(
  "/contact-lists/:id/members",
  requireRole(["OWNER", "ADMIN", "MANAGER", "OPERATOR"]),
  async (req, res) => {
    try {
      const { contactIds } = req.body;
      const listId = req.params.id;
      const tenantId = req.auth.tenant.id;
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: { message: "No contact IDs provided" } });
      }
      const client = db.getClient();
      const memberRows = contactIds.map((cid) => ({
        tenant_id: tenantId,
        list_id: listId,
        contact_id: cid
      }));
      const CHUNK = 200;
      for (let i = 0; i < memberRows.length; i += CHUNK) {
        const chunk = memberRows.slice(i, i + CHUNK);
        await client.from("contact_list_members").upsert(chunk, { onConflict: "tenant_id, list_id, contact_id", ignoreDuplicates: true });
      }
      await logAudit("LIST_MEMBERS_ADDED", "WORKSPACE", listId, { count: contactIds.length }, req);
      res.json({ success: true, count: contactIds.length });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.get("/templates", async (req, res) => {
  try {
    const templates = await db.templatesRepo.findAll(req.auth.tenant.id);
    res.json({ data: templates });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});
api.post(
  "/templates",
  requireRole(["OWNER", "ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      const { name, channel, subject, body, attachmentName, category } = req.body;
      const vars = Array.from(new Set((body.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || []).map((m) => m.replace(/[\{\}]/g, "").trim())));
      const template = await db.templatesRepo.create({
        tenantId: req.auth.tenant.id,
        name,
        channel: channel || "WHATSAPP",
        subject: subject || "",
        body,
        availableVariables: vars,
        attachmentName,
        category: category || "INTRODUCTION",
        createdBy: req.auth.user.id
      });
      await logAudit("TEMPLATE_CREATED", "TEMPLATE", template.id, { name, version: template.version }, req);
      res.json({ data: template });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
async function syncCampaignRecipientsWithTemplate(campaignId, tenantId, template) {
  const client = db.getClient();
  await db.campaignsRepo.update(
    campaignId,
    {
      templateSnapshot: template,
      templateVersion: template.version
    },
    tenantId
  );
  const { data: recipients, error: recError } = await client.from("campaign_recipients").select("id, contact_id, channel").eq("campaign_id", campaignId).in("status", ["READY", "QUEUED", "OPENED"]);
  if (recError || !recipients || recipients.length === 0) return 0;
  const contactIds = Array.from(new Set(recipients.map((r) => r.contact_id)));
  const contactsMap = /* @__PURE__ */ new Map();
  const CHUNK = 200;
  for (let i = 0; i < contactIds.length; i += CHUNK) {
    const chunkIds = contactIds.slice(i, i + CHUNK);
    const { data: contactsData } = await client.from("contacts").select("*").eq("tenant_id", tenantId).in("id", chunkIds);
    if (contactsData) {
      contactsData.forEach((c) => contactsMap.set(c.id, c));
    }
  }
  const updates = [];
  for (const r of recipients) {
    const c = contactsMap.get(r.contact_id);
    if (!c) continue;
    const contactData = {
      first_name: c.first_name || "",
      last_name: c.last_name || "",
      name: c.display_name || "",
      company_name: c.company_name || "",
      company: c.company_name || "",
      city: c.city || "",
      state: c.state || "",
      phone: c.phone || "",
      email: c.email || "",
      ...c.custom_fields || {}
    };
    const { resolved } = DataQualityEngine.resolveTemplateVariables(template.body, contactData);
    const resolvedSub = template.subject ? DataQualityEngine.resolveTemplateVariables(template.subject, contactData).resolved : void 0;
    updates.push({
      id: r.id,
      resolved_message: resolved,
      resolved_subject: resolvedSub,
      attachment_name: template.attachmentName
    });
  }
  const UPDATE_CHUNK = 50;
  for (let i = 0; i < updates.length; i += UPDATE_CHUNK) {
    const chunk = updates.slice(i, i + UPDATE_CHUNK);
    await Promise.all(
      chunk.map(
        (u) => client.from("campaign_recipients").update({
          resolved_message: u.resolved_message,
          resolved_subject: u.resolved_subject,
          attachment_name: u.attachment_name,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", u.id)
      )
    );
  }
  return updates.length;
}
api.put(
  "/templates/:id",
  requireRole(["OWNER", "ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      const updated = await db.templatesRepo.update(req.params.id, req.body, req.auth.tenant.id);
      const tenantId = req.auth.tenant.id;
      const client = db.getClient();
      const { data: affectedCampaigns } = await client.from("campaigns").select("id").eq("tenant_id", tenantId).eq("template_id", req.params.id).neq("status", "COMPLETED");
      let syncedRecipientsCount = 0;
      if (affectedCampaigns && affectedCampaigns.length > 0) {
        for (const camp of affectedCampaigns) {
          syncedRecipientsCount += await syncCampaignRecipientsWithTemplate(camp.id, tenantId, updated);
        }
      }
      await logAudit("TEMPLATE_UPDATED", "TEMPLATE", updated.id, {
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
  "/templates/:id",
  requireRole(["OWNER", "ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      await db.templatesRepo.delete(req.params.id, req.auth.tenant.id);
      res.json({ success: true });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.get("/campaigns", async (req, res) => {
  try {
    const campaigns = await db.campaignsRepo.findAll(req.auth.tenant.id);
    res.json({ data: campaigns });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});
api.get("/campaigns/:id", async (req, res) => {
  try {
    const campaign = await db.campaignsRepo.findById(req.params.id, req.auth.tenant.id);
    if (!campaign) return res.status(404).json({ error: { message: "Campaign not found" } });
    const recipients = await db.campaignsRepo.getRecipients(campaign.id);
    res.json({ data: { campaign, recipients } });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});
api.post(
  "/campaigns",
  requireRole(["OWNER", "ADMIN", "MANAGER", "OPERATOR"]),
  async (req, res) => {
    try {
      const { name, description, channel, targetListId, templateId, isDryRun } = req.body;
      const tenantId = req.auth.tenant.id;
      const [template, targetList, targetContacts] = await Promise.all([
        db.templatesRepo.findById(templateId, tenantId),
        db.contactListsRepo.findById(targetListId, tenantId),
        db.contactsRepo.findAll(tenantId, void 0, void 0, targetListId)
      ]);
      if (!template) return res.status(400).json({ error: { message: "Template not found" } });
      if (!targetList) return res.status(400).json({ error: { message: "Target list not found" } });
      const campaign = await db.campaignsRepo.create({
        tenantId,
        name,
        description: description || "",
        channel: channel || template.channel,
        status: "DRAFT",
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
        createdBy: req.auth.user.id,
        assignedOperator: req.auth.user.id,
        recipientsCount: targetContacts.length
      });
      const recipientEntries = [];
      for (const c of targetContacts) {
        const contactData = {
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
        const resolvedSub = template.subject ? DataQualityEngine.resolveTemplateVariables(template.subject, contactData).resolved : void 0;
        const contactName = c.displayName || `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.phone || "Valued Contact";
        const channelAddress = (campaign.channel === "WHATSAPP" ? c.phone : c.email) || c.phone || c.email || "";
        const resolvedMessage = resolved || template.body || "";
        recipientEntries.push({
          tenantId,
          campaignId: campaign.id,
          contactId: c.id,
          contactName,
          companyName: c.companyName || "",
          channel: campaign.channel,
          channelAddress,
          resolvedMessage,
          resolvedSubject: resolvedSub,
          attachmentName: template.attachmentName,
          status: "READY"
        });
      }
      await Promise.all([
        db.campaignsRepo.addRecipients(recipientEntries, tenantId),
        logAudit("CAMPAIGN_CREATED", "CAMPAIGN", campaign.id, { name, recipients: recipientEntries.length }, req)
      ]);
      res.json({ data: campaign });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.post("/campaigns/:id/status", async (req, res) => {
  try {
    const { newStatus } = req.body;
    const user = req.auth.user;
    const campaign = await db.campaignsRepo.findById(req.params.id, req.auth.tenant.id);
    if (!campaign) return res.status(404).json({ error: { message: "Campaign not found" } });
    const VALID_TRANSITIONS = {
      DRAFT: ["REVIEW"],
      REVIEW: ["DRAFT", "APPROVED"],
      APPROVED: ["ACTIVE"],
      ACTIVE: ["PAUSED", "COMPLETED"],
      PAUSED: ["ACTIVE", "COMPLETED"],
      COMPLETED: []
    };
    const allowed = VALID_TRANSITIONS[campaign.status] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({
        error: {
          code: "ILLEGAL_CAMPAIGN_STATE_TRANSITION",
          message: `Illegal transition from ${campaign.status} to ${newStatus}. Permitted transitions: ${allowed.join(", ") || "None"}`
        }
      });
    }
    if (newStatus === "APPROVED" && !["OWNER", "ADMIN", "MANAGER"].includes(req.auth.role)) {
      return res.status(403).json({
        error: {
          code: "INSUFFICIENT_ROLE_PERMISSIONS",
          message: "Only Managers, Admins, or Owners can approve campaigns. Operators cannot self-approve."
        }
      });
    }
    if (newStatus === "COMPLETED" && !["OWNER", "ADMIN", "MANAGER"].includes(req.auth.role)) {
      return res.status(403).json({
        error: {
          code: "INSUFFICIENT_ROLE_PERMISSIONS",
          message: "Only Managers, Admins, or Owners can mark a campaign completed."
        }
      });
    }
    const updates = { status: newStatus };
    if (newStatus === "APPROVED") {
      updates.approvedBy = user.id;
      updates.approvedAt = (/* @__PURE__ */ new Date()).toISOString();
    } else if (newStatus === "DRAFT") {
      updates.approvedBy = null;
      updates.approvedAt = null;
    } else if (newStatus === "ACTIVE" && !campaign.startedAt) {
      updates.startedAt = (/* @__PURE__ */ new Date()).toISOString();
    } else if (newStatus === "COMPLETED") {
      updates.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    const updated = await db.campaignsRepo.update(campaign.id, updates, req.auth.tenant.id);
    await logAudit(`CAMPAIGN_${newStatus}`, "CAMPAIGN", campaign.id, { previous: campaign.status, new: newStatus }, req);
    res.json({ data: updated });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});
api.delete(
  "/campaigns/:id",
  requireRole(["OWNER", "ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      const campaign = await db.campaignsRepo.findById(req.params.id, req.auth.tenant.id);
      if (!campaign) {
        return res.json({ success: true, message: "Campaign already deleted" });
      }
      await db.campaignsRepo.delete(req.params.id, req.auth.tenant.id);
      await logAudit("CAMPAIGN_DELETED", "CAMPAIGN", req.params.id, { name: campaign.name }, req);
      res.json({ success: true });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.post(
  "/campaigns/:id/sync-template",
  requireRole(["OWNER", "ADMIN", "MANAGER", "OPERATOR"]),
  async (req, res) => {
    try {
      const campaign = await db.campaignsRepo.findById(req.params.id, req.auth.tenant.id);
      if (!campaign) return res.status(404).json({ error: { message: "Campaign not found" } });
      if (!campaign.templateId) return res.status(400).json({ error: { message: "Campaign has no linked template" } });
      const template = await db.templatesRepo.findById(campaign.templateId, req.auth.tenant.id);
      if (!template) return res.status(404).json({ error: { message: "Linked template not found" } });
      const updatedCount = await syncCampaignRecipientsWithTemplate(campaign.id, req.auth.tenant.id, template);
      const updatedCampaign = await db.campaignsRepo.findById(campaign.id, req.auth.tenant.id);
      const recipients = await db.campaignsRepo.getRecipients(campaign.id);
      await logAudit("CAMPAIGN_TEMPLATE_SYNCED", "CAMPAIGN", campaign.id, {
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
api.post(
  "/campaigns/:id/recipients/:recipientId/prepare",
  requireRole(["OWNER", "ADMIN", "MANAGER", "OPERATOR"]),
  async (req, res) => {
    try {
      const { id: campaignId, recipientId } = req.params;
      const campaign = await db.campaignsRepo.findById(campaignId, req.auth.tenant.id);
      const recipient = await db.campaignsRepo.getRecipientById(recipientId);
      if (!campaign || !recipient) {
        return res.status(404).json({ error: { message: "Campaign or recipient not found" } });
      }
      const contact = await db.contactsRepo.findById(recipient.contactId, req.auth.tenant.id);
      if (!contact) return res.status(404).json({ error: { message: "Contact not found" } });
      const complianceContext = {
        tenantId: req.auth.tenant.id,
        contactId: contact.id,
        contactPhone: recipient.channelAddress || contact.phone,
        contactName: recipient.contactName || contact.displayName,
        channel: recipient.channel,
        isMarketing: true,
        messageBody: recipient.resolvedMessage || campaign.templateSnapshot.body,
        templateId: campaign.templateId,
        templateName: campaign.templateSnapshot?.name,
        templateCategory: campaign.templateSnapshot?.category || "MARKETING",
        templateStatus: "APPROVED",
        consentStatus: contact.preferences?.WHATSAPP?.marketingAllowed ? "GRANTED" : "UNKNOWN",
        isGloballyBlocked: Boolean(contact.isGloballyBlocked || contact.status === "BLOCKED" || contact.status === "OPTED_OUT"),
        actorRole: req.auth.role,
        actorId: req.auth.user.id,
        lastInboundMessageAt: contact.lastInteractionAt
      };
      const complianceDecision = PolicyEngine.evaluate(complianceContext);
      ComplianceAuditService.recordEvaluation(complianceContext, complianceDecision, {
        actorId: req.auth.user.id,
        actorRole: req.auth.role,
        campaignId,
        recipientId
      }).catch(console.warn);
      if (complianceDecision.decision === "BLOCK") {
        const primaryReason = complianceDecision.violations[0]?.reason || "Blocked by Meta WhatsApp Business Policy";
        await db.campaignsRepo.updateRecipient(recipientId, {
          status: "BLOCKED",
          policyNotes: `[Meta Policy BLOCK]: ${primaryReason}`
        });
        return res.status(400).json({
          error: {
            code: "META_WHATSAPP_POLICY_VIOLATION",
            message: primaryReason,
            complianceDecision
          }
        });
      }
      const policyResult = CommunicationPolicyEngine.evaluate({
        tenant: req.auth.tenant,
        contact,
        channel: recipient.channel,
        actorRole: req.auth.role,
        rawTemplateText: campaign.templateSnapshot.body,
        isMarketingCampaign: true
      });
      if (!policyResult.canSend) {
        await db.campaignsRepo.updateRecipient(recipientId, {
          status: contact.isGloballyBlocked ? "BLOCKED" : "OPTED_OUT",
          policyNotes: policyResult.primaryBlockReason
        });
        return res.status(400).json({
          error: {
            code: "COMMUNICATION_BLOCKED",
            message: policyResult.primaryBlockReason || "Communication prohibited by policy",
            policyResult,
            complianceDecision
          }
        });
      }
      await db.campaignsRepo.updateRecipient(recipientId, {
        claimedByOperator: req.auth.user.id,
        claimedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      let prepared;
      if (recipient.channel === "WHATSAPP") {
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
        status: "OPENED",
        openedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      await db.contactsRepo.addTimelineEvent({
        contactId: contact.id,
        tenantId: req.auth.tenant.id,
        eventType: recipient.channel === "WHATSAPP" ? "WHATSAPP_OPENED" : "EMAIL_OPENED",
        actor: req.auth.user.name,
        actorId: req.auth.user.id,
        actorName: req.auth.user.name,
        campaignName: campaign.name,
        description: `Official ${recipient.channel} composer opened for manual review`
      });
      await logAudit("CHANNEL_OPENED", "CONTACT", contact.id, { channel: recipient.channel, campaignId }, req);
      res.json({ data: { prepared, policyResult } });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.post(
  "/campaigns/:id/recipients/:recipientId/mark-sent",
  requireRole(["OWNER", "ADMIN", "MANAGER", "OPERATOR"]),
  async (req, res) => {
    try {
      const { id: campaignId, recipientId } = req.params;
      const campaign = await db.campaignsRepo.findById(campaignId, req.auth.tenant.id);
      const recipient = await db.campaignsRepo.getRecipientById(recipientId);
      if (!campaign || !recipient) return res.status(404).json({ error: { message: "Not found" } });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const updatedRecipient = await db.campaignsRepo.updateRecipient(recipientId, {
        status: "USER_SENT",
        userSentAt: now
      });
      (async () => {
        try {
          const contact = await db.contactsRepo.findById(recipient.contactId, req.auth.tenant.id);
          if (contact) {
            await db.contactsRepo.update(
              contact.id,
              {
                lastInteractionAt: now,
                lastMessageSentAt: now
              },
              req.auth.tenant.id
            );
            await db.contactsRepo.addTimelineEvent({
              contactId: contact.id,
              tenantId: req.auth.tenant.id,
              eventType: "USER_MARKED_SENT",
              actor: req.auth.user.name,
              actorId: req.auth.user.id,
              actorName: req.auth.user.name,
              campaignName: campaign.name,
              description: `Operator confirmed message sent via ${recipient.channel} to ${recipient.channelAddress}`
            });
          }
          await logAudit("MESSAGE_MARKED_SENT", "CONTACT", recipient.contactId, { campaignId, channel: recipient.channel }, req);
        } catch (bgErr) {
          console.warn("Background mark-sent telemetry error:", bgErr);
        }
      })();
      res.json({ data: updatedRecipient });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.post(
  "/campaigns/:id/recipients/:recipientId/skip",
  requireRole(["OWNER", "ADMIN", "MANAGER", "OPERATOR"]),
  async (req, res) => {
    try {
      const { recipientId } = req.params;
      const { reason = "Skipped by operator" } = req.body;
      const updated = await db.campaignsRepo.updateRecipient(recipientId, {
        status: "SKIPPED",
        skippedAt: (/* @__PURE__ */ new Date()).toISOString(),
        skipReason: reason
      });
      res.json({ data: updated });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.post(
  "/campaigns/:id/recipients/:recipientId/block",
  requireRole(["OWNER", "ADMIN", "MANAGER", "OPERATOR"]),
  async (req, res) => {
    try {
      const { recipientId } = req.params;
      const { reason = "Contact globally suppressed by operator" } = req.body;
      const updated = await db.campaignsRepo.updateRecipient(recipientId, {
        status: "BLOCKED",
        policyNotes: reason
      });
      res.json({ data: updated });
    } catch (err) {
      handleDatabaseError(err, res);
    }
  }
);
api.post(
  "/campaigns/:id/send-test",
  requireRole(["OWNER", "ADMIN", "MANAGER", "OPERATOR"]),
  async (req, res) => {
    try {
      const { testPhone = "+919999988888", testName = "Test Recipient" } = req.body;
      const campaign = await db.campaignsRepo.findById(req.params.id, req.auth.tenant.id);
      if (!campaign) return res.status(404).json({ error: { message: "Campaign not found" } });
      const sampleData = {
        first_name: testName.split(" ")[0],
        company_name: "ReachOut OS Test Lab",
        city: "Hyderabad",
        phone: testPhone
      };
      const { resolved } = DataQualityEngine.resolveTemplateVariables(campaign.templateSnapshot.body, sampleData);
      const prepared = whatsAppChannel.prepareMessage({
        recipientId: "test-recipient",
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
api.post("/ai/generate", async (req, res) => {
  try {
    const result = await AICopilotService.generateDrafts(req.body);
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: { message: err.message || "AI Generation failed" } });
  }
});
api.post("/ai/personalize", async (req, res) => {
  try {
    const result = await AICopilotService.personalize(req.body);
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: { message: err.message || "AI Personalization failed" } });
  }
});
api.post("/ai/rewrite", async (req, res) => {
  try {
    const result = await AICopilotService.rewrite(req.body);
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: { message: err.message || "AI Rewrite failed" } });
  }
});
api.post("/ai/guardrails", async (req, res) => {
  try {
    const result = await AICopilotService.checkGuardrails(req.body.message || "");
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: { message: err.message || "AI Guardrails check failed" } });
  }
});
api.post("/compliance/evaluate", async (req, res) => {
  try {
    const {
      messageBody,
      channel = "WHATSAPP",
      contactPhone = "",
      isMarketing = true,
      templateId,
      templateName,
      templateCategory,
      templateStatus,
      lastInboundMessageAt,
      customerServiceWindowExpiresAt,
      consentStatus = "GRANTED",
      consentCategory = "marketing",
      isGloballyBlocked = false,
      productCategory
    } = req.body;
    const context = {
      tenantId: req.auth?.tenant?.id || "default",
      contactPhone,
      channel,
      isMarketing,
      messageBody: messageBody || "",
      templateId,
      templateName,
      templateCategory,
      templateStatus,
      lastInboundMessageAt,
      customerServiceWindowExpiresAt,
      consentStatus,
      consentCategory,
      isGloballyBlocked,
      productCategory,
      actorRole: req.auth?.role || "OPERATOR",
      actorId: req.auth?.user?.id
    };
    const decision = PolicyEngine.evaluate(context);
    res.json({ data: decision });
  } catch (err) {
    res.status(500).json({ error: { message: err?.message || "Policy evaluation error" } });
  }
});
api.get("/compliance/policy", async (_req, res) => {
  try {
    const metadata = PolicyEngine.getActivePolicyMetadata();
    const rules = PolicyEngine.getAllRules();
    res.json({
      data: {
        metadata,
        totalRules: rules.length,
        rules
      }
    });
  } catch (err) {
    res.status(500).json({ error: { message: err?.message || "Failed to fetch policy" } });
  }
});
api.get("/audit", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await db.auditRepo.findAll(req.auth.tenant.id, limit);
    res.json({ data: logs });
  } catch (err) {
    handleDatabaseError(err, res);
  }
});
api.get("/stats", async (req, res) => {
  try {
    const contacts = await db.contactsRepo.findAll(req.auth.tenant.id);
    const campaigns = await db.campaignsRepo.findAll(req.auth.tenant.id);
    const templates = await db.templatesRepo.findAll(req.auth.tenant.id);
    const lists = await db.contactListsRepo.findAll(req.auth.tenant.id);
    const tenant = await db.tenantRepo.getTenant(req.auth.tenant.id);
    let totalRecipients = 0;
    let totalOpened = 0;
    let totalSent = 0;
    let totalSkipped = 0;
    let totalBlocked = 0;
    campaigns.forEach((c) => {
      totalRecipients += c.recipientsCount || 0;
      totalOpened += c.openedCount || 0;
      totalSent += c.sentCount || 0;
      totalSkipped += c.skippedCount || 0;
      totalBlocked += c.blockedCount || 0;
    });
    res.json({
      data: {
        totalContacts: contacts.length,
        activeCampaigns: campaigns.filter((c) => c.status === "ACTIVE").length,
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
app.use("/api/v1", api);
app.use("/v1", api);
app.use("/api", api);
app.get("/health", (_req, res) => {
  res.json({
    status: db.isConfigured ? "HEALTHY" : "DATABASE_UNCONFIGURED",
    version: "1.0.0",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    database: "SUPABASE_POSTGRESQL",
    isDatabaseConfigured: db.isConfigured,
    message: db.isConfigured ? "Connected to authoritative Supabase PostgreSQL database." : "Supabase database credentials missing."
  });
});
var isServerless = Boolean(
  process.env.IS_SERVERLESS || process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
);
async function startServer(port = PORT) {
  if (isServerless) return;
  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }
  return app.listen(port, () => {
    console.log(`[ReachOut OS Server] Running on http://localhost:${port}`);
  });
}
if (process.env.NODE_ENV !== "test" && !isServerless) {
  startServer().catch((err) => {
    console.error("[ReachOut OS Server] Failed to start:", err);
  });
}

// scripts/_vercel_entry.ts
process.env.IS_SERVERLESS = "1";
function handler(req, res) {
  let targetUrl = req.url || "";
  if (targetUrl.startsWith("/api?") || targetUrl === "/api" || targetUrl === "/api/" || !targetUrl.startsWith("/api/")) {
    try {
      const u = new URL(targetUrl, "http://localhost");
      const p = u.searchParams.get("__path");
      if (p) {
        u.searchParams.delete("__path");
        const q = u.searchParams.toString();
        targetUrl = "/api/" + p + (q ? "?" + q : "");
      } else {
        const c = req.headers["x-matched-path"] || req.headers["x-forwarded-uri"] || req.headers["x-original-url"];
        if (c && c.startsWith("/api") && c !== "/api" && c !== "/api/") {
          targetUrl = c;
        }
      }
    } catch (_) {
    }
  }
  req.url = targetUrl;
  return app(req, res);
}
export {
  handler as default
};
