# Arabic Village (v0.3)

아랍어(현대 표준 아랍어, MSA)를 배우러 작은 마을에 온 유학생이 되어, 주민 라일라와 **아랍어로 직접 말하고(음성·키보드)**,
**아랍어 음성으로 답을 들으며**, 집 책상에서 공부하는 브라우저 생활 시뮬레이션 게임입니다.

## 빠른 시작

```bash
npm install
npm run dev          # http://localhost:5173  (게임 + /api 서버가 한 프로세스에서 실행)
```

키가 하나도 없어도 실행됩니다. 이때 라일라와의 대화는 **연습 모드(모의)** 로 표시되는 규칙 기반 연습 상대가 맡고,
음성은 미리 만든 MP3와 로컬 `espeak-ng`로 재생됩니다.

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (Vite + API 미들웨어) |
| `npm run build` | 타입 검사(클라이언트·서버) + 프로덕션 빌드 (`dist/`) |
| `npm start` | 운영 서버: `dist/` + `/api/*` 제공 (`PORT`, 기본 8787) |
| `npm run typecheck` | 클라이언트·서버 타입 검사 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run test:e2e` | 브라우저 E2E (Playwright Chromium, espeak-ng·ffmpeg 필요) |
| `npm run audio:build` | 학습 문장 음성 MP3 미리 만들기 (`public/audio/tts/`, espeak-ng·ffmpeg 필요) |

Node 20.19+ / 22.12+ 필요. 로컬 음성: `apt-get install espeak-ng ffmpeg`.

## 기능 상태

| 기능 | 키 없이 | 필요한 설정 |
|---|---|---|
| 마을·이동·집·책상 학습·복습·진도 저장 | ✅ | - |
| 라일라 대화 – 연습 모드(모의, 정해진 표현 인식) | ✅ (서버 없어도 브라우저 안에서 동작) | - |
| 라일라 대화 – **실제 AI 자유 회화** | ❌ | `ANTHROPIC_API_KEY` |
| 음성 출력 – 브라우저 아랍어 음성 | 기기에 아랍어 음성이 있을 때 | - |
| 음성 출력 – 미리 만든 MP3 (학습 문장·연습 대화 210문장) | ✅ (정적 배포 포함) | - |
| 음성 출력 – 서버 합성 (AI 답변 등 새 문장) | ✅ espeak-ng (기계음) | 자연스러운 음성: `AZURE_SPEECH_KEY`+`AZURE_SPEECH_REGION` 또는 `OPENAI_API_KEY` |
| 음성 입력 – 브라우저 인식 (Chrome 등, ar-SA) | 브라우저 지원 시 | - |
| 음성 입력 – 서버 인식 (녹음 → 텍스트) | ❌ | `STT_API_KEY`/`OPENAI_API_KEY` (+ 선택 `STT_BASE_URL`) |

### AI 설정 (Anthropic)

1. https://console.anthropic.com 에서 API 키 발급
2. 서버 환경 변수로 설정 후 실행: `ANTHROPIC_API_KEY=sk-ant-... npm run dev` (운영: `npm start`)
3. 대화창 오른쪽 위 배지가 **🤖 실제 AI** 로 바뀌면 연결된 것입니다. 기본 모델 `claude-opus-5-5`, `AI_EFFORT=low`.

키는 서버에서만 읽으며 브라우저 번들·localStorage·응답으로 내보내지 않습니다. 모든 환경 변수는 `.env.example` 참고.
(서버는 `.env` 파일을 자동으로 읽지 않으니 셸이나 호스팅 플랫폼의 환경 변수로 설정하세요.)

## 아키텍처

```
src/                     브라우저 (Vite + TypeScript + Phaser 3, UI는 HTML/CSS)
  game/                  장면·이동·저장(state.ts: 저장 v4), settings.ts
  game/art/person.ts     도트 사람 그리기 (마을 텍스처와 첫 화면 미리보기가 공용, 머리·눈 모양)
  learning/              학습 콘텐츠(content/), 진도·복습·학습자 프로필, 아랍어 처리(arabic.ts)
  conversation/          대화 세션(session.ts), API 클라이언트(client.ts), 주민 기억·친밀도(memory.ts)
  audio/speech.ts        음성 출력: 브라우저 음성 ↔ 오디오 파일(미리 만든 MP3 → /api/tts) 자동 전환
  audio/recognizer.ts    음성 입력: 브라우저 SpeechRecognition / 녹음 → /api/stt
  shared/                서버·브라우저 공용: 회화 API 형식·검증(conversation.ts), 연습 상대(practiceNpc.ts), 해시, 문장 나누기
  ui/conversation/       자유 회화 창, 화면 아랍어 자판
  ui/study/              공부 책상 (단어·문장·복습·대화에서 만난 표현)
