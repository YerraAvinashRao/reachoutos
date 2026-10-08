/**
 * ReachOut OS - 24-Hour Customer Service Window Policy Module
 * Enforces Meta rule: WA-WINDOW-001
 */

import { PolicyEvaluationContext, RuleEvaluation } from '../ComplianceDecision';

export class WindowPolicy {
  private static readonly WINDOW_DURATION_MS = 24 * 60 * 60 * 1000; // 24 Hours in milliseconds

  public static evaluate(context: PolicyEvaluationContext): RuleEvaluation[] {
    const evaluations: RuleEvaluation[] = [];
    const now = Date.now();

    let isInsideWindow = false;

    // Check expiration timestamp directly if provided
    if (context.customerServiceWindowExpiresAt) {
      const expiresAt = new Date(context.customerServiceWindowExpiresAt).getTime();
      if (!isNaN(expiresAt) && expiresAt > now) {
        isInsideWindow = true;
      }
    } 
    // Or calculate from last inbound message timestamp
    else if (context.lastInboundMessageAt) {
      const lastInbound = new Date(context.lastInboundMessageAt).getTime();
      if (!isNaN(lastInbound) && (now - lastInbound) < WindowPolicy.WINDOW_DURATION_MS) {
        isInsideWindow = true;
      }
    }

    // Business-initiated message outside 24h window
    if (!isInsideWindow) {
      const hasApprovedTemplate = 
        Boolean(context.templateId) && 
        (context.templateStatus === 'APPROVED' || !context.templateStatus);

      if (!hasApprovedTemplate) {
        evaluations.push({
          ruleId: 'WA-WINDOW-001',
          category: 'window',
          passed: false,
          severity: 'BLOCKING',
          reason: 'Outside 24-hour customer service window: business-initiated messages require a Meta-approved message template.'
        });
      } else {
        evaluations.push({
          ruleId: 'WA-WINDOW-001',
          category: 'window',
          passed: true,
          severity: 'BLOCKING',
          reason: 'Outside 24-hour window: approved template is designated and valid.'
        });
      }
    } else {
      // Inside active 24-hour service window: freeform customer service replies are permitted
      evaluations.push({
        ruleId: 'WA-WINDOW-001',
        category: 'window',
        passed: true,
        severity: 'BLOCKING',
        reason: 'Within active 24-hour customer service window: free-form service reply permitted.'
      });
    }

    return evaluations;
  }
}
