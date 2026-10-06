# SECURITY FINDINGS REPORT: ReachOut OS

This report classifies vulnerabilities and integrity deficiencies discovered during the independent code audit and penetration probe.

---

## P0 — Must Fix Before ANY Real Customer Data

### SEC-P0-01: Missing Authentication & Unauthenticated API Access
* **Severity**: Critical (P0)
* **File**: `/server.ts:32`
* **Problem**: There is no authentication middleware, session validator, or JWT verifier. The server sets `const user = await db.tenantRepo.getCurrentUser();` on every request, mapping all unauthenticated traffic to a default user (`usr-avinash`).
* **Security Impact**: Any anonymous network client on the local network or internet can execute full CRUD against the API, trigger emergency kill switches, view customer phone numbers, or alter campaign states without supplying credentials.
* **Recommended Fix**: Implement cookie-based session verification or Bearer token JWT authentication middleware that validates user identity and extracts `tenant_id` securely from the signed token before allowing access to `/api/v1/*`.
* **Proved by**: `tests/security-audit-deep.ts:79` (Probe 4: forged token header received full administrative tenant data).

### SEC-P0-02: Non-Persistent In-Memory Storage Disguised as Database
* **Severity**: Critical (P0)
* **File**: `/src/infrastructure/database/DatabaseProvider.ts:58-65`
* **Problem**: The repository layer runs entirely on Node.js in-memory `Map` instances. No actual PostgreSQL, SQLite, or Supabase driver is connected.
* **Security & Integrity Impact**: Any application container restart, server crash, or scaling deployment silently wipes all customer updates, opt-out preferences, and audit history, reverting to static demo seeds. Opt-out choices will be lost upon restart, violating compliance and data protection laws.
* **Recommended Fix**: Implement a genuine PostgreSQL database adapter with Drizzle or Knex migrations, connection pooling, and disk persistence.
* **Proved by**: `tests/audit-verification.ts:98` (Test 4: verified in-memory heap mapping).

---

## P1 — Must Fix Before Production

### SEC-P1-01: Illegal Campaign State Transitions Allowed via API
* **Severity**: High (P1)
* **File**: `/server.ts:427-440`
* **Problem**: The endpoint `POST /api/v1/campaigns/:id/status` accepts `newStatus` directly from the request body. It only checks whether a non-manager is attempting to approve, but fails to enforce the formal state machine transition rules.
* **Security & Integrity Impact**: An operator can take a `DRAFT` campaign and transition it straight to `COMPLETED` or `ACTIVE` without required manager review, audience verification, or snapshot validation.
* **Recommended Fix**: Enforce an explicit state transition transition table:
  ```ts
  const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
    DRAFT: ['REVIEW'],
    REVIEW: ['DRAFT', 'APPROVED'],
    APPROVED: ['ACTIVE'],
    ACTIVE: ['PAUSED', 'COMPLETED'],
    PAUSED: ['ACTIVE', 'COMPLETED'],
    COMPLETED: []
  };
  if (!VALID_TRANSITIONS[campaign.status].includes(newStatus)) {
    return res.status(400).json({ error: { message: `Illegal transition from ${campaign.status} to ${newStatus}` } });
  }
  ```
* **Proved by**: `tests/security-audit-deep.ts:25` (Probe 1: `DRAFT` campaign jumped directly to `COMPLETED`).

### SEC-P1-02: RBAC Gate Bypass on Recipient State Mutations
* **Severity**: High (P1)
* **File**: `/server.ts:487`, `/server.ts:511`
* **Problem**: While `POST /contacts` and `POST /tenant/kill-switch` properly block the `VIEWER` role, `POST /campaigns/:id/recipients/:recipientId/mark-sent` and `/skip` lack a role check.
* **Security Impact**: A read-only user (`VIEWER`) can issue API calls to mutate recipient states to `USER_SENT` or `SKIPPED`, falsifying outreach completion metrics.
* **Recommended Fix**: Add server-side RBAC authorization middleware across all mutation routes:
  ```ts
  if (user.role === 'VIEWER') {
    return res.status(403).json({ error: { message: 'Read-only role cannot mutate recipient state' } });
  }
  ```
