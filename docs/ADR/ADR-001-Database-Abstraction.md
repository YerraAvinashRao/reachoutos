# ADR-001: Database Abstraction & Multi-Provider Portability

## Context
Commercial outreach platforms cannot remain permanently bound to a single vendor database (e.g. raw Supabase SDK or AWS-specific client). React components must never perform direct database calls.

## Decision
We enforce Hexagonal Architecture (Ports & Adapters):
1. Domain and application code depend only on repository interfaces: `ContactRepository`, `CampaignRepository`, `TemplateRepository`, `AuditRepository`, `TenantRepository`.
2. Infrastructure adapters implement these interfaces (`InMemoryDatabaseProvider`, with pluggable `SupabasePostgresAdapter` and `AwsPostgresAdapter`).
3. Active driver is controlled through runtime configuration (`DATABASE_PROVIDER`).

## Status
Accepted.
