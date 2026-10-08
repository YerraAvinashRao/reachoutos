import { Contact } from '../../types';

export interface EmailFallbackPayload {
  contactId: string;
  contactName: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  mailtoUrl: string;
  canSendEmail: boolean;
  blockReason?: string;
}

export class MultiChannelFallbackService {
  /**
   * Generates a seamless Email fallback from a WhatsApp outreach attempt.
   */
  public static generateEmailFallback(params: {
    contact: Contact;
    whatsappMessageBody: string;
    campaignName?: string;
    operatorName?: string;
    companySignature?: string;
  }): EmailFallbackPayload {
    const { contact, whatsappMessageBody, campaignName, operatorName = 'Account Executive', companySignature = 'ReachOut OS Enterprise' } = params;

    const email = (contact.email || '').trim();
    const canSend = Boolean(email && email.includes('@') && !contact.isGloballyBlocked && contact.preferences?.EMAIL?.marketingAllowed !== false);

    let blockReason: string | undefined = undefined;
    if (!email || !email.includes('@')) {
      blockReason = 'Contact does not have a verified email address';
    } else if (contact.isGloballyBlocked) {
      blockReason = 'Contact is globally suppressed across all channels';
    } else if (contact.preferences?.EMAIL?.marketingAllowed === false) {
      blockReason = 'Contact has explicitly opted out of Email marketing';
    }

    // Clean up WhatsApp markdown formatting (*bold* -> standard / HTML <strong>, _italic_ -> <em>)
    const cleanText = whatsappMessageBody
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/~([^~]+)~/g, '$1');

    const htmlBodyContent = whatsappMessageBody
      .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');

    // Generate smart professional subject line
    const subject = `Trade Partnership & Product Catalog: ${contact.companyName || contact.displayName}`;

    // Append professional enterprise email sign-off and mandatory compliance footer
    const bodyText = `${cleanText}\n\n---\nBest regards,\n${operatorName}\n${companySignature}\n\n[To unsubscribe from email communications, reply with 'UNSUBSCRIBE']`;

    const bodyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.6; font-size: 14px;">
        <div style="padding: 16px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
          ${htmlBodyContent}
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
            <strong>${operatorName}</strong><br/>
            <span>${companySignature}</span>
          </div>
        </div>
        <div style="margin-top: 12px; font-size: 11px; color: #94a3b8; text-align: center;">
          You received this message regarding commercial trade inquiries. Reply with 'UNSUBSCRIBE' to opt out.
        </div>
      </div>
    `.trim();

    // Encode mailto URL for 1-click launch in desktop / web email client
    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

    return {
      contactId: contact.id,
      contactName: contact.displayName || contact.firstName || 'Partner',
      recipientEmail: email,
      subject,
      bodyText,
      bodyHtml,
      mailtoUrl,
      canSendEmail: canSend,
      blockReason
    };
  }
}
