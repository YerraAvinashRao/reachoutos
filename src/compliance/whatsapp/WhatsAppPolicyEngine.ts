/**
 * ReachOut OS - WhatsApp Policy Engine Orchestrator
 * Evaluates the full suite of authoritative Meta WhatsApp Business Policies
 */

import { ComplianceDecision, PolicyEvaluationContext, RuleEvaluation } from '../ComplianceDecision';
import { ConsentPolicy } from './ConsentPolicy';
import { WindowPolicy } from './WindowPolicy';
import { TemplatePolicy } from './TemplatePolicy';
import { ContentPolicy } from './ContentPolicy';
import { CommercePolicy } from './CommercePolicy';
import { DataPolicy } from './DataPolicy';
import { EnforcementPolicy } from './EnforcementPolicy';

export class WhatsAppPolicyEngine {
  /**
   * Evaluates a proposed message dispatch against the full Meta policy registry.
   * "The AI proposes; the Policy Engine decides."
   */
  public static evaluate(context: PolicyEvaluationContext): ComplianceDecision {
    const allEvaluations: RuleEvaluation[] = [];

    // 1. Consent & Opt-Out Policies (WA-CONSENT-001, WA-CONSENT-002, WA-OPTOUT-001)
    allEvaluations.push(...ConsentPolicy.evaluate(context));

    // 2. 24-Hour Customer Service Window (WA-WINDOW-001)
    allEvaluations.push(...WindowPolicy.evaluate(context));

    // 3. Template Policies & Purpose Integrity (WA-TEMPLATE-001, WA-TEMPLATE-002)
    allEvaluations.push(...TemplatePolicy.evaluate(context));

    // 4. Content Policies: Spam, Deception & Medical Claims (WA-CONTENT-001, WA-CONTENT-002)
    allEvaluations.push(...ContentPolicy.evaluate(context));

    // 5. Commerce & Prohibited Goods Policies (WA-PROHIBITED-001, WA-COMMERCE-001)
    allEvaluations.push(...CommercePolicy.evaluate(context));

    // 6. Data Protection & Sensitive Identifiers (WA-DATA-001, WA-DATA-002)
    allEvaluations.push(...DataPolicy.evaluate(context));

    // 7. Aggregate and enforce decision tiers (ALLOW, HUMAN_REVIEW, BLOCK)
    return EnforcementPolicy.aggregate(context, allEvaluations);
  }
}
