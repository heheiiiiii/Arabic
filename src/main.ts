import '@fontsource/noto-naskh-arabic/arabic-400.css';
import '@fontsource/noto-naskh-arabic/arabic-700.css';
import './styles/main.css';

import { createGame } from './game/createGame';
import { getPlayerName, loadSave, setPlayerName } from './game/state';
import { getLearnerProfile, learning } from './learning';
import { hud } from './ui/Hud';
import { byId } from './ui/dom';
import { showStartScreen } from './ui/StartScreen';

async function start(): Promise<void> {
  const saved = loadSave();
  const name = await showStartScreen(saved?.playerName ?? null);
  setPlayerName(name);
  hud.show(getPlayerName());

  const game = createGame(byId('game-root'));

  // 개발 모드에서만: 브라우저 자동화 테스트가 게임 상태를 읽을 수 있게 노출한다.
  if (import.meta.env.DEV) {
    (window as unknown as { __arabicVillage: unknown }).__arabicVillage = { game, learning, getLearnerProfile };
  }
}

void start();
