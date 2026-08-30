import { HandRank, isHiddenHand } from '../core/cards/types';
import { RunSummary } from '../core/scoring';

export const PROFILE_KEY = 'poker-defense:v2:profile';
export const LEGACY_PROFILE_KEY = 'poker-defense:v2-beta:profile';

export type RunMode = 'standard' | 'daily';
export type AchievementId =
  | 'first_run'
  | 'boss_breaker'
  | 'hand_master'
  | 'relic_collector'
  | 'high_roller'
  | 'royal_victory';

export const ACHIEVEMENTS: Record<AchievementId, { name: string; description: string }> = {
  first_run: { name: '첫 수비', description: '게임을 한 판 완료하세요' },
  boss_breaker: { name: '보스 브레이커', description: '10라운드 이상 도달하세요' },
  hand_master: { name: '족보의 달인', description: '풀하우스 이상을 확정하세요' },
  relic_collector: { name: '수집가', description: '한 판에 유물 5개를 모으세요' },
  high_roller: { name: '하이 롤러', description: '한 판에 100,000점을 획득하세요' },
  royal_victory: { name: '왕좌의 수호자', description: '60라운드를 승리하세요' },
};

export interface Profile {
  version: 4;
  totalRuns: number;
  wins: number;
  bestScore: number;
  bestRound: number;
  tutorialDone: boolean;
  soundEnabled: boolean;
  achievements: AchievementId[];
  daily: { date: string; bestScore: number } | null;
  recentRuns: RunLog[];
  leaderboardPlayerId: string;
  leaderboardName: string;
  discoveredHands: HandRank[];
}

