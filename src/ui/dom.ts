/** 작은 DOM 생성 도우미. 텍스트는 항상 textContent로 넣어 HTML 주입을 막는다. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) node.append(child);
  return node;
}

/** 아랍어 텍스트 블록: lang/dir을 지정해 RTL로 표시한다. */
export function arabic(text: string, className = 'ar'): HTMLElement {
  return el('p', { class: className, lang: 'ar', dir: 'rtl' }, text);
}

/** 한국어 텍스트 블록: 아랍어가 섞여도 LTR 문단으로 고정한다. */
export function korean(text: string, className = 'ko'): HTMLElement {
  return el('p', { class: className, lang: 'ko', dir: 'ltr' }, text);
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} 요소가 없습니다.`);
  return node as T;
}
