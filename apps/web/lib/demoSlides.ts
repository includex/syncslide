/**
 * Phase 0/1 골격용 플레이스홀더 슬라이드 + 스크립트.
 * 실제 PDF→WebP 변환·스크립트 작성(Dev B/후속) 이전에 리모컨을 검증하기 위한 더미.
 */
export const TOTAL_PAGES = 5;

const COLORS = ['#1e3a8a', '#7c2d12', '#14532d', '#581c87', '#831843'];

export function slideColor(page: number): string {
  return COLORS[(page - 1) % COLORS.length] ?? '#1f2937';
}

/**
 * 페이지별 발표 스크립트 플레이스홀더 (PRD §11.4).
 * 1-base page → scripts[page-1]. 실제로는 Presentation.scripts에서 온다.
 */
const DEMO_SCRIPTS = [
  '안녕하세요, SyncSlide 데모에 오신 것을 환영합니다. 오늘은 모바일 하나로 발표를 제어하는 경험을 보여드리겠습니다.',
  '먼저 발표자는 PC에서 발표장 링크를 열고, 청중은 QR만 찍어 즉시 입장합니다. 별도 로그인은 필요 없습니다.',
  '발표자가 모바일에서 슬라이드를 넘기면 대형 스크린과 모든 청중 화면이 실시간으로 따라옵니다.',
  '판서와 레이저 포인터도 동일하게 동기화됩니다. 화면 크기가 달라도 같은 위치에 표시됩니다.',
  '발표를 저장하면 영상 인코딩 없이도 오디오와 이벤트 타임라인만으로 리플레이가 재생됩니다. 감사합니다.',
];

/** 해당 페이지의 스크립트. 없으면 빈 문자열. */
export function slideScript(page: number): string {
  return DEMO_SCRIPTS[page - 1] ?? '';
}
