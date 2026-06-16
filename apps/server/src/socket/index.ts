/**
 * Socket.io 서버 — 룸 join/leave + 실시간 이벤트 중계 (PRD §16)
 * 오너: Dev A.  question_submit DB 저장은 Dev B (WORKFLOW.md §4 Phase 2).
 */
import { randomUUID } from 'node:crypto';
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
  type QuestionSubmitPayload,
} from '@syncslide/shared';
import {
  activateSession,
  standbySession,
  finishSession,
  getCurrentPageDrawings,
  getOrCreateSession,
  recordDraw,
  setCurrentPage,
  setHighlightedQuestion,
} from './sessionStore.js';
import { verifyPresenter } from './auth.js';
import { prisma } from '../lib/prisma.js';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// 간단한 인메모리 rate limit: 소켓당 Q&A 제출 추적 (PRD §18.3)
const qaRateMap = new Map<string, { count: number; resetAt: number }>();
const QA_WINDOW_MS = 10_000;
const QA_MAX_PER_WINDOW = 3;

function isRateLimited(socketId: string): boolean {
  const now = Date.now();
  const entry = qaRateMap.get(socketId);
  if (!entry || now > entry.resetAt) {
    qaRateMap.set(socketId, { count: 1, resetAt: now + QA_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > QA_MAX_PER_WINDOW;
}

export function registerSocketHandlers(io: IOServer): void {
  io.on('connection', (socket: IOSocket) => {
    let joinedSessionId: string | null = null;
    let role: JoinRoomPayload['role'] | null = null;
    let presenterToken: string | undefined;

    socket.on(SOCKET_EVENTS.JOIN_ROOM, (payload: JoinRoomPayload) => {
      const { sessionId, role: joinRole, token } = payload;
      joinedSessionId = sessionId;
      role = joinRole;
      presenterToken = token;
      socket.join(sessionId);

      const state = getOrCreateSession(sessionId);
      socket.emit(SOCKET_EVENTS.SESSION_STATE, {
        status: state.status,
        currentPage: state.currentPage,
        drawings: getCurrentPageDrawings(sessionId),
        highlightedQuestionId: state.highlightedQuestionId,
      });
    });

    socket.on(
      SOCKET_EVENTS.PRESENTER_ACTIVATE,
      async (payload: PresenterActivatePayload) => {
        if (role !== 'presenter') return;
        // 발표자 소유권 검증 (PRD §7.3, §18). dev에서는 stub이 항상 허용.
        const ok = await verifyPresenter(payload.sessionId, presenterToken);
        if (!ok) return;
        const state = activateSession(payload.sessionId, socket.id, Date.now());
        // 모든 클라이언트를 첫 슬라이드로 동시 전환 (PRD §7.3)
        io.to(payload.sessionId).emit(SOCKET_EVENTS.PRESENTER_ACTIVATE, payload);
        io.to(payload.sessionId).emit(SOCKET_EVENTS.SLIDE_CHANGE, {
          page: state.currentPage,
        });
      }
    );

    // 발표자가 QR 띄우기(대기) 화면으로 → 세션 READY 복귀, 디스플레이/청중 QR 대기화면 표시
    socket.on(
      SOCKET_EVENTS.PRESENTER_STANDBY,
      (payload: PresenterActivatePayload) => {
        if (role !== 'presenter') return;
        standbySession(payload.sessionId);
        io.to(payload.sessionId).emit(SOCKET_EVENTS.PRESENTER_STANDBY, payload);
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
      setHighlightedQuestion(joinedSessionId, payload.isVisible ? payload.questionId : undefined);
      socket.to(joinedSessionId).emit(SOCKET_EVENTS.QA_HIGHLIGHT, payload);
    });

    // Dev B: question_submit — DB 저장 후 발표자에게 전달 (PRD §16.6, §18.3)
    // DB 미연결/오류여도 실시간 중계는 계속한다 (PRD §21). 저장 성공 시 DB id,
    // 실패 시 임시 id로 폴백해 한 번만 emit한다.
    socket.on(SOCKET_EVENTS.QUESTION_SUBMIT, async (payload: QuestionSubmitPayload) => {
      if (isRateLimited(socket.id)) return;
      const content = payload.content?.trim();
      if (!content || content.length > 300) return;
      const nickname = payload.nickname?.trim() || null;

      let id: string;
      let createdAt: string;
      try {
        const question = await prisma.question.create({
          data: { sessionId: payload.sessionId, nickname, content },
        });
        id = question.id;
        createdAt = question.createdAt.toISOString();
      } catch {
        // DB 미연결/오류 — 인메모리로 중계만 (영구 저장은 생략)
        id = randomUUID();
        createdAt = new Date().toISOString();
      }

      io.to(payload.sessionId).emit(SOCKET_EVENTS.QUESTION_ADDED, {
        id,
        sessionId: payload.sessionId,
        nickname,
        content,
        createdAt,
      });
    });

    socket.on(SOCKET_EVENTS.PRESENTATION_END, (payload: PresentationEndPayload) => {
      if (role !== 'presenter') return;
      finishSession(payload.sessionId);
      io.to(payload.sessionId).emit(SOCKET_EVENTS.PRESENTATION_END, payload);
    });

    socket.on('disconnect', () => {
      qaRateMap.delete(socket.id);
    });
  });
}
