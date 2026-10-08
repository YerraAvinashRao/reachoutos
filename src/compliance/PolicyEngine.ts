/**
 * ReachOut OS - Master Compliance Policy Engine
 * Connects all messaging channels to authoritative policy registries.
 * Guarantees that AI and human outreach actions conform to official platform terms.
 */

import { ComplianceDecision, PolicyEvaluationContext } from './ComplianceDecision';
import { WhatsAppPolicyEngine } from './whatsapp/WhatsAppPolicyEngine';
import { PolicyRegistry } from './PolicyRegistry';
import { ACTIVE_META_POLICY_VERSION, PolicyMetadata } from './PolicyVersion';

export class PolicyEngine {
  /**
   * Evaluates a single message dispatch proposal against authoritative policies.
   */
  public static evaluate(context: PolicyEvaluationContext): ComplianceDecision {
    if (context.channel === 'WHATSAPP') {
      return WhatsAppPolicyEngine.evaluate(context);
    }

    // Default compliance fallback for Email & SMS channels
    // Enforces opt-out and sensitive data protection universally
    const evaluations = WhatsAppPolicyEngine.evaluate({
      ...context,
      channel: 'WHATSAPP' // Apply universal baseline safety
    });

    return evaluations;
  }

  /**
   * Retrieves active policy metadata and review schedules
   */
  public static getActivePolicyMetadata(): PolicyMetadata {
    return PolicyRegistry.getMetadata();
  }

  /**
   * Retrieves all active rules
   */
  public static getAllRules() {
    return PolicyRegistry.getAllRules();
  }
}
