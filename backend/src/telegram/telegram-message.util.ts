import { Api } from 'telegram';
import { IncomingMessagePayload } from '../common/types';

export function getChatIdFromMessage(message: Api.Message): string | null {
  const peer = message.peerId;
  if (peer instanceof Api.PeerChannel) {
    return `-100${peer.channelId.toString()}`;
  }
  if (peer instanceof Api.PeerChat) {
    return `-${peer.chatId.toString()}`;
  }
  if (peer instanceof Api.PeerUser) {
    return peer.userId.toString();
  }
  return null;
}

export function buildTelegramMessageLink(
  chatId: string,
  messageId: number,
): string | null {
  if (chatId.startsWith('-100')) {
    return `https://t.me/c/${chatId.slice(4)}/${messageId}`;
  }
  return null;
}

export async function buildIncomingPayload(
  message: Api.Message,
  chatId: string,
  chatTitle: string,
): Promise<IncomingMessagePayload | null> {
  const text = message.message ?? '';
  if (!text.trim()) return null;

  const sender = await message.getSender();
  const isBot = sender instanceof Api.User ? Boolean(sender.bot) : false;

  let senderId = '';
  let senderUsername: string | null = null;
  let senderFirstName: string | null = null;
  let senderLastName: string | null = null;
  let senderPhone: string | null = null;

  if (sender instanceof Api.User) {
    senderId = sender.id.toString();
    senderUsername = sender.username ?? null;
    senderFirstName = sender.firstName ?? null;
    senderLastName = sender.lastName ?? null;
    senderPhone = sender.phone ?? null;
  } else if (message.senderId) {
    senderId = message.senderId.toString();
  } else if (message.fromId instanceof Api.PeerUser) {
    senderId = message.fromId.userId.toString();
  }

  if (!senderId) return null;

  return {
    messageId: message.id,
    chatId,
    chatTitle,
    text,
    senderId,
    senderUsername,
    senderFirstName,
    senderLastName,
    senderPhone,
    isBot,
    messageLink: buildTelegramMessageLink(chatId, message.id),
    canForward: !message.noforwards,
  };
}
