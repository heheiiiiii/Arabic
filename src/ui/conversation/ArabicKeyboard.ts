import { el } from '../dom';

/**
 * 화면 아랍어 자판 (기기에 아랍어 키보드가 없어도 입력할 수 있게).
 * 글자를 커서 위치에 그대로 넣기만 한다. 모음 부호 입력은 선택 사항이며, 없어도 대화·판정에 문제없다.
 */
const ROWS = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
  ['ذ', 'ء', 'ؤ', 'ر', 'ى', 'ة', 'و', 'ز', 'ظ', 'د', 'ئ'],
  ['أ', 'إ', 'آ', 'لا', '،', '؟', '!', '.'],
];
const MARKS: [string, string][] = [
  ['\u064E', '파트하'],
  ['\u0650', '카스라'],
  ['\u064F', '담마'],
  ['\u0652', '수쿤'],
  ['\u0651', '샷다'],
  ['\u064B', '탄윈'],
];

export function arabicKeyboard(target: HTMLTextAreaElement | HTMLInputElement): HTMLElement {
  const insert = (s: string) => {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    target.setRangeText(s, start, end, 'end');
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.focus({ preventScroll: true });
  };
  const key = (label: string, value: string, cls = '', title?: string) => {
    const b = el('button', { type: 'button', class: `kb-key ${cls}`.trim(), lang: 'ar', ...(title ? { title, 'aria-label': title } : {}) }, label);
    // 마우스로 눌러도 입력창 포커스를 빼앗지 않게 한다
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => insert(value));
    return b;
  };
  const backspace = el('button', { type: 'button', class: 'kb-key kb-key--wide', 'aria-label': '지우기', title: '지우기' }, '⌫');
  backspace.addEventListener('mousedown', (e) => e.preventDefault());
  backspace.addEventListener('click', () => {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    if (start === end && start > 0) {
      // 결합 부호까지 한 번에 지우지 않고 코드 포인트 하나씩 지운다
      const before = Array.from(target.value.slice(0, start));
      before.pop();
      const head = before.join('');
      target.setRangeText('', head.length, end, 'end');
    } else target.setRangeText('', start, end, 'end');
    target.dispatchEvent(new Event('input', { bubbles: true }));
  });
  return el(
    'div',
    { class: 'kb', dir: 'rtl', role: 'group', 'aria-label': '아랍어 화면 자판' },
    ...ROWS.map((row) => el('div', { class: 'kb-row' }, ...row.map((c) => key(c, c)))),
    el(
      'div',
      { class: 'kb-row' },
      ...MARKS.map(([m, name]) => key(`ـ${m}`, m, 'kb-key--mark', `${name} 부호`)),
      key('␣', ' ', 'kb-key--space', '띄어쓰기'),
      backspace,
    ),
  );
}
