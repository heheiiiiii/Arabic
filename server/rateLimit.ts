/**
 * 아주 단순한 메모리 기반 사용량 제한 (서버 프로세스 하나 기준).
 * 여러 인스턴스로 배포할 때는 Redis 등 공용 저장소 기반 제한으로 바꿔야 한다.
 */
const windows = new Map<string, number[]>();
let day = '';
const dayCounts = new Map<string, number>();

/** key(IP+경로)별로 windowMs 동안 max번까지 허용. 허용되면 true */
export function allow(key: string, max: number, windowMs = 60_000, now = Date.now()): boolean {
  const list = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    windows.set(key, list);
    return false;
  }
  list.push(now);
  windows.set(key, list);
  if (windows.size > 5000) windows.clear(); // 메모리 보호
  return true;
}

/** 하루 전체 상한 (비용 보호). key(ai·tts·stt)별로 따로 센다. 허용되면 true */
export function allowDaily(key: string, limit: number, now = new Date()): boolean {
  const d = now.toISOString().slice(0, 10);
  if (d !== day) {
    day = d;
    dayCounts.clear();
  }
  const count = dayCounts.get(key) ?? 0;
  if (count >= limit) return false;
  dayCounts.set(key, count + 1);
  return true;
}

export function resetRateLimits(): void {
  windows.clear();
  day = '';
  dayCounts.clear();
}
