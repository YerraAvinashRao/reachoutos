-- ==============================================================================
-- REACHOUT OS - MIGRATION 002: ROW LEVEL SECURITY & RBAC POLICIES (BANK-GRADE)
-- Description: Enforces multi-tenant isolation, anti-privilege-escalation RBAC,
--              pinned empty search_path, query-optimized RLS checks, and audit immutability.
-- ==============================================================================

-- 1. Enable RLS on all 12 tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 2. SECURE AUTHORIZATION HELPER FUNCTIONS (PINNED EMPTY SEARCH_PATH)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.tenant_members 
        WHERE tenant_id = p_tenant_id 
          AND user_id = auth.uid()
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_role(p_tenant_id UUID)
RETURNS VARCHAR 
LANGUAGE plpgsql 
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_role VARCHAR;
BEGIN
    SELECT role INTO v_role
    FROM public.tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid();
    RETURN COALESCE(v_role, 'NONE');
END;
$$;

-- Revoke default PUBLIC & anon privileges on internal RLS helpers
REVOKE ALL ON FUNCTION public.is_tenant_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_tenant_role(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_tenant_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_tenant_role(UUID) TO authenticated, service_role;

-- ==============================================================================
-- 3. RBAC PRIVILEGE ESCALATION PREVENTION TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.validate_tenant_member_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_role VARCHAR;
    v_owner_count INTEGER;
    v_target_tenant_id UUID;
BEGIN
    -- Allow direct execution by service_role (e.g. background migrations/admin tools)
    IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    v_target_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);

    -- Authoritatively look up the caller's role in this tenant
    SELECT role INTO v_caller_role
    FROM public.tenant_members
    WHERE tenant_id = v_target_tenant_id AND user_id = auth.uid();

    IF v_caller_role IS NULL THEN
        RAISE EXCEPTION 'Access denied: caller is not a member of tenant %', v_target_tenant_id;
    END IF;

    -- Non-admins/non-owners cannot mutate memberships at all
    IF v_caller_role NOT IN ('OWNER', 'ADMIN') THEN
        RAISE EXCEPTION 'Access denied: role % cannot manage tenant members', v_caller_role;
    END IF;

    -- INVARIANT 1: ADMIN cannot create an OWNER
    IF TG_OP = 'INSERT' AND v_caller_role = 'ADMIN' AND NEW.role = 'OWNER' THEN
        RAISE EXCEPTION 'Privilege escalation blocked: ADMIN cannot assign OWNER role';
    END IF;

    -- INVARIANT 2: ADMIN cannot promote anyone to OWNER
    IF TG_OP = 'UPDATE' AND v_caller_role = 'ADMIN' AND NEW.role = 'OWNER' THEN
        RAISE EXCEPTION 'Privilege escalation blocked: ADMIN cannot promote to OWNER';
    END IF;

    -- INVARIANT 3: ADMIN cannot modify or delete an OWNER
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') AND v_caller_role = 'ADMIN' AND OLD.role = 'OWNER' THEN
        RAISE EXCEPTION 'Access denied: ADMIN cannot modify or remove an OWNER';
    END IF;

    -- INVARIANT 4: Tenant must never be left without at least one OWNER
    IF (TG_OP = 'DELETE' AND OLD.role = 'OWNER') OR 
       (TG_OP = 'UPDATE' AND OLD.role = 'OWNER' AND NEW.role != 'OWNER') THEN
        SELECT count(*) INTO v_owner_count
        FROM public.tenant_members
        WHERE tenant_id = OLD.tenant_id 
          AND role = 'OWNER' 
          AND id != OLD.id;

        IF v_owner_count = 0 THEN
            RAISE EXCEPTION 'Invariant violation: tenant must retain at least one OWNER';
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.validate_tenant_member_mutation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_tenant_member_mutation() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_tenant_member_rbac ON public.tenant_members;
CREATE TRIGGER trg_tenant_member_rbac
    BEFORE INSERT OR UPDATE OR DELETE ON public.tenant_members
    FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_member_mutation();

