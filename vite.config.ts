import { defineConfig, type Plugin } from 'vite';

/** 개발 서버(npm run dev)와 미리보기(npm run preview)에서 /api/* 를 같은 프로세스로 처리한다. */
function villageApi(): Plugin {
  const mount = async (use: (fn: (req: never, res: never, next: () => void) => void) => void) => {
    const { nodeApiHandler } = await import('./server/node');
    use(((req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => {
      if (!req.url?.startsWith('/api/')) return next();
      nodeApiHandler(req, res).catch((e) => {
        console.error(e);
        res.statusCode = 500;
        res.end();
      });
    }) as never);
  };
  return {
    name: 'village-api',
    async configureServer(server) {
      await mount((fn) => server.middlewares.use(fn));
    },
    async configurePreviewServer(server) {
      await mount((fn) => server.middlewares.use(fn));
    },
  };
}

export default defineConfig({
  plugins: [villageApi()],
  server: { host: true, port: 5173 },
  build: {
    // Phaser는 단일 청크로 1MB를 넘기므로 경고 기준만 올린다.
    chunkSizeWarningLimit: 1600,
  },
});
