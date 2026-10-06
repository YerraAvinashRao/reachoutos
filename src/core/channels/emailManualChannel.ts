import { ChannelPort, PreparedMessage } from './channelPort';
import { ChannelType } from '../../types';

export class EmailManualChannel implements ChannelPort {
  readonly channelType: ChannelType = 'EMAIL';

  supportsAttachments(): boolean {
    return false; // mailto links do not support arbitrary file attachments
  }

  supportsPrefilledText(): boolean {
    return true;
  }

  prepareMessage(input: {
    recipientId: string;
    recipientName: string;
    address: string;
    body: string;
    subject?: string;
    attachmentName?: string;
  }): PreparedMessage {
    const encodedSubject = encodeURIComponent(input.subject || 'Outreach from ReachOut OS');
    const encodedBody = encodeURIComponent(input.body);
    const deepLinkUrl = `mailto:${encodeURIComponent(input.address)}?subject=${encodedSubject}&body=${encodedBody}`;

    let instructions = 'Review the drafted message in your email client, then click Send.';
    if (input.attachmentName) {
      instructions = `ATTACHMENT REQUIRED: Please manually attach "${input.attachmentName}" in your mail client before sending.`;
    }

    return {
      recipientId: input.recipientId,
      recipientName: input.recipientName,
      channel: 'EMAIL',
      address: input.address,
      subject: input.subject,
      body: input.body,
      attachmentName: input.attachmentName,
      deepLinkUrl,
      instructions
    };
  }
}
