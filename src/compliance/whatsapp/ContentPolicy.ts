/**
 * ReachOut OS - Content Policy Module
 * Enforces Meta rules: WA-CONTENT-001, WA-CONTENT-002
 */

import { PolicyEvaluationContext, RuleEvaluation } from '../ComplianceDecision';

export class ContentPolicy {
  private static readonly FRAUD_PATTERNS = [
    /(?:you(?:'ve| have) won|lottery winner|claim your prize|free money|wire transfer required)/i,
    /(?:urgent[:\s]+account (?:suspended|compromised)|verify your password immediately|enter your secret pin)/i,
    /(?:double your investment|guaranteed daily returns|send bitcoin to receive double)/i
  ];

  private static readonly REGULATED_HEALTH_PATTERNS = [
    /(?:clinical trial|prescription consultation|dietary supplement therapy|telehealth medical advice|homeopathic remedy|herbal wellness treatment|weight loss supplement)/i
  ];

  public static evaluate(context: PolicyEvaluationContext): RuleEvaluation[] {
    const evaluations: RuleEvaluation[] = [];
    const text = context.messageBody || '';

    // 1. SPAM, DECEPTION & FRAUD (WA-CONTENT-001)
    const isFraudulent = ContentPolicy.FRAUD_PATTERNS.some(p => p.test(text));

    if (isFraudulent) {
      evaluations.push({
        ruleId: 'WA-CONTENT-001',
        category: 'content',
        passed: false,
        severity: 'BLOCKING',
        reason: 'Message contains indicators of fraudulent offers, phishing deception, or lottery spam. Meta prohibits deceptive practices.'
      });
    } else {
      evaluations.push({
        ruleId: 'WA-CONTENT-001',
        category: 'content',
        passed: true,
        severity: 'BLOCKING',
        reason: 'Message is free from fraudulent, deceptive, or malicious spam patterns.'
      });
    }

    // 2. MEDICAL & HEALTH CLAIMS (WA-CONTENT-002)
    const hasRegulatedHealthClaim = ContentPolicy.REGULATED_HEALTH_PATTERNS.some(p => p.test(text));

    if (hasRegulatedHealthClaim) {
      evaluations.push({
        ruleId: 'WA-CONTENT-002',
        category: 'content',
        passed: false,
        severity: 'REVIEW',
        reason: 'Message contains regulated medical claims or prescription drug keywords. Meta requires human compliance verification.'
      });
    } else {
      evaluations.push({
        ruleId: 'WA-CONTENT-002',
        category: 'content',
        passed: true,
        severity: 'REVIEW',
        reason: 'Content complies with healthcare and pharmaceutical communication guidelines.'
      });
    }

    return evaluations;
  }
}
