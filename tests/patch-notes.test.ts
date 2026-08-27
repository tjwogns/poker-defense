import { describe, expect, test } from 'vitest';
import { CURRENT_VERSION, PATCH_NOTES } from '../src/meta/patchNotes';

describe('patch notes', () => {
  test('현재 버전이 최신 패치 노트와 일치한다', () => {
    expect(PATCH_NOTES[0].version).toBe(CURRENT_VERSION);
    expect(PATCH_NOTES[0].current).toBe(true);
  });

  test('버전은 중복되지 않고 최신 항목에 내용이 있다', () => {
    expect(new Set(PATCH_NOTES.map((note) => note.version)).size).toBe(PATCH_NOTES.length);
    expect(PATCH_NOTES[0].sections.flatMap((section) => section.items).length).toBeGreaterThanOrEqual(5);
  });
});
