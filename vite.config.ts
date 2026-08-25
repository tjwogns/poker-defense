import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLEFILE=1 빌드는 아티팩트/단일 파일 배포용 (모든 JS를 index.html에 인라인)
export default defineConfig({
  base: './',
  plugins: process.env.SINGLEFILE ? [viteSingleFile()] : [],
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
