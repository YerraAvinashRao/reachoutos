import { ChannelType } from '../../types';

export interface PreparedMessage {
  recipientId: string;
  recipientName: string;
  channel: ChannelType;
  address: string;
  body: string;
  subject?: string;
  attachmentName?: string;
  deepLinkUrl: string;
  instructions?: string;
}

export interface ChannelPort {
  readonly channelType: ChannelType;
  supportsAttachments(): boolean;
  supportsPrefilledText(): boolean;
  prepareMessage(input: {
    recipientId: string;
    recipientName: string;
    address: string;
    body: string;
    subject?: string;
    attachmentName?: string;
  }): PreparedMessage;
}
