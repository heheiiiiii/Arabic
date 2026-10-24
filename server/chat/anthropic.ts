import Anthropic from '@anthropic-ai/sdk';
import { parseReplyBody, type ChatRequest, type NpcReply } from '../../src/shared/conversation';
import { config } from '../config';
import { ProviderError } from '../http';
import { arabicFields, sameLetters, suspiciousArabic } from './diacritics';
import type { Persona } from './persona';
import { dynamicContext, REPLY_SCHEMA, stableInstructions, toMessages } from './prompt';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!config.chat.anthropicKey) throw new ProviderError('not_configured', 'ANTHROPIC_API_KEY가 설정되지 않았습니다');
  // 키와 주소를 명시적으로 넘겨, 개발 도구가 설정한 ANTHROPIC_BASE_URL/AUTH_TOKEN이 섞이지 않게 한다.
  client ??= new Anthropic({
    apiKey: config.chat.anthropicKey,
    authToken: null,
    baseURL: config.chat.anthropicBaseUrl,
    timeout: config.chat.timeoutMs,
    maxRetries: 1,
  });
  return client;
}

export function anthropicConfigured(): boolean {
  return !!config.chat.anthropicKey;
}

function mapError(e: unknown): ProviderError {
  if (e instanceof ProviderError) return e;
  if (e instanceof Anthropic.RateLimitError) return new ProviderError('rate_limited', 'AI 사용량 제한에 걸렸습니다. 잠시 후 다시 시도해 주세요.');
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new ProviderError('not_configured', 'AI 키가 올바르지 않습니다');
  if (e instanceof Anthropic.APIConnectionTimeoutError) return new ProviderError('timeout', 'AI 응답 시간이 초과되었습니다');
  if (e instanceof Anthropic.BadRequestError) return new ProviderError('provider_error', 'AI 요청이 거부되었습니다 (요청 형식)');
  if (e instanceof Anthropic.APIConnectionError) return new ProviderError('provider_error', 'AI 서버에 연결하지 못했습니다');
  if (e instanceof Anthropic.APIError) return new ProviderError('provider_error', `AI 서버 오류 (${e.status ?? '?'})`);
  return new ProviderError('provider_error', 'AI 요청 중 알 수 없는 오류가 발생했습니다');
}

async function callJson(system: Anthropic.Beta.BetaTextBlockParam[], messages: Anthropic.Beta.BetaMessageParam[], schema: object, maxTokens: number) {
  const res = await getClient().beta.messages.create({
    model: config.chat.model,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages,
    output_config: { effort: config.chat.effort, format: { type: 'json_schema', schema: schema as Record<string, unknown> } },
  });
  if (res.stop_reason === 'refusal') throw new ProviderError('provider_error', 'AI가 이 요청에 답하지 않았습니다. 다른 말로 다시 시도해 주세요.');
  if (res.stop_reason === 'max_tokens') throw new ProviderError('invalid_response', 'AI 응답이 너무 길어 잘렸습니다');
  const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  try {
    return { json: JSON.parse(text) as unknown, model: res.model };
  } catch {
    throw new ProviderError('invalid_response', 'AI 응답을 해석하지 못했습니다');
  }
}

const REPAIR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['lines'],
  properties: { lines: { type: 'array', items: { type: 'string' } } },
};

/**
 * 하라카트 교정 단계: 자동 검사에 걸린 문장만 모아 한 번 더 부호만 고치게 한다.
 * 글자가 바뀐 교정은 받아들이지 않는다 (의미가 바뀌는 것 방지).
 */
async function repairDiacritics(body: Omit<NpcReply, 'source' | 'provider' | 'model'>): Promise<string[]> {
  const fields = arabicFields(body).filter((f) => suspiciousArabic(f.text));
  if (fields.length === 0) return [];
  try {
    const { json } = await callJson(
      [{ type: 'text', text: 'You are an expert in Modern Standard Arabic orthography. For each input line, return the same line with complete and grammatically correct harakat (including case endings, shadda, sukun, tanwin). Do not change, add or remove any letters or words. Return lines in the same order.' }],
      [{ role: 'user', content: JSON.stringify(fields.map((f) => f.text)) }],
      REPAIR_SCHEMA,
      2000,
    );
    const lines = (json as { lines?: unknown }).lines;
    if (Array.isArray(lines)) {
      fields.forEach((f, i) => {
        const fixed = lines[i];
        if (typeof fixed !== 'string' || !sameLetters(fixed, f.text) || suspiciousArabic(fixed)) return;
        setField(body, f.path, fixed);
      });
    }
  } catch {
    // 교정 실패는 치명적이지 않다: 경고만 남긴다
  }
  return arabicFields(body).filter((f) => suspiciousArabic(f.text)).map((f) => f.text);
}

function setField(body: Omit<NpcReply, 'source' | 'provider' | 'model'>, path: string, value: string) {
  if (path === 'reply') body.reply.ar = value;
  else if (path === 'hint.model') body.hint.model.ar = value;
  else if (path === 'correction.better' && body.correction) body.correction.better.ar = value;
  else if (path.startsWith('hint.alternatives.')) body.hint.alternatives[Number(path.split('.')[2])] = value;
  else if (path.startsWith('hint.words.')) body.hint.words[Number(path.split('.')[2])].ar = value;
}

export async function anthropicReply(req: ChatRequest, persona: Persona): Promise<NpcReply> {
  try {
    const { json, model } = await callJson(
      [
        { type: 'text', text: stableInstructions(persona), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: dynamicContext(req) },
      ],
      toMessages(req),
      REPLY_SCHEMA,
      4000,
    );
    const body = parseReplyBody(json);
    if (!body) throw new ProviderError('invalid_response', 'AI 응답 형식이 올바르지 않습니다');
    const warnings = await repairDiacritics(body);
    return { ...body, source: 'ai', provider: 'anthropic', model, ...(warnings.length ? { diacriticsWarning: warnings } : {}) };
  } catch (e) {
    throw mapError(e);
  }
}
