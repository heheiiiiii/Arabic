import { looseNormalize } from '../learning/arabic';
import { requireItem } from '../learning/content';
import type { ArabicLine, ChatRequest, Gender, NpcReply } from './conversation';

/**
 * 규칙 기반 "연습 상대" (모의 NPC).
 * 실제 AI가 연결되지 않았을 때(키 없음·오프라인) 대화를 계속할 수 있게 하는 대체 기능이다.
 * - 검토된 학습 콘텐츠 문장만 조합해 말하므로 모음 부호가 검증된 문장만 나온다.
 * - 정해진 주제 순서와 간단한 키워드 인식만 한다. 자유로운 이해·교정은 하지 못한다.
 * - 응답에는 항상 source: 'practice'를 붙여 UI가 "연습 모드(모의)"로 표시하게 한다.
 */

const L = (id: string): ArabicLine => {
  const it = requireItem(id);
  return { ar: it.ar, ko: it.ko.replace(/^\((남성|여성)에게\)\s*/, ''), translit: it.translit };
};
const join = (...parts: ArabicLine[]): ArabicLine => ({
  ar: parts.map((p) => p.ar).join(' '),
  ko: parts.map((p) => p.ko).join(' '),
  translit: parts.every((p) => p.translit) ? parts.map((p) => p.translit).join(' ') : undefined,
});
const raw = (ar: string, ko: string, translit?: string): ArabicLine => ({ ar, ko, ...(translit ? { translit } : {}) });
/** 플레이어 성별에 맞는 학습 항목 ID */
const pick = (g: Gender, m: string, f: string): string => (g === 'm' ? m : f);

interface Topic {
  id: string;
  /** 라일라가 이 주제를 꺼낼 때 하는 말 (플레이어 성별에 따라 다를 수 있음) */
  ask(g: Gender): ArabicLine;
  hint(g: Gender): NpcReply['hint'];
  topicKo: string;
}

const TOPICS: Topic[] = [
  {
    id: 'howareyou',
    topicKo: '안부',
    ask: (g) => L(pick(g, 's.kayfa_haluka', 's.kayfa_haluki')),
    hint: () => ({
      words: [L('w.ana'), L('w.khayr'), L('w.shukran')],
      contextKo: '라일라가 안부를 물었어요. 잘 지낸다고 대답해 보세요.',
      model: L('s.bikhayr'),
      alternatives: [requireItem('s.hamdulillah').ar],
    }),
  },
  {
    id: 'name',
    topicKo: '이름',
    ask: (g) => join(L('s.ismi_layla'), L(pick(g, 's.ma_ismuka', 's.ma_ismuki'))),
    hint: () => ({
      words: [L('w.ism'), L('w.ana')],
      contextKo: '라일라가 자기 이름을 말했어요. "제 이름은 ○○예요"라고 소개해 보세요. (اِسْمِي 뒤에 이름)',
      model: raw('اِسْمِي …', '제 이름은 ○○예요. (… 자리에 내 이름)', 'ismī …'),
      alternatives: ['أَنَا …'],
    }),
  },
  {
    id: 'origin',
    topicKo: '출신지',
    ask: (g) => join(L('s.ana_min_misr'), L(pick(g, 's.min_ayna_anta', 's.min_ayna_anti'))),
    hint: (g) => ({
      words: [L('w.min'), L('w.kuriya')],
      contextKo: '라일라는 이집트에서 왔대요. 나는 어디에서 왔는지 말해 보세요.',
      model: L('s.ana_min_kuriya'),
      alternatives: [requireItem(pick(g, 's.ana_kuri', 's.ana_kuriyya')).ar],
    }),
  },
  {
    id: 'food',
    topicKo: '좋아하는 음료',
    ask: (g) => join(L('s.uhibbu_qahwa'), L(pick(g, 's.hal_tuhibbu', 's.hal_tuhibbina'))),
    hint: () => ({
      words: [L('w.uhibbu'), L('w.shay'), L('w.qahwa')],
      contextKo: '라일라는 커피를 좋아한대요. 나는 무엇을 좋아하는지 말해 보세요.',
      model: L('s.uhibbu_shay'),
      alternatives: [requireItem('s.uhibbu_qahwa').ar],
    }),
  },
  {
    id: 'village',
    topicKo: '마을',
    ask: () => L('s.qarya_jamila'),
    hint: () => ({
      words: [L('w.naam'), L('w.qarya'), L('w.jamil')],
      contextKo: '라일라가 마을이 아름답다고 해요. 맞장구를 쳐 보세요.',
      model: join(raw('نَعَمْ،', '네,', 'naʿam,'), L('s.qarya_jamila')),
      alternatives: [requireItem('s.ayna_suq').ar],
    }),
  },
];

