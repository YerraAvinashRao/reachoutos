-- ==============================================================================
-- REACHOUT OS - MIGRATION 003: COMPLIANCE POLICY ENGINE LEDGER
-- Description: Multi-tenant table for storing authoritative Meta WhatsApp Policy
--              evaluations, violation breakdowns, and compliance overrides.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.compliance_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    campaign_id UUID,
    recipient_id UUID,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL DEFAULT 'WHATSAPP',
    policy_version VARCHAR(50) NOT NULL DEFAULT '2026-10',
    decision VARCHAR(50) NOT NULL CHECK (decision IN ('ALLOW', 'HUMAN_REVIEW', 'BLOCK')),
    risk_level VARCHAR(50) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    rule_evaluations JSONB NOT NULL DEFAULT '[]'::jsonb,
    violations JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_actions TEXT[] NOT NULL DEFAULT '{}',
    can_human_override BOOLEAN NOT NULL DEFAULT FALSE,
    is_overridden BOOLEAN NOT NULL DEFAULT FALSE,
    override_reason TEXT,
    overridden_by UUID,
    actor_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning fast compliance lookup and analytics
CREATE INDEX IF NOT EXISTS idx_compliance_evaluations_tenant ON public.compliance_evaluations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_evaluations_campaign ON public.compliance_evaluations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_compliance_evaluations_decision ON public.compliance_evaluations(tenant_id, decision);
CREATE INDEX IF NOT EXISTS idx_compliance_evaluations_created_at ON public.compliance_evaluations(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.compliance_evaluations ENABLE ROW LEVEL SECURITY;

-- Multi-tenant isolation policy
DROP POLICY IF EXISTS tenant_isolation_compliance_evaluations ON public.compliance_evaluations;
CREATE POLICY tenant_isolation_compliance_evaluations ON public.compliance_evaluations
    FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1));
