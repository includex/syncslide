'use client';

/**
 * 발표자 모바일 리모컨 (Dev A, Phase 1).
 *
 * - presenter 역할 join_room → presenter_activate(소유권 검증은 서버 stub)
 * - 슬라이드 전환: 버튼 + 좌우 스와이프 (slide_change emit)
 * - 활성화 시 Screen Wake Lock 요청
 * - DESIGN.md §7 다크 테마 (리모컨 예외)
 *
 * 슬라이드는 PDF 변환(Dev B) 전까지 demoSlides 플레이스홀더 사용.
 */
import { use, useEffect, useRef } from 'react';
import { createSocket, type AppSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@syncslide/shared';
import { TOTAL_PAGES, slideColor } from '@/lib/demoSlides';
import { useRemoteStore } from '@/lib/remoteStore';
import { useWakeLock } from '@/lib/useWakeLock';

const SWIPE_THRESHOLD = 50; // px

export default function RemotePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const socketRef = useRef<AppSocket | null>(null);
  const swipeStartX = useRef<number | null>(null);

  const status = useRemoteStore((s) => s.status);
  const connected = useRemoteStore((s) => s.connected);
  const currentPage = useRemoteStore((s) => s.currentPage);
  const totalPages = useRemoteStore((s) => s.totalPages);
  const { setStatus, setConnected, setPage, setTotalPages, reset } =
    useRemoteStore.getState();

  const wakeLock = useWakeLock();

  useEffect(() => {
    setTotalPages(TOTAL_PAGES);
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { sessionId, role: 'presenter' });
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on(SOCKET_EVENTS.SESSION_STATE, (state) => {
      setStatus(state.status);
      if (state.currentPage > 0) setPage(state.currentPage);
    });
    // 서버가 활성화를 확정하면 ACTIVE 반영 (소유권 검증 통과 시에만 도착)
    socket.on(SOCKET_EVENTS.PRESENTER_ACTIVATE, () => setStatus('ACTIVE'));
    socket.on(SOCKET_EVENTS.SLIDE_CHANGE, (payload) => setPage(payload.page));

    return () => {
      socket.disconnect();
      reset();
    };
    // store 액션은 안정적이므로 sessionId에만 의존
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function activate() {
    socketRef.current?.emit(SOCKET_EVENTS.PRESENTER_ACTIVATE, { sessionId });
    wakeLock.enable(); // 화면 꺼짐 방지 (미지원이어도 발표 진행)
  }

  function goTo(next: number) {
    if (status !== 'ACTIVE') return;
    const clamped = Math.max(1, Math.min(totalPages, next));
    if (clamped === currentPage) return;
    setPage(clamped);
    socketRef.current?.emit(SOCKET_EVENTS.SLIDE_CHANGE, { page: clamped });
  }

  function onPointerDown(e: React.PointerEvent) {
    swipeStartX.current = e.clientX;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (swipeStartX.current === null) return;
    const dx = e.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    goTo(currentPage + (dx < 0 ? 1 : -1)); // 왼쪽으로 스와이프 → 다음
  }

  const page = currentPage > 0 ? currentPage : 1;
  const isActive = status === 'ACTIVE';

  return (
    <main
      className="flex min-h-screen flex-col p-6"
      style={{ backgroundColor: '#0f0e17', color: '#f9fafb' }}
    >
      {/* 헤더 */}
      <header className="flex items-center justify-between">
        <span className="text-sm" style={{ color: '#9ca3af' }}>
          리모컨 · {sessionId}
        </span>
        <div className="flex items-center gap-2">
          <WakeBadge status={wakeLock.status} />
          <ConnectionBadge connected={connected} />
        </div>
      </header>

      {/* 슬라이드 미리보기 (스와이프 영역) */}
      <div
        className="my-6 flex flex-1 touch-none select-none items-center justify-center rounded-2xl text-6xl font-bold"
        style={{ backgroundColor: slideColor(page) }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {isActive ? page : '⏸'}
      </div>

      {isActive ? (
        <>
          <p className="text-center" style={{ color: '#9ca3af' }}>
            {currentPage} / {totalPages}
          </p>
          <div className="mt-4 flex gap-4">
            <DarkButton onClick={() => goTo(page - 1)} disabled={page <= 1}>
              ◀ 이전
            </DarkButton>
            <DarkButton
              onClick={() => goTo(page + 1)}
              disabled={page >= totalPages}
            >
              다음 ▶
            </DarkButton>
          </div>
        </>
      ) : (
        <button
          onClick={activate}
          disabled={!connected}
          className="mt-4 w-full rounded-xl py-6 text-xl font-semibold disabled:opacity-40"
          style={{ backgroundColor: '#7270ff', color: '#ffffff' }}
        >
          ▶ 리모컨 시작
        </button>
      )}
    </main>
  );
}

/** 연결 상태 pill 배지 (DESIGN.md §6) */
function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className="rounded-full px-3 py-1 text-xs font-semibold"
      style={
        connected
          ? { backgroundColor: '#7270ff', color: '#ffffff' }
          : { backgroundColor: '#1c1a2c', color: '#9ca3af' }
      }
    >
      {connected ? '연결됨' : '연결 끊김'}
    </span>
  );
}

/** Wake Lock 상태 배지 — 미지원/오류 시에만 경고 노출 (PRD §12.3) */
function WakeBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span
        className="rounded-full px-3 py-1 text-xs font-semibold"
        style={{ backgroundColor: '#1c1a2c', color: '#9ca3af' }}
      >
        화면유지
      </span>
    );
  }
  if (status === 'unsupported' || status === 'error') {
    return (
      <span
        className="rounded-full px-3 py-1 text-xs font-semibold"
        style={{ backgroundColor: '#1c1a2c', color: '#facc15' }}
      >
        화면유지 미지원
      </span>
    );
  }
  return null;
}

/** 다크 환경 슬라이드 이동 버튼 (DESIGN.md §7) */
function DarkButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 rounded-xl py-6 text-xl font-semibold disabled:opacity-30"
      style={{
        backgroundColor: '#1c1a2c',
        color: '#f9fafb',
        border: '1px solid #2f2b4a',
      }}
    >
      {children}
    </button>
  );
}
