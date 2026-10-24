import '@fontsource/noto-naskh-arabic/arabic-400.css';
import '@fontsource/noto-naskh-arabic/arabic-700.css';
import './styles/main.css';

import { submitAccessCode } from './conversation/client';
import { createGame } from './game/createGame';
import { getPlayerName, getPlayerProfile, loadSave, setPlayerName, setPlayerProfile } from './game/state';
import { getLearnerProfile, learning } from './learning';
import { hud } from './ui/Hud';
import { byId } from './ui/dom';
import { showStartScreen } from './ui/StartScreen';

/** 초대 링크(?access=코드)로 들어오면 코드를 서버에 확인받고, 주소창에서 코드를 지운다 */
async function acceptInviteLink(): Promise<void> {
  const url = new URL(location.href);
  const code = url.searchParams.get('access');
  if (!code) return;
  url.searchParams.delete('access');
  history.replaceState(null, '', url);
  await submitAccessCode(code);
}

async function start(): Promise<void> {
  await acceptInviteLink();
  const saved = loadSave();
  const choice = await showStartScreen(saved?.playerName ?? null, getPlayerProfile());
  setPlayerName(choice.name);
  setPlayerProfile({ gender: choice.gender, appearance: choice.appearance });
  hud.show(getPlayerName());

  const game = createGame(byId('game-root'));

  // 개발 모드에서만: 브라우저 자동화 테스트가 게임 상태를 읽을 수 있게 노출한다.
  if (import.meta.env.DEV) {
    (window as unknown as { __arabicVillage: unknown }).__arabicVillage = { game, learning, getLearnerProfile };
  }
}

void start();
