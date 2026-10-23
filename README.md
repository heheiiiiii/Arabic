# Arabic Village (프로토타입 v0.1)

아랍어(현대 표준 아랍어, MSA)를 배우러 작은 마을에 온 유학생이 되어
주민과 대화하고 공부하는 브라우저 생활 시뮬레이션 게임의 첫 프로토타입입니다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # TypeScript 검사
npm run build      # 타입 검사 + 프로덕션 빌드 (dist/)
npm run preview    # 빌드 결과 확인
```

Node 20.19+ 또는 22.12+ 가 필요합니다 (Vite 8).

## 조작

- 땅을 클릭/터치하면 그 위치로 걸어갑니다 (장애물은 자동으로 돌아감).
- 주민(라일라)을 누르면 다가가서 대화를 시작합니다.
- 빨간 지붕 집의 문을 누르면 집 안으로 들어갑니다. 책상을 누르면 공부 메뉴가 열립니다.
- 대화창: `Enter`/`Space`/화살표 = 다음, `Esc` = 닫기

## 구조

```
src/
  main.ts                 진입점: 시작 화면 → 게임 생성
  data/                   대화·단어 데이터 (콘텐츠는 여기만 고치면 됨)
  game/
    config.ts             타일 크기, 이동 속도, 상호작용 거리 등 상수
    createGame.ts         Phaser 설정
    state.ts              로컬 저장 (현재는 이름만)
    art/textures.ts       [임시] 코드로 그린 픽셀풍 텍스처
    world/                격자·경로 탐색, 맵 배치, 상호작용 인터페이스
    entities/             플레이어, 주민
    scenes/               Boot / Village / House + 공통 WorldScene
  ui/                     HTML/CSS UI (시작 화면, HUD, 대화창, 공부 메뉴)
  styles/main.css
```
