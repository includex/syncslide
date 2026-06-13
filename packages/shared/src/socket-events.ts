/**
 * Socket.io 이벤트 프로토콜 (PRD §16)
 *
 * 이 파일이 발표자(emit)와 디스플레이/청중(receive) 사이의 "계약"이다.
 * 변경 시 PR + 상대 리뷰 필수 (WORKFLOW.md §5).
 */

import type { DrawEvent, Role, SessionStatus } from './session';

// ── Client → Server ──────────────────────────────────────────────

/** §16.1 join_room: 세션 룸 입장 */
export interface JoinRoomPayload {
  sessionId: string;
  role: Role;
  /** presenter 역할은 토큰 또는 로그인 세션 검증 필요 */
  token?: string;
}

/** §16.3 presenter_activate: 발표자가 리모컨 시작 */
export interface PresenterActivatePayload {
  sessionId: string;
}

/** §16.4 slide_change: 슬라이드 전환 */
export interface SlideChangePayload {
  page: number;
}

/** §16.5 draw_event: Canvas 판서 및 레이저 포인터 (상대 좌표) */
export interface DrawEventPayload {
  type: 'start' | 'move' | 'end' | 'clear' | 'laser';
  page: number;
  x?: number;
  y?: number;
  color?: string;
  thickness?: number;
}

/** §16.6 question_submit: 청중 질문 제출 */
export interface QuestionSubmitPayload {
  sessionId: string;
  nickname?: string;
  content: string;
}

/** §16.7 qa_highlight: 질문 강조/해제 */
export interface QaHighlightPayload {
  questionId: string;
  isVisible: boolean;
}

/** §16.8 presentation_end: 발표 종료 */
export interface PresentationEndPayload {
  sessionId: string;
}

// ── Server → Client ──────────────────────────────────────────────

/** §16.2 session_state: 최초 입장/재연결 시 현재 상태 전달 */
export interface SessionStatePayload {
  status: SessionStatus;
  currentPage: number;
  drawings: DrawEvent[];
  highlightedQuestionId?: string;
}

/** 새 질문이 발표자에게 도착했을 때 */
export interface QuestionAddedPayload {
  id: string;
  sessionId: string;
  nickname?: string | null;
  content: string;
  createdAt: string;
}

// ── 이벤트 맵 (Socket.io 제네릭에 사용) ──────────────────────────

/** Client → Server 로 보내는 이벤트 */
export interface ClientToServerEvents {
  join_room: (payload: JoinRoomPayload) => void;
  presenter_activate: (payload: PresenterActivatePayload) => void;
  /** 발표자가 QR 띄우기(대기) 화면으로 → 세션 READY 복귀, 디스플레이 QR 표시 */
  presenter_standby: (payload: PresenterActivatePayload) => void;
  slide_change: (payload: SlideChangePayload) => void;
  draw_event: (payload: DrawEventPayload) => void;
  question_submit: (payload: QuestionSubmitPayload) => void;
  qa_highlight: (payload: QaHighlightPayload) => void;
  presentation_end: (payload: PresentationEndPayload) => void;
}

/** Server → Client 로 보내는 이벤트 */
export interface ServerToClientEvents {
  session_state: (payload: SessionStatePayload) => void;
  presenter_activate: (payload: PresenterActivatePayload) => void;
  presenter_standby: (payload: PresenterActivatePayload) => void;
  slide_change: (payload: SlideChangePayload) => void;
  draw_event: (payload: DrawEventPayload) => void;
  question_added: (payload: QuestionAddedPayload) => void;
  qa_highlight: (payload: QaHighlightPayload) => void;
  presentation_end: (payload: PresentationEndPayload) => void;
}

/** Socket.io 이벤트 이름 상수 (오타 방지) */
export const SOCKET_EVENTS = {
  JOIN_ROOM: 'join_room',
  SESSION_STATE: 'session_state',
  PRESENTER_ACTIVATE: 'presenter_activate',
  PRESENTER_STANDBY: 'presenter_standby',
  SLIDE_CHANGE: 'slide_change',
  DRAW_EVENT: 'draw_event',
  QUESTION_SUBMIT: 'question_submit',
  QUESTION_ADDED: 'question_added',
  QA_HIGHLIGHT: 'qa_highlight',
  PRESENTATION_END: 'presentation_end',
} as const;
