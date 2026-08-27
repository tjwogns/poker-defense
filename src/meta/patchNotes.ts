export interface PatchNote {
  version: string;
  title: string;
  date: string;
  current?: boolean;
  sections: readonly {
    heading: string;
    items: readonly string[];
  }[];
}

export const CURRENT_VERSION = 'v1.4';

export const PATCH_NOTES: readonly PatchNote[] = [
  {
    version: 'v1.4',
    title: 'BUILD SYNERGY',
    date: '2026-08-27',
    current: true,
    sections: [
      {
        heading: '새로운 빌드',
        items: [
          '군단·정밀·마도·왕실·용족 시너지 5종 추가',
          '필드의 서로 다른 유닛 종류에 따라 단계별 효과 활성화',
          'BUILD 패널과 족보·유닛 도감에서 계열과 진행도 확인',
        ],
      },
      {
        heading: '신규 유물',
        items: [
          '탐욕의 장부 · 유리 왕관 · 얼어붙은 클로버 · 피의 계약',
          '경제·화력·제어·무늬 스킬을 바꾸는 위험/보상 선택지',
        ],
      },
      {
        heading: '검증',
        items: ['자동 테스트 133개 통과 · 30판 봇 클리어율 33.3%'],
      },
    ],
  },
  {
    version: 'v1.3',
    title: 'DAILY RANKING BETA',
    date: '2026-08-26',
    sections: [
      {
        heading: '온라인 경쟁',
        items: [
          '모두가 같은 패로 도전하는 날짜별 온라인 TOP 10',
          '자동 생성 익명 지휘관 이름과 최고 점수 갱신 방식',
        ],
      },
    ],
  },
  {
    version: 'v1.2',
    title: 'ROYAL TABLE UI',
    date: '2026-08-25',
    sections: [
      {
        heading: '전장 개선',
        items: [
          '상태·경제·군단·스킬·유물 정보를 고정 패널로 재구성',
          '카드, 적, 보스, 선택 유닛의 시각 피드백 강화',
        ],
      },
    ],
  },
];
