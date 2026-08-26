import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Codex/Claude가 보존한 git worktree의 동일 테스트를 중복 수집하지 않는다.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
});
