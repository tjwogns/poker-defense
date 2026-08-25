# 포커 디펜스 MVP 구현 계획

> **For agentic workers:** 이 계획은 작성 세션에서 인라인 실행됨 (superpowers:executing-plans).
> 기획안(스펙)은 아티팩트 "포커 디펜스 — 게임 기획안 v0.1" 참고.

**Goal:** 기획안 M0~M2 범위 — 60라운드 클리어 가능한 포커 디펜스 웹 게임 (족보→유닛, 순환 경로, 필드 누적 패배, 경제/강화, 헤드리스 시뮬레이터).

**Architecture:** `src/core`는 Phaser 의존성 0의 순수 TS 결정론적 시뮬레이션(고정 틱 30/s, 시드 RNG).
`src/game`(Phaser 씬)은 core 상태를 구독해 그리기만 한다. `src/sim`은 core만 import하는 헤드리스 밸런싱 CLI.

**Tech Stack:** TypeScript strict + Vite + Phaser 3.90 + Vitest + tsx

**채택 결정(기획안 추천안):** 패배=필드 80마리 누적 / 라운드제(준비→전투) / 라운드당 유닛 1기 확정(하이카드 포함) / 픽셀 판타지 테마(도형+글리프로 대체, 에셋 없음)

---

## 파일 구조

```
src/core/rng.ts              시드 RNG (mulberry32), shuffle
src/core/cards/types.ts      Card(rank 2..14, suit S/H/D/C), HandRank enum(0~9)
src/core/cards/evaluator.ts  evaluateHand(cards): HandRank — 순수 함수
src/core/cards/deck.ts       newDeck / drawHand(rng) / exchange(hand, holds, rng)
src/core/balance.ts          모든 수치 상수 단일 파일 (기획안 4~8장 수치)
src/core/units.ts            HandRank → UnitDef (dps, period, range, traits)
src/core/enemies.ts          EnemyKind 정의 + 라운드별 종류 결정
src/core/map.ts              그리드/경로 웨이포인트/배치 가능 타일 (17×12, TILE=44px)
src/core/combat.ts           고정 틱 전투: 이동·타깃팅·공격·특성(스플래시/체인/슬로우/비례/오라/방무)
src/core/game.ts             GameState 머신: prep⇄combat, 경제, 승패, 공개 API
src/sim/run.ts               헤드리스 시뮬레이터 (npm run sim)
src/main.ts                  Phaser 부트스트랩 (1280×720)
src/game/PlayScene.ts        씬 오케스트레이션 + 입력
src/game/FieldRenderer.ts    필드/유닛/적/HP바 렌더
src/game/HandBar.ts          카드 5장 UI + 교환/확정 버튼
src/game/SidePanel.ts        골드/강화/게이지/유닛정보/판매
tests/*.test.ts              vitest (core만 테스트)
```

## Tasks

- [ ] **T1. 카드 코어 (TDD)** — rng, types, evaluator, deck.
  테스트 케이스: 10개 족보 각 1+, 백스트레이트(A-2-3-4-5=Straight), 로열 vs 스트레이트플러시 구분,
  플러시+스트레이트 동시=StraightFlush, 트리플 vs 투페어 우선, exchange가 홀드 카드 보존·중복 카드 없음,
  같은 시드=같은 드로우.
- [ ] **T2. balance.ts + units.ts + enemies.ts + map.ts** — 기획안 수치 그대로. 테스트: HP 공식 spot check(R1=21, R30≈1190), 교환 비용 수열, 이자 상한.
- [ ] **T3. combat.ts (TDD 핵심만)** — 테스트: first 타깃팅, 슬로우 이속 감소, 방어형 25% 감산+저격수 무시, 스플래시 반경, 처치 골드/분열, 80마리 패배 판정.
- [ ] **T4. game.ts** — 테스트: prep→combat 전이, 이자 지급 상한 50, 교환 비용 차감, 확정 시 유닛 획득, 배치 상한 30, 60라운드 승리.
- [ ] **T5. sim/run.ts** — 휴리스틱 전략으로 seed 1..N 자동 플레이 → 클리어율/평균 도달 라운드 출력. 밸런스 1차 패스(목표: 평균 도달 35~55R, 클리어율 5~40% 구간으로 성장률·강화 효율 조정).
- [ ] **T6. Phaser UI** — PlayScene/FieldRenderer/HandBar/SidePanel. 준비 페이즈(카드 조작·배치·강화) + 전투(배속 ×1/×2/×3) + 승패 오버레이 + 풀하우스 이상 연출.
- [ ] **T7. 검증·커밋** — vitest 전체 PASS, `npm run build` 성공, sim 결과 기록, git 커밋.
- [ ] **T8. 단일 파일 빌드(SINGLEFILE=1) → 아티팩트로 플레이 가능 링크 게시.**

## MVP에서 의도적으로 뺀 것 (기획안 12장 컷라인)

유닛 합성, 조커, 히든 레시피, 상점, 타깃팅 옵션, 멀티 맵, 모바일 최적화, 서버/리더보드, 무한 모드, 보스 고유 기믹(HP×40만 적용), Pity 보정.
