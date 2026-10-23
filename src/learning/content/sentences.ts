import type { StudyItem } from './types';

/**
 * 초급 회화 문장 (현대 표준 아랍어).
 * 모든 문장은 문법에 맞게 모음 부호를 모두 표시했다 (원어민 검수 전).
 * keyWords는 words.ts의 항목 ID이며, 문장 속 형태(격·소유 어미)는 사전형과 다를 수 있다.
 */
export const SENTENCES: StudyItem[] = [
  // ── 인사와 안부 ─────────────────────────────
  {
    id: 's.marhaban', kind: 'sentence', unit: 'greetings', difficulty: 1,
    ar: 'مَرْحَبًا!', translit: 'marḥaban!', pron: '마르하반!', ko: '안녕하세요!',
    keyWords: ['w.marhaban'],
    usage: '처음 만났을 때도, 아는 사이에서도 쓸 수 있어요.',
  },
  {
    id: 's.salam', kind: 'sentence', unit: 'greetings', difficulty: 1,
    ar: 'السَّلَامُ عَلَيْكُمْ.', translit: 'as-salāmu ʿalaykum.', pron: '앗살라무 알라이쿰', ko: '안녕하세요. (평화가 함께하길)',
    keyWords: ['w.salam'],
    usage: '아랍 세계 어디서나 쓰는 정중한 인사예요. 한 사람에게도 복수형 عَلَيْكُمْ를 써요.',
  },
  {
    id: 's.wa_alaykum', kind: 'sentence', unit: 'greetings', difficulty: 1,
    ar: 'وَعَلَيْكُمُ السَّلَامُ.', translit: 'wa-ʿalaykumu s-salām.', pron: '와알라이쿠뭇 살람', ko: '안녕하세요. (당신에게도 평화가)',
    keyWords: ['w.salam'],
    usage: 'السَّلَامُ عَلَيْكُمْ에 대한 대답이에요. مُ의 담마는 뒤 단어와 이어 읽기 위한 소리예요.',
  },
  {
    id: 's.sabah_khayr', kind: 'sentence', unit: 'greetings', difficulty: 1,
    ar: 'صَبَاحَ الْخَيْرِ.', translit: 'ṣabāḥa l-khayr.', pron: '사바할 카이르', ko: '좋은 아침이에요.',
    keyWords: ['w.sabah', 'w.khayr'],
  },
  {
    id: 's.sabah_nur', kind: 'sentence', unit: 'greetings', difficulty: 1,
    ar: 'صَبَاحَ النُّورِ.', translit: 'ṣabāḥa n-nūr.', pron: '사바한 누르', ko: '좋은 아침이에요. (아침 인사에 대한 대답)',
    keyWords: ['w.sabah', 'w.nur'],
    usage: 'صَبَاحَ الْخَيْرِ라는 인사를 받았을 때 대답하는 말이에요.',
  },
  {
    id: 's.masa_khayr', kind: 'sentence', unit: 'greetings', difficulty: 1,
    ar: 'مَسَاءَ الْخَيْرِ.', translit: 'masāʾa l-khayr.', pron: '마사알 카이르', ko: '좋은 저녁이에요.',
    keyWords: ['w.masa', 'w.khayr'],
    usage: '오후 늦게부터 밤까지 쓰는 인사예요. 대답은 مَسَاءَ النُّورِ.',
  },
  {
    id: 's.kayfa_hal', kind: 'sentence', unit: 'greetings', difficulty: 1,
    ar: 'كَيْفَ الْحَالُ؟', translit: 'kayfa l-ḥāl?', pron: '카이팔 할?', ko: '어떻게 지내요?',
    keyWords: ['w.kayfa', 'w.hal'],
    usage: '상대의 성별과 상관없이 쓸 수 있는 안부 인사예요.',
  },
  {
    id: 's.kayfa_haluka', kind: 'sentence', unit: 'greetings', difficulty: 2,
    ar: 'كَيْفَ حَالُكَ؟', translit: 'kayfa ḥāluka?', pron: '카이파 할루카?', ko: '(남성에게) 어떻게 지내요?',
    keyWords: ['w.kayfa', 'w.hal'],
    grammar: 'حَالُ + كَ(너의, 남성) → "너의 형편"',
    gender: { role: 'addressee', gender: 'm', pairId: 's.kayfa_haluki' },
  },
  {
    id: 's.kayfa_haluki', kind: 'sentence', unit: 'greetings', difficulty: 2,
    ar: 'كَيْفَ حَالُكِ؟', translit: 'kayfa ḥāluki?', pron: '카이파 할루키?', ko: '(여성에게) 어떻게 지내요?',
    keyWords: ['w.kayfa', 'w.hal'],
    grammar: 'حَالُ + كِ(너의, 여성) → 끝 모음이 카스라(-ki)예요.',
    gender: { role: 'addressee', gender: 'f', pairId: 's.kayfa_haluka' },
  },
  {
    id: 's.bikhayr', kind: 'sentence', unit: 'greetings', difficulty: 1,
    ar: 'أَنَا بِخَيْرٍ، شُكْرًا.', translit: 'anā bi-khayr, shukran.', pron: '아나 비카이르, 슈크란', ko: '잘 지내요, 고마워요.',
    keyWords: ['w.ana', 'w.khayr', 'w.shukran'],
    grammar: 'بِـ(~와 함께) + خَيْرٍ → "좋은 상태로". 말하는 사람의 성별과 상관없이 써요.',
  },
  {
    id: 's.hamdulillah', kind: 'sentence', unit: 'greetings', difficulty: 1,
    ar: 'الْحَمْدُ لِلَّهِ.', translit: 'al-ḥamdu lillāh.', pron: '알함두 릴라', ko: '덕분에 잘 지내요. (신께 감사를)',
    usage: '안부 인사에 대답할 때 아주 자주 쓰는 표현이에요.',
  },
  {
    id: 's.ila_liqa', kind: 'sentence', unit: 'greetings', difficulty: 1,
    ar: 'إِلَى اللِّقَاءِ.', translit: 'ilā l-liqāʾ.', pron: '일랄 리까', ko: '또 만나요.',
    usage: '헤어질 때 "다음에 또 보자"는 뜻으로 써요.',
  },
  {
    id: 's.maa_salama', kind: 'sentence', unit: 'greetings', difficulty: 1,
    ar: 'مَعَ السَّلَامَةِ.', translit: 'maʿa s-salāmah.', pron: '마아쌀라마', ko: '안녕히 가세요.',
    acceptKo: ['잘 가요', '안녕히 계세요'],
    usage: '헤어질 때 쓰는 인사예요. 떠나는 사람과 남는 사람 모두 쓸 수 있어요.',
  },

  // ── 자기소개 ─────────────────────────────
  {
    id: 's.ma_ismuka', kind: 'sentence', unit: 'introductions', difficulty: 1,
    ar: 'مَا اسْمُكَ؟', translit: 'mā smuka?', pron: '마 스무카?', ko: '(남성에게) 이름이 뭐예요?',
    keyWords: ['w.ma', 'w.ism'],
    grammar: 'اسْم + ـُكَ(너의, 남성). مَا 뒤에서 연결 알리프는 소리 나지 않아요.',
    gender: { role: 'addressee', gender: 'm', pairId: 's.ma_ismuki' },
  },
  {
    id: 's.ma_ismuki', kind: 'sentence', unit: 'introductions', difficulty: 1,
    ar: 'مَا اسْمُكِ؟', translit: 'mā smuki?', pron: '마 스무키?', ko: '(여성에게) 이름이 뭐예요?',
    keyWords: ['w.ma', 'w.ism'],
    grammar: 'اسْم + ـُكِ(너의, 여성)',
    gender: { role: 'addressee', gender: 'f', pairId: 's.ma_ismuka' },
  },
  {
    id: 's.ismi_layla', kind: 'sentence', unit: 'introductions', difficulty: 1,
    ar: 'اِسْمِي لَيْلَى.', translit: 'ismī laylā.', pron: '이스미 라일라', ko: '제 이름은 라일라예요.',
    keyWords: ['w.ism'],
    grammar: 'اِسْم + ـِي(나의) → "내 이름". 자기 이름을 넣어 말해 보세요.',
  },
  {
    id: 's.tasharrafna', kind: 'sentence', unit: 'introductions', difficulty: 1,
    ar: 'تَشَرَّفْنَا.', translit: 'tasharrafnā.', pron: '타샤르라프나', ko: '만나서 반가워요.',
    usage: '처음 인사를 나눈 뒤에 써요. "우리가 영광이에요"라는 뜻이에요.',
  },
  {
    id: 's.ana_talib', kind: 'sentence', unit: 'introductions', difficulty: 1,
    ar: 'أَنَا طَالِبٌ.', translit: 'anā ṭālib.', pron: '아나 탈리브', ko: '저는 학생이에요. (남성)',
    keyWords: ['w.ana', 'w.talib'],
    grammar: '아랍어 현재 문장에는 "~이다" 동사가 필요 없어요.',
    gender: { role: 'speaker', gender: 'm', pairId: 's.ana_taliba' },
  },
  {
    id: 's.ana_taliba', kind: 'sentence', unit: 'introductions', difficulty: 1,
    ar: 'أَنَا طَالِبَةٌ.', translit: 'anā ṭāliba.', pron: '아나 탈리바', ko: '저는 학생이에요. (여성)',
    keyWords: ['w.ana', 'w.taliba'],
    gender: { role: 'speaker', gender: 'f', pairId: 's.ana_talib' },
  },
  {
    id: 's.hadha_sadiqi', kind: 'sentence', unit: 'introductions', difficulty: 1,
    ar: 'هٰذَا صَدِيقِي.', translit: 'hādhā ṣadīqī.', pron: '하다 사디끼', ko: '이 사람은 제 친구예요.',
    keyWords: ['w.hadha', 'w.sadiq'],
    grammar: 'صَدِيق + ـِي(나의) → "내 친구"',
  },
  {
    id: 's.adrusu_arabiyya', kind: 'sentence', unit: 'introductions', difficulty: 2,
    ar: 'أَدْرُسُ اللُّغَةَ الْعَرَبِيَّةَ.', translit: 'adrusu l-lughata l-ʿarabiyya.', pron: '아드루술 루가탈 아라비야', ko: '저는 아랍어를 공부해요.',
    keyWords: ['w.adrusu', 'w.lugha', 'w.arabiyya'],
    grammar: '목적어 자리라서 끝 모음이 -a(목적격)로 바뀌었어요.',
  },

  // ── 출신지 ─────────────────────────────
  {
    id: 's.min_ayna_anta', kind: 'sentence', unit: 'origin', difficulty: 1,
    ar: 'مِنْ أَيْنَ أَنْتَ؟', translit: 'min ayna anta?', pron: '민 아이나 안타?', ko: '(남성에게) 어디에서 왔어요?',
    keyWords: ['w.min', 'w.ayna', 'w.anta'],
    gender: { role: 'addressee', gender: 'm', pairId: 's.min_ayna_anti' },
  },
  {
    id: 's.min_ayna_anti', kind: 'sentence', unit: 'origin', difficulty: 1,
    ar: 'مِنْ أَيْنَ أَنْتِ؟', translit: 'min ayna anti?', pron: '민 아이나 안티?', ko: '(여성에게) 어디에서 왔어요?',
    keyWords: ['w.min', 'w.ayna', 'w.anti'],
    gender: { role: 'addressee', gender: 'f', pairId: 's.min_ayna_anta' },
  },
  {
    id: 's.ana_min_kuriya', kind: 'sentence', unit: 'origin', difficulty: 1,
    ar: 'أَنَا مِنْ كُورِيَا.', translit: 'anā min kūriyā.', pron: '아나 민 쿠리야', ko: '저는 한국에서 왔어요.',
    keyWords: ['w.ana', 'w.min', 'w.kuriya'],
  },
  {
    id: 's.ana_kuri', kind: 'sentence', unit: 'origin', difficulty: 2,
    ar: 'أَنَا كُورِيٌّ.', translit: 'anā kūriyy.', pron: '아나 쿠리', ko: '저는 한국 사람이에요. (남성)',
    keyWords: ['w.ana', 'w.kuri'],
    gender: { role: 'speaker', gender: 'm', pairId: 's.ana_kuriyya' },
  },
  {
    id: 's.ana_kuriyya', kind: 'sentence', unit: 'origin', difficulty: 2,
    ar: 'أَنَا كُورِيَّةٌ.', translit: 'anā kūriyya.', pron: '아나 쿠리야', ko: '저는 한국 사람이에요. (여성)',
    keyWords: ['w.ana', 'w.kuriyya'],
    gender: { role: 'speaker', gender: 'f', pairId: 's.ana_kuri' },
  },
  {
    id: 's.layla_min_misr', kind: 'sentence', unit: 'origin', difficulty: 2,
    ar: 'لَيْلَى مِنْ مِصْرَ.', translit: 'laylā min miṣr.', pron: '라일라 민 미스르', ko: '라일라는 이집트에서 왔어요.',
    keyWords: ['w.min', 'w.misr'],
    grammar: 'مِنْ 뒤라서 مِصْرُ가 مِصْرَ로 바뀌었어요. (탄윈이 붙지 않는 명사의 소유격은 -a)',
  },
  {
    id: 's.ahlan_qarya', kind: 'sentence', unit: 'origin', difficulty: 2,
    ar: 'أَهْلًا وَسَهْلًا فِي قَرْيَتِنَا!', translit: 'ahlan wa-sahlan fī qaryatinā!', pron: '아흘란 와 사흘란 피 까르야티나!', ko: '우리 마을에 온 걸 환영해요!',
    keyWords: ['w.ahlan', 'w.fi', 'w.qarya'],
    grammar: 'قَرْيَة + ـنَا(우리의) → قَرْيَتِنَا. 붙으면 ة가 ت로 바뀌어요.',
  },

  // ── 마을 생활 ─────────────────────────────
  {
    id: 's.hadha_bayti', kind: 'sentence', unit: 'daily', difficulty: 1,
    ar: 'هٰذَا بَيْتِي.', translit: 'hādhā baytī.', pron: '하다 바이티', ko: '여기는 제 집이에요.',
    keyWords: ['w.hadha', 'w.bayt'],
  },
  {
    id: 's.bayt_saghir', kind: 'sentence', unit: 'daily', difficulty: 2,
    ar: 'الْبَيْتُ صَغِيرٌ وَجَمِيلٌ.', translit: 'al-baytu ṣaghīrun wa-jamīl.', pron: '알바이투 사기룬 와 자밀', ko: '집이 작고 예뻐요.',
    keyWords: ['w.bayt', 'w.saghir', 'w.jamil'],
  },
  {
    id: 's.qarya_jamila', kind: 'sentence', unit: 'daily', difficulty: 2,
    ar: 'الْقَرْيَةُ جَمِيلَةٌ.', translit: 'al-qaryatu jamīla.', pron: '알까르야투 자밀라', ko: '마을이 아름다워요.',
    keyWords: ['w.qarya', 'w.jamil'],
    grammar: 'قَرْيَةٌ가 여성 명사라서 형용사도 여성형 جَمِيلَةٌ를 써요.',
  },
  {
    id: 's.ayna_suq', kind: 'sentence', unit: 'daily', difficulty: 1,
    ar: 'أَيْنَ السُّوقُ؟', translit: 'ayna s-sūq?', pron: '아이나 쑤끄?', ko: '시장이 어디예요?',
    keyWords: ['w.ayna', 'w.suq'],
    grammar: 'س는 태양 문자라서 정관사의 ل을 읽지 않고 س를 두 번 읽어요.',
  },
  {
    id: 's.urid_qahwa', kind: 'sentence', unit: 'daily', difficulty: 2,
    ar: 'أُرِيدُ قَهْوَةً.', translit: 'urīdu qahwa.', pron: '우리두 까흐와', ko: '커피를 원해요. (커피 주세요)',
    keyWords: ['w.uridu', 'w.qahwa'],
    grammar: '목적어라서 قَهْوَةٌ가 قَهْوَةً(-tan)로 바뀌었어요.',
  },
  {
    id: 's.urid_maa', kind: 'sentence', unit: 'daily', difficulty: 2,
    ar: 'أُرِيدُ مَاءً.', translit: 'urīdu māʾ.', pron: '우리두 마', ko: '물을 원해요. (물 주세요)',
    keyWords: ['w.uridu', 'w.maa'],
  },
  {
    id: 's.min_fadlik', kind: 'sentence', unit: 'daily', difficulty: 2,
    ar: 'مِنْ فَضْلِكَ.', translit: 'min faḍlik.', pron: '민 파들리크', ko: '(남성에게) 부탁해요.',
    acceptKo: ['주세요', '실례지만'],
    usage: '무언가를 부탁할 때 문장 앞이나 뒤에 붙여요. 여성에게는 مِنْ فَضْلِكِ.',
    gender: { role: 'addressee', gender: 'm' },
  },
  {
    id: 's.adrusu_kulla_yawm', kind: 'sentence', unit: 'daily', difficulty: 2,
    ar: 'أَدْرُسُ الْعَرَبِيَّةَ كُلَّ يَوْمٍ.', translit: 'adrusu l-ʿarabiyyata kulla yawm.', pron: '아드루술 아라비야타 쿨라 야음', ko: '저는 매일 아랍어를 공부해요.',
    keyWords: ['w.adrusu', 'w.arabiyya', 'w.yawm'],
    grammar: 'كُلَّ يَوْمٍ = "모든 날" → 매일',
  },
];
