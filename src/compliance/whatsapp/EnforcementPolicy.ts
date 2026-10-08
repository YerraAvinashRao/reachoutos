/**
 * ReachOut OS - Enforcement & Decision Tiering Module
 * Enforces Meta rule: WA-ENFORCEMENT-001
 * Implements "The AI proposes; the Policy Engine decides" and "Fail Closed" principles.
 */

import { 
  ComplianceDecision, 
  ComplianceViolation, 
  PolicyEvaluationContext, 
  RuleEvaluation 
} from '../ComplianceDecision';
import { ACTIVE_META_POLICY_VERSION } from '../PolicyVersion';

export class EnforcementPolicy {
  public static aggregate(
    context: PolicyEvaluationContext,
    evaluations: RuleEvaluation[]
  ): ComplianceDecision {
    const blockingViolations: ComplianceViolation[] = [];
    const reviewViolations: ComplianceViolation[] = [];
    const requiredActions: string[] = [];

    for (const ev of evaluations) {
      if (!ev.passed) {
        const violation: ComplianceViolation = {
          ruleId: ev.ruleId,
          category: ev.category,
          severity: ev.severity,
          reason: ev.reason,
          sourceUrl: 'https://business.whatsapp.com/policy',
          // Blocking violations cannot be overridden by AI or operators
          canHumanOverride: ev.severity === 'REVIEW'
        };

        if (ev.severity === 'BLOCKING') {
          blockingViolations.push(violation);
          // Suggest actionable remediation
          if (ev.ruleId === 'WA-CONSENT-001') {
            requiredActions.push('Obtain valid WhatsApp opt-in from recipient before sending');
          } else if (ev.ruleId === 'WA-OPTOUT-001') {
            requiredActions.push('Permanently suppress contact and exclude from all future outreach');
          } else if (ev.ruleId === 'WA-WINDOW-001') {
            requiredActions.push('Designate a Meta-approved message template for outbound messaging outside 24h window');
          } else if (ev.ruleId === 'WA-TEMPLATE-002') {
            requiredActions.push('Remove promotional keywords from utility template or switch to MARKETING template');
          } else if (ev.ruleId === 'WA-PROHIBITED-001') {
            requiredActions.push('Remove references to prohibited goods (tobacco, alcohol, weapons, prescription drugs, gambling)');
          } else if (ev.ruleId === 'WA-DATA-001') {
            requiredActions.push('Remove payment card numbers, CVVs, and financial account credentials from message');
          } else if (ev.ruleId === 'WA-DATA-002') {
            requiredActions.push('Remove national identification numbers (SSN/Aadhaar) from message');
          } else {
            requiredActions.push(`Resolve ${ev.ruleId} policy violation: ${ev.reason}`);
          }
        } else if (ev.severity === 'REVIEW') {
          reviewViolations.push(violation);
          requiredActions.push(`Perform operator compliance review on ${ev.ruleId}: ${ev.reason}`);
        }
      }
    }

    // Determine final Decision Tier
    let decision: ComplianceDecision['decision'] = 'ALLOW';
    let riskLevel: ComplianceDecision['riskLevel'] = 'LOW';
    let canHumanOverride = true;

    if (blockingViolations.length > 0) {
      decision = 'BLOCK';
      riskLevel = 'HIGH';
      canHumanOverride = false; // Hard rule: BLOCK cannot be overridden by AI or operator
    } else if (reviewViolations.length > 0) {
      decision = 'HUMAN_REVIEW';
      riskLevel = 'MEDIUM';
      canHumanOverride = true; // Review requires human compliance operator sign-off
    }

    const allViolations = [...blockingViolations, ...reviewViolations];

    return {
      decision,
      confidence: 0.99,
      riskLevel,
      violations: allViolations,
      evaluatedRules: evaluations,
      requiredActions,
      canHumanOverride,
      policyVersion: ACTIVE_META_POLICY_VERSION.version,
      evaluatedAt: new Date().toISOString(),
      metadata: {
        channel: context.channel,
        contactPhone: context.contactPhone,
        totalRulesEvaluated: evaluations.length,
        blockingCount: blockingViolations.length,
        reviewCount: reviewViolations.length
      }
    };
  }
}
