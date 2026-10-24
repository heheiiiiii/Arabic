import { createHash, timingSafeEqual } from 'node:crypto';
import { config } from './config';

/**
 * 초대 코드 (ACCESS_CODE). 소수 사용자에게만 유료 기능을 열어 두기 위한 간단한 장치다.
 * 코드를 맞히면 HttpOnly 쿠키를 주고, 이후 /api 요청은 이 쿠키로 확인한다.
 * 코드가 없어도 게임·연습 모드·무료 음성(espeak-ng)은 그대로 쓸 수 있다.
 */
const COOKIE = 'village_access';
const MAX_AGE = 60 * 60 * 24 * 180;

export type AccessState = 'open' | 'granted' | 'required';

export function accessRequired(): boolean {
  return !!config.accessCode;
}

function token(code: string): Buffer {
  return createHash('sha256').update(`arabic-village|${code}`).digest();
}

function sameToken(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

function cookieValue(req: Request): string | null {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return null;
}

export function accessState(req: Request): AccessState {
  if (!config.accessCode) return 'open';
  const v = cookieValue(req);
  if (!v || !/^[0-9a-f]{64}$/.test(v)) return 'required';
  return sameToken(Buffer.from(v, 'hex'), token(config.accessCode)) ? 'granted' : 'required';
}

/** 유료 기능을 써도 되는지 */
export function hasAccess(req: Request): boolean {
  return accessState(req) !== 'required';
}

/** 입력한 코드가 맞는지 */
export function checkCode(code: string): boolean {
  if (!config.accessCode) return true;
  return sameToken(token(code), token(config.accessCode));
}

/** 코드를 맞힌 브라우저에 줄 쿠키 (HTTPS면 Secure) */
export function accessCookie(req: Request): string {
  const https = new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
  return `${COOKIE}=${token(config.accessCode ?? '').toString('hex')}; Path=/api; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Strict${https ? '; Secure' : ''}`;
}
