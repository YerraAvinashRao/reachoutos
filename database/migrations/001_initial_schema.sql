-- ==============================================================================
-- REACHOUT OS - MIGRATION 001: INITIAL SCHEMA (BANK-GRADE HARDENED)
-- Description: Core relational multi-tenant tables, UUIDs, composite foreign keys,
--              relational list membership, E.164 phone constraints,
--              immutable audit ledger, and tenant soft-deletion.
-- ==============================================================================

-- Enable UUID & cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 0. REUSABLE UPDATED_AT TRIGGER FUNCTION (PINNED EMPTY SEARCH_PATH)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated, service_role;

-- ==============================================================================
-- 1. TENANTS TABLE (Lifecycle & Soft-Delete Support)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETION_PENDING', 'DELETED')),
    is_kill_switch_active BOOLEAN NOT NULL DEFAULT FALSE,
    kill_switch_reason TEXT,
    kill_switch_triggered_at TIMESTAMPTZ,
    kill_switch_triggered_by UUID,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_tenants_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$')
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 2. USERS TABLE (Strictly linked with Supabase auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 3. TENANT MEMBERS TABLE (Multi-tenant membership and RBAC)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_tenant_user UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON public.tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON public.tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_composite ON public.tenant_members(tenant_id, user_id);

DROP TRIGGER IF EXISTS trg_tenant_members_updated_at ON public.tenant_members;
CREATE TRIGGER trg_tenant_members_updated_at
    BEFORE UPDATE ON public.tenant_members
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 4. CONTACTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL DEFAULT '',
    last_name VARCHAR(100) NOT NULL DEFAULT '',
    display_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL DEFAULT '',
    job_title VARCHAR(100) NOT NULL DEFAULT '',
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL DEFAULT '',
    city VARCHAR(100) NOT NULL DEFAULT '',
    state VARCHAR(100) NOT NULL DEFAULT 'Telangana',
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BLOCKED', 'OPTED_OUT', 'ARCHIVED', 'INVALID')),
    source VARCHAR(100) NOT NULL DEFAULT 'manual',
    lead_status VARCHAR(50) NOT NULL DEFAULT 'LEAD' CHECK (lead_status IN ('LEAD', 'PROSPECT', 'RETAILER', 'DISTRIBUTOR', 'WHOLESALE', 'VIP')),
    notes TEXT NOT NULL DEFAULT '',
    tags TEXT[] NOT NULL DEFAULT '{}',
    custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_globally_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    blocked_reason TEXT,
    last_interaction_at TIMESTAMPTZ,
    last_message_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Database-level ITU E.164 phone regex enforcement
    CONSTRAINT chk_contacts_phone_e164 CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
    CONSTRAINT unique_tenant_phone UNIQUE (tenant_id, phone),
    -- Composite unique key to support composite cross-tenant foreign keys
    CONSTRAINT unique_tenant_contact UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON public.contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON public.contacts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_city ON public.contacts(tenant_id, city);
CREATE INDEX IF NOT EXISTS idx_contacts_composite ON public.contacts(tenant_id, id);

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON public.contacts;
CREATE TRIGGER trg_contacts_updated_at
    BEFORE UPDATE ON public.contacts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 5. CONTACT TIMELINE TABLE (Event stream with Authoritative Actor Reference)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.contact_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    actor_id UUID NOT NULL, -- Backed by tenant_members
    actor_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    campaign_name VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Strict cross-tenant composite FKs: contact and actor must belong to the exact same tenant
    CONSTRAINT fk_timeline_tenant_contact FOREIGN KEY (tenant_id, contact_id) 
        REFERENCES public.contacts(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_timeline_tenant_actor FOREIGN KEY (tenant_id, actor_id) 
        REFERENCES public.tenant_members(tenant_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_timeline_contact ON public.contact_timeline(contact_id);
CREATE INDEX IF NOT EXISTS idx_timeline_tenant ON public.contact_timeline(tenant_id);
CREATE INDEX IF NOT EXISTS idx_timeline_actor ON public.contact_timeline(tenant_id, actor_id);

-- Auto-derive tenant_id from contact if not supplied
CREATE OR REPLACE FUNCTION public.stamp_timeline_tenant()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO NEW.tenant_id
        FROM public.contacts
        WHERE id = NEW.contact_id;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.stamp_timeline_tenant() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stamp_timeline_tenant() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_timeline_stamp_tenant ON public.contact_timeline;
CREATE TRIGGER trg_timeline_stamp_tenant
    BEFORE INSERT ON public.contact_timeline
    FOR EACH ROW EXECUTE FUNCTION public.stamp_timeline_tenant();

-- ==============================================================================
-- 6. COMMUNICATION PREFERENCES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.communication_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('WHATSAPP', 'EMAIL', 'SMS')),
    marketing_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    transactional_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    opt_out_reason TEXT,
    opted_out_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_contact_channel_pref UNIQUE (contact_id, channel),
    -- Strict cross-tenant composite FK
    CONSTRAINT fk_comm_prefs_tenant_contact FOREIGN KEY (tenant_id, contact_id)
        REFERENCES public.contacts(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comm_prefs_contact ON public.communication_preferences(contact_id);
CREATE INDEX IF NOT EXISTS idx_comm_prefs_tenant ON public.communication_preferences(tenant_id);

-- Auto-derive tenant_id from contact if not supplied
CREATE OR REPLACE FUNCTION public.stamp_comm_prefs_tenant()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO NEW.tenant_id
        FROM public.contacts
        WHERE id = NEW.contact_id;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.stamp_comm_prefs_tenant() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stamp_comm_prefs_tenant() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_comm_prefs_stamp_tenant ON public.communication_preferences;
CREATE TRIGGER trg_comm_prefs_stamp_tenant
    BEFORE INSERT ON public.communication_preferences
    FOR EACH ROW EXECUTE FUNCTION public.stamp_comm_prefs_tenant();

DROP TRIGGER IF EXISTS trg_comm_prefs_updated_at ON public.communication_preferences;
CREATE TRIGGER trg_comm_prefs_updated_at
    BEFORE UPDATE ON public.communication_preferences
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 7. CONTACT LISTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.contact_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    type VARCHAR(50) NOT NULL CHECK (type IN ('STATIC', 'DYNAMIC')),
    rules JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Composite unique key to support composite cross-tenant foreign keys
    CONSTRAINT unique_tenant_contact_list UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_contact_lists_tenant ON public.contact_lists(tenant_id);

DROP TRIGGER IF EXISTS trg_contact_lists_updated_at ON public.contact_lists;
CREATE TRIGGER trg_contact_lists_updated_at
    BEFORE UPDATE ON public.contact_lists
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 8. CONTACT LIST MEMBERS (Relational Membership Table for 100k+ Scale)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.contact_list_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    list_id UUID NOT NULL,
    contact_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_tenant_list_contact UNIQUE (tenant_id, list_id, contact_id),
    -- Strict cross-tenant composite FKs: List and Contact must belong to the same tenant
    CONSTRAINT fk_list_members_tenant_list FOREIGN KEY (tenant_id, list_id)
        REFERENCES public.contact_lists(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_list_members_tenant_contact FOREIGN KEY (tenant_id, contact_id)
        REFERENCES public.contacts(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_list_members_lookup ON public.contact_list_members(tenant_id, list_id);
CREATE INDEX IF NOT EXISTS idx_list_members_contact ON public.contact_list_members(tenant_id, contact_id);

-- Auto-derive tenant_id from contact_list if not supplied
CREATE OR REPLACE FUNCTION public.stamp_list_member_tenant()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO NEW.tenant_id
        FROM public.contact_lists
        WHERE id = NEW.list_id;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.stamp_list_member_tenant() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stamp_list_member_tenant() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_list_member_stamp_tenant ON public.contact_list_members;
CREATE TRIGGER trg_list_member_stamp_tenant
    BEFORE INSERT ON public.contact_list_members
    FOR EACH ROW EXECUTE FUNCTION public.stamp_list_member_tenant();

-- ==============================================================================
-- 9. MESSAGE TEMPLATES TABLE (Versioned with Authoritative Creator)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('WHATSAPP', 'EMAIL', 'SMS')),
    subject TEXT,
    body TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    available_variables TEXT[] NOT NULL DEFAULT '{}',
    attachment_name TEXT,
    attachment_size VARCHAR(50),
    attachment_type VARCHAR(100),
    category VARCHAR(50) NOT NULL DEFAULT 'INTRODUCTION',
    created_by UUID NOT NULL, -- UUID reference to tenant_members
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Composite unique key to support composite cross-tenant foreign keys
    CONSTRAINT unique_tenant_template UNIQUE (tenant_id, id),
    CONSTRAINT fk_templates_tenant_creator FOREIGN KEY (tenant_id, created_by)
        REFERENCES public.tenant_members(tenant_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_templates_tenant ON public.message_templates(tenant_id);

DROP TRIGGER IF EXISTS trg_message_templates_updated_at ON public.message_templates;
CREATE TRIGGER trg_message_templates_updated_at
    BEFORE UPDATE ON public.message_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 10. CAMPAIGNS TABLE (State Machine & Snapshots)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('WHATSAPP', 'EMAIL', 'SMS')),
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEW', 'APPROVED', 'ACTIVE', 'PAUSED', 'COMPLETED')),
    target_list_id UUID,
    target_list_name VARCHAR(255) NOT NULL,
    template_id UUID,
    template_version INTEGER NOT NULL,
    template_snapshot JSONB NOT NULL,
    is_dry_run BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL,
    approved_by UUID,
    assigned_operator UUID,
    approved_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    recipients_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    opened_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    blocked_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Composite unique key to support composite cross-tenant foreign keys
    CONSTRAINT unique_tenant_campaign UNIQUE (tenant_id, id),
    -- Cross-tenant referential integrity: Target list & template MUST belong to the SAME tenant
    -- Uses ON DELETE RESTRICT to preserve campaign historical integrity
    CONSTRAINT fk_campaigns_tenant_target_list FOREIGN KEY (tenant_id, target_list_id) 
        REFERENCES public.contact_lists(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_campaigns_tenant_template FOREIGN KEY (tenant_id, template_id) 
        REFERENCES public.message_templates(tenant_id, id) ON DELETE RESTRICT,
    -- Actors must be legitimate members of this tenant
    CONSTRAINT fk_campaigns_tenant_creator FOREIGN KEY (tenant_id, created_by)
        REFERENCES public.tenant_members(tenant_id, user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_campaigns_tenant_approver FOREIGN KEY (tenant_id, approved_by)
        REFERENCES public.tenant_members(tenant_id, user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_campaigns_tenant_operator FOREIGN KEY (tenant_id, assigned_operator)
        REFERENCES public.tenant_members(tenant_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON public.campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(tenant_id, status);

DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER trg_campaigns_updated_at
    BEFORE UPDATE ON public.campaigns
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 11. CAMPAIGN RECIPIENTS QUEUE TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL,
    contact_id UUID NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL DEFAULT '',
    channel VARCHAR(50) NOT NULL,
    channel_address VARCHAR(255) NOT NULL,
    resolved_message TEXT NOT NULL,
    resolved_subject TEXT,
    attachment_name TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'READY' CHECK (status IN ('QUEUED', 'READY', 'OPENED', 'USER_SENT', 'SKIPPED', 'BLOCKED', 'OPTED_OUT')),
    claimed_by_operator UUID,
    claimed_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    user_sent_at TIMESTAMPTZ,
    skipped_at TIMESTAMPTZ,
    skip_reason TEXT,
    policy_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_campaign_contact UNIQUE (campaign_id, contact_id),
    -- Cross-tenant referential integrity: Campaign MUST belong to the SAME tenant
    CONSTRAINT fk_recipients_tenant_campaign FOREIGN KEY (tenant_id, campaign_id)
        REFERENCES public.campaigns(tenant_id, id) ON DELETE CASCADE,
    -- Cross-tenant referential integrity: Contact MUST belong to the SAME tenant
    CONSTRAINT fk_recipients_tenant_contact FOREIGN KEY (tenant_id, contact_id)
        REFERENCES public.contacts(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_recipients_tenant_operator FOREIGN KEY (tenant_id, claimed_by_operator)
        REFERENCES public.tenant_members(tenant_id, user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_recipients_status ON public.campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_recipients_tenant ON public.campaign_recipients(tenant_id);

DROP TRIGGER IF EXISTS trg_recipients_updated_at ON public.campaign_recipients;
CREATE TRIGGER trg_recipients_updated_at
    BEFORE UPDATE ON public.campaign_recipients
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Automatically derive tenant_id from parent campaign if not explicitly supplied
CREATE OR REPLACE FUNCTION public.stamp_recipient_tenant()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO NEW.tenant_id
        FROM public.campaigns
        WHERE id = NEW.campaign_id;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.stamp_recipient_tenant() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stamp_recipient_tenant() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_recipients_stamp_tenant ON public.campaign_recipients;
CREATE TRIGGER trg_recipients_stamp_tenant
    BEFORE INSERT ON public.campaign_recipients
    FOR EACH ROW EXECUTE FUNCTION public.stamp_recipient_tenant();

-- ==============================================================================
-- 12. AUDIT LOGS TABLE (Append-Only / Tamper-Evident SHA-256 Ledger)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- ON DELETE RESTRICT: Audit logs NEVER disappear if a tenant is deleted or purged!
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    sequence_number BIGINT GENERATED ALWAYS AS IDENTITY,
    actor_id UUID NOT NULL,
    actor_name VARCHAR(255) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50) DEFAULT NULL, -- Nullable; never defaulted to arbitrary loopback
    previous_hash VARCHAR(64) NOT NULL,  -- Derived authoritative previous hash
    entry_hash VARCHAR(64) NOT NULL,     -- Computed deterministic cryptographic hash
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(tenant_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_seq ON public.audit_logs(tenant_id, sequence_number DESC);

-- Automated cryptographic entry_hash verification & actor stamping trigger
CREATE OR REPLACE FUNCTION public.process_audit_log_entry()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_prev_hash VARCHAR(64);
    v_actor_name VARCHAR(255);
    v_actor_role VARCHAR(50);
BEGIN
    -- Authenticity: If an authenticated session is active, authoritative actor_id must match auth.uid()
    IF auth.uid() IS NOT NULL THEN
        NEW.actor_id := auth.uid();
    END IF;

    -- Query authoritative public user record for display name snapshot
    SELECT name INTO v_actor_name 
    FROM public.users 
    WHERE id = NEW.actor_id;

    -- Query authoritative tenant role snapshot
    SELECT role INTO v_actor_role 
    FROM public.tenant_members 
    WHERE tenant_id = NEW.tenant_id AND user_id = NEW.actor_id;

    NEW.actor_name := COALESCE(v_actor_name, 'System Actor');
    NEW.actor_role := COALESCE(v_actor_role, 'SYSTEM');

    -- Authoritative previous hash retrieval with tenant-level ordering
    SELECT entry_hash INTO v_prev_hash
    FROM public.audit_logs
    WHERE tenant_id = NEW.tenant_id
    ORDER BY sequence_number DESC
    LIMIT 1;

    NEW.previous_hash := COALESCE(v_prev_hash, 'GENESIS_REACHOUT_OS_INITIAL_BLOCK');

    -- Canonical deterministic hash computation: SHA-256 over key event parameters
    NEW.entry_hash := encode(digest(
        NEW.previous_hash || ':' ||
        NEW.tenant_id::text || ':' ||
        NEW.actor_id::text || ':' ||
        NEW.actor_role || ':' ||
        NEW.action || ':' ||
        NEW.entity_type || ':' ||
        NEW.entity_id || ':' ||
        NEW.metadata::text || ':' ||
        NEW.created_at::text,
        'sha256'
    ), 'hex');

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.process_audit_log_entry() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_audit_log_entry() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_audit_logs_process ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_process
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_entry();

-- ==============================================================================
-- 13. SUPABASE AUTH USER SYNCHRONIZATION TRIGGER (PINNED EMPTY SEARCH_PATH)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'user'), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 14. LEAST-PRIVILEGE SCHEMA GRANTS
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Authenticated role: Restricted table operations (NO raw DROP, TRUNCATE, or UNCHECKED ACCESS)
GRANT SELECT, UPDATE ON public.tenants, public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON 
    public.contacts, 
    public.contact_lists,
    public.contact_list_members,
    public.message_templates, 
    public.campaigns, 
    public.campaign_recipients,
    public.communication_preferences 
TO authenticated;

-- Timeline & Audit logs: Append-only for authenticated role (no UPDATE, no DELETE)
GRANT SELECT, INSERT ON public.contact_timeline TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;

-- Sequence usage for authenticated
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Full administrative access reserved strictly for backend service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;
