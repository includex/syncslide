# SyncSlide — 2인 개발 워크플로우 & 작업 분배

> 이 문서는 2명의 개발자가 병목 없이 병렬로 SyncSlide MVP를 개발하기 위한 역할 분담과 작업 순서를 정의합니다.
> 제품 사양은 [`SyncSlide_PRD_v1.0.md`](./SyncSlide_PRD_v1.0.md)를 따릅니다.

---

## 1. 핵심 전략

SyncSlide의 본질은 **실시간 동기화**(발표자 조작 → 디스플레이·청중 화면 추종)다. 따라서 작업 분배는 다음 두 원칙을 따른다.

1. **가장 위험한 기능(실시간 동기화)을 가장 먼저 관통시킨다.** "발표자만" 먼저 만들면 따라올 화면이 없어 동기화를 검증할 수 없다.
2. **FE/BE 수평 분리 대신 수직(역할) 분리를 쓴다.** `slide_change` 같은 실시간 기능은 FE의 emit과 BE의 broadcast가 한 몸이라, FE/BE로 자르면 매 기능마다 서로를 막는다. 대신 **공유 계약을 Phase 0에 한 번 고정**하고, 이후 각자 한 역할의 FE+BE를 끝까지 소유한다.

---

## 2. 역할 분담

| | **Dev A — 발표자 & 실시간 코어** | **Dev B — 자산 & 수신 화면** |
| --- | --- | --- |
| 한 줄 정의 | "상태를 만드는 쪽" (master / emit) | "상태를 받는 쪽 + 자산 파이프라인" (receive / store) |
| 소유 영역 | Socket 서버 + 세션 상태머신, 발표자 모바일 리모컨, 제어 이벤트 emit, 오디오 녹음, 타임라인 수집 | 인증, PDF 업로드·변환, Supabase Storage, 디스플레이 화면, 청중 뷰어, QR, Q&A, 리플레이 플레이어 |

**배분 근거**

- 발표자 트랙은 로직 밀도(상태머신·Canvas·녹음)가 높아 무겁고, 수신 화면 트랙은 상대적으로 가볍다 → 인프라성 작업(인증·PDF변환·스토리지·배포)을 Dev B에 몰아 균형을 맞춘다.
- 발표자가 세션의 "마스터"이므로 서버 세션 상태머신은 Dev A가 오너로 두는 것이 자연스럽다(이벤트를 만드는 쪽이 상태를 소유).
- 두 트랙 모두 같은 Socket 서버/공유 타입에 의존하므로, 그 경계만 Phase 0에서 공동 확정한다.

---

## 3. 레포 구조 (모노레포)

```
syncslide/
  apps/web/          # Next.js App Router (발표자 리모컨 + 디스플레이 + 청중 + 리플레이)
  apps/server/       # Express + Socket.io + Prisma
  packages/shared/   # 공유 타입: Socket 이벤트, 타임라인 이벤트, 세션 상태, DTO
```

- **모노레포 이유**: Socket 이벤트·타임라인 타입을 `packages/shared` 한 곳에서 공유 → 두 사람의 계약이 컴파일 타임에 강제 동기화된다. 레포 2개 분리는 타입 동기화 오버헤드가 커서 비추천.
- **배포**: `apps/web` → Vercel, `apps/server` → Railway 또는 Render (PRD §9.1).

---

## 4. 워크플로우 (Phase별)

### Phase 0 — 공동 골격 (둘이 페어) ★가장 중요

> 여기서 인터페이스 계약을 고정하면 이후 두 사람이 독립적으로 굴러간다.

- 모노레포 스캐폴딩(web / server / shared), Tailwind·Zustand·Prisma 초기화
- `packages/shared`에 계약 정의 (PRD §13~16 기반)
  - `SocketEvents`: `join_room`, `session_state`, `presenter_activate`, `slide_change`, `draw_event`, `question_submit`, `qa_highlight`, `presentation_end`
  - `TimelineEvent` 유니온 (PRD §15.1)
  - `LiveSessionState` (PRD §13.1)
- Prisma 스키마 입력 (PRD §14: User / Presentation / Session / Question / Recording) + Supabase 연결
- 빈 Socket 서버 + 룸 join/leave 골격, 인메모리 세션 상태 맵
- **Phase 0 종료 게이트 = "수직 골격 1줄 관통"**: 발표자 리모컨에서 `slide_change` emit → 서버 broadcast → 디스플레이 화면 페이지 전환

