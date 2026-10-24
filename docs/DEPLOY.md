# Render 배포 (소규모: 5명 내외)

게임 페이지와 `/api` 서버를 Docker 이미지 하나로 Render에 올립니다. HTTPS 주소는 Render가 자동으로 만들어 줍니다. 마이크를 쓰려면 HTTPS가 필요합니다.

## 1. 처음 한 번만

1. https://render.com 에 가입하고 GitHub 계정을 연결합니다. 이 저장소에 접근할 수 있도록 허용해 주세요.
2. 결제 수단을 등록합니다. `render.yaml`은 **Starter 요금제(월 약 7달러)와 1GB 디스크(월 약 0.25달러)**를 씁니다.
   - 무료 요금제는 15분 동안 쓰지 않으면 잠들고, 다시 깨어나는 데 1분 가까이 걸립니다. 디스크도 붙일 수 없습니다.
3. Dashboard → **New → Blueprint**에서 이 저장소를 고릅니다. `render.yaml`을 읽어 `arabic-village` 서비스를 만듭니다.
4. 비밀 값을 입력하라는 화면이 나옵니다.
   - `ANTHROPIC_API_KEY`: 실제 AI 대화에 필요합니다. 비워 두면 연습 모드(모의)로 동작합니다.
   - `ACCESS_CODE`: 초대 코드입니다. 원하는 문자열을 넣으세요. 이 코드가 있어야 AI 대화를 쓸 수 있어서 비용을 지킬 수 있습니다.
5. **Apply**를 누르면 빌드와 배포가 시작됩니다. 처음에는 5~10분쯤 걸립니다.

## 2. 친구 초대

배포가 끝나면 `https://arabic-village-xxxx.onrender.com` 같은 주소가 생깁니다. 초대 링크는 다음과 같습니다.

```
https://<주소>/?access=<ACCESS_CODE>
```

이 링크로 한 번 들어오면 브라우저에 180일 동안 유지되는 쿠키가 저장됩니다. 코드가 없어도 게임, 책상 학습, 연습 모드, 기계 음성은 쓸 수 있습니다.

## 3. 그다음부터

- `main`에 병합할 때마다 자동으로 다시 배포됩니다(`autoDeploy: true`).
- 배포할 때마다 `/api/health`로 서버 상태를 확인합니다. 디스크가 붙은 서비스는 새 버전을 띄우기 전에 이전 버전을 먼저 멈추기 때문에, 배포하는 동안 1분쯤 접속이 끊길 수 있습니다.
- 다시 배포해도 서버 음성 캐시(`/data/tts-cache`)는 남습니다. 대화 기록과 학습 진도는 각자의 브라우저에 저장됩니다.

## 비용 보호 장치 (기본값)

| 항목 | 값 | 바꾸는 환경 변수 |
|---|---|---|
| 하루 전체 AI 모델 호출 | 300회 (`render.yaml`) | `AI_DAILY_LIMIT` |
| 음성 출력 | espeak-ng만 사용 (무료, 기계음) | `TTS_PROVIDERS`, `AZURE_SPEECH_*`, `OPENAI_API_KEY` |
| 분당 요청 | chat 60 / tts 200 / stt 45 | `CHAT_PER_MINUTE` 등 |

- 하루 상한은 서버 메모리에 저장됩니다. 그래서 다시 배포하거나 서버를 재시작하면 0으로 초기화됩니다.
- Render 앞단 프록시를 거치기 때문에 분당 상한은 모든 사용자가 함께 씁니다. 5명이면 충분합니다.
- 다른 환경 변수는 `.env.example`을 참고해서 Render 서비스의 **Environment** 탭에 추가하세요.

## 로컬에서 이미지 확인

```bash
docker build -t arabic-village .
docker run --rm -p 8787:8787 -e ACCESS_CODE=test arabic-village
# http://localhost:8787
```

GitHub Actions CI의 `docker` 작업도 PR마다 이미지를 빌드합니다. 그다음 게임 페이지, `/api/health`, 서버 음성(espeak-ng)이 동작하는지 확인합니다.
