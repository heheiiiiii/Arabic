import type { Unit } from './types';

/** 초급 회화 단원. order 순서대로 배운다. */
export const UNITS: Unit[] = [
  {
    id: 'greetings',
    order: 1,
    titleKo: '인사와 안부',
    titleAr: 'التَّحِيَّاتُ',
    difficulty: 1,
    goalKo: '만나고 헤어질 때 인사하고, 안부를 묻고 답할 수 있어요.',
  },
  {
    id: 'introductions',
    order: 2,
    titleKo: '자기소개',
    titleAr: 'التَّعَارُفُ',
    difficulty: 1,
    goalKo: '이름을 묻고 답하고, 내가 누구인지 소개할 수 있어요.',
  },
  {
    id: 'origin',
    order: 3,
    titleKo: '출신지',
    titleAr: 'مِنْ أَيْنَ؟',
    difficulty: 2,
    goalKo: '어디에서 왔는지 묻고 답할 수 있어요.',
  },
  {
    id: 'daily',
    order: 4,
    titleKo: '마을 생활',
    titleAr: 'الْحَيَاةُ الْيَوْمِيَّةُ',
    difficulty: 2,
    goalKo: '집과 마을, 먹고 마시는 것에 대해 간단히 말할 수 있어요.',
  },
];
