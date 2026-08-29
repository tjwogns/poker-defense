import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('mobile shell', () => {
  test('일반 가로 휴대폰은 실행하고 극단적으로 작은 화면만 차단한다', () => {
    expect(html).toContain('(max-width: 599px)');
    expect(html).toContain('(max-height: 279px)');
    expect(html).not.toContain('(max-width: 959px)');
    expect(html).not.toContain('(max-height: 519px)');
  });

  test('모바일 주소창 변화와 터치 스크롤을 제어한다', () => {
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('height: 100dvh');
    expect(html).toContain('touch-action: none');
  });
});
