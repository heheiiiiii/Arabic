# Arabic Village (v0.2)

아랍어(현대 표준 아랍어, MSA)를 배우러 작은 마을에 온 유학생이 되어
주민과 대화하고, 집 책상에서 공부하며 회화 실력을 키우는 브라우저 생활 시뮬레이션 게임입니다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # TypeScript 검사
npm run build      # 타입 검사 + 프로덕션 빌드 (dist/)
npm test           # 단위 테스트 (Vitest): 콘텐츠·모음 부호 검사, 진도, 복습 문제, 저장, 음성
npm run test:e2e   # 브라우저 E2E (Playwright + Chromium). E2E_SHOTS=폴더 를 주면 스크린샷 저장
```

Node 20.19+ 또는 22.12+ 가 필요합니다 (Vite 8). E2E는 Playwright Chromium이 설치되어 있어야 합니다.

## 조작

- 땅을 클릭/터치하면 그 위치로 걸어갑니다. 주민(라일라)을 누르면 대화, 빨간 지붕 집 문을 누르면 집 안으로.
- 집 안 책상을 누르면 공부 메뉴: 새 단어 / 새 문장 / 복습. `Esc` 닫기, 학습 화면 `←/→`, 복습 `1~4`.

## 학습 시스템

| 위치 | 내용 |
|---|---|
| `src/learning/content/` | 단원·단어·문장·문맥 문제 데이터. 코드 다른 곳에 아랍어 학습 문장을 하드코딩하지 않는다. |
| `src/learning/arabic.ts` | 부호 제거(일반 표기), 비교 키, 모음 부호 형식 검사기 |
| `src/learning/progress.ts` | 진도·간격 반복(Leitner 0~5단계). "본 것(seen)"과 "맞힌 것"을 구분 |
| `src/learning/review.ts` | 객관식 복습 문제 생성 (4유형, 정답 위치 무작위) |
| `src/learning/profile.ts` | 다음 단계 AI 회화용 학습자 프로필 `getLearnerProfile()` |
| `src/audio/speech.ts` | 브라우저 음성 출력 (Web Speech API) |
| `src/ui/study/` | 공부 책상 UI (메뉴·현황, 단어/문장 학습, 복습) |

### 아랍어 표기 원칙

- `ar`는 학습용 표기(모음 부호 완전 표시), `plain`은 일반 표기(없으면 `ar`에서 부호만 제거해 생성).
- 명사·형용사 단어는 사전형인 비한정 주격(탄윈 -un)으로 적고, 문장은 문맥의 격을 그대로 적는다.
- 데이터에 Unicode 정규화를 적용하지 않고, 문자열을 뒤집거나 재배열하지 않는다 (방향은 `dir`/CSS로만 처리).
- 소스 코드의 결합 부호는 `َ`처럼 이스케이프로 적는다.
- `npm test`가 모든 학습 문자열의 부호 형식, 참조 무결성, 정규화 후 부호 보존을 검사하고,
  E2E가 실제 글꼴로 부호가 줄 상자 밖으로 넘치지 않는지 측정한다.
- **원어민 검수는 아직 받지 않았다.** 표기는 표준 문법을 기준으로 직접 검토했다.

### 저장 데이터

`localStorage['arabic-village:v1']` 에 `{ version: 2, playerName, learning }` 형식으로 저장한다.
1단계의 `{ playerName }` 데이터는 자동으로 version 2로 옮기고, 더 새로운 버전의 데이터는 덮어쓰지 않는다.
