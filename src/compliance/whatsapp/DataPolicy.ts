/**
 * ReachOut OS - Data Protection & PII Policy Module
 * Enforces Meta rules: WA-DATA-001, WA-DATA-002
 */

import { PolicyEvaluationContext, RuleEvaluation } from '../ComplianceDecision';
import { PolicyRegistry } from '../PolicyRegistry';

export class DataPolicy {
  /**
   * Luhn Algorithm validator to eliminate false positives on credit card detection
   */
  private static passesLuhn(digitsOnly: string): boolean {
    if (digitsOnly.length < 13 || digitsOnly.length > 19) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = digitsOnly.length - 1; i >= 0; i--) {
      let digit = parseInt(digitsOnly.charAt(i), 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  public static evaluate(context: PolicyEvaluationContext): RuleEvaluation[] {
    const evaluations: RuleEvaluation[] = [];
    const text = context.messageBody || '';

    const dataRules = PolicyRegistry.getDataProtectionRules();
    const prohibitedDataTypes = dataRules.prohibited_sensitive_data || [];

    let hasCardViolation = false;
    let cardViolationReason = '';

    let hasNationalIdViolation = false;
    let nationalIdReason = '';

    for (const rule of prohibitedDataTypes) {
      const regex = new RegExp(rule.pattern, 'i');
      const match = text.match(regex);

      if (match) {
        if (rule.type === 'PAYMENT_CARD_NUMBER') {
          // Verify with Luhn to avoid false positives on arbitrary digit strings
          const digitsOnly = match[0].replace(/[\s-]/g, '');
          if (DataPolicy.passesLuhn(digitsOnly)) {
            hasCardViolation = true;
            cardViolationReason = `Message contains a valid payment card number (${rule.description}). Meta prohibits asking for or transmitting full card numbers.`;
          }
        } else if (rule.type === 'CARD_CVV_CVC' || rule.type === 'BANK_ACCOUNT_PASSWORD_PIN') {
          hasCardViolation = true;
          cardViolationReason = `Message requests or contains sensitive financial credentials: ${rule.description}.`;
        } else if (rule.type.startsWith('NATIONAL_ID')) {
          hasNationalIdViolation = true;
          nationalIdReason = `Message requests or contains a government-issued national identifier (${rule.description}).`;
        }
      }
    }

    // WA-DATA-001: Payment Cards & Financial Credentials
    if (hasCardViolation) {
      evaluations.push({
        ruleId: 'WA-DATA-001',
        category: 'data_protection',
        passed: false,
        severity: 'BLOCKING',
        reason: cardViolationReason
      });
    } else {
      evaluations.push({
        ruleId: 'WA-DATA-001',
        category: 'data_protection',
        passed: true,
        severity: 'BLOCKING',
        reason: 'No payment cards, CVVs, or financial credentials detected in message.'
      });
    }

    // WA-DATA-002: National Identifiers & PII
    if (hasNationalIdViolation) {
      evaluations.push({
        ruleId: 'WA-DATA-002',
        category: 'data_protection',
        passed: false,
        severity: 'BLOCKING',
        reason: nationalIdReason
      });
    } else {
      evaluations.push({
        ruleId: 'WA-DATA-002',
        category: 'data_protection',
        passed: true,
        severity: 'BLOCKING',
        reason: 'No prohibited government national identifiers detected.'
      });
    }

    return evaluations;
  }
}
