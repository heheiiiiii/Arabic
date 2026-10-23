import { byId } from './dom';

/** 화면 왼쪽 위의 이름·장소 표시와 장면별 버튼. */
export const hud = {
  show(name: string): void {
    byId('hud-name').textContent = name;
    byId('hud').hidden = false;
  },

  setPlace(place: string, hint: string): void {
    byId('hud-place').textContent = place;
    const hintEl = byId('hint');
    hintEl.textContent = hint;
    hintEl.hidden = hint === '';
  },

  /** 집 안에서만 보이는 "마을로 나가기" 버튼. null이면 숨긴다. */
  setExit(onExit: (() => void) | null): void {
    const btn = byId<HTMLButtonElement>('hud-exit');
    btn.hidden = onExit === null;
    btn.onclick = onExit;
  },
};
