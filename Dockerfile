# Arabic Village 운영 이미지: 빌드된 게임(dist/) + /api 서버(tsx)
# 음성 출력 기본값인 espeak-ng와 MP3 변환용 ffmpeg를 함께 설치한다.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends espeak-ng ffmpeg \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g tsx@4.23.15
WORKDIR /app
ENV NODE_ENV=production PORT=8787 TTS_CACHE_DIR=/data/tts-cache
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json tsconfig.json tsconfig.server.json ./
COPY server ./server
COPY src ./src
# 호스팅 디스크(/data)는 root 소유로 붙는 경우가 많아, 음성 캐시를 쓸 수 있도록 root로 실행한다.
RUN mkdir -p /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["tsx", "server/index.ts"]
