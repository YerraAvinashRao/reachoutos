-- ==============================================================================
-- REACHOUT OS - MIGRATION 005: ADVANCED ENTERPRISE SUITE
-- Description: Schema additions for:
--   1. Multi-step follow-up cadences & daily dispatch queues
--   2. Canned quick responses & live smart inbox threads
--   3. A/B variant testing allocations & metrics
-- ==============================================================================

-- 1. Cadence Sequences
CREATE TABLE IF NOT EXISTS public.cadence_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    channel VARCHAR(50) NOT NULL DEFAULT 'WHATSAPP',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PAUSED, ARCHIVED
    steps JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { stepNumber, delayDays, templateId, templateSnapshot, title }
    auto_exit_on_reply BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Cadence Enrollments
CREATE TABLE IF NOT EXISTS public.cadence_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cadence_id UUID NOT NULL REFERENCES public.cadence_sequences(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    current_step INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, COMPLETED, PAUSED_REPLIED, OPTED_OUT, SKIPPED
    next_due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    step_history JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { stepNumber, dispatchedAt, operatorName, status }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Canned Responses (Quick Snippets)
CREATE TABLE IF NOT EXISTS public.canned_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    shortcut VARCHAR(50) NOT NULL, -- e.g. "/catalog", "/pricing", "/bank"
    category VARCHAR(50) NOT NULL DEFAULT 'SALES', -- SALES, SUPPORT, PAYMENTS, SAMPLES
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Campaign A/B Test Variants Extension
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS is_ab_test BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ab_variants JSONB DEFAULT '[]'::jsonb, -- Array of { id, name, templateId, templateSnapshot, allocationPct, sentCount, openedCount, repliedCount }
ADD COLUMN IF NOT EXISTS winning_variant_id VARCHAR(100);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cadence_sequences_tenant ON public.cadence_sequences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cadence_enrollments_tenant ON public.cadence_enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cadence_enrollments_due ON public.cadence_enrollments(tenant_id, next_due_at, status);
CREATE INDEX IF NOT EXISTS idx_canned_responses_tenant ON public.canned_responses(tenant_id);

-- Enable RLS
ALTER TABLE public.cadence_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
DROP POLICY IF EXISTS tenant_isolation_cadence_sequences ON public.cadence_sequences;
CREATE POLICY tenant_isolation_cadence_sequences ON public.cadence_sequences
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS tenant_isolation_cadence_enrollments ON public.cadence_enrollments;
CREATE POLICY tenant_isolation_cadence_enrollments ON public.cadence_enrollments
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS tenant_isolation_canned_responses ON public.canned_responses;
CREATE POLICY tenant_isolation_canned_responses ON public.canned_responses
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1));