-- ==============================================================================
-- 4. TRUSTED ATOMIC TENANT ONBOARDING FUNCTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(
    p_name VARCHAR,
    p_slug VARCHAR
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_clean_slug VARCHAR;
    v_clean_name VARCHAR;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to onboard a tenant';
    END IF;

    v_clean_name := trim(p_name);
    v_clean_slug := lower(trim(p_slug));

    IF length(v_clean_name) < 2 OR length(v_clean_name) > 255 THEN
        RAISE EXCEPTION 'Tenant name must be between 2 and 255 characters';
    END IF;

    IF NOT (v_clean_slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$') THEN
        RAISE EXCEPTION 'Tenant slug must be alphanumeric with hyphens (e.g. my-org)';
    END IF;

    -- Create tenant record
    INSERT INTO public.tenants (name, slug, status)
    VALUES (v_clean_name, v_clean_slug, 'ACTIVE')
    RETURNING id INTO v_tenant_id;

    -- Assign creator as authoritative OWNER
    INSERT INTO public.tenant_members (tenant_id, user_id, role)
    VALUES (v_tenant_id, v_user_id, 'OWNER');

    -- Record initial audit event
    INSERT INTO public.audit_logs (
        tenant_id,
        actor_id,
        actor_name,
        actor_role,
        action,
        entity_type,
        entity_id,
        metadata
    ) VALUES (
        v_tenant_id,
        v_user_id,
        'Tenant Creator',
        'OWNER',
        'TENANT_ONBOARDED',
        'TENANT',
        v_tenant_id::text,
        jsonb_build_object('name', v_clean_name, 'slug', v_clean_slug)
    );

    RETURN v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_tenant_with_owner(VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_tenant_with_owner(VARCHAR, VARCHAR) TO authenticated;

-- ==============================================================================
-- 5. TENANTS POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS tenant_isolation_select ON public.tenants;
CREATE POLICY tenant_isolation_select ON public.tenants
    FOR SELECT
    USING ((SELECT public.is_tenant_member(id)));

-- Direct INSERT blocked: Must use create_tenant_with_owner RPC or service_role
DROP POLICY IF EXISTS tenant_isolation_insert ON public.tenants;
CREATE POLICY tenant_isolation_insert ON public.tenants
    FOR INSERT
    WITH CHECK (FALSE);

DROP POLICY IF EXISTS tenant_isolation_update ON public.tenants;
CREATE POLICY tenant_isolation_update ON public.tenants
    FOR UPDATE
    USING ((SELECT public.get_tenant_role(id)) IN ('OWNER', 'ADMIN'));

DROP POLICY IF EXISTS tenant_isolation_delete ON public.tenants;
CREATE POLICY tenant_isolation_delete ON public.tenants
    FOR DELETE
    USING (FALSE);

-- ==============================================================================
-- 6. USERS PROFILE POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users
    FOR SELECT
    USING (
        id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.tenant_members tm1
            JOIN public.tenant_members tm2 ON tm1.tenant_id = tm2.tenant_id
            WHERE tm1.user_id = (SELECT auth.uid()) AND tm2.user_id = users.id
        )
    );

DROP POLICY IF EXISTS users_insert ON public.users;
CREATE POLICY users_insert ON public.users
    FOR INSERT
    WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users
    FOR UPDATE
    USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS users_delete ON public.users;
CREATE POLICY users_delete ON public.users
    FOR DELETE
    USING (FALSE);

-- ==============================================================================
-- 7. TENANT MEMBERS POLICIES (Governed by trigger + RLS)
-- ==============================================================================
DROP POLICY IF EXISTS tenant_members_select ON public.tenant_members;
CREATE POLICY tenant_members_select ON public.tenant_members
    FOR SELECT
    USING (
        user_id = (SELECT auth.uid()) 
        OR (SELECT public.is_tenant_member(tenant_id))
    );

DROP POLICY IF EXISTS tenant_members_insert ON public.tenant_members;
CREATE POLICY tenant_members_insert ON public.tenant_members
    FOR INSERT
    WITH CHECK ((SELECT public.get_tenant_role(tenant_id)) IN ('OWNER', 'ADMIN'));

DROP POLICY IF EXISTS tenant_members_update ON public.tenant_members;
CREATE POLICY tenant_members_update ON public.tenant_members
    FOR UPDATE
    USING ((SELECT public.get_tenant_role(tenant_id)) IN ('OWNER', 'ADMIN'));

DROP POLICY IF EXISTS tenant_members_delete ON public.tenant_members;
CREATE POLICY tenant_members_delete ON public.tenant_members
    FOR DELETE
    USING ((SELECT public.get_tenant_role(tenant_id)) IN ('OWNER', 'ADMIN'));

-- ==============================================================================
-- 8. CONTACTS POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS contacts_select ON public.contacts;
CREATE POLICY contacts_select ON public.contacts
    FOR SELECT
    USING ((SELECT public.is_tenant_member(tenant_id)));

DROP POLICY IF EXISTS contacts_insert ON public.contacts;
CREATE POLICY contacts_insert ON public.contacts
    FOR INSERT
    WITH CHECK (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) != 'VIEWER'
    );

DROP POLICY IF EXISTS contacts_update ON public.contacts;
CREATE POLICY contacts_update ON public.contacts
    FOR UPDATE
    USING (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) != 'VIEWER'
    );

