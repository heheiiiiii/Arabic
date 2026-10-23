import type { ContextQuestion } from './types';

/**
 * "문맥에 맞는 표현 고르기" 문제. 오답은 그 상황에서 분명히 어색한 표현만 골랐다.
 * 정답 항목을 배운 뒤에만 출제된다.
 */
export const CONTEXT_QUESTIONS: ContextQuestion[] = [
  {
    id: 'c.reply_salam',
    situationKo: '이웃이 이렇게 인사했어요. 어떻게 대답할까요?',
    promptItemId: 's.salam',
    answerId: 's.wa_alaykum',
    distractorIds: ['s.maa_salama', 's.min_ayna_anta'],
    explanationKo: '"평화가 함께하길"이라는 인사에는 "당신에게도 평화가"라고 그대로 돌려주며 대답해요.',
  },
  {
    id: 'c.reply_sabah',
    situationKo: '아침에 라일라가 이렇게 인사했어요. 알맞은 대답은?',
    promptItemId: 's.sabah_khayr',
    answerId: 's.sabah_nur',
    distractorIds: ['s.ila_liqa', 's.ana_talib'],
    explanationKo: '"좋은 것(خَيْرٌ)의 아침"이라는 인사에는 "빛(نُورٌ)의 아침"으로 대답하는 것이 관용 표현이에요.',
  },
  {
    id: 'c.reply_kayfa',
    situationKo: '라일라가 안부를 물었어요. 어떻게 대답할까요?',
    promptItemId: 's.kayfa_hal',
    answerId: 's.bikhayr',
    distractorIds: ['s.ismi_layla', 's.ayna_suq'],
    explanationKo: '안부 질문에는 "잘 지내요, 고마워요"로 대답해요.',
  },
  {
    id: 'c.reply_shukran',
    situationKo: '길을 알려 줬더니 주민이 이렇게 말했어요. 뭐라고 대답할까요?',
    promptItemId: 'w.shukran',
    answerId: 'w.afwan',
    distractorIds: ['w.la', 'w.masa'],
    explanationKo: '"고마워요"에는 "천만에요"로 대답해요.',
  },
  {
    id: 'c.leaving',
    situationKo: '이야기를 마치고 헤어지려고 해요. 어울리는 인사는?',
    answerId: 's.maa_salama',
    distractorIds: ['s.sabah_khayr', 's.kayfa_hal'],
    explanationKo: '헤어질 때는 "안녕히 가세요"라는 뜻의 이 표현을 써요.',
  },
  {
    id: 'c.ask_name_m',
    situationKo: '처음 만난 남자 주민의 이름을 묻고 싶어요.',
    answerId: 's.ma_ismuka',
    distractorIds: ['s.ma_ismuki', 's.min_ayna_anta'],
    explanationKo: '남성에게는 끝이 ـكَ(-ka)인 형태를 써요. ـكِ(-ki)는 여성에게 쓰는 형태예요.',
  },
  {
    id: 'c.ask_origin_f',
    situationKo: '라일라(여성)에게 어디에서 왔는지 묻고 싶어요.',
    answerId: 's.min_ayna_anti',
    distractorIds: ['s.min_ayna_anta', 's.ayna_suq'],
    explanationKo: '여성에게는 أَنْتِ(anti)를 써요. أَنْتَ(anta)는 남성에게 쓰는 형태예요.',
  },
  {
    id: 'c.reply_origin',
    situationKo: '주민이 어디에서 왔냐고 물었어요. 한국에서 왔다고 대답해요.',
    promptItemId: 's.min_ayna_anta',
    answerId: 's.ana_min_kuriya',
    distractorIds: ['s.bikhayr', 's.urid_qahwa'],
    explanationKo: '"~에서"는 مِنْ, 한국은 كُورِيَا예요.',
  },
  {
    id: 'c.nice_to_meet',
    situationKo: '서로 이름을 말하고 처음 인사를 나눴어요. 이어서 할 말은?',
    answerId: 's.tasharrafna',
    distractorIds: ['s.maa_salama', 's.qarya_jamila'],
    explanationKo: '처음 만났을 때 "만나서 반가워요"라는 뜻으로 써요.',
  },
  {
    id: 'c.order_coffee',
    situationKo: '찻집에서 커피를 주문하고 싶어요.',
    answerId: 's.urid_qahwa',
    distractorIds: ['s.urid_maa', 's.ayna_suq'],
    explanationKo: 'أُرِيدُ(원해요) 뒤에 커피 قَهْوَةً를 붙여요. مَاءً는 "물"이에요.',
  },
  {
    id: 'c.find_market',
    situationKo: '장을 보러 가고 싶은데 시장 위치를 몰라요.',
    answerId: 's.ayna_suq',
    distractorIds: ['s.min_ayna_anta', 's.hadha_bayti'],
    explanationKo: '"어디"는 أَيْنَ, 시장은 السُّوقُ예요.',
  },
  {
    id: 'c.student_f',
    situationKo: '여성 유학생이 자기를 학생이라고 소개해요.',
    answerId: 's.ana_taliba',
    distractorIds: ['s.ana_talib', 's.ana_kuri'],
    explanationKo: '여성은 طَالِبَةٌ(ṭālibatun)를 써요. طَالِبٌ는 남성형이에요.',
  },
];
