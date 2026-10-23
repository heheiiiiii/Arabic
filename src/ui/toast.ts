import { byId } from './dom';

let timer: number | undefined;

/** 화면 위쪽에 잠깐 나타나는 안내 문구. */
export function showToast(message: string, ms = 1800): void {
  const toast = byId('toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(timer);
  timer = window.setTimeout(() => toast.classList.remove('is-visible'), ms);
}