DROP POLICY IF EXISTS contacts_delete ON public.contacts;
CREATE POLICY contacts_delete ON public.contacts
    FOR DELETE
    USING (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) IN ('OWNER', 'ADMIN', 'MANAGER')
    );

-- ==============================================================================
-- 9. CONTACT TIMELINE POLICIES (Append-Only)
-- ==============================================================================
DROP POLICY IF EXISTS timeline_select ON public.contact_timeline;
CREATE POLICY timeline_select ON public.contact_timeline
    FOR SELECT
    USING ((SELECT public.is_tenant_member(tenant_id)));

DROP POLICY IF EXISTS timeline_insert ON public.contact_timeline;
CREATE POLICY timeline_insert ON public.contact_timeline
    FOR INSERT
    WITH CHECK (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) != 'VIEWER'
    );

DROP POLICY IF EXISTS timeline_update ON public.contact_timeline;
CREATE POLICY timeline_update ON public.contact_timeline
    FOR UPDATE
    USING (FALSE);

DROP POLICY IF EXISTS timeline_delete ON public.contact_timeline;
CREATE POLICY timeline_delete ON public.contact_timeline
    FOR DELETE
    USING (FALSE);

-- ==============================================================================
-- 10. COMMUNICATION PREFERENCES POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS comm_prefs_select ON public.communication_preferences;
CREATE POLICY comm_prefs_select ON public.communication_preferences
    FOR SELECT
    USING ((SELECT public.is_tenant_member(tenant_id)));

DROP POLICY IF EXISTS comm_prefs_insert ON public.communication_preferences;
CREATE POLICY comm_prefs_insert ON public.communication_preferences
    FOR INSERT
    WITH CHECK (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) != 'VIEWER'
    );

DROP POLICY IF EXISTS comm_prefs_update ON public.communication_preferences;
CREATE POLICY comm_prefs_update ON public.communication_preferences
    FOR UPDATE
    USING (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) != 'VIEWER'
    );

DROP POLICY IF EXISTS comm_prefs_delete ON public.communication_preferences;
CREATE POLICY comm_prefs_delete ON public.communication_preferences
    FOR DELETE
    USING (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) IN ('OWNER', 'ADMIN', 'MANAGER')
    );

-- ==============================================================================
-- 11. CONTACT LISTS POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS lists_select ON public.contact_lists;
CREATE POLICY lists_select ON public.contact_lists
    FOR SELECT
    USING ((SELECT public.is_tenant_member(tenant_id)));

DROP POLICY IF EXISTS lists_insert ON public.contact_lists;
CREATE POLICY lists_insert ON public.contact_lists
    FOR INSERT
    WITH CHECK (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) != 'VIEWER'
    );

DROP POLICY IF EXISTS lists_update ON public.contact_lists;
CREATE POLICY lists_update ON public.contact_lists
    FOR UPDATE
    USING (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) != 'VIEWER'
    );

DROP POLICY IF EXISTS lists_delete ON public.contact_lists;
CREATE POLICY lists_delete ON public.contact_lists
    FOR DELETE
    USING (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) IN ('OWNER', 'ADMIN', 'MANAGER')
    );

-- ==============================================================================
-- 12. CONTACT LIST MEMBERS POLICIES (Relational Membership Table)
-- ==============================================================================
DROP POLICY IF EXISTS list_members_select ON public.contact_list_members;
CREATE POLICY list_members_select ON public.contact_list_members
    FOR SELECT
    USING ((SELECT public.is_tenant_member(tenant_id)));

DROP POLICY IF EXISTS list_members_insert ON public.contact_list_members;
CREATE POLICY list_members_insert ON public.contact_list_members
    FOR INSERT
    WITH CHECK (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) != 'VIEWER'
    );

DROP POLICY IF EXISTS list_members_update ON public.contact_list_members;
CREATE POLICY list_members_update ON public.contact_list_members
    FOR UPDATE
    USING (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) != 'VIEWER'
    );

