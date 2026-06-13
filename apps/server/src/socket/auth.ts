/**
 * 발표자 소유권 검증 인터페이스 (PRD §18).
 *
 * 오너십: 검증 "인터페이스"는 Dev A가 정의하고, 실제 구현(로그인 세션 +
 * 슬라이드 소유권 대조)은 Dev B가 인증 미들웨어와 함께 주입한다
 * (WORKFLOW.md §5).
 *
 * Phase 1 현재: 항상 허용하는 dev stub. Dev B가 verifyPresenter를
 * 실제 구현으로 교체하면 소켓 핸들러는 그대로 동작한다.
 */
export type PresenterVerifier = (
  sessionId: string,
  token?: string
) => boolean | Promise<boolean>;

let verifier: PresenterVerifier = () => true;

/** Dev B가 실제 검증 구현을 주입하는 진입점 */
export function setPresenterVerifier(fn: PresenterVerifier): void {
  verifier = fn;
}

export async function verifyPresenter(
  sessionId: string,
  token?: string
): Promise<boolean> {
  return verifier(sessionId, token);
}
