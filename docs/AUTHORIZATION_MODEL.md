# ReachOut OS — Authorization & RBAC Model

## 1. Role Hierarchy & Matrix

ReachOut OS enforces 5 discrete roles within each tenant:

| Role | Description | Tenant Settings | Member Management | Campaigns & Templates | Contacts & Lists | Dispatch |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **`OWNER`** | Primary account holder | Full | Full (Can manage OWNERs) | Full | Full | Full |
| **`ADMIN`** | Organization administrator | Read/Update | Manage MANAGER, OPERATOR, VIEWER | Full | Full | Full |
| **`MANAGER`** | Operations manager | Read | Read only | Create/Edit/Approve | Full | Full |
| **`OPERATOR`** | Dispatch worker | Read | Read only | Execute approved dispatch | Read | Claim & Send |
| **`VIEWER`** | Read-only auditor | Read | Read only | Read only | Read only | Denied |

---

## 2. RBAC Enforcement Points

1. **Database Triggers (`validate_tenant_member_mutation`)**:
   - Blocks non-`OWNER` users from creating or promoting anyone to `OWNER`.
   - Prevents demoting or deleting the final `OWNER` of a tenant.
   - Blocks non-admin/owner roles from modifying memberships.

2. **Row-Level Security Policies**:
   - `contacts_insert` / `contacts_update`: Requires role $\neq$ `VIEWER`.
   - `contacts_delete`: Restricted to `OWNER`, `ADMIN`, `MANAGER`.
   - `campaigns_delete`: Restricted to `OWNER`, `ADMIN`.
   - `audit_logs`: Append-only for all members; immutable forever.

3. **Application API Middleware (`requireRole`)**:
   - First-line defense in Express routes to prevent unnecessary database queries when a caller lacks required permissions.