* **Proved by**: `tests/security-audit-deep.ts:51` (Probe 2: Viewer successfully called `/mark-sent`).

### SEC-P1-03: Lack of IDOR / Tenant Validation on Resource Lookups
* **Severity**: High (P1)
* **File**: `/server.ts:98`, `/server.ts:167`
* **Problem**: Endpoints query entities by ID alone (e.g. `findById(req.params.id)`) without asserting that `entity.tenantId === authenticatedUser.tenantId`.
* **Security Impact**: In a multi-tenant environment, an authenticated user from Tenant A can view, edit, or delete contacts belonging to Tenant B simply by guessing or knowing their UUID.
* **Recommended Fix**: Enforce tenant ownership scoping in every repository query:
  ```ts
  const contact = await db.contactsRepo.findById(tenantId, req.params.id);
  ```

---

## P2 — Should Fix Before Scale

### SEC-P2-01: Spreadsheet Formula Injection (CSV / Excel DDE)
* **Severity**: Medium (P2)
* **File**: `/server.ts:275`, `/server.ts:327`
* **Problem**: Raw spreadsheet imports accept values beginning with `=, +, -, @` without neutralization. When an operator later exports contacts to CSV and opens them in Microsoft Excel or Google Sheets, arbitrary DDE commands or hyperlinked exploits could execute.
* **Security Impact**: Potential client-side command execution or external URL beaconing upon opening exported contacts in Excel.
* **Recommended Fix**: Sanitize import values before storage: if a string begins with `=, +, -, @`, prepend a single quote `'` or tab character.
* **Proved by**: `tests/security-audit-deep.ts:65` (Probe 3: `=cmd` stored intact).

### SEC-P2-02: Audit Log Missing Cryptographic Hash Chaining
* **Severity**: Medium (P2)
* **File**: `/src/infrastructure/database/DatabaseProvider.ts:384`
* **Problem**: The audit repository is described as "tamper-evident", but it is simply an unhashed in-memory array. There is no cryptographic link between log entry $N$ and $N-1$.
* **Security Impact**: An administrator with database access could alter historical audit timestamps or actions without detection.
* **Recommended Fix**: Implement SHA-256 hash chaining:
  $$\text{hash}_n = \text{SHA256}(\text{hash}_{n-1} + \text{timestamp} + \text{actorId} + \text{action} + \text{metadata})$$
* **Proved by**: `tests/audit-verification.ts:107` (Test 5: hash chaining absent).

### SEC-P2-03: Static AI Cost Estimation
* **Severity**: Low (P2)
* **File**: `/src/services/aiCopilotService.ts:79`
* **Problem**: The API returns a hardcoded `estimatedCostRupees: 0.15` rather than computing actual prompt token consumption from the Gemini response metadata.
* **Security Impact**: Inaccurate operational cost monitoring for tenant usage.
* **Recommended Fix**: Extract `response.usageMetadata.promptTokenCount` and `candidatesTokenCount` from the `@google/genai` response and calculate exact cost based on Gemini pricing tiers.

---

## P3 — Quality & Architectural Improvements

### SEC-P3-01: Race Conditions in Concurrent Operator Claims
* **Severity**: Low (P3)
* **File**: `/server.ts:468`
* **Problem**: Recipient claiming sets `claimedByOperator = user.name` without an atomic compare-and-swap or database-level lock.
* **Impact**: Two operators rapidly clicking next in the same campaign could collide on the same recipient.
* **Recommended Fix**: Use atomic SQL update: `UPDATE campaign_recipients SET claimed_by = $1, claimed_at = NOW() WHERE id = $2 AND (claimed_by IS NULL OR claimed_at < NOW() - INTERVAL '5 minutes')`.
