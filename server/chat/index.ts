import type { ChatRequest, NpcReply } from '../../src/shared/conversation';
import { practiceReply } from '../../src/shared/practiceNpc';
import { config } from '../config';
import { ProviderError } from '../http';
import { anthropicConfigured, anthropicReply } from './anthropic';
import { PERSONAS } from './persona';

/** @param paid 유료 기능을 써도 되는지 (초대 코드). 아니면 키가 있어도 연습 상대로 보고한다 */
export function chatProviderInfo(paid = true): { provider: 'anthropic' | 'practice'; model?: string } {
  return paid && anthropicConfigured() ? { provider: 'anthropic', model: config.chat.model } : { provider: 'practice' };
}

/**
 * NPC 응답 생성. AI 키가 없으면 연습 상대(모의)로 답하고 source='practice'로 표시한다.
 * 초대 코드가 필요한데 없는 경우(paid=false)도 연습 상대로 답한다 (/api/health가 이미 practice로 알린다).
 * AI 요청이 실패하면 가짜 응답으로 바꾸지 않고 오류를 그대로 돌려준다 (클라이언트가 다시 시도/연습 모드 선택).
 */
export async function npcReply(req: ChatRequest, paid = true): Promise<NpcReply> {
  const persona = PERSONAS[req.npcId];
  if (!persona) throw new ProviderError('bad_request', '알 수 없는 주민입니다');
  if (!paid || !anthropicConfigured()) return practiceReply(req);
  return anthropicReply(req, persona);
}
