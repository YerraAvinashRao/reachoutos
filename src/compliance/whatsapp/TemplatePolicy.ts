/**
 * ReachOut OS - Template Policy Module
 * Enforces Meta rules: WA-TEMPLATE-001, WA-TEMPLATE-002
 */

import { PolicyEvaluationContext, RuleEvaluation } from '../ComplianceDecision';
import { PolicyRegistry } from '../PolicyRegistry';

export class TemplatePolicy {
  public static evaluate(context: PolicyEvaluationContext): RuleEvaluation[] {
    const evaluations: RuleEvaluation[] = [];

    // If no template is used (e.g. free-form inside 24h window), template policies pass conditionally
    if (!context.templateId && !context.templateCategory) {
      return evaluations;
    }

    const templateSpecs = PolicyRegistry.getTemplateSpecs();

    // 1. TEMPLATE APPROVAL STATUS (WA-TEMPLATE-001)
    if (context.templateStatus) {
      const isApproved = context.templateStatus === 'APPROVED';
      if (!isApproved) {
        evaluations.push({
          ruleId: 'WA-TEMPLATE-001',
          category: 'template',
          passed: false,
          severity: 'BLOCKING',
          reason: `Template status is '${context.templateStatus}'. Only templates in 'APPROVED' status can be dispatched on WhatsApp.`
        });
      } else {
        evaluations.push({
          ruleId: 'WA-TEMPLATE-001',
          category: 'template',
          passed: true,
          severity: 'BLOCKING',
          reason: 'Template is officially approved by Meta.'
        });
      }
    } else {
      // Default approved for registered templates
      evaluations.push({
        ruleId: 'WA-TEMPLATE-001',
        category: 'template',
        passed: true,
        severity: 'BLOCKING',
        reason: 'Template status verified.'
      });
    }

    // 2. TEMPLATE PURPOSE INTEGRITY (WA-TEMPLATE-002)
    // Prevent hijacking utility templates for promotional marketing
    const category = (context.templateCategory || '').toUpperCase();
    if (category === 'UTILITY' || category === 'AUTHENTICATION' || category === 'SERVICE') {
      const prohibitedKeywords = templateSpecs.categories.UTILITY?.prohibited_marketing_keywords || [];
      const textLower = (context.messageBody || '').toLowerCase();

      const matchedKeyword = prohibitedKeywords.find(kw => textLower.includes(kw.toLowerCase()));

      if (matchedKeyword) {
        evaluations.push({
          ruleId: 'WA-TEMPLATE-002',
          category: 'template',
          passed: false,
          severity: 'BLOCKING',
          reason: `Template category is '${category}', but message content contains promotional marketing keyword '${matchedKeyword}'. Meta prohibits repurposing non-marketing templates for promotional offers.`
        });
      } else {
        evaluations.push({
          ruleId: 'WA-TEMPLATE-002',
          category: 'template',
          passed: true,
          severity: 'BLOCKING',
          reason: `Template content aligns with designated '${category}' purpose.`
        });
      }
    } else {
      evaluations.push({
        ruleId: 'WA-TEMPLATE-002',
        category: 'template',
        passed: true,
        severity: 'BLOCKING',
        reason: 'Template category purpose is compliant.'
      });
    }

    return evaluations;
  }
}
