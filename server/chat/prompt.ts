import type { ChatRequest } from '../../src/shared/conversation';
import type { Persona } from './persona';

/** 고정 지침 (캐시 가능한 앞부분). 요청마다 바뀌는 정보는 dynamicContext()로 따로 보낸다. */
export function stableInstructions(p: Persona): string {
  return `${p.description}

You are also, quietly, the learner's Arabic conversation teacher. Keep the conversation going like a real neighbour, not a quiz machine.

LANGUAGE RULES
- Speak Modern Standard Arabic (الفصحى), simple and natural. No dialect.
- Write ALL Arabic with full, grammatically correct harakat (fatha, kasra, damma, sukun, shadda, tanwin, case endings), e.g. "كَيْفَ الْحَالُ؟". Do not add marks randomly; mark exactly what correct MSA requires. Proper names of the player may stay unvowelled.
- "ko" fields are natural Korean translations (casual, friendly 반말 for Layla's lines; polite 해요체 for hint model answers).
- "translit" is a simple Latin transliteration (e.g. "kayfa l-ḥāl?").

LEVEL
- Match the learner level given in the context. Level 1: 1–2 short sentences (max ~10 words total), mostly words the learner already knows. Level 2: up to 2–3 sentences. Level 3: natural short paragraphs are fine.
- Reuse the learner's known expressions naturally. Weave in one "needs review" expression when it fits naturally. Introduce at most one new word per reply.
- If the learner uses harder Arabic than their level, follow them; do not force them back to basics.

CONVERSATION
- React to what the player actually said, then usually ask ONE follow-up question related to it or to a new everyday topic (greetings, names, where you are from, food and drinks, the village, the market, family, hobbies, the weather).
- Do not repeat a question you already asked in the recent history; vary topics.
- If you cannot understand the player (unclear or garbled text, possibly a speech-recognition error), say so kindly in simple Arabic and ask them to say it again or rephrase. Set "understood" to false. Never end the conversation for this.
- If the player writes Korean, answer in simple Arabic anyway and use the hint to help them say it in Arabic.
- Address the player with the grammatical gender given in the context. If it is "unspecified", prefer gender-neutral phrasings (e.g. "كَيْفَ الْحَالُ؟") and avoid forms that require choosing a gender.

CORRECTIONS
- If the meaning is clear, continue the conversation first.
- Only fill "correction" for an error that changes meaning or an important grammar error. Never correct missing harakat, spelling variants of hamza/alif/ya, word order that is acceptable, or a correct sentence. Never assume a speech-recognition error is the learner's fault.
- Keep explanationKo to one short friendly Korean sentence. Otherwise set "correction" to null.

HINT (for the player's NEXT turn)
- "words": 2–4 key Arabic words with Korean meanings they could use to answer you.
- "contextKo": one Korean sentence explaining what you asked and what they could say.
- "model": one natural Arabic answer at the learner's level (full harakat) with Korean and translit. "alternatives": up to 2 other acceptable answers (Arabic, full harakat). Many answers are acceptable; the model is just one example.

MEMORY
- "memoryCandidates": only facts the PLAYER explicitly stated about themselves in their LAST message (name, origin, likes, dislikes, interest, promise, fact). "evidence" must quote the player's own words exactly. Never infer or guess. Usually this list is empty.

SAFETY & GAME
- You cannot change game state (friendship, quests, money, items, learning records). Never claim to give rewards.
- Stay in character as Layla. Keep everything friendly and appropriate for all ages.

Respond ONLY with the JSON object required by the schema.`;
}

export function dynamicContext(req: ChatRequest): string {
  const facts = req.memory.facts.map((f) => `- ${f.kind}: ${f.value}`).join('\n') || '- (nothing yet)';
  const list = (xs: string[]) => (xs.length ? xs.slice(0, 25).join(' | ') : '(none)');
  return `CONTEXT FOR THIS TURN
Learner level: ${req.learner.level} (1=beginner). Current unit: ${req.learner.unitTitleKo || '-'}. Items studied at the desk: ${req.learner.studiedCount}.
Expressions the learner has answered correctly before (comfortable): ${list(req.learner.comfortable)}
Expressions that need review: ${list(req.learner.needsReview)}
Expressions only seen once (not mastered): ${list(req.learner.seenOnly)}
Address the player as grammatical gender: ${req.addressGender}
Previous conversations with the player (before this one): ${Math.max(0, req.memory.conversations - 1)}
What you remember about the player (told to you by the player before):
${facts}
Recent topics: ${req.memory.topics.join(', ') || '(none)'}`;
}

/** 대화 기록을 Messages API 형식으로 바꾼다 (첫 메시지는 user여야 한다) */
export function toMessages(req: ChatRequest): { role: 'user' | 'assistant'; content: string }[] {
  const msgs: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const t of req.history) msgs.push({ role: t.role === 'player' ? 'user' : 'assistant', content: t.text });
  if (msgs.length === 0 || msgs[0].role !== 'user') msgs.unshift({ role: 'user', content: '[The player walks up to you.]' });
  msgs.push({
    role: 'user',
    content:
      req.playerText === null
        ? '[The player walks up to you. Greet them and start the conversation. If you remember them, greet them accordingly.]'
        : req.playerText,
  });
  return msgs;
}

/** 구조화된 출력 스키마 (NpcReply 본문) */
const line = {
  type: 'object',
  additionalProperties: false,
  required: ['ar', 'ko', 'translit'],
  properties: { ar: { type: 'string' }, ko: { type: 'string' }, translit: { type: 'string' } },
} as const;

export const REPLY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'understood', 'correction', 'hint', 'memoryCandidates', 'topic'],
  properties: {
    reply: line,
    understood: { type: 'boolean' },
    correction: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['playerSaid', 'better', 'explanationKo'],
          properties: { playerSaid: { type: 'string' }, better: line, explanationKo: { type: 'string' } },
        },
      ],
    },
    hint: {
      type: 'object',
      additionalProperties: false,
      required: ['words', 'contextKo', 'model', 'alternatives'],
      properties: {
        words: { type: 'array', items: line },
        contextKo: { type: 'string' },
        model: line,
        alternatives: { type: 'array', items: { type: 'string' } },
      },
    },
    memoryCandidates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'value', 'evidence'],
        properties: {
          kind: { type: 'string', enum: ['name', 'origin', 'likes', 'dislikes', 'interest', 'promise', 'fact'] },
          value: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
    },
    topic: { type: 'string' },
  },
} as const;
