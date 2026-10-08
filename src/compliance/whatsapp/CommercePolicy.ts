/**
 * ReachOut OS - Commerce & Prohibited Goods Policy Module
 * Enforces Meta rules: WA-PROHIBITED-001, WA-COMMERCE-001
 */

import { PolicyEvaluationContext, RuleEvaluation } from '../ComplianceDecision';
import { PolicyRegistry } from '../PolicyRegistry';

export class CommercePolicy {
  public static evaluate(context: PolicyEvaluationContext): RuleEvaluation[] {
    const evaluations: RuleEvaluation[] = [];
    const textLower = (context.messageBody || '').toLowerCase();
    const productCatLower = (context.productCategory || '').toLowerCase();

    const prohibitedCategories = PolicyRegistry.getProhibitedCategories();

    // Check both explicit product category and message content keywords
    let matchedProhibited: { category: string; matchedKeyword: string; explanation: string } | null = null;

    for (const cat of prohibitedCategories) {
      // Check if productCategory explicitly matches
      if (productCatLower && productCatLower.includes(cat.category)) {
        matchedProhibited = {
          category: cat.category,
          matchedKeyword: cat.category,
          explanation: cat.explanation
        };
        break;
      }

      // Check keywords inside the message body
      for (const kw of cat.keywords) {
        // Match word boundaries
        const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(textLower)) {
          matchedProhibited = {
            category: cat.category,
            matchedKeyword: kw,
            explanation: cat.explanation
          };
          break;
        }
      }

      if (matchedProhibited) break;
    }

    if (matchedProhibited) {
      evaluations.push({
        ruleId: 'WA-PROHIBITED-001',
        category: 'prohibited_goods',
        passed: false,
        severity: 'BLOCKING',
        reason: `Message promotes or references prohibited category '${matchedProhibited.category}' (matched keyword: '${matchedProhibited.matchedKeyword}'). ${matchedProhibited.explanation}`
      });
      evaluations.push({
        ruleId: 'WA-COMMERCE-001',
        category: 'commerce',
        passed: false,
        severity: 'BLOCKING',
        reason: 'Violation of Meta Commerce Policy: commerce in regulated or prohibited goods is strictly banned.'
      });
    } else {
      evaluations.push({
        ruleId: 'WA-PROHIBITED-001',
        category: 'prohibited_goods',
        passed: true,
        severity: 'BLOCKING',
        reason: 'Content complies with Meta prohibited goods and services restrictions.'
      });
      evaluations.push({
        ruleId: 'WA-COMMERCE-001',
        category: 'commerce',
        passed: true,
        severity: 'BLOCKING',
        reason: 'Commercial interactions comply with Meta Commerce guidelines.'
      });
    }

    return evaluations;
  }
}
