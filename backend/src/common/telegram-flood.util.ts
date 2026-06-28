export function parseFloodWaitSeconds(error: unknown): number | null {
  const msg = (error as Error)?.message ?? String(error);
  const match = msg.match(/(?:FLOOD_WAIT_|wait of )(\d+)/i);
  if (!match) return null;
  const sec = Number(match[1]);
  return Number.isFinite(sec) && sec > 0 ? sec : null;
}

/** Qayta urinish foydasiz — keyingi foydalanuvchiga o'tish kerak */
export function isPermanentSendError(error: unknown): boolean {
  const msg = ((error as Error)?.message ?? String(error)).toUpperCase();
  return (
    msg.includes('USER_PRIVACY_RESTRICTED') ||
    msg.includes('PRIVACY') ||
    msg.includes('PEER_ID_INVALID') ||
    msg.includes('INPUT_USER_DEACTIVATED') ||
    msg.includes('USER_IS_BOT') ||
    msg.includes('COULD NOT FIND THE INPUT ENTITY') ||
    msg.includes('ENTITY NOT FOUND') ||
    msg.includes('ALLOW_PAYMENT_REQUIRED') ||
    msg.includes('FOYDALANUVCHI TOPILMADI') ||
    msg.includes('TOPA OLMADI') ||
    msg.includes('VAQTI TUGADI') ||
    msg.includes('TIMEOUT') ||
    msg.includes("SHABLONI BO'SH")
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Spam xavfini kamaytirish: bazaviy kechikish + tasodifiy qo'shimcha */
export async function sleepWithJitter(
  baseMs: number,
  jitterMs: number,
): Promise<void> {
  const extra = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
  await sleep(baseMs + extra);
}
