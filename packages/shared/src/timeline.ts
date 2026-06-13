/**
 * 이벤트 타임라인 규격 (PRD §15)
 *
 * 리플레이는 오디오 플레이어의 currentTime(ms)을 기준으로, 해당 시점까지의
 * 이벤트를 순차 적용하여 화면을 복원한다. 모든 좌표는 0.0~1.0 정규화 좌표.
 */

/** 발표 시작 시점(0ms) 기준 경과 밀리초 */
export type Millis = number;

/** 정규화 좌표: 0.0000 ~ 1.0000 (PRD §11.2) */
export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface SessionStartEvent {
  t: Millis;
  type: 'SESSION_START';
}

export interface SlideChangeEvent {
  t: Millis;
  type: 'SLIDE_CHANGE';
  page: number;
}

export interface DrawStartEvent {
  t: Millis;
  type: 'DRAW_START';
  color: string;
  thickness: number;
}

export interface DrawMoveEvent {
  t: Millis;
  type: 'DRAW_MOVE';
  x: number;
  y: number;
}

export interface DrawEndEvent {
  t: Millis;
  type: 'DRAW_END';
}

export interface DrawClearEvent {
  t: Millis;
  type: 'DRAW_CLEAR';
  page: number;
}

export interface LaserPointerEvent {
  t: Millis;
  type: 'LASER_POINTER';
  x: number;
  y: number;
}

export interface QaSelectEvent {
  t: Millis;
  type: 'QA_SELECT';
  questionId: string;
}

export interface QaHideEvent {
  t: Millis;
  type: 'QA_HIDE';
}

export interface SessionEndEvent {
  t: Millis;
  type: 'SESSION_END';
}

/** 타임라인에 저장되는 모든 이벤트의 유니온 */
export type TimelineEvent =
  | SessionStartEvent
  | SlideChangeEvent
  | DrawStartEvent
  | DrawMoveEvent
  | DrawEndEvent
  | DrawClearEvent
  | LaserPointerEvent
  | QaSelectEvent
  | QaHideEvent
  | SessionEndEvent;

export type TimelineEventType = TimelineEvent['type'];

/** Recording.timeline 으로 저장되는 전체 타임라인 */
export type Timeline = TimelineEvent[];