const FAREWELL_HINT: NpcReply['hint'] = {
  words: [L('w.shukran')],
  contextKo: '이야기를 마치고 헤어지는 인사를 해 보세요.',
  model: L('s.maa_salama'),
  alternatives: [requireItem('s.ila_liqa').ar],
};

/** 플레이어 문장에서 알아들을 수 있는 의도 */
function detect(text: string): { intent: string; capture?: string } | null {
  const t = looseNormalize(text);
  if (!/[\u0621-\u064A]/.test(t)) return null;
  const has = (...ws: string[]) => ws.some((w) => (' ' + t + ' ').includes(' ' + w + ' ') || t.startsWith(w + ' ') || t === w);
  let m: RegExpMatchArray | null;
  if (has('مع السلامه', 'مع السلامة', 'الي اللقاء', 'وداعا')) return { intent: 'bye' };
  if (t.includes('السلام عليكم')) return { intent: 'salam' };
  if (t.includes('صباح الخير')) return { intent: 'sabah' };
  if (t.includes('مساء الخير')) return { intent: 'masa' };
  if ((m = t.match(/اسمي ([^ ]+)/))) return { intent: 'name', capture: m[1] };
  if ((m = t.match(/(?:انا )?من ([^ ]+)/)) && !t.includes('من فضل')) return { intent: 'origin', capture: m[1] };
  if ((m = t.match(/احب ([^ ]+(?: [^ ]+)?)/))) return { intent: 'likes', capture: m[1] };
  if (has('بخير', 'الحمد لله', 'كويس', 'تمام')) return { intent: 'fine' };
  if (has('كيف')) return { intent: 'howareyou' };
  if (has('شكرا')) return { intent: 'thanks' };
  if (has('مرحبا', 'اهلا', 'هلا')) return { intent: 'hello' };
  if (has('نعم', 'اجل')) return { intent: 'yes' };
  if (has('لا')) return { intent: 'no' };
  if ((m = t.match(/^انا ([^ ]+)$/))) return { intent: 'name', capture: m[1] };
  return { intent: 'other' };
}

/** 이미 라일라가 꺼낸 주제 (대화 기록의 NPC 문장으로 판단). 대화 중에 성별을 바꿨을 수 있어 두 형태를 다 본다. */
function askedTopics(req: ChatRequest): Set<string> {
  const said = req.history.filter((h) => h.role === 'npc').map((h) => looseNormalize(h.text));
  const out = new Set<string>();
  for (const topic of TOPICS) {
    const keys = (['m', 'f'] as const).map((g) => looseNormalize(topic.ask(g).ar));
    if (said.some((s) => keys.some((k) => s.includes(k)))) out.add(topic.id);
  }
  return out;
}

