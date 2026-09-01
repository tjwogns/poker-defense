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

  test('세로 화면을 회전 안내로 막지 않는다', () => {
    expect(html).not.toContain('id="rotate"');
    expect(html).not.toContain('화면을 가로로 돌려주세요');
    expect(html).toContain('(max-width: 359px)');
  });

  test('모바일 주소창 변화와 터치 스크롤을 제어한다', () => {
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('height: 100dvh');
    expect(html).toContain('touch-action: none');
  });

  test('게임 준비 중 빈 화면 대신 즉시 로딩 안내를 표시한다', () => {
    expect(html).toContain('id="boot-splash"');
    expect(html).toContain('왕국과 카드 군단을 불러오는 중');
    expect(html).toContain('role="status"');
  });

  test('WebGL 손실 시 캔버스 밖에서 복구와 안정 모드 진입을 안내한다', () => {
    expect(html).toContain('id="renderer-recovery"');
    expect(html).toContain('그래픽 장치를 복구하는 중입니다');
    expect(html).toContain('id="renderer-safe-mode"');
    expect(html).toContain('안정 모드로 다시 시작');
  });
});
