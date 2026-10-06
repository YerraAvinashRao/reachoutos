# ReachOut OS — Security Architecture & Invariants

## 1. Security Architecture Overview

ReachOut OS utilizes a defense-in-depth model where security boundaries are enforced simultaneously across three independent tiers:

1. **Client Tier (React/Vite)**: Clean user authentication flows via Supabase Auth client SDK. No secrets or client-minted tokens.
2. **Application Tier (Node.js/Express)**: Bearer JWT validation via Supabase Auth server verification. Parameter validation, canonical phone normalization, and fail-closed error handling.
3. **Database Tier (PostgreSQL / Supabase)**: Row-Level Security (RLS) policies, composite foreign key tenant boundaries, anti-escalation RBAC triggers, and tamper-evident cryptographic audit logs.

---

## 2. Invariants & Guarantees

### A. Anti-Privilege Escalation
- `ADMIN` cannot assign the `OWNER` role during member creation or updates.
- `ADMIN` cannot modify or delete an `OWNER` member.
- Every tenant must always maintain $\ge 1$ active `OWNER`.
- Role assignment outside the defined enum (`OWNER`, `ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`) is rejected by check constraints.

### B. Audit Trail Authenticity & Tamper Evidence
- `actor_id` is derived from `auth.uid()`; authenticated sessions cannot forge other user identities.
- `actor_name` and `actor_role` are authoritatively retrieved by PostgreSQL triggers from `users` and `tenant_members`.
- `previous_hash` is queried from the prior ledger entry for the tenant; clients cannot pass forged chain roots.
- `entry_hash` is computed deterministically in PostgreSQL via SHA-256 (`pgcrypto`'s `digest` function).
- `audit_logs` has zero `UPDATE` and `DELETE` privileges granted, with explicit `USING (FALSE)` RLS rules.
- `audit_logs` foreign key to `tenants` uses `ON DELETE RESTRICT` to prevent accidental deletion during tenant lifecycle changes.

### C. Function Hardening
- All `SECURITY DEFINER` functions specify `SET search_path = ''` to prevent search path hijacking.
- All internal tables and functions are fully schema-qualified (`public.tenants`, `auth.uid()`, etc.).
- Default `PUBLIC` and `anon` EXECUTE privileges are revoked from internal helpers (`is_tenant_member`, `get_tenant_role`, `validate_tenant_member_mutation`).
