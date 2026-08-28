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

export const CURRENT_VERSION = 'v2.0-beta';

export const PATCH_NOTES: readonly PatchNote[] = [
  {
    version: 'v2.0-beta',
    title: 'DECK FOUNDATION',
    date: '2026-08-28',
    current: true,
    sections: [
      {
        heading: '영속 덱과 정비소',
        items: [
          '런 동안 유지되는 덱에서 카드를 추방하거나 복제해 확률을 직접 설계',
          '보스전 직전 정비소에서 인장과 유물을 구매하고 5슬롯 빌드를 교체',
          '덱 뷰어에서 카드별 보유량과 개조 전후 족보 확률 변화 확인',
        ],
      },
      {
        heading: '유물 확장',
        items: [
          '일반·희귀·전설 등급과 조건부 신규 유물 8종 추가',
          '실제 조건을 만족한 유물을 BUILD 패널에서 즉시 점등',
        ],
      },
      {
        heading: '베타 운영',
        items: [
          'v1.4 정식판과 별도 주소에서 운영하며 밸런스와 사용성을 검증',
        ],
      },
    ],
  },
  {
    version: 'v1.4',
    title: 'BUILD SYNERGY',
    date: '2026-08-27',
    sections: [
      {
        heading: '새로운 빌드',
        items: [
          '군단·정밀·마도·왕실·용족 시너지 5종 추가',
          '필드의 서로 다른 유닛 종류에 따라 단계별 효과 활성화',
          'BUILD 패널과 족보·유닛 도감에서 계열과 진행도 확인',
          '현재 홀드 기준 리롤 상승 확률 요약과 전체 족보 확률표',
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
        items: ['이월 보스도 처치 시 유물 보상 · 최종 보스 50초 승패 판정 · 자동 테스트 150개 통과'],
      },
      {
        heading: '패배 분석',
        items: [
          '패배 원인·생존 보스 HP·강화·유닛·유물·최고 족보를 한 화면에 표시',
          '활성 시너지와 남은 무늬 스킬을 바탕으로 다음 판 조언 제공',
        ],
      },
      {
        heading: '플레이 안정성',
        items: [
          '알트탭 복귀 시 누적 시간을 제거하고 전투를 안전하게 일시정지',
          '시크릿 모드의 개인 기록 보존 범위를 온라인 랭킹에 안내',
          '탭 복귀 후 선택 배속 유지 · 무늬 스킬의 정확한 수치 상시 표시',
          '동의 기반 익명 분석·보스별 퍼널·동일 브라우저 재방문 측정 · 원본 이벤트 최대 90일 보관',
        ],
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
