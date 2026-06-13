'use client';

/**
 * 발표자 모바일 리모컨 — 가로 4-모드 UI (Dev A, Phase 1~2)
 * 스펙: docs/REMOTE_MOBILE_UX.md
 *
 * - 슬라이드(기본)/스크립트/레이저/판서 4-모드
 * - 진입 즉시 자동 활성화 + Screen Wake Lock
 * - 줌은 리모컨 로컬, 판서 좌표는 슬라이드 기준 정규화 후 emit
 * - 슬라이드는 PDF 변환(Dev B) 전까지 demoSlides 플레이스홀더
 */
import { use, useCallback, useEffect, useRef, useState } from 'react';
import { createSocket, type AppSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@syncslide/shared';
import { TOTAL_PAGES, slideColor, slideScript } from '@/lib/demoSlides';
import { useRemoteStore, type RemoteMode } from '@/lib/remoteStore';
import { useWakeLock } from '@/lib/useWakeLock';
import { useCanvasDraw, PEN_COLOR, PEN_WIDTH } from '@/lib/useCanvasDraw';

const DIM = 'rgba(0, 0, 0, 0.35)';
const SWIPE_THRESHOLD = 50;
const TAP_MOVE_MAX = 10;
const DOUBLE_TAP_MS = 300;
const LASER_FADE_MS = 1200;
const MIN_SCALE = 1;
const MAX_SCALE = 3;

// DESIGN.md §7 다크 토큰
const C = {
  base: '#0f0e17',
  surface: '#1c1a2c',
  border: '#2f2b4a',
  textPrimary: '#f9fafb',
  textSecondary: '#9ca3af',
  accent: '#7270ff',
  paper: '#ffffff',
  fog: '#d9dbda',
};

interface LaserDot {
  x: number;
  y: number;
  key: number;
}

export default function RemotePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);

  const socketRef = useRef<AppSocket | null>(null);
  const slideRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activatedRef = useRef(false);

  const connected = useRemoteStore((s) => s.connected);
  const currentPage = useRemoteStore((s) => s.currentPage);
  const totalPages = useRemoteStore((s) => s.totalPages);
  const mode = useRemoteStore((s) => s.mode);
  const {
    setStatus,
    setConnected,
    setPage,
    setTotalPages,
    setMode,
    toggleMode,
    reset,
  } = useRemoteStore.getState();

  const wakeLock = useWakeLock();
  const draw = useCanvasDraw(canvasRef);

  // 줌/팬 (리모컨 로컬, 판서 모드 전용)
  const [transform, setTransform] = useState({ scale: 1, tx: 0, ty: 0 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const [laser, setLaser] = useState<LaserDot | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const laserTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const page = currentPage > 0 ? currentPage : 1;
  const modeRef = useRef<RemoteMode>(mode);
  modeRef.current = mode;
  const pageRef = useRef(page);
  pageRef.current = page;

  // ── 소켓 연결 + 자동 활성화 ─────────────────────────────
  useEffect(() => {
    setTotalPages(TOTAL_PAGES);
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { sessionId, role: 'presenter' });
      // 진입 즉시 자동 활성화 (REMOTE_MOBILE_UX: 시작 버튼 없음)
      if (!activatedRef.current) {
        activatedRef.current = true;
        socket.emit(SOCKET_EVENTS.PRESENTER_ACTIVATE, { sessionId });
        wakeLock.enable();
      }
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on(SOCKET_EVENTS.SESSION_STATE, (state) => {
      setStatus(state.status);
      if (state.currentPage > 0) setPage(state.currentPage);
    });
    socket.on(SOCKET_EVENTS.PRESENTER_ACTIVATE, () => setStatus('ACTIVE'));
    socket.on(SOCKET_EVENTS.SLIDE_CHANGE, (payload) => setPage(payload.page));

    return () => {
      socket.disconnect();
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // 페이지 변경 시 로컬 판서 초기화 (서버는 페이지별 판서 별도 보관)
  useEffect(() => {
    draw.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // 모드 변경 시 줌 리셋 + 판서 진입 토스트
  useEffect(() => {
    if (mode !== 'draw') setTransform({ scale: 1, tx: 0, ty: 0 });
    if (mode === 'draw') showToast('판서 모드 · 더블탭으로 종료');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1500);
  }

  // ── 슬라이드 전환 ───────────────────────────────────────
  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(1, Math.min(totalPages, next));
      if (clamped === pageRef.current) return;
      setPage(clamped);
      socketRef.current?.emit(SOCKET_EVENTS.SLIDE_CHANGE, { page: clamped });
    },
    [totalPages, setPage]
  );

  // ── 좌표 정규화 (transform 반영된 slideRef 기준) ────────
  function normalize(clientX: number, clientY: number) {
    const el = slideRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    return { x, y };
  }

  function emitDraw(
    type: 'start' | 'move' | 'end' | 'clear' | 'laser',
    p?: { x: number; y: number }
  ) {
    socketRef.current?.emit(SOCKET_EVENTS.DRAW_EVENT, {
      type,
      page: pageRef.current,
      ...(p ? { x: p.x, y: p.y } : {}),
      ...(type === 'start' ? { color: PEN_COLOR, thickness: PEN_WIDTH } : {}),
    });
  }

  function fireLaser(clientX: number, clientY: number) {
    const p = normalize(clientX, clientY);
    emitDraw('laser', p);
    setLaser({ x: p.x, y: p.y, key: Date.now() });
    if (laserTimer.current) clearTimeout(laserTimer.current);
    laserTimer.current = setTimeout(() => setLaser(null), LASER_FADE_MS);
  }

  // ── 포인터 제스처 ───────────────────────────────────────
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef({
    startX: 0,
    startY: 0,
    moved: 0,
    drawing: false,
    pinchDist: 0,
    pinchStartScale: 1,
    panStart: null as { x: number; y: number; tx: number; ty: number } | null,
    lastTapAt: 0,
  });

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    g.startX = e.clientX;
    g.startY = e.clientY;
    g.moved = 0;

    const m = modeRef.current;
    if (m === 'laser') {
      fireLaser(e.clientX, e.clientY);
      return;
    }
    if (m === 'draw') {
      if (pointers.current.size === 2) {
        if (g.drawing) {
          g.drawing = false;
          draw.endStroke();
        }
        const pts = [...pointers.current.values()];
        g.pinchDist = dist(pts[0], pts[1]);
        g.pinchStartScale = transformRef.current.scale;
        const mid = midpoint(pts[0], pts[1]);
        g.panStart = {
          x: mid.x,
          y: mid.y,
          tx: transformRef.current.tx,
          ty: transformRef.current.ty,
        };
      } else if (pointers.current.size === 1) {
        g.drawing = true;
        const p = normalize(e.clientX, e.clientY);
        draw.beginStroke(p);
        emitDraw('start', p);
      }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    g.moved = Math.max(
      g.moved,
      Math.hypot(e.clientX - g.startX, e.clientY - g.startY)
    );

    const m = modeRef.current;
    if (m === 'laser') {
      fireLaser(e.clientX, e.clientY);
      return;
    }
    if (m === 'draw') {
      if (pointers.current.size >= 2 && g.panStart) {
        const pts = [...pointers.current.values()];
        const newDist = dist(pts[0], pts[1]);
        const scale = clamp(
          (g.pinchStartScale * newDist) / (g.pinchDist || newDist),
          MIN_SCALE,
          MAX_SCALE
        );
        const mid = midpoint(pts[0], pts[1]);
        const tx = scale > 1 ? g.panStart.tx + (mid.x - g.panStart.x) : 0;
        const ty = scale > 1 ? g.panStart.ty + (mid.y - g.panStart.y) : 0;
        setTransform({ scale, tx, ty });
      } else if (g.drawing && pointers.current.size === 1) {
        const p = normalize(e.clientX, e.clientY);
        draw.extendStroke(p);
        emitDraw('move', p);
      }
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    const m = modeRef.current;

    if (m === 'draw') {
      if (g.drawing && pointers.current.size === 0) {
        g.drawing = false;
        draw.endStroke();
        emitDraw('end');
      }
      if (pointers.current.size < 2) g.panStart = null;
      // 더블탭으로 판서 종료
      if (g.moved < TAP_MOVE_MAX && pointers.current.size === 0) {
        const now = Date.now();
        if (now - g.lastTapAt < DOUBLE_TAP_MS) {
          g.lastTapAt = 0;
          setMode('slide');
        } else {
          g.lastTapAt = now;
        }
      }
      return;
    }

    if (m === 'slide' && pointers.current.size === 0) {
      const dx = e.clientX - g.startX;
      if (g.moved < TAP_MOVE_MAX) {
        // 탭: 좌측=이전, 우측=다음
        const el = slideRef.current;
        if (el) {
          const r = el.getBoundingClientRect();
          const mid = r.left + r.width / 2;
          goTo(e.clientX < mid ? page - 1 : page + 1);
        }
      } else if (Math.abs(dx) >= SWIPE_THRESHOLD) {
        goTo(page + (dx < 0 ? 1 : -1)); // 왼쪽 스와이프 → 다음
      }
    }
  }

  const showPanel = mode !== 'draw';
  const dimVisible = mode === 'slide';

  return (
    <main
      className="flex h-screen w-screen overflow-hidden"
      style={{ backgroundColor: C.base, color: C.textPrimary }}
    >
      {/* ── 슬라이드 / 콘텐츠 영역 ── */}
      <section className="relative flex-1 overflow-hidden">
        {/* 연결 상태 배지 (좌상단) */}
        <div className="absolute left-3 top-3 z-20">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={
              connected
                ? { backgroundColor: C.accent, color: C.paper }
                : { backgroundColor: C.surface, color: C.textSecondary }
            }
          >
            {connected ? '연결됨' : '연결 끊김'}
          </span>
        </div>

        {mode === 'script' ? (
          // ── 스크립트 모드 ──
          <div className="flex h-full w-full flex-col p-8">
            <span className="text-xs" style={{ color: C.textSecondary }}>
              {page} / {totalPages}
            </span>
            <div className="flex flex-1 items-center justify-center">
              <p
                className="max-w-3xl text-center leading-relaxed"
                style={{ fontSize: 26, fontWeight: 500, color: C.textPrimary }}
              >
                {slideScript(page) || '스크립트 없음'}
              </p>
            </div>
          </div>
        ) : (
          // ── 슬라이드 / 레이저 / 판서 모드 ──
          <div
            className="relative h-full w-full touch-none select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              ref={slideRef}
              className="absolute inset-0 flex items-center justify-center text-7xl font-bold"
              style={{
                backgroundColor: slideColor(page),
                transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
                transformOrigin: 'center center',
              }}
            >
              {page}
              {/* 판서 캔버스 오버레이 */}
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full"
              />
            </div>

            {/* dim 오버레이 (슬라이드 모드 넘기기 어포던스) */}
            {dimVisible && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{ backgroundColor: DIM }}
              />
            )}

            {/* 레이저 점 */}
            {mode === 'laser' && laser && (
              <div
                key={laser.key}
                className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: `${laser.x * 100}%`,
                  top: `${laser.y * 100}%`,
                  backgroundColor: '#FF3B30',
                  boxShadow: '0 0 16px 6px rgba(255,59,48,0.7)',
                  animation: `laserFade ${LASER_FADE_MS}ms forwards`,
                }}
              />
            )}

            {/* 페이지 번호 (하단 중앙) */}
            <div
              className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-xs"
              style={{ color: C.textSecondary }}
            >
              {page} / {totalPages}
            </div>

            {/* 판서 모드: 지우기 플로팅 버튼 */}
            {mode === 'draw' && (
              <button
                onClick={() => {
                  draw.clear();
                  emitDraw('clear');
                }}
                className="absolute bottom-4 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full text-xl"
                style={{
                  backgroundColor: C.surface,
                  border: `1px solid ${C.fog}`,
                  color: C.textPrimary,
                }}
                aria-label="판서 지우기"
              >
                🗑
              </button>
            )}

            {/* 토스트 */}
            {toast && (
              <div
                className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-md px-4 py-2 text-sm"
                style={{ backgroundColor: C.surface, color: C.textPrimary }}
              >
                {toast}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 우측 버튼 패널 (판서 모드에서는 숨김) ── */}
      {showPanel && (
        <nav
          className="flex w-1/5 min-w-[88px] flex-col"
          style={{ backgroundColor: C.surface }}
        >
          <ModeButton
            label="스크립트"
            active={mode === 'script'}
            onClick={() => toggleMode('script')}
          />
          <div style={{ height: 1, backgroundColor: C.border }} />
          <ModeButton
            label="레이저"
            active={mode === 'laser'}
            onClick={() => toggleMode('laser')}
          />
          <div style={{ height: 1, backgroundColor: C.border }} />
          {/* 판서 진입 시 패널이 숨겨지므로 active 표시는 불필요 */}
          <ModeButton label="판서" active={false} onClick={() => setMode('draw')} />
        </nav>
      )}

      <style jsx global>{`
        @keyframes laserFade {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}

/** 우측 패널 모드 버튼 (REMOTE_MOBILE_UX.md §5) — 1/3 균등, 네모, radius 4px */
function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 items-center justify-center text-sm font-medium"
      style={{
        borderRadius: 4,
        backgroundColor: active ? C.accent : C.surface,
        color: active ? C.paper : C.textSecondary,
      }}
    >
      {label}
    </button>
  );
}

// ── 기하 헬퍼 ──
function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
