import type { ChatRequest, NpcReply } from '../../src/shared/conversation';
import { practiceReply } from '../../src/shared/practiceNpc';
import { config } from '../config';
import { ProviderError } from '../http';
import { anthropicConfigured, anthropicReply } from './anthropic';
import { PERSONAS } from './persona';

export function chatProviderInfo(): { provider: 'anthropic' | 'practice'; model?: string } {
  return anthropicConfigured() ? { provider: 'anthropic', model: config.chat.model } : { provider: 'practice' };
}

/**
 * NPC 응답 생성. AI 키가 없으면 연습 상대(모의)로 답하고 source='practice'로 표시한다.
 * AI 요청이 실패하면 가짜 응답으로 바꾸지 않고 오류를 그대로 돌려준다 (클라이언트가 다시 시도/연습 모드 선택).
 */
export async function npcReply(req: ChatRequest): Promise<NpcReply> {
  const persona = PERSONAS[req.npcId];
  if (!persona) throw new ProviderError('bad_request', '알 수 없는 주민입니다');
  if (!anthropicConfigured()) return practiceReply(req);
  return anthropicReply(req, persona);
}
