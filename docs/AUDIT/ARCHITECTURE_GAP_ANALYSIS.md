# ARCHITECTURE GAP ANALYSIS: ReachOut OS

This document compares the architectural promises outlined in the engineering specifications against the concrete codebase implementation.

---

## 1. Architectural Boundaries Overview

```text
CLAIMED ARCHITECTURE:
  React UI → API Layer → Domain Layer → Repository Interfaces → Database Adapters (Postgres/Supabase/AWS)

ACTUAL CURRENT CODE:
  React UI → Express API → InMemoryDatabaseProvider (JS Map in RAM)
```

---

## 2. Detailed Gap Analysis

### Gap 1: Database Adapter Portability
* **Claim**: The application can swap between Supabase, PostgreSQL, AWS RDS, and Azure via the environment flag `DATABASE_PROVIDER=supabase|postgres|memory`.
* **Reality**: Only `InMemoryDatabaseProvider` exists in `/src/infrastructure/database/DatabaseProvider.ts`. There is no `SupabaseContactRepository`, `PostgresContactRepository`, or SQL migration runner. Changing `DATABASE_PROVIDER=supabase` in `.env` would have zero effect because the active provider is hard-coded as `export const db = new InMemoryDatabaseProvider();`.
* **Verdict**: **MOCKED / ARCHITECTURAL PLACEHOLDER**. The interfaces (`IContactRepository`, `ICampaignRepository`) are well-designed and provider-neutral, but concrete persistent adapters remain to be written.

### Gap 2: Event Sourcing vs Event Audit Table
* **Claim**: "Event-sourced customer timeline."
* **Reality**: The contact state is not materialized by replaying past domain events. Instead, the contact is stored as a mutable document in a Map, and when updates occur, a descriptive log entry is appended to `this.timelines`.
* **Verdict**: **PARTIAL / MISLABELLED**. This is a standard relational interaction log table, not event sourcing (where state is derived exclusively by replaying an append-only event stream).

### Gap 3: Tamper-Evident Audit Logging
* **Claim**: "Cryptographic tamper-evident append-only audit trail."
* **Reality**: Entries are pushed to an in-memory array (`this.auditLogs.unshift()`). There is no cryptographic hashing, no Merkle tree root, and no external ledger anchoring.
* **Verdict**: **MOCKED**. While append-only in normal UI operations, it lacks mathematical tamper evidence.

### Gap 4: Server-Side Authentication & Identity
* **Claim**: "Tenant identity must come from authenticated server-side context; never trust client-supplied tenant_id."
* **Reality**: The server does not validate JWTs or session cookies. It assumes a static user `usr-avinash` belonging to `tenant-yar-organics`. The role switcher (`/api/v1/tenant/switch-role`) is a convenience endpoint that mutates the in-memory user object globally across all clients.
* **Verdict**: **MOCKED / DEMO-ONLY**. Must be replaced with real auth middleware before multi-user deployment.

### Gap 5: Campaign State Machine Transition Invariants
* **Claim**: Formal state machine (`DRAFT` → `REVIEW` → `APPROVED` → `ACTIVE` → `COMPLETED`).
* **Reality**: The UI enforces the progression, but the server API (`server.ts:427`) allows arbitrary jumps if called directly by a client or script (e.g., jumping from `DRAFT` directly to `COMPLETED`).
* **Verdict**: **CLIENT-ONLY ENFORCEMENT**.

---

## 3. Strong Architectural Implementations (What is genuinely real)

1. **WhatsApp & Channel Boundary**:
   - Absolutely zero browser DOM automation, simulated clicks, Puppeteer, Playwright, or session hijacking scripts.
   - Clean implementation of `WhatsAppManualChannel` generating RFC/standard `https://wa.me/` URLs with encoded parameters.
   - True human-in-the-loop: UI explicitly requires operator confirmation (`USER_SENT`) and never pretends URL opening equals transmission.

2. **Deterministic Communication Policy Engine**:
   - `CommunicationPolicyEngine.evaluate()` is cleanly isolated from React and runs purely in TypeScript.
   - Explicit evaluation order: Kill switch → Global block → Contact status → Role authorization → Channel address normalization → Consent preference → Variable resolution.
   - Blocks message preparation if any check fails, returning structured diagnostic reasons.

3. **Template Snapshot Immutability**:
   - Campaign entity embeds `templateSnapshot` at creation time.
   - Edits or version increments to the template do not corrupt existing active or completed campaigns.

4. **Data Quality Engine**:
   - High-precision Indian mobile regex rejecting landlines and enforcing `+91` E.164.
   - Rejection of disposable email domains.
