/**
 * Phase 0 골격용 플레이스홀더 슬라이드.
 * 실제 PDF→WebP 변환(Dev B, Phase 1) 이전에 동기화를 검증하기 위한 더미 데이터.
 */
export const TOTAL_PAGES = 5;

const COLORS = ['#1e3a8a', '#7c2d12', '#14532d', '#581c87', '#831843'];

export function slideColor(page: number): string {
  return COLORS[(page - 1) % COLORS.length] ?? '#1f2937';
}
