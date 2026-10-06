# ReachOut OS — Database Architecture & PostgreSQL Schema Specification

## 1. Authoritative Architecture Principles

1. **Single Source of Truth**: Supabase PostgreSQL is the authoritative data plane. Local in-memory or JSON stores are strictly forbidden.
2. **Fail-Closed Policy**: If the database connection is interrupted or unconfigured, the application throws an unrecoverable error rather than falling back to unverified cache or mock data.
3. **Database-Enforced Multi-Tenancy**: Tenant isolation is guaranteed via composite foreign keys `(tenant_id, ...)` combined with PostgreSQL Row-Level Security (RLS).
4. **Relational List Membership**: Audience segmentation uses the relational `contact_list_members` junction table to support 100,000+ contacts per tenant without array scaling bottlenecks.
5. **Soft Deletion & Audit Preservation**: Tenants and core business objects use lifecycle statuses (`ACTIVE`, `SUSPENDED`, `DELETION_PENDING`, `DELETED`) and `ON DELETE RESTRICT` on audit logs to prevent accidental destruction of compliance records.

---

## 2. Relational Entity Schema

```text
tenants (id, name, slug, timezone, status, is_kill_switch_active, deleted_at, created_at, updated_at)
  │
  ├── users (id -> auth.users.id, email, name, avatar_url, created_at, updated_at)
  │
  ├── tenant_members (id, tenant_id, user_id, role, created_at, updated_at)
  │     [Role: OWNER, ADMIN, MANAGER, OPERATOR, VIEWER]
  │
  ├── contacts (id, tenant_id, first_name, last_name, display_name, company_name, phone, email, status, lead_status, ...)
  │     ├── contact_timeline (id, tenant_id, contact_id, actor_id, description, metadata, created_at)
  │     └── communication_preferences (id, tenant_id, contact_id, channel, marketing_allowed, transactional_allowed, ...)
  │
  ├── contact_lists (id, tenant_id, name, description, type, rules, created_at, updated_at)
  │     └── contact_list_members (id, tenant_id, list_id, contact_id, created_at)
  │
  ├── message_templates (id, tenant_id, name, channel, subject, body, version, created_by, ...)
  │
  ├── campaigns (id, tenant_id, name, channel, status, target_list_id, template_id, created_by, approved_by, ...)
  │     └── campaign_recipients (id, tenant_id, campaign_id, contact_id, channel_address, resolved_message, status, ...)
  │
  └── audit_logs (id, tenant_id, sequence_number, actor_id, actor_name, actor_role, action, entity_type, entity_id, previous_hash, entry_hash, ...)
```

---

## 3. Composite Cross-Tenant Referential Integrity

All cross-entity references are constrained by composite foreign keys referencing composite unique keys `(tenant_id, id)`:

- `campaigns (tenant_id, target_list_id)` → `contact_lists (tenant_id, id)`
- `campaigns (tenant_id, template_id)` → `message_templates (tenant_id, id)`
- `campaign_recipients (tenant_id, campaign_id)` → `campaigns (tenant_id, id)`
- `campaign_recipients (tenant_id, contact_id)` → `contacts (tenant_id, id)`
- `contact_timeline (tenant_id, contact_id)` → `contacts (tenant_id, id)`
- `contact_timeline (tenant_id, actor_id)` → `tenant_members (tenant_id, user_id)`
- `contact_list_members (tenant_id, list_id)` → `contact_lists (tenant_id, id)`
- `contact_list_members (tenant_id, contact_id)` → `contacts (tenant_id, id)`

Attempts to reference an entity belonging to another tenant result in a PostgreSQL `foreign_key_violation` (SQLSTATE `23503`).