export function practiceReply(req: ChatRequest): NpcReply {
  const g = req.addressGender;
  const base = { source: 'practice' as const, provider: 'practice', correction: null };
  const nameFact = req.memory.facts.find((f) => f.kind === 'name');
  const asked = askedTopics(req);
  const nextTopic = TOPICS.find((t) => !asked.has(t.id) && !(t.id === 'name' && nameFact));

  // 대화 시작
  if (req.playerText === null) {
    // conversations에는 지금 연 대화도 포함되어 있다
    const greet = req.memory.conversations > 1 ? raw('أَهْلًا وَسَهْلًا!', '어서 와, 또 만나서 반가워!', 'ahlan wa-sahlan!') : join(L('s.marhaban'), raw('أَنَا لَيْلَى.', '저는 라일라예요.', 'anā laylā.'));
    return {
      ...base,
      reply: greet,
      understood: true,
      hint: { words: [L('w.marhaban'), L('w.ahlan')], contextKo: '라일라가 인사했어요. 인사로 대답해 보세요.', model: L('s.marhaban'), alternatives: [requireItem('s.salam').ar] },
      memoryCandidates: [],
      topic: '인사',
    };
  }

  const d = detect(req.playerText);
  const follow = nextTopic ? nextTopic.ask(g) : null;
  const followHint = nextTopic ? nextTopic.hint(g) : FAREWELL_HINT;
  const withFollow = (reaction: ArabicLine) => (follow ? join(reaction, follow) : reaction);
  // 못 알아들었을 때는 방금 꺼낸 주제의 힌트를 다시 준다
  const lastHint = () => {
    const last = [...TOPICS].reverse().find((t) => asked.has(t.id));
    return last ? last.hint(g) : TOPICS[0].hint(g);
  };

  if (!d) {
    return {
      ...base,
      reply: raw('عَفْوًا؟', '음… 아랍어로 말해 줄래요? 힌트를 봐도 괜찮아요!', 'ʿafwan?'),
      understood: false,
      hint: lastHint(),
      memoryCandidates: [],
      topic: '되묻기',
    };
  }

  const memoryCandidates: NpcReply['memoryCandidates'] = [];
  let reaction: ArabicLine;
  switch (d.intent) {
    case 'bye':
      return { ...base, reply: join(L('s.maa_salama'), L('s.ila_liqa')), understood: true, hint: FAREWELL_HINT, memoryCandidates: [], topic: '작별' };
    case 'salam':
      reaction = L('s.wa_alaykum');
      break;
    case 'sabah':
      reaction = L('s.sabah_nur');
      break;
    case 'masa':
      reaction = raw('مَسَاءَ النُّورِ.', '좋은 저녁이에요.', 'masāʾa n-nūr.');
      break;
    case 'hello':
      reaction = raw('أَهْلًا!', '반가워!', 'ahlan!');
      break;
    case 'howareyou':
      reaction = join(L('s.bikhayr'), L('s.hamdulillah'));
      break;
    case 'fine':
      reaction = L('s.hamdulillah');
      break;
    case 'name':
      reaction = L('s.tasharrafna');
      memoryCandidates.push({ kind: 'name', value: d.capture!, evidence: req.playerText });
      break;
    case 'origin':
      reaction = raw('أَهْلًا وَسَهْلًا!', '환영해!', 'ahlan wa-sahlan!');
      memoryCandidates.push({ kind: 'origin', value: d.capture!, evidence: req.playerText });
      break;
    case 'likes':
      reaction = raw('جَمِيلٌ!', '좋다!', 'jamīl!');
      memoryCandidates.push({ kind: 'likes', value: d.capture!, evidence: req.playerText });
      break;
    case 'thanks':
      reaction = raw('عَفْوًا!', '천만에!', 'ʿafwan!');
      break;
    case 'yes':
    case 'no':
      reaction = raw('حَسَنًا.', '그렇구나.', 'ḥasanan.');
      break;
    default:
      return {
        ...base,
        reply: raw('عَفْوًا؟ مَرَّةً أُخْرَى؟', '미안해요, 잘 못 알아들었어요. 한 번 더 말해 줄래요?', 'ʿafwan? marratan ukhrā?'),
        understood: false,
        hint: lastHint(),
        memoryCandidates: [],
        topic: '되묻기',
      };
  }

  return {
    ...base,
    reply: withFollow(reaction),
    understood: true,
    hint: followHint,
    memoryCandidates,
    topic: nextTopic?.topicKo ?? '작별',
  };
}
