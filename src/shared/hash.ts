/**
 * 텍스트 → 짧은 해시 (cyrb53). 음성 파일 캐시 키로 쓴다.
 * 브라우저·Node·빌드 스크립트에서 같은 값을 내야 하므로 Web Crypto 없이 순수 JS로 계산한다.
 * 보안용 해시가 아니다.
 */
export function textHash(text: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** 미리 만든 음성 파일 경로 (public/audio/tts/<hash>.mp3) */
export function prebuiltAudioPath(text: string): string {
  return `audio/tts/${textHash(text.normalize('NFC'))}.mp3`;
}
