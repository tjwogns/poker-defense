import { HandRank, Suit, SUIT_GLYPHS } from '../core/cards/types';
import type { HandVariant } from '../core/cards/handIdentity';
import type { RelicId, RelicRarity } from '../core/relics';
import type { BossId } from '../core/bosses';
import type { EnemyKindId } from '../core/enemies';

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

const EN_RELIC_NAMES: Record<RelicId, string> = {
  royal_seal: 'Royal Seal', war_chest: 'War Chest', compound_ledger: 'Compound Ledger',
  fortified_table: 'Expansion Permit', swift_shuffle: 'Swift Shuffle', ace_up_sleeve: 'Ace up the Sleeve',
  greedy_ledger: 'Greedy Ledger', glass_crown: 'Glass Crown', frozen_clover: 'Lucky Clover',
  blood_contract: 'Blood Contract', underdog_banner: 'Underdog Banner', royal_bloodline: 'Royal Bloodline',
  rear_position: 'Rear Position', pristine_oath: 'Pristine Oath', pair_broker: 'Pair Broker',
  four_suit_crest: 'Four-Suit Crest', delay_tactics: 'Delay Tactics', compression_enthusiast: 'Compression Enthusiast',
  last_stand: 'Last Stand', crossroad_mark: 'Crossroad Mark',
};

const EN_RELIC_DESCRIPTIONS: Record<RelicId, string> = {
  royal_seal: 'All unit damage +12%', war_chest: 'Kill gold +25%',
  compound_ledger: 'Interest +50%, cap +20G', fortified_table: 'All damage +30% with 12+ units',
  swift_shuffle: '2 free exchanges each round', ace_up_sleeve: 'Hand rank +1 on boss rounds',
  greedy_ledger: 'Interest ×2 · all damage +25% at 150G+', glass_crown: 'All damage +35% · kill gold −15%',
  frozen_clover: 'All damage +8% · free exchanges +1', blood_contract: 'Boss damage +55% · normal enemy damage −10%',
  underdog_banner: 'High Card and One Pair unit damage ×1.75', royal_bloodline: 'Full House+ damage +50% · lower ranks −20%',
  rear_position: 'Units 2+ tiles from the path deal +25% damage', pristine_oath: 'Units made without exchanges deal +60% damage',
  pair_broker: 'Confirming One Pair grants an extra matching unit', four_suit_crest: 'A four-suit hand grants +15G',
  delay_tactics: 'Damage +25% against slowed or stunned enemies', compression_enthusiast: 'Free exchanges +2 at 48 cards or fewer',
  last_stand: 'Final exchange redraws all 5 · that unit attack speed +15%', crossroad_mark: 'Enemies in the central crossroads take +25% damage',
};

const EN_BOSS_NAMES: Record<BossId, string> = {
  iron_dealer: 'Iron Dealer', blood_queen: 'Blood Moon Queen', time_thief: 'Time Thief',
  gold_tyrant: 'Gold Tyrant', legion_king: 'Legion King', royal_joker: 'Royal Joker',
};

const EN_BOSS_MECHANICS: Record<BossId, string> = {
  iron_dealer: 'Takes 35% less damage', blood_queen: 'Regenerates 2% max HP per second',
  time_thief: 'Movement speed +60%', gold_tyrant: 'Steals 5 gold every 5 seconds',
  legion_king: 'Summons 2 minions every 8 seconds', royal_joker: 'Enrages below 50% HP',
};

const EN_ENEMY_NAMES: Record<EnemyKindId, string> = {
  normal: 'Torn Card Soldier', fast: 'Chip Thief', tank: 'Vault Golem', regen: 'Stitched Heart',
  splitter: 'Card Mimic', boss: 'Boss',
};

const EN_GUIDE_RULES: Record<HandRank, string> = {
  [HandRank.HighCard]: 'No completed combination', [HandRank.Pair]: '2 cards of the same rank',
  [HandRank.TwoPair]: '2 different pairs', [HandRank.Trips]: '3 cards of the same rank',
  [HandRank.Straight]: '5 consecutive ranks · includes Broadway/Wheel', [HandRank.Flush]: '5 cards of the same suit',
  [HandRank.FullHouse]: 'Three of a kind + a pair', [HandRank.FourKind]: '4 cards of the same rank',
  [HandRank.StraightFlush]: '5 consecutive cards of one suit', [HandRank.RoyalFlush]: '10-J-Q-K-A of one suit',
  [HandRank.FiveKind]: '5 cards of the same rank · requires duplicates', [HandRank.FlushHouse]: 'Suited three of a kind + pair',
  [HandRank.FlushFive]: '5 identical cards',
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

export function relicName(id: RelicId, koreanName: string): string {
  return getLocale() === 'ko' ? koreanName : EN_RELIC_NAMES[id];
}

export function relicDescription(id: RelicId, koreanDescription: string): string {
  return getLocale() === 'ko' ? koreanDescription : EN_RELIC_DESCRIPTIONS[id];
}

export function relicRarityName(rarity: RelicRarity, koreanName: string): string {
  return getLocale() === 'ko' ? koreanName : ({ common: 'Common', rare: 'Rare', legendary: 'Legendary' } as const)[rarity];
}

export function bossName(id: BossId, koreanName: string): string {
  return getLocale() === 'ko' ? koreanName : EN_BOSS_NAMES[id];
}

export function bossMechanic(id: BossId, koreanMechanic: string): string {
  return getLocale() === 'ko' ? koreanMechanic : EN_BOSS_MECHANICS[id];
}

export function enemyName(id: EnemyKindId, koreanName: string): string {
  return getLocale() === 'ko' ? koreanName : EN_ENEMY_NAMES[id];
}

export function guideRule(rank: HandRank, koreanRule: string): string {
  return getLocale() === 'ko' ? koreanRule : EN_GUIDE_RULES[rank];
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
