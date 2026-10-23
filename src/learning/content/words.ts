import type { StudyItem } from './types';

/**
 * 단어 (현대 표준 아랍어).
 * 명사·형용사는 사전형인 비한정 주격(탄윈 -un)으로 적는다. 문장 끝에서는 보통 끝소리를 줄여 읽는다
 * (예: صَبَاحٌ ṣabāḥun → [ṣabāḥ]).
 * 원어민 검수 전 상태이며, 표기는 표준 사전형을 기준으로 직접 확인했다.
 */
export const WORDS: StudyItem[] = [
  // ── 인사와 안부 ─────────────────────────────
  {
    id: 'w.marhaban', kind: 'word', unit: 'greetings', difficulty: 1,
    ar: 'مَرْحَبًا', translit: 'marḥaban', pron: '마르하반', ko: '안녕하세요',
    acceptKo: ['안녕', '반가워요'],
    grammar: '감탄 인사말. 끝의 ـًا는 탄윈 파트하(-an)예요.',
    usage: '언제든 쓸 수 있는 가장 기본적인 인사예요.',
  },
  {
    id: 'w.ahlan', kind: 'word', unit: 'greetings', difficulty: 1,
    ar: 'أَهْلًا', translit: 'ahlan', pron: '아흘란', ko: '어서 와요, 안녕',
    acceptKo: ['환영해요'],
    usage: 'أَهْلًا وَسَهْلًا(환영해요)처럼 손님을 맞을 때 자주 써요.',
  },
  {
    id: 'w.salam', kind: 'word', unit: 'greetings', difficulty: 1,
    ar: 'سَلَامٌ', translit: 'salāmun', pron: '살라문', ko: '평화',
    grammar: '명사',
    usage: 'السَّلَامُ عَلَيْكُمْ(당신들에게 평화를)라는 인사에 들어 있어요.',
  },
  {
    id: 'w.sabah', kind: 'word', unit: 'greetings', difficulty: 1,
    ar: 'صَبَاحٌ', translit: 'ṣabāḥun', pron: '사바훈', ko: '아침',
    grammar: '명사 (남성)',
  },
  {
    id: 'w.masa', kind: 'word', unit: 'greetings', difficulty: 1,
    ar: 'مَسَاءٌ', translit: 'masāʾun', pron: '마사운', ko: '저녁',
    grammar: '명사 (남성)',
  },
  {
    id: 'w.khayr', kind: 'word', unit: 'greetings', difficulty: 1,
    ar: 'خَيْرٌ', translit: 'khayrun', pron: '카이룬', ko: '좋은 것, 복',
    grammar: '명사',
    usage: 'صَبَاحَ الْخَيْرِ(좋은 아침), بِخَيْرٍ(잘 지내요)에 들어 있어요.',
  },
  {
    id: 'w.nur', kind: 'word', unit: 'greetings', difficulty: 1,
    ar: 'نُورٌ', translit: 'nūrun', pron: '누룬', ko: '빛',
    grammar: '명사',
    usage: 'صَبَاحَ النُّورِ(빛의 아침)은 아침 인사에 답할 때 써요.',
  },
  {
    id: 'w.kayfa', kind: 'word', unit: 'greetings', difficulty: 1,
    ar: 'كَيْفَ', translit: 'kayfa', pron: '카이파', ko: '어떻게',
    grammar: '의문사',
  },
  {
    id: 'w.hal', kind: 'word', unit: 'greetings', difficulty: 1,
    ar: 'حَالٌ', translit: 'ḥālun', pron: '할룬', ko: '상태, 형편',
    grammar: '명사',
    usage: 'كَيْفَ الْحَالُ؟(어떻게 지내요?)에서 안부를 물을 때 써요.',
  },
  {
    id: 'w.shukran', kind: 'word', unit: 'greetings', difficulty: 1,
    ar: 'شُكْرًا', translit: 'shukran', pron: '슈크란', ko: '고마워요',
    acceptKo: ['감사합니다'],
  },
  {
    id: 'w.afwan', kind: 'word', unit: 'greetings', difficulty: 1,
    ar: 'عَفْوًا', translit: 'ʿafwan', pron: '아프완', ko: '천만에요',
    acceptKo: ['실례합니다'],
    usage: '고맙다는 말에 대답할 때 써요. "실례합니다"라는 뜻으로도 써요.',
  },
  {
    id: 'w.naam', kind: 'word', unit: 'greetings', difficulty: 1,
    ar: 'نَعَمْ', translit: 'naʿam', pron: '나암', ko: '네',
    acceptKo: ['예', '그래요'],
  },
  {
    id: 'w.la', kind: 'word', unit: 'greetings', difficulty: 1,
    ar: 'لَا', translit: 'lā', pron: '라', ko: '아니요',
  },
  {
    id: 'w.ana', kind: 'word', unit: 'greetings', difficulty: 1,
    ar: 'أَنَا', translit: 'anā', pron: '아나', ko: '나, 저',
    grammar: '1인칭 대명사 (남녀 공통)',
  },

  // ── 자기소개 ─────────────────────────────
  {
    id: 'w.anta', kind: 'word', unit: 'introductions', difficulty: 1,
    ar: 'أَنْتَ', translit: 'anta', pron: '안타', ko: '너, 당신 (남성에게)',
    grammar: '2인칭 남성 대명사',
    gender: { role: 'addressee', gender: 'm', pairId: 'w.anti' },
  },
  {
    id: 'w.anti', kind: 'word', unit: 'introductions', difficulty: 1,
    ar: 'أَنْتِ', translit: 'anti', pron: '안티', ko: '너, 당신 (여성에게)',
    grammar: '2인칭 여성 대명사',
    gender: { role: 'addressee', gender: 'f', pairId: 'w.anta' },
  },
  {
    id: 'w.ism', kind: 'word', unit: 'introductions', difficulty: 1,
    ar: 'اِسْمٌ', translit: 'ismun', pron: '이스문', ko: '이름',
    grammar: '명사. 첫 알리프는 연결 알리프라서 문장 중간에서는 소리 나지 않아요.',
    usage: 'اِسْمِي(내 이름), اسْمُكَ(당신의 이름)처럼 소유 어미가 붙어요.',
  },
  {
    id: 'w.ma', kind: 'word', unit: 'introductions', difficulty: 1,
    ar: 'مَا', translit: 'mā', pron: '마', ko: '무엇',
    grammar: '의문사 (명사 앞에서 "무엇")',
  },
  {
    id: 'w.talib', kind: 'word', unit: 'introductions', difficulty: 1,
    ar: 'طَالِبٌ', translit: 'ṭālibun', pron: '탈리분', ko: '학생 (남성)',
    grammar: '명사 (남성형)',
    gender: { role: 'speaker', gender: 'm', pairId: 'w.taliba' },
  },
  {
    id: 'w.taliba', kind: 'word', unit: 'introductions', difficulty: 1,
    ar: 'طَالِبَةٌ', translit: 'ṭālibatun', pron: '탈리바툰', ko: '학생 (여성)',
    grammar: '명사 (여성형). 끝의 ة(타 마르부타)가 여성형 표시예요.',
    gender: { role: 'speaker', gender: 'f', pairId: 'w.talib' },
  },
  {
    id: 'w.sadiq', kind: 'word', unit: 'introductions', difficulty: 1,
    ar: 'صَدِيقٌ', translit: 'ṣadīqun', pron: '사디쿤', ko: '친구',
    grammar: '명사 (남성). 여성형은 صَدِيقَةٌ',
  },
  {
    id: 'w.hadha', kind: 'word', unit: 'introductions', difficulty: 1,
    ar: 'هٰذَا', translit: 'hādhā', pron: '하다', ko: '이것, 이 사람 (남성)',
    grammar: '지시대명사. هـ 위의 작은 세로 알리프(ٰ)가 긴 "아" 소리예요.',
  },
  {
    id: 'w.lugha', kind: 'word', unit: 'introductions', difficulty: 2,
    ar: 'لُغَةٌ', translit: 'lughatun', pron: '루가툰', ko: '언어',
    grammar: '명사 (여성)',
  },
  {
    id: 'w.arabiyya', kind: 'word', unit: 'introductions', difficulty: 2,
    ar: 'الْعَرَبِيَّةُ', translit: 'al-ʿarabiyyatu', pron: '알아라비야투', ko: '아랍어',
    grammar: 'اللُّغَةُ الْعَرَبِيَّةُ(아랍 언어)를 줄인 말이에요.',
  },
  {
    id: 'w.adrusu', kind: 'word', unit: 'introductions', difficulty: 2,
    ar: 'أَدْرُسُ', translit: 'adrusu', pron: '아드루수', ko: '(나는) 공부해요',
    grammar: '동사 دَرَسَ(공부하다)의 1인칭 현재형',
  },

  // ── 출신지 ─────────────────────────────
  {
    id: 'w.min', kind: 'word', unit: 'origin', difficulty: 1,
    ar: 'مِنْ', translit: 'min', pron: '민', ko: '~에서, ~ 출신',
    grammar: '전치사',
  },
  {
    id: 'w.ayna', kind: 'word', unit: 'origin', difficulty: 1,
    ar: 'أَيْنَ', translit: 'ayna', pron: '아이나', ko: '어디',
    grammar: '의문사',
  },
  {
    id: 'w.kuriya', kind: 'word', unit: 'origin', difficulty: 1,
    ar: 'كُورِيَا', translit: 'kūriyā', pron: '쿠리야', ko: '한국',
  },
  {
    id: 'w.kuri', kind: 'word', unit: 'origin', difficulty: 2,
    ar: 'كُورِيٌّ', translit: 'kūriyyun', pron: '쿠리윤', ko: '한국 사람 (남성)',
    grammar: '국적 형용사. 끝의 ـِيٌّ(-iyyun)가 "~의, ~ 사람"을 만들어요.',
    gender: { role: 'speaker', gender: 'm', pairId: 'w.kuriyya' },
  },
  {
    id: 'w.kuriyya', kind: 'word', unit: 'origin', difficulty: 2,
    ar: 'كُورِيَّةٌ', translit: 'kūriyyatun', pron: '쿠리야툰', ko: '한국 사람 (여성)',
    grammar: '국적 형용사 여성형',
    gender: { role: 'speaker', gender: 'f', pairId: 'w.kuri' },
  },
  {
    id: 'w.misr', kind: 'word', unit: 'origin', difficulty: 1,
    ar: 'مِصْرُ', translit: 'miṣru', pron: '미스르', ko: '이집트',
    grammar: '나라 이름. 탄윈이 붙지 않는 명사예요.',
  },
  {
    id: 'w.balad', kind: 'word', unit: 'origin', difficulty: 1,
    ar: 'بَلَدٌ', translit: 'baladun', pron: '발라둔', ko: '나라',
    grammar: '명사 (남성)',
  },
  {
    id: 'w.madina', kind: 'word', unit: 'origin', difficulty: 1,
    ar: 'مَدِينَةٌ', translit: 'madīnatun', pron: '마디나툰', ko: '도시',
    grammar: '명사 (여성)',
  },
  {
    id: 'w.qarya', kind: 'word', unit: 'origin', difficulty: 1,
    ar: 'قَرْيَةٌ', translit: 'qaryatun', pron: '까르야툰', ko: '마을',
    grammar: '명사 (여성)',
  },
  {
    id: 'w.fi', kind: 'word', unit: 'origin', difficulty: 1,
    ar: 'فِي', translit: 'fī', pron: '피', ko: '~에, ~ 안에',
    grammar: '전치사',
  },

  // ── 마을 생활 ─────────────────────────────
  {
    id: 'w.bayt', kind: 'word', unit: 'daily', difficulty: 1,
    ar: 'بَيْتٌ', translit: 'baytun', pron: '바이툰', ko: '집',
    grammar: '명사 (남성)',
  },
  {
    id: 'w.suq', kind: 'word', unit: 'daily', difficulty: 1,
    ar: 'سُوقٌ', translit: 'sūqun', pron: '쑤쿤', ko: '시장',
    grammar: '명사',
  },
  {
    id: 'w.maa', kind: 'word', unit: 'daily', difficulty: 1,
    ar: 'مَاءٌ', translit: 'māʾun', pron: '마운', ko: '물',
    grammar: '명사 (남성)',
  },
  {
    id: 'w.qahwa', kind: 'word', unit: 'daily', difficulty: 1,
    ar: 'قَهْوَةٌ', translit: 'qahwatun', pron: '까흐와툰', ko: '커피',
    grammar: '명사 (여성)',
  },
  {
    id: 'w.shay', kind: 'word', unit: 'daily', difficulty: 1,
    ar: 'شَايٌ', translit: 'shāyun', pron: '샤윤', ko: '차',
    grammar: '명사 (남성)',
  },
  {
    id: 'w.khubz', kind: 'word', unit: 'daily', difficulty: 1,
    ar: 'خُبْزٌ', translit: 'khubzun', pron: '쿠브준', ko: '빵',
    grammar: '명사 (남성)',
  },
  {
    id: 'w.kitab', kind: 'word', unit: 'daily', difficulty: 1,
    ar: 'كِتَابٌ', translit: 'kitābun', pron: '키타분', ko: '책',
    grammar: '명사 (남성)',
  },
  {
    id: 'w.yawm', kind: 'word', unit: 'daily', difficulty: 1,
    ar: 'يَوْمٌ', translit: 'yawmun', pron: '야우문', ko: '날, 하루',
    grammar: '명사 (남성)',
    usage: 'كُلَّ يَوْمٍ(매일), الْيَوْمَ(오늘)처럼 써요.',
  },
  {
    id: 'w.uridu', kind: 'word', unit: 'daily', difficulty: 2,
    ar: 'أُرِيدُ', translit: 'urīdu', pron: '우리두', ko: '(나는) 원해요',
    grammar: '동사 أَرَادَ(원하다)의 1인칭 현재형. 뒤의 명사는 목적격(-an)이 돼요.',
  },
  {
    id: 'w.jamil', kind: 'word', unit: 'daily', difficulty: 1,
    ar: 'جَمِيلٌ', translit: 'jamīlun', pron: '자밀룬', ko: '아름다운, 멋진',
    grammar: '형용사. 여성 명사를 꾸밀 때는 جَمِيلَةٌ',
  },
  {
    id: 'w.kabir', kind: 'word', unit: 'daily', difficulty: 1,
    ar: 'كَبِيرٌ', translit: 'kabīrun', pron: '카비룬', ko: '큰',
    grammar: '형용사. 여성형은 كَبِيرَةٌ',
  },
  {
    id: 'w.saghir', kind: 'word', unit: 'daily', difficulty: 1,
    ar: 'صَغِيرٌ', translit: 'ṣaghīrun', pron: '사기룬', ko: '작은',
    grammar: '형용사. 여성형은 صَغِيرَةٌ',
  },
];
