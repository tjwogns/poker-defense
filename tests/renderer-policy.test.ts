import { describe, expect, test } from 'vitest';
import { shouldUseCanvasRenderer } from '../src/game/rendererPolicy';

describe('renderer recovery policy', () => {
  test('평소에는 WebGL 자동 선택을 유지한다', () => {
    expect(shouldUseCanvasRenderer('', null)).toBe(false);
  });

  test('복구 화면에서 저장한 세션은 Canvas 안정 모드를 사용한다', () => {
    expect(shouldUseCanvasRenderer('', 'canvas')).toBe(true);
  });

  test('URL 진단 옵션이 저장된 모드보다 우선한다', () => {
    expect(shouldUseCanvasRenderer('?renderer=canvas', null)).toBe(true);
    expect(shouldUseCanvasRenderer('?renderer=webgl', 'canvas')).toBe(false);
  });
});
