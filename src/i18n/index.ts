import { HandRank, Suit, SUIT_GLYPHS } from '../core/cards/types';
import type { HandVariant } from '../core/cards/handIdentity';

export type Locale = 'ko' | 'en';

export const LOCALE_STORAGE_KEY = 'poker-defense:locale';

type LocaleStorage = Pick<Storage, 'getItem' | 'setItem'>;

const EN_HAND_NAMES: Record<HandRank, string> = {
  [HandRank.HighCard]: 'High Card',
  [HandRank.Pair]: 'One Pair',
  [HandRank.TwoPair]: 'Two Pair',
  [HandRank.Trips]: 'Three of a Kind',
  [HandRank.Straight]: 'Straight',
  [HandRank.Flush]: 'Flush',
  [HandRank.FullHouse]: 'Full House',
  [HandRank.FourKind]: 'Four of a Kind',
  [HandRank.StraightFlush]: 'Straight Flush',
  [HandRank.RoyalFlush]: 'Royal Flush',
  [HandRank.FiveKind]: 'Five of a Kind',
  [HandRank.FlushHouse]: 'Flush House',
  [HandRank.FlushFive]: 'Flush Five',
};

const EN_UNIT_NAMES: Record<HandRank, string> = {
  [HandRank.HighCard]: 'Militia',
  [HandRank.Pair]: 'Archer',
  [HandRank.TwoPair]: 'Twin Ranger',
  [HandRank.Trips]: 'Pyromancer',
  [HandRank.Straight]: 'Lancer',
  [HandRank.Flush]: 'Storm Mage',
  [HandRank.FullHouse]: 'Paladin',
  [HandRank.FourKind]: 'Dragon Knight',
  [HandRank.StraightFlush]: 'Archmage',
  [HandRank.RoyalFlush]: 'Royal Dragon',
  [HandRank.FiveKind]: 'Fivefold Guard',
  [HandRank.FlushHouse]: 'Tide Sovereign',
  [HandRank.FlushFive]: 'Prismatic Avatar',
};

const EN_SUIT_NAMES: Record<Suit, string> = {
  S: 'Spades',
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
};

const EN_VARIANT_NAMES: Record<HandVariant, string> = {
  mountain: 'Broadway',
  'back-straight': 'Wheel',
};

export function resolveLocale(
  search: string,
  storage?: Pick<LocaleStorage, 'getItem'>,
  languages: readonly string[] = [],
): Locale {
  const query = new URLSearchParams(search).get('lang')?.toLowerCase();
  if (query === 'ko' || query === 'en') return query;
  try {
    const stored = storage?.getItem(LOCALE_STORAGE_KEY)?.toLowerCase();
    if (stored === 'ko' || stored === 'en') return stored;
  } catch {
    // Private browsing can deny storage access.
  }
  return languages.some((language) => language.toLowerCase().startsWith('ko')) ? 'ko' : 'en';
}

let activeLocale: Locale | null = null;

export function getLocale(): Locale {
  if (activeLocale) return activeLocale;
  if (typeof window === 'undefined') return 'ko';
  activeLocale = resolveLocale(window.location.search, window.localStorage, navigator.languages);
  return activeLocale;
}

export function setLocale(locale: Locale, storage?: LocaleStorage): void {
  activeLocale = locale;
  try {
    (storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined))?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Locale still applies for this page when storage is unavailable.
  }
}

export function tr(ko: string, en: string): string {
  return getLocale() === 'ko' ? ko : en;
}

export function handName(rank: HandRank, koreanName: string): string {
  return getLocale() === 'ko' ? koreanName : EN_HAND_NAMES[rank];
}

export function unitName(rank: HandRank, koreanName: string): string {
  return getLocale() === 'ko' ? koreanName : EN_UNIT_NAMES[rank];
}

export function suitIdentityName(suit: Suit | null, koreanName: string): string {
  if (getLocale() === 'ko') return koreanName;
  return suit ? `${SUIT_GLYPHS[suit]} ${EN_SUIT_NAMES[suit]}` : 'No suit';
}

export function handVariantName(variant: HandVariant, koreanName: string): string {
  return getLocale() === 'ko' ? koreanName : EN_VARIANT_NAMES[variant];
}

export function waveName(kind: string, koreanName: string): string {
  if (getLocale() === 'ko') return koreanName;
  return ({ normal: 'Marching Host', fast: 'Swift Raiders', tank: 'Iron Vanguard', regen: 'Regenerators', splitter: 'Split Legion', boss: 'Boss' } as Record<string, string>)[kind] ?? koreanName;
}

export function applyDocumentLocale(locale = getLocale(), root: Document = document): void {
  root.documentElement.lang = locale;
  root.title = locale === 'ko' ? '포커 디펜스' : 'Poker Defense';
  const description = root.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description) description.content = locale === 'ko'
    ? '포커 족보로 군단을 만들고 60라운드를 지키는 전략 웹게임, 포커 디펜스.'
    : 'Build an army with poker hands and defend the kingdom for 60 rounds.';
  const text = (id: string, ko: string, en: string) => {
    const element = root.getElementById(id);
    if (element) element.textContent = locale === 'ko' ? ko : en;
  };
  text('game-instructions',
    '포커 족보로 군단을 만드는 전략 게임입니다. E로 카드를 교환하고, Enter로 족보를 확정하고, Space로 전투를 시작하거나 일시정지합니다.',
    'A strategy game where poker hands summon units. Press E to exchange, Enter to confirm your hand, and Space to start or pause combat.');
  text('boot-message', '왕국과 카드 군단을 불러오는 중…', 'Summoning the kingdom and your card army…');
  text('boot-tip', '첫 실행 후에는 브라우저 캐시로 더 빠르게 열립니다.', 'Future launches are faster after the first load.');
  text('mobile-gate-title', '가로 화면이 너무 작습니다', 'This landscape screen is too small');
  text('mobile-gate-body', '브라우저 메뉴를 접거나 전체 화면으로 전환하면 실행할 수 있습니다.', 'Hide the browser controls or switch to full screen to play.');
  text('fullscreen', '전체 화면 시도', 'Try full screen');
  text('renderer-recovery-message', '그래픽 장치를 복구하는 중입니다', 'Recovering the graphics device');
  text('renderer-recovery-detail', '게임을 잠시 멈췄습니다. 복구되면 자동으로 이어집니다.', 'The game is paused and will resume automatically.');
  text('renderer-safe-mode', '안정 모드로 다시 시작', 'Restart in safe mode');
}
