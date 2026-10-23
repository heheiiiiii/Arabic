import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true, port: 5173 },
  build: {
    // Phaser는 단일 청크로 1MB를 넘기므로 경고 기준만 올린다.
    chunkSizeWarningLimit: 1600,
  },
});
