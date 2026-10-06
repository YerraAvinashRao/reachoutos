import { ChannelPort, PreparedMessage } from './channelPort';
import { ChannelType } from '../../types';

export class WhatsAppManualChannel implements ChannelPort {
  readonly channelType: ChannelType = 'WHATSAPP';

  supportsAttachments(): boolean {
    return false; // Universal web deep links do not allow silent arbitrary file payloads
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
    // Clean phone number to digits only (strip + for wa.me)
    const phoneDigits = input.address.replace(/\D/g, '');
    const encodedBody = encodeURIComponent(input.body);
    
    // Official wa.me deep link URL
    const deepLinkUrl = `https://wa.me/${phoneDigits}?text=${encodedBody}`;

    let instructions = 'Review the prefilled text in WhatsApp, then manually press Send.';
    if (input.attachmentName) {
      instructions = `ATTACHMENT REQUIRED: Please manually attach "${input.attachmentName}" using WhatsApp's paperclip icon before pressing Send.`;
    }

    return {
      recipientId: input.recipientId,
      recipientName: input.recipientName,
      channel: 'WHATSAPP',
      address: input.address,
      body: input.body,
      attachmentName: input.attachmentName,
      deepLinkUrl,
      instructions
    };
  }
}
