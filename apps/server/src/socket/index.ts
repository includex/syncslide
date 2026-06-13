/**
 * Socket.io 서버 — 룸 join/leave + 실시간 이벤트 중계 (PRD §16)
 * 오너: Dev A.
 *
 * 발표자(presenter)가 emit한 제어 이벤트를 같은 룸의 display/audience 에게 broadcast.
 * 인증 검증(presenter 소유권)은 Dev B가 제공하는 훅을 끼우는 자리를 TODO로 남겨둠.
 */
import type { Server, Socket } from 'socket.io';
import {
  SOCKET_EVENTS,
  type ClientToServerEvents,
  type DrawEvent,
  type ServerToClientEvents,
  type JoinRoomPayload,
  type PresenterActivatePayload,
  type SlideChangePayload,
  type DrawEventPayload,
  type QaHighlightPayload,
  type PresentationEndPayload,
} from '@syncslide/shared';
import {
  activateSession,
  finishSession,
  getCurrentPageDrawings,
  getOrCreateSession,
  recordDraw,
  setCurrentPage,
  setHighlightedQuestion,
} from './sessionStore.js';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerSocketHandlers(io: IOServer): void {
  io.on('connection', (socket: IOSocket) => {
    let joinedSessionId: string | null = null;
    let role: JoinRoomPayload['role'] | null = null;

    socket.on(SOCKET_EVENTS.JOIN_ROOM, (payload: JoinRoomPayload) => {
      const { sessionId, role: joinRole } = payload;
      // TODO(Dev B): presenter 역할은 token / 로그인 세션으로 소유권 검증 (PRD §18)
      joinedSessionId = sessionId;
      role = joinRole;
      socket.join(sessionId);

      const state = getOrCreateSession(sessionId);
      // 최초 입장 / 재연결 시 현재 상태 전달 (PRD §13.2, §16.2)
      socket.emit(SOCKET_EVENTS.SESSION_STATE, {
        status: state.status,
        currentPage: state.currentPage,
        drawings: getCurrentPageDrawings(sessionId),
        highlightedQuestionId: state.highlightedQuestionId,
      });
    });

    socket.on(
      SOCKET_EVENTS.PRESENTER_ACTIVATE,
      (payload: PresenterActivatePayload) => {
        if (role !== 'presenter') return;
        const state = activateSession(payload.sessionId, socket.id, Date.now());
        // 모든 클라이언트를 첫 슬라이드로 동시 전환 (PRD §7.3)
        io.to(payload.sessionId).emit(SOCKET_EVENTS.PRESENTER_ACTIVATE, payload);
        io.to(payload.sessionId).emit(SOCKET_EVENTS.SLIDE_CHANGE, {
          page: state.currentPage,
        });
      }
    );

    socket.on(SOCKET_EVENTS.SLIDE_CHANGE, (payload: SlideChangePayload) => {
      if (role !== 'presenter' || !joinedSessionId) return;
      setCurrentPage(joinedSessionId, payload.page);
      socket.to(joinedSessionId).emit(SOCKET_EVENTS.SLIDE_CHANGE, payload);
    });

    socket.on(SOCKET_EVENTS.DRAW_EVENT, (payload: DrawEventPayload) => {
      if (role !== 'presenter' || !joinedSessionId) return;
      recordDraw(joinedSessionId, payload as DrawEvent);
      socket.to(joinedSessionId).emit(SOCKET_EVENTS.DRAW_EVENT, payload);
    });

    socket.on(SOCKET_EVENTS.QA_HIGHLIGHT, (payload: QaHighlightPayload) => {
      if (role !== 'presenter' || !joinedSessionId) return;
      setHighlightedQuestion(
        joinedSessionId,
        payload.isVisible ? payload.questionId : undefined
      );
      socket.to(joinedSessionId).emit(SOCKET_EVENTS.QA_HIGHLIGHT, payload);
    });

    // question_submit 은 DB 저장 + 발표자 전달이 필요 → Dev B가 routes/socket에서 구현
    // (Phase 0 골격에서는 미구현)

    socket.on(
      SOCKET_EVENTS.PRESENTATION_END,
      (payload: PresentationEndPayload) => {
        if (role !== 'presenter') return;
        finishSession(payload.sessionId);
        io.to(payload.sessionId).emit(SOCKET_EVENTS.PRESENTATION_END, payload);
      }
    );

    socket.on('disconnect', () => {
      // MVP: 재연결 시 session_state 재전송으로 복구 (PRD §13.2)
    });
  });
}
