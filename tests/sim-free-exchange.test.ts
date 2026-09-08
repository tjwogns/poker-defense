import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { HandRank } from '../src/core/cards/types';

describe('free-exchange comparison CLI', () => {
  it('keeps baseline first-round behavior and spends free exchanges until Trips or exhaustion', () => {
    // Use the loader directly: tsx CLI IPC is unnecessary for this child process.
    const report = JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', 'src/sim/run.ts', '6', 'free-exchange-compare'],
      { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
    expect(report.ruleset).toBe('life-economy');
    expect(report.seeds).toEqual({ first: 1, last: 6 });
    expect(report.difficulties.map((d: { crownLevel: number }) => d.crownLevel)).toEqual([0, 1]);
    let extraExchangesObserved = 0;
    let earlyStopObserved = 0;
    for (const difficulty of report.difficulties) {
      expect(difficulty.seeds).toHaveLength(6);
      expect(difficulty.baseline.extraFreeExchanges).toBe(0);
      expect(difficulty.baseline.guardTerminated + difficulty.freeUntilTrips.guardTerminated).toBe(0);
      expect(Object.values(difficulty.paired).reduce<number>((sum, n) => sum + Number(n), 0)).toBe(6);
      for (const row of difficulty.seeds) {
        expect(row.baseline.prepExchanges[0].initialHand).toEqual(row.freeUntilTrips.prepExchanges[0].initialHand);
        expect(row.baseline.round1Exchanges).toBeLessThanOrEqual(1);
        const first = row.freeUntilTrips.prepExchanges[0];
        expect(first.exchangesUsed).toBeLessThanOrEqual(first.available);
        expect(first.confirmedRank >= HandRank.Trips || first.exchangesUsed === first.available).toBe(true);
        extraExchangesObserved += first.extraFreeExchanges;
        if (first.exchangesUsed < first.available) earlyStopObserved++;
        for (const arm of [row.baseline, row.freeUntilTrips]) {
          for (const prep of arm.prepExchanges) {
            expect(prep.exchangesUsed).toBeLessThanOrEqual(prep.available);
            expect(prep.extraFreeExchanges).toBeLessThanOrEqual(prep.exchangesUsed);
          }
        }
      }
      for (const policy of ['baseline', 'freeUntilTrips']) {
        const actual = difficulty.seeds.reduce((sum: number, row: any) =>
          sum + row[policy].prepExchanges.reduce((n: number, prep: any) => n + prep.exchangesUsed, 0), 0);
        expect(difficulty[policy].actualExchanges).toBe(actual);
      }
    }
    expect(extraExchangesObserved).toBeGreaterThan(0);
    expect(earlyStopObserved).toBeGreaterThan(0);
  }, 30_000);
});
