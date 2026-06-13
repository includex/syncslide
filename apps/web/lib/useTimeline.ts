'use client';

/**
 * 이벤트 타임라인 수집기 (Dev A, Phase 3 / PRD §15).
 *
 * 발표 시작(SESSION_START, t=0) 기준 경과 ms로 제어 이벤트를 누적한다.
 * '발표 끝' 시 오디오와 함께 서버에 업로드되어 리플레이의 근거가 된다.
 */
import { useCallback, useRef } from 'react';
import type { TimelineEvent } from '@syncslide/shared';

/** TimelineEvent에서 t를 뺀 형태 (유니온 분배) */
type EventInput = TimelineEvent extends infer E
  ? E extends { t: number }
    ? Omit<E, 't'>
    : never
  : never;

export function useTimeline() {
  const startedAt = useRef<number | null>(null);
  const events = useRef<TimelineEvent[]>([]);

  const start = useCallback(() => {
    startedAt.current = performance.now();
    events.current = [{ t: 0, type: 'SESSION_START' }];
  }, []);

  /** 이벤트 1건 기록 (start 이전엔 무시) */
  const push = useCallback((e: EventInput) => {
    if (startedAt.current == null) return;
    const t = Math.round(performance.now() - startedAt.current);
    events.current.push({ t, ...e } as TimelineEvent);
  }, []);

  const end = useCallback(() => {
    if (startedAt.current == null) return;
    push({ type: 'SESSION_END' } as EventInput);
  }, [push]);

  const get = useCallback(() => events.current, []);

  const reset = useCallback(() => {
    startedAt.current = null;
    events.current = [];
  }, []);

  return { start, push, end, get, reset, isRecording: () => startedAt.current != null };
}
