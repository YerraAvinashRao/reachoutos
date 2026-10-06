# PRODUCT CONTRACT: ReachOut OS

## 1. Product Purpose
ReachOut OS is a secure, multi-channel, human-in-the-loop communication and contact intelligence platform designed for commercial outreach (e.g. retail networks, distributors, wholesale leads). It empowers operators to organize contacts, normalize phone and email records, enforce rigorous consent and suppression policies, test and approve campaigns, and manually dispatch personalized communications across WhatsApp and Email through official composer handoffs.

## 2. V1 Scope
- **Multi-Tenant Architecture & RBAC**: Owner, Admin, Manager, Operator, Viewer roles.
- **Contact Intelligence Layer**: Unified contact profiles with multiple channel addresses, tags, custom fields, consent history, notes, and an event-sourced Customer Timeline.
- **Data Quality Engine**: Phone normalization (canonical E.164 / +91), email validation, disposable domain detection, and duplicate resolution.
- **Suppression & Communication Policy Engine**: Multi-tier suppression (Global, Channel, Campaign, Tenant) and deterministic `ALLOW / BLOCK` evaluations with explicit "Why can't I send?" reasoning.
- **Contact Import & Mapping Pipeline**: CSV/TSV/JSON/VCF parsing with schema mapping, error triage, duplicate policy resolution, and preview before commit.
- **Campaign State Machine & Snapshots**: Draft → Review → Approved → Active → Completed/Paused workflow with immutable recipient message snapshots.
- **Safety & Quality Controls**: Pre-activation audience breakdown, 5-recipient preview, internal Test Recipient dispatch, and Workspace Emergency Kill Switch.
- **Manual Sending Workspace**: Keyboard-driven (`W`, `E`, `S`, `K`, `B`, `N`) focus environment with explicit state tracking (`PREPARED` → `OPENED` → `USER CONFIRMED SENT`).
- **AI Message Copilot**: Server-side Gemini 3.8 Flash integration for draft generation, tone adjustment, translation (Telugu, Hindi, Hinglish), and spam/claim guardrail checks.
- **Audit System**: Append-only log of every administrative and messaging action.

## 3. Non-Goals (Explicitly NOT V1)
- Automated or unattended WhatsApp sending.
- WhatsApp Web DOM manipulation, simulated keystrokes, Playwright/Puppeteer/Selenium browser automation, QR-session hijacking, or anti-ban evasion.
- Unofficial WhatsApp APIs.
- False delivery claims (never reporting "Delivered" or "Read" without provider confirmation).
- Automatic AI sending or AI mutating customer consent.
- Microservices or multi-database deployments in V1 (modular monolith is the standard).

## 4. Non-Negotiable Architecture & Security Rules
1. **No direct database calls from React UI**: All operations must flow through versioned API endpoints, domain services, and repository interfaces.
2. **Repository Abstraction**: Domain and application layers depend solely on repository interfaces (`ContactRepository`, `CampaignRepository`, etc.) rather than concrete DB drivers.
3. **No client-side AI keys**: Gemini API is invoked exclusively on the server (`server.ts`).
4. **Deterministic Policy Precedence**: AI suggestions pass through policy engines and human review before reaching send preparation.
5. **No silent data loss during imports**: Every duplicate, warning, or error is categorized and presented to the operator.
6. **No unresolved variables**: Message dispatch is blocked if placeholders such as `{{first_name}}` lack corresponding recipient data.

## 5. Definition of Done
- Complete TypeScript compilation without errors.
- Real API endpoints handling all domain commands and queries.
- High-performance, keyboard-friendly UI styled with modern Tailwind CSS.
- Working CSV import and preview engine.
- Working WhatsApp deep-link composer handoff and Email mailto handoff.
- Verified workspace kill switch and contact suppression enforcement.
