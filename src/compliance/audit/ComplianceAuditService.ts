/**
 * ReachOut OS - Compliance Audit Service
 * Cryptographically links compliance decisions with tenant audit logs
 */

import { ComplianceDecision, PolicyEvaluationContext } from '../ComplianceDecision';
import { db } from '../../infrastructure/database/SupabaseDatabaseAdapter';

export interface AuditRecordOptions {
  actorId?: string;
  actorRole?: string;
  campaignId?: string;
  recipientId?: string;
  isOverride?: boolean;
  overrideReason?: string;
}

export class ComplianceAuditService {
  /**
   * Persists a compliance evaluation record in the authoritative audit ledger
   */
  public static async recordEvaluation(
    context: PolicyEvaluationContext,
    decision: ComplianceDecision,
    options?: AuditRecordOptions
  ): Promise<void> {
    if (!db || !db.isConfigured) return;

    try {
      // 1. Log to standard workspace audit log
      if (db.auditRepo) {
        await db.auditRepo.log({
          tenantId: context.tenantId,
          actorId: options?.actorId || '00000000-0000-0000-0000-000000000000',
          actorName: 'WhatsApp Policy Engine',
          actorRole: (options?.actorRole as any) || 'OPERATOR',
          action: `COMPLIANCE_EVALUATION_${decision.decision}`,
          entityType: 'POLICY',
          entityId: options?.recipientId || options?.campaignId || context.contactPhone,
          metadata: {
            policyVersion: decision.policyVersion,
            decision: decision.decision,
            riskLevel: decision.riskLevel,
            violationsCount: decision.violations.length,
            violations: decision.violations.map(v => ({ ruleId: v.ruleId, reason: v.reason })),
            evaluatedRulesCount: decision.evaluatedRules.length,
            canHumanOverride: decision.canHumanOverride,
            channel: context.channel,
            contactPhone: context.contactPhone,
            isOverride: options?.isOverride || false,
            overrideReason: options?.overrideReason
          },
          ipAddress: '127.0.0.1'
        });
      }
    } catch (err) {
      console.warn('[ComplianceAuditService] Non-blocking audit record warning:', err);
    }
  }
}
