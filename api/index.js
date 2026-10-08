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
          if (listMemberIds && listMemberIds.length > 0) {
            query = query.in("id", listMemberIds);
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
          recipients_count: 0,
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
    const client = this.getClient();
    const { data: authData, error: authError } = await client.auth.getUser(token);
    if (authError || !authData.user) {
      return null;
    }
    const authUser = authData.user;
    const userId = authUser.id;
    const email = authUser.email || "";
    const { data: userProfile } = await client.from("users").select("*").eq("id", userId).maybeSingle();
    const name = userProfile?.name || authUser.user_metadata?.full_name || email.split("@")[0];
    const avatarUrl = userProfile?.avatar_url || authUser.user_metadata?.avatar_url;
    const { data: memberRows, error: memberErr } = await client.from("tenant_members").select("id, tenant_id, role, created_at, tenants(*)").eq("user_id", userId);
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
    const [tenant, contacts, campaigns, templates, lists, auditLogs] = await Promise.all([
      db.tenantRepo.getTenant(tenantId),
      db.contactsRepo.findAll(tenantId),
      db.campaignsRepo.findAll(tenantId),
      db.templatesRepo.findAll(tenantId),
      db.contactListsRepo.findAll(tenantId),
      db.auditRepo.findAll(tenantId, 100)
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
  requireRole(["OWNER", "ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      const contact = await db.contactsRepo.findById(req.params.id, req.auth.tenant.id);
      if (!contact) return res.status(404).json({ error: { message: "Contact not found" } });
      const isBlocked = !contact.isGloballyBlocked;
      const reason = req.body.reason || (isBlocked ? "Manually suppressed by manager" : void 0);
      const updated = await db.contactsRepo.update(
        contact.id,
        {
          isGloballyBlocked: isBlocked,
          blockedReason: reason,
          status: isBlocked ? "BLOCKED" : "ACTIVE"
        },
        req.auth.tenant.id
      );
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
      const template = await db.templatesRepo.findById(templateId, req.auth.tenant.id);
      if (!template) return res.status(400).json({ error: { message: "Template not found" } });
      const targetList = await db.contactListsRepo.findById(targetListId, req.auth.tenant.id);
      if (!targetList) return res.status(400).json({ error: { message: "Target list not found" } });
      const allContacts = await db.contactsRepo.findAll(req.auth.tenant.id);
      const targetContacts = allContacts.filter((c) => targetList.contactIds.includes(c.id));
      const campaign = await db.campaignsRepo.create({
        tenantId: req.auth.tenant.id,
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
        assignedOperator: req.auth.user.id
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
        recipientEntries.push({
          tenantId: req.auth.tenant.id,
          campaignId: campaign.id,
          contactId: c.id,
          contactName: c.displayName,
          companyName: c.companyName,
          channel: campaign.channel,
          channelAddress: campaign.channel === "WHATSAPP" ? c.phone : c.email,
          resolvedMessage: resolved,
          resolvedSubject: resolvedSub,
          attachmentName: template.attachmentName,
          status: "READY"
        });
      }
      await db.campaignsRepo.addRecipients(recipientEntries, req.auth.tenant.id);
      const updatedCampaign = await db.campaignsRepo.update(
        campaign.id,
        { recipientsCount: recipientEntries.length },
        req.auth.tenant.id
      );
      await logAudit("CAMPAIGN_CREATED", "CAMPAIGN", campaign.id, { name, recipients: recipientEntries.length }, req);
      res.json({ data: updatedCampaign });
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
            policyResult
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
