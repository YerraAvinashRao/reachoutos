import { Contact, ChannelType, Tenant, Role, PolicyCheckResult } from '../../types';
import { DataQualityEngine } from '../validation/dataQuality';

export interface PolicyContext {
  tenant: Tenant;
  contact: Contact;
  channel: ChannelType;
  actorRole: Role;
  rawTemplateText: string;
  isMarketingCampaign: boolean;
}

export class CommunicationPolicyEngine {
  /**
   * Evaluates if a message can be prepared and sent to a recipient.
   * Returns a structured report with all passing and failing criteria.
   */
  static evaluate(context: PolicyContext): PolicyCheckResult {
    const { tenant, contact, channel, actorRole, rawTemplateText, isMarketingCampaign } = context;
    const reasons: PolicyCheckResult['reasons'] = [];

    // 1. Workspace Emergency Kill Switch
    if (tenant.isKillSwitchActive) {
      reasons.push({
        passed: false,
        code: 'KILL_SWITCH_ACTIVE',
        message: `Workspace Emergency Kill Switch is ACTIVE: ${tenant.killSwitchReason || 'All outreach paused'}`
      });
    } else {
      reasons.push({
        passed: true,
        code: 'KILL_SWITCH_OK',
        message: 'Workspace outreach is active'
      });
    }

    // 2. Global Contact Block ("Never contact this person again")
    if (contact.isGloballyBlocked) {
      reasons.push({
        passed: false,
        code: 'GLOBAL_BLOCK',
        message: `Contact is globally blocked: ${contact.blockedReason || 'Marked as Do Not Contact'}`
      });
    } else {
      reasons.push({
        passed: true,
        code: 'GLOBAL_BLOCK_OK',
        message: 'Contact is not globally suppressed'
      });
    }

    // 3. Contact Status
    if (contact.status === 'BLOCKED' || contact.status === 'ARCHIVED') {
      reasons.push({
        passed: false,
        code: 'STATUS_INVALID',
        message: `Contact status is '${contact.status}'`
      });
    } else {
      reasons.push({
        passed: true,
        code: 'STATUS_OK',
        message: 'Contact status is active'
      });
    }

    // 4. Operator RBAC Permission
    if (actorRole === 'VIEWER') {
      reasons.push({
        passed: false,
        code: 'INSUFFICIENT_ROLE',
        message: 'Viewers have read-only access and cannot dispatch outreach'
      });
    } else {
      reasons.push({
        passed: true,
        code: 'ROLE_AUTHORIZED',
        message: `Operator role '${actorRole}' is authorized to dispatch`
      });
    }

    // 5. Channel Address Availability & Quality
    if (channel === 'WHATSAPP') {
      const phoneNorm = DataQualityEngine.normalizePhone(contact.phone);
      if (!phoneNorm.isValid) {
        reasons.push({
          passed: false,
          code: 'INVALID_WHATSAPP_PHONE',
          message: phoneNorm.error || 'Contact has an invalid WhatsApp phone number'
        });
      } else if (phoneNorm.isLandline) {
        reasons.push({
          passed: false,
          code: 'LANDLINE_DETECTED',
          message: 'Contact phone appears to be a landline'
        });
      } else {
        reasons.push({
          passed: true,
          code: 'WHATSAPP_PHONE_OK',
          message: `Valid canonical mobile number (${phoneNorm.canonical})`
        });
      }
    } else if (channel === 'EMAIL') {
      const emailNorm = DataQualityEngine.normalizeEmail(contact.email);
      if (!emailNorm.isValid) {
        reasons.push({
          passed: false,
          code: 'INVALID_EMAIL',
          message: emailNorm.error || 'Contact has an invalid email address'
        });
      } else {
        reasons.push({
          passed: true,
          code: 'EMAIL_OK',
          message: `Valid email address (${emailNorm.canonical})`
        });
      }
    }

    // 6. Channel Communication Preference & Suppression
    const channelPref = contact.preferences[channel];
    if (isMarketingCampaign && channelPref && !channelPref.marketingAllowed) {
      reasons.push({
        passed: false,
        code: 'MARKETING_OPTED_OUT',
        message: `Contact has opted out of marketing communications via ${channel}`
      });
    } else {
      reasons.push({
        passed: true,
        code: 'CONSENT_OK',
        message: `Communication consent is granted for ${channel}`
      });
    }

    // 7. Variable Resolution Check
    const contactData: Record<string, string> = {
      first_name: contact.firstName,
      last_name: contact.lastName,
      name: contact.displayName || `${contact.firstName} ${contact.lastName}`.trim(),
      company_name: contact.companyName,
      company: contact.companyName,
      city: contact.city,
      state: contact.state,
      phone: contact.phone,
      email: contact.email,
      ...contact.customFields
    };

    const { missingVariables } = DataQualityEngine.resolveTemplateVariables(rawTemplateText, contactData);
    if (missingVariables.length > 0) {
      reasons.push({
        passed: false,
        code: 'UNRESOLVED_VARIABLES',
        message: `Missing required template variables: ${missingVariables.map(v => `{{${v}}}`).join(', ')}`
      });
    } else {
      reasons.push({
        passed: true,
        code: 'VARIABLES_RESOLVED',
        message: 'All template variables resolved successfully'
      });
    }

    const failedReasons = reasons.filter(r => !r.passed);
    const canSend = failedReasons.length === 0;

    return {
      canSend,
      reasons,
      primaryBlockReason: failedReasons[0]?.message
    };
  }
}
