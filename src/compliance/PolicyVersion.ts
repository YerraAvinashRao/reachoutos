/**
 * ReachOut OS - Policy Versioning System
 * Tracks authoritative Meta policy release versions and review dates
 */

export interface PolicyMetadata {
  policy_provider: string;
  policy_family: string;
  version: string;
  source_type: string;
  authority: string;
  official_sources: string[];
  last_verified_at: string;
  next_review: string;
  description: string;
  engine_principles: string[];
}

export const ACTIVE_META_POLICY_VERSION: PolicyMetadata = {
  policy_provider: "Meta / WhatsApp",
  policy_family: "WhatsApp Business",
  version: "2026-10",
  source_type: "official",
  authority: "Meta Platforms, Inc.",
  official_sources: [
    "https://business.whatsapp.com/policy",
    "https://www.whatsapp.com/legal/business-terms/",
    "https://developers.facebook.com/docs/whatsapp/messaging-limits",
    "https://www.facebook.com/policies_center/commerce"
  ],
  last_verified_at: "2026-10-08T00:00:00Z",
  next_review: "2026-11-08T00:00:00Z",
  description: "Meta WhatsApp Business Messaging Policy Registry v2026-10 for ReachOut OS.",
  engine_principles: [
    "The AI proposes; the Policy Engine decides.",
    "Fail closed: unverified compliance triggers BLOCK or HUMAN_REVIEW.",
    "Opt-out is an immutable hard system control.",
    "Every evaluation generates an immutable audit record."
  ]
};
