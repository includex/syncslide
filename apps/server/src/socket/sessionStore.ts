/**
 * 인메모리 세션 상태 스토어 (PRD §13.1)
 * 오너: Dev A (세션 상태머신). 상태 전이 로직은 여기서 단일 관리.
 *
 * MVP에서는 서버 재시작 시 상태가 유실될 수 있다 (PRD §21).
 */
import type { DrawEvent, LiveSessionState } from '@syncslide/shared';

const sessions = new Map<string, LiveSessionState>();

/** 세션 상태를 가져오거나, 없으면 READY 상태로 생성 */
export function getOrCreateSession(
  sessionId: string,
  presentationId = ''
): LiveSessionState {
  let state = sessions.get(sessionId);
  if (!state) {
    state = {
      sessionId,
      presentationId,
      status: 'READY',
      currentPage: 0,
      drawingsByPage: {},
    };
    sessions.set(sessionId, state);
  }
  return state;
}

export function getSession(sessionId: string): LiveSessionState | undefined {
  return sessions.get(sessionId);
}

/** 발표자 활성화: READY → ACTIVE, 첫 슬라이드로 이동 */
export function activateSession(
  sessionId: string,
  presenterSocketId: string,
  startedAt: number
): LiveSessionState {
  const state = getOrCreateSession(sessionId);
  state.status = 'ACTIVE';
  state.presenterSocketId = presenterSocketId;
  state.currentPage = 1;
  state.startedAt = startedAt;
  return state;
}

export function setCurrentPage(sessionId: string, page: number): void {
  const state = getOrCreateSession(sessionId);
  state.currentPage = page;
}

/** 현재 페이지에 판서 이벤트 누적. clear는 해당 페이지 비우기. */
export function recordDraw(sessionId: string, draw: DrawEvent): void {
  const state = getOrCreateSession(sessionId);
  // 레이저 포인터는 영구 저장하지 않는다 (PRD §11.3)
  if (draw.type === 'laser') return;
  if (draw.type === 'clear') {
    state.drawingsByPage[draw.page] = [];
    return;
  }
  (state.drawingsByPage[draw.page] ??= []).push(draw);
}

export function setHighlightedQuestion(
  sessionId: string,
  questionId: string | undefined
): void {
  const state = getOrCreateSession(sessionId);
  state.highlightedQuestionId = questionId;
}

export function finishSession(sessionId: string): void {
  const state = sessions.get(sessionId);
  if (state) state.status = 'FINISHED';
}

/** 현재 페이지의 누적 판서 (재연결 복구용, PRD §13.2) */
export function getCurrentPageDrawings(sessionId: string): DrawEvent[] {
  const state = sessions.get(sessionId);
  if (!state) return [];
  return state.drawingsByPage[state.currentPage] ?? [];
}
