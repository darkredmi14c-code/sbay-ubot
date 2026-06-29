import bigInt from 'big-integer';
import { Api, TelegramClient } from 'telegram';
import { DirectMessageRecipient } from '../common/types';

type SendMessageEntity = Parameters<TelegramClient['sendMessage']>[0];
type GroupEntity = Parameters<TelegramClient['getMessages']>[0];

export interface ResolveEntityOptions {
  /** false = accessHash ishlatilmasin (boshqa akkaunt hash i bilan yuborishda) */
  allowAccessHash?: boolean;
}

function matchesUserId(entity: unknown, telegramUserId: string): boolean {
  if (!entity || typeof entity !== 'object' || !('id' in entity)) return false;
  const id = (entity as { id?: { toString(): string } }).id;
  return id?.toString() === telegramUserId;
}

function buildInputPeerUser(
  recipient: DirectMessageRecipient,
): Api.InputPeerUser | null {
  const hash = recipient.accessHash?.trim();
  if (!hash) return null;
  try {
    return new Api.InputPeerUser({
      userId: bigInt(recipient.telegramUserId),
      accessHash: bigInt(hash),
    });
  } catch {
    return null;
  }
}

async function tryGetEntity(
  client: TelegramClient,
  input: string | bigInt.BigInteger | number,
): Promise<SendMessageEntity | null> {
  try {
    return await client.getEntity(input);
  } catch {
    return null;
  }
}

async function resolveFromGroupMessage(
  client: TelegramClient,
  recipient: DirectMessageRecipient,
): Promise<SendMessageEntity | null> {
  const groupId = recipient.sourceGroupId?.trim();
  const rawMsgId = recipient.sourceMessageId?.trim();
  if (!groupId || !rawMsgId) return null;

  const msgId = parseInt(rawMsgId, 10);
  if (!Number.isFinite(msgId)) return null;

  const group = await tryGetEntity(client, groupId);
  if (!group) return null;

  try {
    const messages = await client.getMessages(group as GroupEntity, {
      ids: [msgId],
    });
    const message = messages?.[0];
    if (message) {
      const sender = await message.getSender();
      if (sender) {
        return sender;
      }
    }
  } catch {
    // InputUserFromMessage ga o'tiladi
  }

  try {
    const peer = await client.getInputEntity(groupId);
    const users = await client.invoke(
      new Api.users.GetUsers({
        id: [
          new Api.InputUserFromMessage({
            peer,
            msgId,
            userId: bigInt(recipient.telegramUserId),
          }),
        ],
      }),
    );
    const user = users?.[0];
    if (user instanceof Api.User) {
      return user;
    }
  } catch {
    return null;
  }

  return null;
}

export async function resolveDirectMessageEntity(
  client: TelegramClient,
  recipient: DirectMessageRecipient,
  options: ResolveEntityOptions = {},
): Promise<SendMessageEntity> {
  const allowAccessHash = options.allowAccessHash !== false;

  if (allowAccessHash) {
    const inputPeer = buildInputPeerUser(recipient);
    if (inputPeer) {
      return inputPeer;
    }
  }

  const username = recipient.username?.replace(/^@/, '').trim();
  if (username) {
    const entity = await tryGetEntity(client, username);
    if (entity) {
      return entity;
    }
  }

  const fromMessage = await resolveFromGroupMessage(client, recipient);
  if (fromMessage) {
    return fromMessage;
  }

  const byBigInt = await tryGetEntity(client, bigInt(recipient.telegramUserId));
  if (byBigInt && matchesUserId(byBigInt, recipient.telegramUserId)) {
    return byBigInt;
  }

  const byNumber = await tryGetEntity(
    client,
    parseInt(recipient.telegramUserId, 10),
  );
  if (byNumber && matchesUserId(byNumber, recipient.telegramUserId)) {
    return byNumber;
  }

  const cached = await tryGetEntity(client, recipient.telegramUserId);
  if (cached && matchesUserId(cached, recipient.telegramUserId)) {
    return cached;
  }

  throw new Error(
    `Foydalanuvchi topilmadi (ID: ${recipient.telegramUserId}). ` +
      `Username yoki manba guruh xabari orqali ham hal qilib bo'lmadi.`,
  );
}

export function toDirectMessageRecipient(user: {
  telegramUserId: string;
  username?: string | null;
  telegramAccessHash?: string | null;
  sourceGroupId?: string | null;
  sourceMessageId?: string | null;
}): DirectMessageRecipient {
  return {
    telegramUserId: user.telegramUserId,
    username: user.username,
    accessHash: user.telegramAccessHash,
    sourceGroupId: user.sourceGroupId,
    sourceMessageId: user.sourceMessageId,
  };
}
