/**
 * 미리 작성한 대화 데이터 (현대 표준 아랍어, MSA).
 *
 * 주민이 플레이어에게 하는 말은 플레이어가 첫 화면에서 고른 성별에 맞춘다 (كَيْفَ حَالُكَ؟ / كَيْفَ حَالُكِ؟).
 * 다른 성별에게 쓰는 형태는 note로 함께 알려 준다.
 */

import type { Gender } from '../shared/conversation';

export type Speaker = 'villager' | 'player';

export interface DialogueLine {
  speaker: Speaker;
  /** 아랍어 원문 (모음 부호 포함) */
  ar: string;
  /** 자연스러운 한국어 번역 */
  ko: string;
  /** 이 대사에 들어 있는 학습 항목 ID (src/learning/content). 책상에서 배운 표현과 연결된다. */
  refs?: string[];
  /** 선택: 짧은 학습 메모. 한국어 설명과 아랍어 예시를 분리해 두어야 방향이 섞이지 않는다. */
  note?: DialogueNote;
}

export interface DialogueNote {
  text: string;
  examples: { label: string; ar: string }[];
}

export interface VillagerDef {
  id: string;
  nameAr: string;
  nameKo: string;
  /** 첫 인사 대사 (플레이어 성별에 따라 달라진다) */
  greeting(g: Gender): DialogueLine[];
}

export const LAYLA: VillagerDef = {
  id: 'layla',
  nameAr: 'لَيْلَى',
  nameKo: '라일라',
  greeting: (g) => [
    { speaker: 'villager', ar: 'مَرْحَبًا!', ko: '안녕!', refs: ['s.marhaban'] },
    { speaker: 'villager', ar: 'أَنَا لَيْلَى.', ko: '나는 라일라야.', refs: ['w.ana'] },
    { speaker: 'villager', ar: 'أَهْلًا وَسَهْلًا فِي قَرْيَتِنَا!', ko: '우리 마을에 온 걸 환영해!', refs: ['s.ahlan_qarya'] },
    {
      speaker: 'villager',
      ar: g === 'm' ? 'كَيْفَ حَالُكَ؟' : 'كَيْفَ حَالُكِ؟',
      ko: '요즘 어때?',
      refs: [g === 'm' ? 's.kayfa_haluka' : 's.kayfa_haluki'],
      note: {
        text: '상대를 직접 가리켜 "너는 어떻게 지내?"라고 물을 때는 상대의 성별에 따라 끝소리가 달라져요. 성별과 상관없이 كَيْفَ الْحَالُ؟라고 물을 수도 있어요.',
        examples: [
          { label: g === 'm' ? '남성에게 (나)' : '남성에게', ar: 'كَيْفَ حَالُكَ؟' },
          { label: g === 'f' ? '여성에게 (나)' : '여성에게', ar: 'كَيْفَ حَالُكِ؟' },
        ],
      },
    },
    { speaker: 'player', ar: 'أَنَا بِخَيْرٍ، شُكْرًا.', ko: '잘 지내, 고마워.', refs: ['s.bikhayr'] },
    { speaker: 'villager', ar: 'الْحَمْدُ لِلَّهِ! إِلَى اللِّقَاءِ!', ko: '다행이다! 또 보자!', refs: ['s.hamdulillah', 's.ila_liqa'] },
  ],
};
