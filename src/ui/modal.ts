/**
 * 현재 열려 있는 모달 UI(대화창, 공부 메뉴 등)의 수.
 * 하나라도 열려 있으면 게임 장면은 클릭 이동을 무시한다.
 */
let openCount = 0;

export function openModal(): void {
  openCount++;
}

export function closeModal(): void {
  openCount = Math.max(0, openCount - 1);
}

export function isModalOpen(): boolean {
  return openCount > 0;
}
