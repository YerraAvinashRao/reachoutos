# ARCHITECTURE: ReachOut OS

## 1. System Overview
ReachOut OS is designed as a **Modular Monolith** with clean architectural separation between Presentation, Application Services, Domain Models, Repository Ports, and Infrastructure Adapters:

```text
               ┌────────────────────────────────────────────────────────┐
               │              React 19 SPA (Client UI)                   │
               │   • Linear / Stripe / Raycast Aesthetic                 │
               │   • Keyboard Navigation (W, E, S, K, B)                │
               │   • Optimistic Caching & Virtualized Tables            │
               └──────────────────────────┬─────────────────────────────┘
                                          │ HTTP / JSON API (v1)
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │              Express Application Layer                 │
               │   • Authentication & RBAC Middleware                   │
               │   • Input Validation & Rate Governance                 │
               │   • API Routes (/api/v1/*)                             │
               └──────────────────────────┬─────────────────────────────┘
                                          │
                     ┌────────────────────┴───────────────────┐
                     ▼                                        ▼
    ┌─────────────────────────────────┐      ┌─────────────────────────────────┐
    │          Domain Services        │      │          AI Copilot Port        │
    │  • ContactIntelligenceService   │      │  • Gemini 3.8 Flash SDK         │
    │  • DataQualityEngine            │      │  • Guardrail & Spam Detector    │
    │  • CommunicationPolicyEngine    │      │  • Tone & Translation Engine    │
    │  • CampaignWorkflowService      │      └─────────────────────────────────┘
    │  • ManualHandoffService         │
    │  • AuditLogService              │
    └────────────────┬────────────────┘
                     │
                     ▼
    ┌─────────────────────────────────┐
    │     Repository Ports (SPI)      │
    │  • ContactRepository            │
    │  • CampaignRepository           │
    │  • TemplateRepository           │
    │  • StorageProvider              │
    └────────────────┬────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│ In-Memory/Sqlite │    │ Supabase/Postgres│
│ Active Adapter   │    │ Portability Ready│
└──────────────────┘    └──────────────────┘
```

## 2. Ports and Adapters (Hexagonal Architecture)
1. **Database Port (`DatabaseProvider`)**: Defines generic contracts for entity persistence (`ContactRepository`, `CampaignRepository`, `TemplateRepository`, `AuditRepository`, `TenantRepository`). The active provider is determined via environment configuration (`DATABASE_PROVIDER=postgres|supabase|memory`).
2. **Channel Port (`CommunicationChannel`)**: Decouples channel-specific logic.
   - `WhatsAppManualChannel`: Prepares official `wa.me/` URLs with encoded parameters and validates recipient phone readiness.
   - `EmailManualChannel`: Prepares `mailto:` strings with RFC-compliant subjects and bodies.
3. **Storage Port (`StorageProvider`)**: Abstracts file attachment persistence and signed URL generation.

## 3. Communication Policy Engine
Before any message composer is opened or marked ready:
```text
Recipient (Active?)
       ↓
Consent Granted?
       ↓
Channel Allowed?
       ↓
Suppression Rules (Global / Tenant / Campaign)?
       ↓
Variable Resolution Verified?
       ↓
Emergency Kill Switch Inactive?
       ↓
ALLOW / BLOCK (with detailed diagnostic reasons)
```