export interface RunLog {
  date: string;
  mode: RunMode;
  seed: number;
  score: number;
  round: number;
  result: 'victory' | 'defeat' | 'active';
  kills: number;
  bestHand: HandRank;
  relics: string[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function defaultProfile(): Profile {
  return {
    version: 4,
    totalRuns: 0,
    wins: 0,
    bestScore: 0,
    bestRound: 0,
    tutorialDone: false,
    soundEnabled: true,
    achievements: [],
    daily: null,
    recentRuns: [],
    leaderboardPlayerId: '',
    leaderboardName: '',
    discoveredHands: [],
  };
}

export function loadProfile(storage: StorageLike): Profile {
  try {
    const raw = storage.getItem(PROFILE_KEY) ?? storage.getItem(LEGACY_PROFILE_KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw) as Partial<Profile>;
    const base = defaultProfile();
    return {
      ...base,
      totalRuns: safeCount(parsed.totalRuns),
      wins: safeCount(parsed.wins),
      bestScore: safeCount(parsed.bestScore),
      bestRound: safeCount(parsed.bestRound),
      tutorialDone: typeof parsed.tutorialDone === 'boolean' ? parsed.tutorialDone : base.tutorialDone,
      soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : base.soundEnabled,
      achievements: Array.isArray(parsed.achievements)
        ? parsed.achievements.filter(isAchievement)
        : [],
      daily: isDaily(parsed.daily) ? parsed.daily : null,
      recentRuns: Array.isArray(parsed.recentRuns)
        ? parsed.recentRuns.filter(isRunLog).slice(-20)
        : [],
      leaderboardPlayerId: safeIdentityPart(parsed.leaderboardPlayerId, 100),
      leaderboardName: safeIdentityPart(parsed.leaderboardName, 30),
      discoveredHands: Array.isArray(parsed.discoveredHands)
        ? parsed.discoveredHands.filter(isHiddenHandValue)
        : [],
    };
  } catch {
    return defaultProfile();
  }
}

export function discoverHiddenHand(profile: Profile, rank: HandRank): { profile: Profile; discovered: boolean } {
  if (!isHiddenHand(rank) || profile.discoveredHands.includes(rank)) {
    return { profile, discovered: false };
  }
  return {
    profile: { ...profile, discoveredHands: [...profile.discoveredHands, rank] },
    discovered: true,
  };
}

const COMMANDER_ADJECTIVES = ['고요한', '황금빛', '용감한', '날쌘', '푸른', '붉은', '은빛', '영리한'];
const COMMANDER_NOUNS = ['스페이드', '하트', '다이아', '클로버', '조커', '에이스', '왕관', '방패'];

export function ensureLeaderboardIdentity(
  profile: Profile,
  idFactory: () => string = randomIdentity,
): Profile {
  if (profile.leaderboardPlayerId && profile.leaderboardName) return profile;
  const playerId = idFactory();
  const hash = dailySeed(playerId);
  const adjective = COMMANDER_ADJECTIVES[hash % COMMANDER_ADJECTIVES.length];
  const noun = COMMANDER_NOUNS[Math.floor(hash / COMMANDER_ADJECTIVES.length) % COMMANDER_NOUNS.length];
  const suffix = String(hash % 100).padStart(2, '0');
  return {
    ...profile,
    leaderboardPlayerId: playerId,
    leaderboardName: `${adjective} ${noun} ${suffix}`,
  };
}

/** 일일 도전 기준 날짜. 전 세계에서 같은 판을 쓰도록 한국 표준시로 고정한다. */
export function dailyDate(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60_000).toISOString().slice(0, 10);
}

export function saveProfile(storage: StorageLike, profile: Profile): boolean {
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

export function recordRun(
  profile: Profile,
  summary: RunSummary,
  mode: RunMode,
  date: string,
): Profile {
  const achievements = new Set(profile.achievements);
  achievements.add('first_run');
  if (summary.round >= 10) achievements.add('boss_breaker');
  if (summary.bestHand >= HandRank.FullHouse) achievements.add('hand_master');
  if (summary.relics.length >= 5) achievements.add('relic_collector');
  if (summary.score >= 100_000) achievements.add('high_roller');
  if (summary.result === 'victory') achievements.add('royal_victory');

  const priorDaily = profile.daily?.date === date ? profile.daily.bestScore : 0;
  return {
    ...profile,
    totalRuns: profile.totalRuns + 1,
    wins: profile.wins + (summary.result === 'victory' ? 1 : 0),
    bestScore: Math.max(profile.bestScore, summary.score),
    bestRound: Math.max(profile.bestRound, summary.round),
    achievements: [...achievements],
    daily: mode === 'daily'
      ? { date, bestScore: Math.max(priorDaily, summary.score) }
      : profile.daily,
    recentRuns: [
      ...profile.recentRuns,
      {
        date,
        mode,
        seed: summary.seed,
        score: summary.score,
        round: summary.round,
        result: summary.result,
        kills: summary.kills,
        bestHand: summary.bestHand,
        relics: [...summary.relics],
      },
    ].slice(-20),
  };
}

export function exportPlaytestData(profile: Profile, analyticsEvents: unknown[] = []): string {
  return JSON.stringify({
    schema: 'poker-defense-playtest-v2',
    aggregate: {
      totalRuns: profile.totalRuns,
      wins: profile.wins,
      bestScore: profile.bestScore,
      bestRound: profile.bestRound,
    },
    runs: profile.recentRuns,
    events: analyticsEvents,
  }, null, 2);
}

/** FNV-1a 32-bit: 날짜 문자열만으로 플랫폼 독립적인 양의 시드를 만든다. */
export function dailySeed(date: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < date.length; i++) {
    hash ^= date.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) || 1;
}

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function safeIdentityPart(value: unknown, maxLength: number): string {
  return typeof value === 'string' && value.length <= maxLength ? value : '';
}

function randomIdentity(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isAchievement(value: unknown): value is AchievementId {
  return typeof value === 'string' && value in ACHIEVEMENTS;
}

function isHiddenHandValue(value: unknown): value is HandRank {
  return typeof value === 'number' && isHiddenHand(value as HandRank);
}

function isDaily(value: unknown): value is { date: string; bestScore: number } {
  if (!value || typeof value !== 'object') return false;
  const daily = value as { date?: unknown; bestScore?: unknown };
  return typeof daily.date === 'string' && safeCount(daily.bestScore) === daily.bestScore;
}

function isRunLog(value: unknown): value is RunLog {
  if (!value || typeof value !== 'object') return false;
  const run = value as Partial<RunLog>;
  return typeof run.date === 'string'
    && (run.mode === 'standard' || run.mode === 'daily')
    && typeof run.seed === 'number'
    && typeof run.score === 'number'
    && typeof run.round === 'number'
    && (run.result === 'victory' || run.result === 'defeat' || run.result === 'active')
    && typeof run.kills === 'number'
    && typeof run.bestHand === 'number'
    && Array.isArray(run.relics);
}
