export const PERFECT_DEFENSE_SCORE_STEP = 100;

export interface FormationMasteryState {
  streak: number;
  bestStreak: number;
  perfectCount: number;
  score: number;
}

export interface FormationRoundResult {
  perfect: boolean;
  streak: number;
  scoreBonus: number;
}

export const FORMATION_MASTERY_COPY = {
  perfect: { ko: '완벽 방어', en: 'PERFECT DEFENSE' },
  lost: { ko: '완벽 방어 실패', en: 'PERFECT LOST' },
  streak: { ko: '연속', en: 'STREAK' },
  nextEnemies: { ko: '다음 적', en: 'NEXT' },
  result: { ko: '완벽 진형', en: 'PERFECT FORMATIONS' },
  best: { ko: '최고 연속', en: 'BEST STREAK' },
} as const;

export function createFormationMasteryState(): FormationMasteryState {
  return { streak: 0, bestStreak: 0, perfectCount: 0, score: 0 };
}

/** 비진형은 완전 중립이며, 진형은 클리어와 현재 라운드 출신 침투 0을 모두 요구한다. */
export function resolveFormationRound(
  state: Readonly<FormationMasteryState>,
  formation: boolean,
  roundCleared: boolean,
  currentRoundEscaped: number,
): { state: FormationMasteryState; result: FormationRoundResult | null } {
  if (!formation) return { state: { ...state }, result: null };
  const perfect = roundCleared && currentRoundEscaped === 0;
  if (!perfect) {
    return {
      state: { ...state, streak: 0 },
      result: { perfect: false, streak: 0, scoreBonus: 0 },
    };
  }
  const streak = state.streak + 1;
  const scoreBonus = PERFECT_DEFENSE_SCORE_STEP * streak;
  return {
    state: {
      streak,
      bestStreak: Math.max(state.bestStreak, streak),
      perfectCount: state.perfectCount + 1,
      score: state.score + scoreBonus,
    },
    result: { perfect: true, streak, scoreBonus },
  };
}
