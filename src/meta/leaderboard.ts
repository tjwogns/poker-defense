import { RunSummary } from '../core/scoring';

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  round: number;
  result: 'victory' | 'defeat';
  submittedAt: string;
  isCurrentPlayer?: boolean;
}

export interface LeaderboardSubmission {
  date: string;
  playerId: string;
  name: string;
  summary: RunSummary;
}

export interface SubmissionResult {
  rank: number;
  bestScore: number;
  accepted: boolean;
}

type FetchLike = typeof fetch;

const REQUEST_TIMEOUT_MS = 7_000;

export function leaderboardEndpoint(): string {
  return import.meta.env.VITE_LEADERBOARD_ENDPOINT?.trim() ?? '';
}

export function leaderboardConfigured(): boolean {
  return leaderboardEndpoint().length > 0;
}

export async function fetchDailyLeaderboard(
  date: string,
  playerId: string,
  fetcher: FetchLike = fetch,
  endpoint = leaderboardEndpoint(),
): Promise<LeaderboardEntry[]> {
  if (!endpoint) throw new Error('leaderboard_not_configured');
  const url = new URL(endpoint);
  url.searchParams.set('date', date);
  url.searchParams.set('limit', '10');
  url.searchParams.set('playerId', playerId);
  const response = await timedFetch(fetcher, url, { method: 'GET' });
  if (!response.ok) throw new Error(`leaderboard_fetch_${response.status}`);
  const payload = await response.json() as { entries?: unknown };
  if (!Array.isArray(payload.entries)) throw new Error('leaderboard_invalid_response');
  return payload.entries.filter(isLeaderboardEntry).slice(0, 10);
}

export async function submitDailyScore(
  submission: LeaderboardSubmission,
  fetcher: FetchLike = fetch,
  endpoint = leaderboardEndpoint(),
): Promise<SubmissionResult> {
  if (!endpoint) throw new Error('leaderboard_not_configured');
  const { summary } = submission;
  const response = await timedFetch(fetcher, endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      schema: 'royal-siege-leaderboard-v1',
      date: submission.date,
      playerId: submission.playerId,
      name: submission.name,
      seed: summary.seed,
      score: summary.score,
      round: summary.round,
      kills: summary.kills,
      result: summary.result,
    }),
  });
  if (!response.ok) throw new Error(`leaderboard_submit_${response.status}`);
  const payload = await response.json() as Partial<SubmissionResult>;
  if (!Number.isInteger(payload.rank) || !Number.isInteger(payload.bestScore) || typeof payload.accepted !== 'boolean') {
    throw new Error('leaderboard_invalid_response');
  }
  return payload as SubmissionResult;
}

async function timedFetch(fetcher: FetchLike, input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<LeaderboardEntry>;
  return Number.isInteger(entry.rank)
    && typeof entry.name === 'string'
    && Number.isInteger(entry.score)
    && Number.isInteger(entry.round)
    && (entry.result === 'victory' || entry.result === 'defeat')
    && typeof entry.submittedAt === 'string'
    && (entry.isCurrentPlayer === undefined || typeof entry.isCurrentPlayer === 'boolean');
}
