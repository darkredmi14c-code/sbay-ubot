export function parseFloodWaitSeconds(error: unknown): number | null {
  const msg = (error as Error)?.message ?? String(error);
  const match = msg.match(/(?:FLOOD_WAIT_|wait of )(\d+)/i);
  if (!match) return null;
  const sec = Number(match[1]);
  return Number.isFinite(sec) && sec > 0 ? sec : null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Spam xavfini kamaytirish: bazaviy kechikish + tasodifiy qo'shimcha */
export async function sleepWithJitter(
  baseMs: number,
  jitterMs: number,
): Promise<void> {
  const extra = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
  await sleep(baseMs + extra);
}
