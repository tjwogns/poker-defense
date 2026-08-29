import { describe, expect, test } from 'vitest';
import { newDeck } from '../src/core/cards/deck';
import { closestHiddenRecipe, hiddenRecipeProgress } from '../src/core/cards/hiddenRecipes';
import { HandRank } from '../src/core/cards/types';

describe('hidden hand recipe progress', () => {
  test('기본 덱은 파이브 카드가 복제 1장으로 가장 가깝다', () => {
    const recipes = hiddenRecipeProgress(newDeck());
    expect(recipes).toHaveLength(3);
    expect(recipes.find((recipe) => recipe.rank === HandRank.FiveKind)).toMatchObject({ progress: 4, missing: 1 });
    expect(recipes.find((recipe) => recipe.rank === HandRank.FlushHouse)).toMatchObject({ progress: 2, missing: 3 });
    expect(recipes.find((recipe) => recipe.rank === HandRank.FlushFive)).toMatchObject({ progress: 1, missing: 4 });
    expect(closestHiddenRecipe(newDeck())?.rank).toBe(HandRank.FiveKind);
  });

  test('동일 카드 복제는 플러시 파이브 진행도를 높이고 해당 카드를 추천한다', () => {
    const deck = newDeck();
    deck.push({ rank: 14, suit: 'S' }, { rank: 14, suit: 'S' }, { rank: 14, suit: 'S' });
    const flushFive = hiddenRecipeProgress(deck).find((recipe) => recipe.rank === HandRank.FlushFive)!;
    expect(flushFive).toMatchObject({ progress: 4, missing: 1, target: { rank: 14, suit: 'S' } });
    expect(closestHiddenRecipe(deck)?.rank).toBe(HandRank.FiveKind);
  });

  test('같은 무늬의 두 랭크를 복제하면 플러시 하우스 완성도를 계산한다', () => {
    const deck = newDeck();
    deck.push({ rank: 13, suit: 'H' }, { rank: 13, suit: 'H' }, { rank: 12, suit: 'H' });
    const house = hiddenRecipeProgress(deck).find((recipe) => recipe.rank === HandRank.FlushHouse)!;
    expect(house).toMatchObject({ progress: 5, missing: 0 });
  });
});
