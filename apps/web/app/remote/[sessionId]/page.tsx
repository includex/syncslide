'use client';

/**
 * 발표자 모바일 리모컨 (Dev A 소유, Phase 0 골격)
 *
 * Phase 0 범위: presenter 역할로 join_room → slide_change emit.
 * Phase 1+에서 스와이프/Wake Lock/presenter_activate 소유권 검증/Canvas 추가.
 */
import { useEffect, useRef, useState } from 'react';
import { use } from 'react';
import { createSocket, type AppSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@syncslide/shared';
import { TOTAL_PAGES, slideColor } from '@/lib/demoSlides';

export default function RemotePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const socketRef = useRef<AppSocket | null>(null);
  const [page, setPage] = useState(1);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { sessionId, role: 'presenter' });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on(SOCKET_EVENTS.SESSION_STATE, (state) => {
      if (state.currentPage > 0) setPage(state.currentPage);
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  function goTo(next: number) {
    const clamped = Math.max(1, Math.min(TOTAL_PAGES, next));
    setPage(clamped);
    socketRef.current?.emit(SOCKET_EVENTS.SLIDE_CHANGE, { page: clamped });
  }

  return (
    <main className="flex min-h-screen flex-col p-6">
      <header className="flex items-center justify-between">
        <span className="text-sm text-neutral-400">리모컨 · {sessionId}</span>
        <span
          className={`text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}
        >
          {connected ? '● 연결됨' : '○ 연결 끊김'}
        </span>
      </header>

      <div
        className="my-6 flex flex-1 items-center justify-center rounded-2xl text-6xl font-bold"
        style={{ backgroundColor: slideColor(page) }}
      >
        {page}
      </div>

      <p className="text-center text-neutral-400">
        {page} / {TOTAL_PAGES}
      </p>

      <div className="mt-4 flex gap-4">
        <button
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          className="flex-1 rounded-xl bg-neutral-800 py-6 text-xl font-semibold disabled:opacity-30"
        >
          ◀ 이전
        </button>
        <button
          onClick={() => goTo(page + 1)}
          disabled={page >= TOTAL_PAGES}
          className="flex-1 rounded-xl bg-blue-600 py-6 text-xl font-semibold disabled:opacity-30"
        >
          다음 ▶
        </button>
      </div>
    </main>
  );
}
