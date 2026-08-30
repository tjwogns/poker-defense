import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Pages는 새 배포 때 이전 해시 번들을 제거한다. 브라우저가 캐시한 이전 HTML이
// 삭제된 JS를 가리켜 빈 화면이 되는 일을 막기 위해 CI 배포본은 코드를 인라인한다.
const singleFile = Boolean(process.env.SINGLEFILE || process.env.GITHUB_ACTIONS);

export default defineConfig({
  base: './',
  plugins: singleFile ? [viteSingleFile()] : [],
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
