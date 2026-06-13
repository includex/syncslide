/**
 * 실시간 세션 상태 (PRD §13)
 *
 * Socket.io 서버는 각 세션 룸에 대해 아래 상태를 인메모리로 유지한다.
 */

export type SessionStatus = 'READY' | 'ACTIVE' | 'FINISHED';

export type Role = 'presenter' | 'display' | 'audience';

/** 판서 이벤트(서버가 페이지별로 누적) — 정규화 좌표 기반 */
export interface DrawEvent {
  type: 'start' | 'move' | 'end' | 'clear' | 'laser';
  page: number;
  x?: number;
  y?: number;
  color?: string;
  thickness?: number;
}

/** 서버 인메모리 세션 상태 (PRD §13.1) */
export interface LiveSessionState {
  sessionId: string;
  presentationId: string;
  status: SessionStatus;
  presenterSocketId?: string;
  currentPage: number;
  drawingsByPage: Record<number, DrawEvent[]>;
  highlightedQuestionId?: string;
  startedAt?: number;
}

/** 청중이 제출한 질문 */
export interface Question {
  id: string;
  sessionId: string;
  nickname?: string | null;
  content: string;
  createdAt: string;
}