DROP POLICY IF EXISTS list_members_delete ON public.contact_list_members;
CREATE POLICY list_members_delete ON public.contact_list_members
    FOR DELETE
    USING (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) IN ('OWNER', 'ADMIN', 'MANAGER')
    );

-- ==============================================================================
-- 13. MESSAGE TEMPLATES POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS templates_select ON public.message_templates;
CREATE POLICY templates_select ON public.message_templates
    FOR SELECT
    USING ((SELECT public.is_tenant_member(tenant_id)));

DROP POLICY IF EXISTS templates_insert ON public.message_templates;
CREATE POLICY templates_insert ON public.message_templates
    FOR INSERT
    WITH CHECK (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) != 'VIEWER'
    );

DROP POLICY IF EXISTS templates_update ON public.message_templates;
CREATE POLICY templates_update ON public.message_templates
    FOR UPDATE
    USING (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) != 'VIEWER'
    );

DROP POLICY IF EXISTS templates_delete ON public.message_templates;
CREATE POLICY templates_delete ON public.message_templates
    FOR DELETE
    USING (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) IN ('OWNER', 'ADMIN', 'MANAGER')
    );

-- ==============================================================================
-- 14. CAMPAIGNS POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS campaigns_select ON public.campaigns;
CREATE POLICY campaigns_select ON public.campaigns
    FOR SELECT
    USING ((SELECT public.is_tenant_member(tenant_id)));

DROP POLICY IF EXISTS campaigns_insert ON public.campaigns;
CREATE POLICY campaigns_insert ON public.campaigns
    FOR INSERT
    WITH CHECK (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) != 'VIEWER'
    );

DROP POLICY IF EXISTS campaigns_update ON public.campaigns;
CREATE POLICY campaigns_update ON public.campaigns
    FOR UPDATE
    USING (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) != 'VIEWER'
    );

DROP POLICY IF EXISTS campaigns_delete ON public.campaigns;
CREATE POLICY campaigns_delete ON public.campaigns
    FOR DELETE
    USING (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) IN ('OWNER', 'ADMIN')
    );

-- ==============================================================================
-- 15. CAMPAIGN RECIPIENTS POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS recipients_select ON public.campaign_recipients;
CREATE POLICY recipients_select ON public.campaign_recipients
    FOR SELECT
    USING ((SELECT public.is_tenant_member(tenant_id)));

DROP POLICY IF EXISTS recipients_insert ON public.campaign_recipients;
CREATE POLICY recipients_insert ON public.campaign_recipients
    FOR INSERT
    WITH CHECK (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) != 'VIEWER'
    );

DROP POLICY IF EXISTS recipients_update ON public.campaign_recipients;
CREATE POLICY recipients_update ON public.campaign_recipients
    FOR UPDATE
    USING (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) != 'VIEWER'
    );

DROP POLICY IF EXISTS recipients_delete ON public.campaign_recipients;
CREATE POLICY recipients_delete ON public.campaign_recipients
    FOR DELETE
    USING (
        (SELECT public.is_tenant_member(tenant_id))
        AND (SELECT public.get_tenant_role(tenant_id)) IN ('OWNER', 'ADMIN')
    );

-- ==============================================================================
-- 16. AUDIT LOGS POLICIES (Append-Only / Tamper-Evident Ledger)
-- ==============================================================================
DROP POLICY IF EXISTS audit_select ON public.audit_logs;
CREATE POLICY audit_select ON public.audit_logs
    FOR SELECT
    USING ((SELECT public.is_tenant_member(tenant_id)));

DROP POLICY IF EXISTS audit_insert ON public.audit_logs;
CREATE POLICY audit_insert ON public.audit_logs
    FOR INSERT
    WITH CHECK (
        (SELECT public.is_tenant_member(tenant_id)) 
        AND (actor_id = (SELECT auth.uid()) OR auth.role() = 'service_role')
    );

-- Strictly prohibited: modifications or deletions to audit log records
DROP POLICY IF EXISTS audit_no_delete ON public.audit_logs;
CREATE POLICY audit_no_delete ON public.audit_logs
    FOR DELETE
    USING (FALSE);

DROP POLICY IF EXISTS audit_no_update ON public.audit_logs;
CREATE POLICY audit_no_update ON public.audit_logs
    FOR UPDATE
    USING (FALSE);