### Phase 1 — 발표 동기화 핵심 (PRD §22 Phase 1)

- **Dev A**: 발표자 모바일 리모컨 UI(현재 페이지·다음/이전·스와이프), `presenter_activate` 소유권 검증, 세션 `READY → ACTIVE` 전환 + 첫 슬라이드 강제 동기화, Screen Wake Lock
- **Dev B**: 로그인(`POST /api/auth/login`), PDF 업로드·WebP 변환·Storage 저장(`POST /api/presentations`), 보관함/상세 페이지, 디스플레이 화면 렌더 + QR 대기화면, 청중 입장(토큰) 뷰어 골격

### Phase 2 — 상호작용 (PRD §22 Phase 2)

- **Dev A**: Canvas 판서(정규화 좌표 §11.2) `draw_event` emit, 지우개·전체지우기, 레이저 포인터(1.2s 페이드), 리모컨 Q&A 탭 + `qa_highlight` 선택
- **Dev B**: 디스플레이/청중 측 판서·레이저·Q&A 팝업 수신 렌더, 청중 Q&A 입력창 + `question_submit`, 질문 DB 저장 + rate limit(§18.3), 정렬

### Phase 3 — 리플레이 (PRD §22 Phase 3)

- **Dev A**: MediaRecorder 오디오 녹음(권한 분기 §12.2), 이벤트 타임라인 수집(발표 중 누적), `presentation_end`
- **Dev B**: 오디오+타임라인 업로드 API(`POST /api/sessions/:id/recording`), `Recording` 저장, 리플레이 플레이어(오디오 currentTime 기준 이벤트 재적용 §19, 1차 선형 seek)

### Phase 4 — 데모 안정화 (공동, PRD §22 Phase 4)

- 재연결 복구(`session_state` 재전송 §13.2), 오류 메시지 정리, 배포 환경 고정, 데모 시나리오(§23) 리허설

---

## 5. 의존성 / 통합 규칙 (병목 관리)

- **단방향 의존**: Dev B의 수신 화면은 Dev A가 emit하는 이벤트를 소비한다. Phase 0에서 계약이 고정되므로, Dev A 구현 전이라도 Dev B는 더미 이벤트로 렌더를 먼저 만들 수 있다.
- **공유 타입 변경 규칙**: `packages/shared` 수정은 PR + 상대 리뷰 필수 (계약 깨짐 방지).
- **세션 상태머신 오너 = Dev A**: 상태 전이 로직 변경은 Dev A가 단일 소유. Dev B는 읽기만.
- **인증 미들웨어 오너 = Dev B**: presenter 소켓 검증 훅 인터페이스만 Dev A에 제공.

---

## 6. 핵심 파일 맵

| 파일 / 디렉터리 | 담당 | 단계 |
| --- | --- | --- |
| `packages/shared/src/*` (socket-events, timeline, session) | 공동 | Phase 0 |
| `apps/server/prisma/schema.prisma` | 공동 | Phase 0 |
| `apps/server/src/socket/*` (서버, sessionStore) | Dev A | Phase 0~ |
| `apps/server/src/routes/{auth,presentations,sessions,recordings}.ts` | Dev B | Phase 1~ |
| `apps/web/app/remote/[sessionId]/` (리모컨) | Dev A | Phase 1~ |
| `apps/web/app/display/[sessionId]/`, `app/live/[sessionId]/`, `app/replay/[id]/` | Dev B | Phase 1~ |

---

## 7. 검증 (end-to-end)

1. **Phase 0 게이트**: 로컬에서 web 2탭(리모컨/디스플레이)을 띄우고 리모컨 페이지 전환 → 디스플레이가 따라오면 통과.
2. **Phase 1**: PDF 업로드 → 변환 이미지 보관함 표시 → 리모컨 시작 → 모든 화면 첫 슬라이드 동기화.
3. **Phase 2**: 청중 폰에서 Q&A 제출 → 리모컨에 실시간 도착 → 선택 시 전 화면 팝업. 판서·레이저 동기화 육안 확인.
4. **Phase 3**: 발표 후 저장 → 리플레이 페이지에서 슬라이드/판서/레이저/Q&A가 오디오 타임라인대로 재현.
5. **데모 리허설**: PRD §23 11단계 시나리오를 실제 기기(iOS Safari·Android Chrome)로 1회 완주.
