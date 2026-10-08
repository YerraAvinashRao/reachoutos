-- ==============================================================================
-- REACHOUT OS - MIGRATION 004: INBOUND WHATSAPP WEBHOOKS & 24H SERVICE WINDOWS
-- Description: Multi-tenant storage for inbound WhatsApp messages, customer service
--              window tracking, and automated opt-out ingestion.
-- ==============================================================================

-- 1. Extend contacts table with 24-hour service window timestamps if not present
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS last_inbound_message_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_service_window_expires_at TIMESTAMPTZ;

-- 2. Create inbound_messages ledger table
CREATE TABLE IF NOT EXISTS public.inbound_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL DEFAULT 'WHATSAPP',
    sender_address VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    message_type VARCHAR(50) NOT NULL DEFAULT 'text',
    message_body TEXT NOT NULL,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    is_opt_out_trigger BOOLEAN NOT NULL DEFAULT FALSE,
    window_opened_until TIMESTAMPTZ,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for ultra-fast customer inbox lookup
CREATE INDEX IF NOT EXISTS idx_inbound_messages_tenant ON public.inbound_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_contact ON public.inbound_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_sender ON public.inbound_messages(tenant_id, sender_address);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_received_at ON public.inbound_messages(received_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.inbound_messages ENABLE ROW LEVEL SECURITY;

-- Tenant isolation RLS policy
DROP POLICY IF EXISTS tenant_isolation_inbound_messages ON public.inbound_messages;
CREATE POLICY tenant_isolation_inbound_messages ON public.inbound_messages
    FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() LIMIT 1));
