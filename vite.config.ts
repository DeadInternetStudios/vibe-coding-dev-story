import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PORT ?? 5173),
    strictPort: false,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
    sourcemap: false,
  },
});
