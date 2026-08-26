import { HAND_NAMES_KO } from '../core/cards/types';
import { RunSummary } from '../core/scoring';
import { RunMode } from '../meta/profile';
import { runShareUrl, shareText } from '../meta/share';

export async function shareRun(summary: RunSummary, mode: RunMode, date: string): Promise<'shared' | 'copied'> {
  const text = shareText(summary, mode, date);
  const url = runShareUrl(window.location.href, mode, date);
  if (navigator.share) {
    await navigator.share({ title: '포커 디펜스: Royal Siege', text, url });
    return 'shared';
  }
  await copyText(`${text}\n${url}`);
  return 'copied';
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.readOnly = true;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('copy unavailable');
}

export function downloadShareCard(summary: RunSummary, mode: RunMode, date: string): void {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, '#07130c');
  gradient.addColorStop(1, '#1b3b28');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 630);
  ctx.fillStyle = '#5cb187';
  ctx.font = '700 30px sans-serif';
  ctx.fillText('♠  POKER DEFENSE  ♦', 80, 90);
  ctx.fillStyle = '#e6c84f';
  ctx.font = '800 72px sans-serif';
  ctx.fillText(summary.result === 'victory' ? 'ROYAL VICTORY' : `ROUND ${summary.round}`, 80, 205);
  ctx.fillStyle = '#e6ebe5';
  ctx.font = '800 56px sans-serif';
  ctx.fillText(`${summary.score.toLocaleString()} POINTS`, 80, 295);
  ctx.fillStyle = '#94a698';
  ctx.font = '500 28px sans-serif';
  ctx.fillText(`최고 족보  ${HAND_NAMES_KO[summary.bestHand]}    ·    KILLS  ${summary.kills}`, 80, 370);
  ctx.fillText(`${mode === 'daily' ? `${date} DAILY` : 'STANDARD'}    ·    SEED ${summary.seed}`, 80, 420);
  ctx.fillStyle = '#5cb187';
  ctx.fillRect(80, 500, 1040, 2);
  ctx.fillStyle = '#94a698';
  ctx.font = '600 22px sans-serif';
  ctx.fillText('패를 만들고 · 군단을 합성하고 · 왕좌를 지켜라', 80, 555);
  const anchor = document.createElement('a');
  anchor.download = `poker-defense-${date}-${summary.score}.png`;
  anchor.href = canvas.toDataURL('image/png');
  anchor.click();
}
