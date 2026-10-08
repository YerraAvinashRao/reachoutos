/**
 * ReachOut OS - Consent & Opt-Out Policy Module
 * Enforces Meta rules: WA-CONSENT-001, WA-CONSENT-002, WA-OPTOUT-001
 */

import { PolicyEvaluationContext, RuleEvaluation } from '../ComplianceDecision';
import { PolicyRegistry } from '../PolicyRegistry';

export class ConsentPolicy {
  public static evaluate(context: PolicyEvaluationContext): RuleEvaluation[] {
    const evaluations: RuleEvaluation[] = [];
    const consentRules = PolicyRegistry.getConsentRules();

    // 1. HARD OPT-OUT ENFORCEMENT (WA-OPTOUT-001)
    // Absolute hard system control: cannot be bypassed by AI or operator
    const isExplicitlyBlocked = Boolean(context.isGloballyBlocked);
    const hasRevokedConsent = context.consentStatus === 'REVOKED';
    
    // Check if the message contains opt-out keywords from the recipient
    const bodyUpper = (context.messageBody || '').trim().toUpperCase();
    const containsOptOutKeyword = consentRules.opt_out_hard_triggers.some(trigger => 
      bodyUpper === trigger || bodyUpper.startsWith(`${trigger} `) || bodyUpper.endsWith(` ${trigger}`)
    );

    if (isExplicitlyBlocked || hasRevokedConsent) {
      evaluations.push({
        ruleId: 'WA-OPTOUT-001',
        category: 'opt_out',
        passed: false,
        severity: 'BLOCKING',
        reason: 'Recipient has previously opted out or is globally suppressed. Meta requires immediate and permanent suppression.'
      });
    } else {
      evaluations.push({
        ruleId: 'WA-OPTOUT-001',
        category: 'opt_out',
        passed: true,
        severity: 'BLOCKING',
        reason: 'Recipient is not opted out and has not triggered suppression.'
      });
    }

    // 2. VALID WHATSAPP OPT-IN (WA-CONSENT-001)
    // If recipient consent status is explicitly unknown or expired for marketing outreach
    if (context.isMarketing) {
      if (context.consentStatus === 'GRANTED') {
        evaluations.push({
          ruleId: 'WA-CONSENT-001',
          category: 'consent',
          passed: true,
          severity: 'BLOCKING',
          reason: 'Valid WhatsApp opt-in record verified for recipient.'
        });
      } else if (context.consentStatus === 'UNKNOWN' || !context.consentStatus) {
        // In ReachOut OS, manual dispatch to imported lists with opt-in assumption requires verification
        evaluations.push({
          ruleId: 'WA-CONSENT-001',
          category: 'consent',
          passed: false,
          severity: 'BLOCKING',
          reason: 'Recipient does not have a recorded WhatsApp opt-in on file. Meta mandates prior opt-in for business messaging.'
        });
      } else {
        evaluations.push({
          ruleId: 'WA-CONSENT-001',
          category: 'consent',
          passed: false,
          severity: 'BLOCKING',
          reason: `Recipient consent state is '${context.consentStatus}'. Valid opt-in is required.`
        });
      }
    } else {
      // Transactional / Utility message inside active service window
      evaluations.push({
        ruleId: 'WA-CONSENT-001',
        category: 'consent',
        passed: true,
        severity: 'BLOCKING',
        reason: 'Service or transactional response does not require promotional opt-in.'
      });
    }

    // 3. CATEGORY-SPECIFIC CONSENT MATCH (WA-CONSENT-002)
    if (context.isMarketing && context.consentCategory && context.consentCategory !== 'marketing') {
      evaluations.push({
        ruleId: 'WA-CONSENT-002',
        category: 'consent',
        passed: false,
        severity: 'BLOCKING',
        reason: `Consent category '${context.consentCategory}' does not permit promotional marketing broadcasts. Meta requires explicit marketing opt-in.`
      });
    } else {
      evaluations.push({
        ruleId: 'WA-CONSENT-002',
        category: 'consent',
        passed: true,
        severity: 'BLOCKING',
        reason: 'Consent category aligns with message intent.'
      });
    }

    return evaluations;
  }
}
