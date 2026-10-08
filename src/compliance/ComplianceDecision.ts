/**
 * ReachOut OS - Compliance Decision Types
 * Authoritative types for Meta WhatsApp Business Policy Engine
 */

export type ComplianceDecisionType = 'ALLOW' | 'HUMAN_REVIEW' | 'BLOCK';

export type ComplianceRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type PolicySeverity = 'BLOCKING' | 'REVIEW' | 'WARNING';

export interface ComplianceViolation {
  ruleId: string;
  category: string;
  severity: PolicySeverity;
  reason: string;
  sourceUrl?: string;
  canHumanOverride: boolean;
}

export interface RuleEvaluation {
  ruleId: string;
  category: string;
  passed: boolean;
  severity: PolicySeverity;
  reason: string;
}

export interface ComplianceDecision {
  decision: ComplianceDecisionType;
  confidence: number;
  riskLevel: ComplianceRiskLevel;
  violations: ComplianceViolation[];
  evaluatedRules: RuleEvaluation[];
  requiredActions: string[];
  canHumanOverride: boolean;
  policyVersion: string;
  evaluatedAt: string;
  metadata?: Record<string, any>;
}

export interface PolicyEvaluationContext {
  tenantId: string;
  contactId?: string;
  contactPhone: string;
  contactName?: string;
  channel: 'WHATSAPP' | 'EMAIL' | 'SMS';
  isMarketing: boolean;
  messageBody: string;
  
  // Template parameters
  templateId?: string;
  templateName?: string;
  templateCategory?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | 'SERVICE' | string;
  templateStatus?: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED' | string;
  
  // Customer Service Window
  lastInboundMessageAt?: string | null;
  customerServiceWindowExpiresAt?: string | null;
  
  // Consent & Preferences
  consentStatus?: 'GRANTED' | 'REVOKED' | 'UNKNOWN' | 'EXPIRED';
  consentCategory?: 'marketing' | 'utility' | 'authentication' | 'service';
  consentSource?: string;
  consentTimestamp?: string;
  isGloballyBlocked?: boolean;
  
  // Actor context
  actorRole?: string;
  actorId?: string;
  
  // Commerce & Products
  productCategory?: string;
  variables?: Record<string, any>;
}
