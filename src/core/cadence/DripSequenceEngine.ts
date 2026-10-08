/**
 * ReachOutOS Autonomous Multi-Channel Drip Sequence Engine
 * Evaluates branching decision gates (time delay, channel failover, reply/open checks)
 * to advance contacts through multi-step outreach cadences automatically.
 */

export interface DripStep {
  stepNumber: number;
  channel: 'WHATSAPP' | 'EMAIL';
  delayDays: number;
  conditionGate: 'ALWAYS_DISPATCH' | 'IF_NOT_REPLIED' | 'IF_OPENED' | 'IF_NOT_OPENED';
  templateName: string;
  templateSubject?: string;
  templateBody: string;
}

export interface DripEnrollment {
  id: string;
  sequenceId: string;
  contactId: string;
  contactName: string;
  currentStep: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'EXITED_REPLIED' | 'EXITED_OPTED_OUT';
  enrolledAt: string;
  lastExecutedAt?: string;
  nextScheduledAt?: string;
  history: Array<{
    stepNumber: number;
    channel: 'WHATSAPP' | 'EMAIL';
    executedAt: string;
    status: 'SENT' | 'SKIPPED_GATE_CONDITION' | 'FAILED';
    notes?: string;
  }>;
}

export class DripSequenceEngine {
  /**
   * Default high-converting enterprise 4-step omnichannel sequence
   */
  public static getDefaultSteps(): DripStep[] {
    return [
      {
        stepNumber: 1,
        channel: 'WHATSAPP',
        delayDays: 0,
        conditionGate: 'ALWAYS_DISPATCH',
        templateName: 'Step 1: WhatsApp Value Introduction',
        templateBody: 'Hello {{first_name}}, we noticed your store in {{city}} and would like to introduce our pure organic honey line. Would you like a sample kit?'
      },
      {
        stepNumber: 2,
        channel: 'EMAIL',
        delayDays: 2,
        conditionGate: 'IF_NOT_REPLIED',
        templateName: 'Step 2: Email Detailed Wholesale Catalog',
        templateSubject: 'Wholesale Pricing & Product Catalog for {{company_name}}',
        templateBody: 'Hi {{first_name}},\n\nFollowing up on our WhatsApp message. Here is our full catalog and volume discount slabs for your store in {{city}}.\n\nBest regards,\nReachOut Team'
      },
      {
        stepNumber: 3,
        channel: 'WHATSAPP',
        delayDays: 5,
        conditionGate: 'IF_NOT_REPLIED',
        templateName: 'Step 3: WhatsApp Special Margin Offer',
        templateBody: 'Hi {{first_name}}, quick check if you had a chance to view our pricing? We are currently offering an extra 5% margin for new stockists this month.'
      },
      {
        stepNumber: 4,
        channel: 'EMAIL',
        delayDays: 10,
        conditionGate: 'IF_NOT_REPLIED',
        templateName: 'Step 4: Final Courtesy Check-in',
        templateSubject: 'Closing our outreach loop for {{company_name}}',
        templateBody: 'Hi {{first_name}}, assuming you might be busy right now. I will pause our outreach, but please feel free to reach out whenever you need restock!'
      }
    ];
  }

  /**
   * Evaluates whether a contact should advance to the next step based on gate conditions
   */
  public static evaluateStepEligibility(
    step: DripStep,
    contactState: {
      hasReplied: boolean;
      hasOpenedEmail: boolean;
      isOptedOut: boolean;
      isGloballyBlocked: boolean;
    }
  ): { eligible: boolean; reason: string } {
    if (contactState.isOptedOut || contactState.isGloballyBlocked) {
      return { eligible: false, reason: 'Contact is opted out or suppressed globally.' };
    }

    if (step.conditionGate === 'IF_NOT_REPLIED' && contactState.hasReplied) {
      return { eligible: false, reason: 'Skipped because recipient has already replied (Cadence Goal Met).' };
    }

    if (step.conditionGate === 'IF_OPENED' && !contactState.hasOpenedEmail) {
      return { eligible: false, reason: 'Skipped because recipient has not opened previous email.' };
    }

    if (step.conditionGate === 'IF_NOT_OPENED' && contactState.hasOpenedEmail) {
      return { eligible: false, reason: 'Skipped because recipient already opened email.' };
    }

    return { eligible: true, reason: 'Gate condition passed.' };
  }
}