server/                  Node (tsx) — Web 표준 Request→Response 핸들러
  app.ts                 /api/health, /api/access, /api/chat, /api/tts, /api/stt + 사용량 제한·CORS
  access.ts              초대 코드(ACCESS_CODE) 확인과 쿠키
  chat/                  Anthropic 어댑터(구조화 출력, 하라카트 교정 단계), 프롬프트, NPC 성격(persona.ts)
  tts/                   espeak-ng(로컬) / Azure / OpenAI 어댑터 + 디스크 캐시
  stt/                   OpenAI 호환 음성 인식 어댑터
  index.ts               운영 서버 (dist + API)
scripts/build-audio.ts   학습 문장 음성 미리 만들기
```

개발 시에는 `vite.config.ts`의 플러그인이 같은 `handleApi`를 Vite 미들웨어로 연결합니다.

### 회화 흐름 (`ConversationSession`)

1. 대화창을 열면 `/api/health`로 모드 결정: **실제 AI** / **연습 모드(모의)**(서버에 AI 키 없음) / **오프라인 연습(모의)**(서버 없음)
2. 요청: 최근 대화 12턴 + 기억 요약 + 학습자 요약(`getLearnerProfile()` → 익숙한 표현·복습 필요 표현·본 표현, 단원, 수준) + 플레이어 성별(`m`/`f`, 라일라가 이 성별로 부른다)
3. 서버(AI): 구조화된 JSON 출력 → `parseReplyBody` 검증 → 하라카트 자동 검사(`findDiacriticIssues`) → 의심 문장만 부호 교정 1회(글자가 바뀌면 거부) → 남은 의심은 `diacriticsWarning`으로 UI 경고
4. 클라이언트 게임 로직만 상태 변경: 친밀도(아랍어로 말할 때 +1, 하루 상한 6, 감점 없음), 기억(AI 제안 중 **플레이어가 실제로 한 말에 근거가 있는 것만** 저장), 대화에서 들은 학습 항목 기록(`recordHeard`, 학습 완료 아님)
5. 실패 처리: 네트워크 단절 → 오프라인 연습으로 전환(명시), 그 밖의 오류(키 없음·제한 초과·서버 오류·시간 초과·잘못된 응답) → 종류 안내 + 다시 시도 / 연습 모드로 계속 (자동으로 가짜 응답을 넣지 않음)

### 주요 인터페이스 (다음 작업자를 위해)

- `getLearnerProfile()` (`src/learning/index.ts`): encountered / reviewed / comfortable / needsReview / heardNotStudied
- `learning()`: `markStudied`, `recordAnswer`, `recordHeard`, `savePhrase`, `stats()`
- `ConversationSession` (`src/conversation/session.ts`): `open()`, `send(text, viaVoice)`, `retry()`, `switchToPractice()`, `close()`
- `speech.speakSequence(texts, key)` / `speech.stop()` (`src/audio/speech.ts`)
- `VoiceInput.start(engine, callbacks)` / `.stop()` / `.cancel()` (`src/audio/recognizer.ts`)
- 새 주민: `server/chat/persona.ts`에 성격 추가 + 마을에 `Villager` 배치 (기억은 `npcs[npcId]`에 따로 저장)
- 새 공급자: `server/tts/types.ts`의 `TtsProvider` 구현 후 `tts/index.ts`에 등록 / `server/chat/anthropic.ts`를 본떠 채팅 공급자 추가

### 저장 데이터 (`localStorage['arabic-village:v1']`, version 4)

`{ version, playerName, player: { gender, appearance: { hairStyle, eyes } }, learning: { items, heard, saved, position }, npcs: { layla: { facts, recent, topics, conversations, friendship, … } }, settings }`
v1(이름만)·v2(학습 기록)·v3(성별이 대화 설정에 있던 형식) 데이터는 자동 이전되고, 더 새로운 버전은 덮어쓰지 않습니다. 녹음 원본은 어디에도 저장하지 않습니다.
성별(남/여)과 외형(머리·눈 모양)은 첫 화면에서 고릅니다. 성별은 꼭 골라야 하며(v3에서 '지정 안 함'이었다면 다시 고름), 대화창 설정에서도 바꿀 수 있고 연습 상대·AI 대화·책상 학습 설명에 모두 같은 값이 쓰입니다.
대화창 **설정**에서 기억 보기·잊게 하기·관계 초기화·대화 기록 지우기를 할 수 있습니다.

## 아랍어 표기 원칙

- `ar` = 학습용 표기(모음 부호 완전 표시), `plain` = 일반 표기(없으면 부호만 제거해 생성). Unicode 정규화·문자열 뒤집기 없음, 방향은 `dir`/CSS로만.
- 비교는 `comparisonKey` / `looseNormalize`로 부호·함자 자리·문장부호 차이를 무시 → 음성 인식 결과(부호 없음)도 정상 비교.
- 학습 콘텐츠·연습 상대 문장은 자동 형식 검사를 통과한 검토 문장만 사용. AI 문장은 자동 검사 + 교정 단계만 거치며, **원어민 검수는 받지 않았습니다.**

## 배포 안내

- **HTTPS 필수 (마이크)**: 브라우저는 HTTPS 또는 `localhost`에서만 마이크를 허용합니다. 리버스 프록시(예: Caddy, Nginx)나 플랫폼의 HTTPS 뒤에서 `npm start`를 실행하세요.
- **환경 변수**: 키는 서버 환경 변수로만. `.env`는 `.gitignore`에 포함되어 있습니다.
- **CORS**: 기본은 같은 출처만. 게임 페이지와 API가 다른 도메인이면 `ALLOWED_ORIGINS`에 페이지 주소를 넣으세요.
- **초대 코드**: `ACCESS_CODE`를 설정하면 코드를 입력한 브라우저만 실제 AI 대화·유료 음성(Azure·OpenAI)·서버 음성 인식을 씁니다. 초대 링크 `https://게임주소/?access=코드`로 들어오거나 대화 설정에서 입력하면, 서버가 HttpOnly 쿠키(180일)를 줍니다. 코드가 없어도 게임·학습·연습 모드·espeak-ng 음성은 동작합니다. 쿠키를 쓰므로 게임 페이지와 API가 같은 주소여야 합니다.
- **사용량 제한**: IP당 분당 chat 60 / tts 200 / stt 45 (`CHAT_PER_MINUTE` 등으로 변경). 리버스 프록시 뒤에서는 모든 사용자가 프록시 IP 하나로 보여 이 상한을 함께 씁니다. 하루 전체 상한: AI 모델 호출 `AI_DAILY_LIMIT`(기본 500, 하라카트 교정 호출 포함), 유료 음성 새로 만들기 `TTS_DAILY_LIMIT`(기본 2000, 넘으면 espeak-ng), 서버 음성 인식 `STT_DAILY_LIMIT`(기본 300). 메모리 기반이라 서버를 다시 시작하면 초기화되고, 인스턴스가 여러 개면 공용 저장소(Redis 등) 기반으로 바꿔야 합니다.
- **요청 제한**: 대화 본문 24KB, 플레이어 문장 300자, 녹음 2MB·15초, TTS 문장 400자, 서버 AI 시간 제한 30초(클라이언트 45초).
- **정적 호스팅만 할 때**: `npm run build` 결과만 올려도 학습·연습 대화·미리 만든 음성은 동작합니다(오프라인 연습 모드). AI·서버 음성·서버 인식은 동작하지 않습니다.

## 의존성 추가 이유

- `@anthropic-ai/sdk`: Claude 호출(서버 전용, 브라우저 번들에 포함되지 않음)
- `tsx`: 서버 TypeScript 실행 / `@types/node`: 서버 타입
- `vitest`, `playwright`: 테스트

## 알려진 제한

- 실제 Claude API·Azure·OpenAI 음성 공급자 호출은 키가 없어 **검증하지 못했습니다** (모의 서버로 요청 형식·오류 처리만 검증).
- 로컬 `espeak-ng` 아랍어 음성은 기계음이며 MSA 발음 품질이 낮습니다. 자연스러운 음성은 Azure `ar-SA-*Neural` 등 클라우드 공급자를 권장합니다.
- 실제 아랍어 음성 인식 정확도는 검증하지 못했습니다 (서버 인식 공급자 미설정, 헤드리스 브라우저의 내장 인식은 서비스에 연결되지 않음).
- 연습 모드(모의)는 정해진 표현만 알아듣고 교정 기능이 없습니다.
