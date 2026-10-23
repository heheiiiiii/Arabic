/**
 * 미리 작성한 대화 데이터 (현대 표준 아랍어, MSA).
 *
 * 플레이어의 성별을 아직 고르지 않으므로, 주민이 플레이어에게 하는 말은
 * 성별 구분이 필요 없는 표현(كَيْفَ الْحَالُ؟ 등)만 쓰고, 성별에 따른 차이는 note로 알려 준다.
 */

export type Speaker = 'villager' | 'player';

export interface DialogueLine {
  speaker: Speaker;
  /** 아랍어 원문 (모음 부호 포함) */
  ar: string;
  /** 자연스러운 한국어 번역 */
  ko: string;
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
  greeting: DialogueLine[];
}

export const LAYLA: VillagerDef = {
  id: 'layla',
  nameAr: 'لَيْلَى',
  nameKo: '라일라',
  greeting: [
    { speaker: 'villager', ar: 'مَرْحَبًا!', ko: '안녕!' },
    { speaker: 'villager', ar: 'أَنَا لَيْلَى.', ko: '나는 라일라야.' },
    { speaker: 'villager', ar: 'أَهْلًا وَسَهْلًا فِي قَرْيَتِنَا!', ko: '우리 마을에 온 걸 환영해!' },
    {
      speaker: 'villager',
      ar: 'كَيْفَ الْحَالُ؟',
      ko: '요즘 어때?',
      note: {
        text: '상대를 직접 가리켜 "너는 어떻게 지내?"라고 물을 때는 상대의 성별에 따라 끝소리가 달라져요.',
        examples: [
          { label: '남성에게', ar: 'كَيْفَ حَالُكَ؟' },
          { label: '여성에게', ar: 'كَيْفَ حَالُكِ؟' },
        ],
      },
    },
    { speaker: 'player', ar: 'أَنَا بِخَيْرٍ، شُكْرًا.', ko: '잘 지내, 고마워.' },
    { speaker: 'villager', ar: 'الْحَمْدُ لِلَّهِ! إِلَى اللِّقَاءِ!', ko: '다행이다! 또 보자!' },
  ],
};
