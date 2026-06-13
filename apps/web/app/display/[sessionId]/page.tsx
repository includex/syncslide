'use client';

/**
 * 공연장 디스플레이 화면 (Dev B 소유, Phase 0 골격)
 *
 * Phase 0 범위: display 역할로 join_room → slide_change 수신하여 페이지 추종.
 * Phase 1+에서 QR 대기화면 / 판서·레이저·Q&A 팝업 수신 렌더 추가.
 */
import { useEffect, useRef, useState } from 'react';
import { use } from 'react';
import { createSocket, type AppSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@syncslide/shared';
import { slideColor } from '@/lib/demoSlides';

export default function DisplayPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const socketRef = useRef<AppSocket | null>(null);
  const [page, setPage] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { sessionId, role: 'display' });
    });
    socket.on('disconnect', () => setConnected(false));

    // 최초 입장/재연결 시 현재 상태 복구 (PRD §13.2)
    socket.on(SOCKET_EVENTS.SESSION_STATE, (state) => {
      setPage(state.currentPage);
    });
    // 발표자 슬라이드 전환 추종
    socket.on(SOCKET_EVENTS.SLIDE_CHANGE, (payload) => {
      setPage(payload.page);
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  return (
    <main className="relative flex min-h-screen items-center justify-center">
      <span
        className={`absolute right-4 top-4 text-xs ${
          connected ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {connected ? '● 연결됨' : '○ 연결 끊김'}
      </span>

      {page === 0 ? (
        <div className="text-center text-neutral-500">
          <p className="text-2xl">발표 시작 대기 중…</p>
          <p className="mt-2 text-sm">리모컨에서 슬라이드를 넘겨주세요</p>
        </div>
      ) : (
        <div
          className="flex h-screen w-screen items-center justify-center text-9xl font-bold"
          style={{ backgroundColor: slideColor(page) }}
        >
          {page}
        </div>
      )}
    </main>
  );
}
