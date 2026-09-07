export function attackFxBudget(compactTouch: boolean): number {
  return compactTouch ? 26 : 40;
}

export function totalFxBudget(compactTouch: boolean): number {
  return compactTouch ? 44 : 60;
}

export function tacticFeedbackBudget(compactTouch: boolean): number {
  return compactTouch ? 1 : 2;
}

export function canCreateTacticFeedback(activeCount: number, compactTouch: boolean): boolean {
  return activeCount < tacticFeedbackBudget(compactTouch);
}
