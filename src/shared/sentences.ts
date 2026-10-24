/**
 * 아랍어 문단을 문장 단위로 나눈다 (재생 순서 = 화면 순서).
 * 글자를 바꾸거나 재배열하지 않고, 문장 끝 부호(. ! ? ؟) 뒤의 공백에서만 자른다.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?؟])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
