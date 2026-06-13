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

const SWIPE_THRESHOLD = 50;
const TAP_MOVE_MAX = 10;
const DOUBLE_TAP_MS = 300;
const LASER_FADE_MS = 1200;
const MIN_SCALE = 1;
const MAX_SCALE = 3;
const LONG_PRESS_MS = 450;
const RADIAL_RADIUS = 96;
const RADIAL_DEADZONE = 28;

/** Radial Menu 섹션 (가로 기준: 12시=슬라이드, 4시=Q&A, 8시=발표 끝내기) */
type RadialSection = 'slide' | 'qa' | 'end';
const PEN_RED = '#FF6B6B';

/** 중심 기준 (dx,dy)를 섹션으로 분류. 데드존 내부면 null. */
function pickSection(dx: number, dy: number): RadialSection | null {
  if (Math.hypot(dx, dy) < RADIAL_DEADZONE) return null;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI; // 0=오른쪽, y아래 → 시계방향 +
  if (deg < 0) deg += 360;
  if (deg >= 330 || deg < 90) return 'qa'; // 중심 30° (4시)
  if (deg < 210) return 'end'; // 중심 150° (8시)
  return 'slide'; // 210~330°, 중심 270° (12시)
}

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

  // Radial Menu (롱프레스) + 발표 종료 컨펌
  const [radial, setRadial] = useState<{
    cx: number;
    cy: number;
    sel: RadialSection | null;
    closing: boolean;
  } | null>(null);
  const radialRef = useRef<{ cx: number; cy: number; sel: RadialSection | null } | null>(
    null
  );
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [endConfirm, setEndConfirm] = useState(false);

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
    if (mode === 'draw') {
      const portrait =
        typeof window !== 'undefined' &&
        window.matchMedia('(orientation: portrait)').matches;
      // 판서는 가로 단일 레이아웃 → 세로면 가로 전환 안내
      showToast(
        portrait
          ? '가로로 돌려서 판서하세요 · 더블탭으로 종료'
          : '판서 모드 · 더블탭으로 종료'
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1500);
  }

  // 언마운트 시 타이머 정리
  useEffect(
    () => () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (laserTimer.current) clearTimeout(laserTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

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

  // ── Radial Menu (롱프레스) ──────────────────────────────
  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function openRadial(cx: number, cy: number) {
    setLaser(null);
    radialRef.current = { cx, cy, sel: null };
    setRadial({ cx, cy, sel: null, closing: false });
  }

  function updateRadialSel(sel: RadialSection | null) {
    if (!radialRef.current || radialRef.current.sel === sel) return;
    radialRef.current.sel = sel;
    setRadial((r) => (r ? { ...r, sel } : r));
  }

  function closeRadialWithAnim() {
    radialRef.current = null;
    setRadial((r) => (r ? { ...r, closing: true } : r));
    setTimeout(() => setRadial(null), 150);
  }

  function executeRadial(sel: RadialSection) {
    if (sel === 'slide') setMode('slide');
    else if (sel === 'qa') setMode('qa');
    else if (sel === 'end') setEndConfirm(true);
  }

  function endPresentation() {
    socketRef.current?.emit(SOCKET_EVENTS.PRESENTATION_END, { sessionId });
    setEndConfirm(false);
    setMode('slide');
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
    // 롱프레스 → Radial Menu (판서 모드 제외, 단일 포인터)
    if (m !== 'draw' && pointers.current.size === 1) {
      const sx = e.clientX;
      const sy = e.clientY;
      clearLongPress();
      longPressTimer.current = setTimeout(() => openRadial(sx, sy), LONG_PRESS_MS);
    }

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

    // Radial 활성 중: 드래그로 섹션 선택 (다른 제스처 무시)
    if (radialRef.current) {
      updateRadialSel(
        pickSection(e.clientX - radialRef.current.cx, e.clientY - radialRef.current.cy)
      );
      return;
    }
    // 롱프레스 대기 중 이동하면 취소 (드래그/스와이프로 간주)
    if (longPressTimer.current && g.moved > TAP_MOVE_MAX) clearLongPress();

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
    clearLongPress();
    const g = gesture.current;
    const m = modeRef.current;

    // Radial 활성 중 손 떼면 선택 섹션 실행 (일반 제스처 건너뜀)
    if (radialRef.current) {
      const sel = radialRef.current.sel;
      closeRadialWithAnim();
      if (sel) executeRadial(sel);
      return;
    }

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

    // 슬라이드/스크립트 모드: 탭·스와이프로 페이지 이동 (스크립트는 이전/다음 장 스크립트 표시)
    if ((m === 'slide' || m === 'script') && pointers.current.size === 0) {
      const dx = e.clientX - g.startX;
      if (g.moved < TAP_MOVE_MAX) {
        // 탭: 좌측=이전, 우측=다음
        const r = e.currentTarget.getBoundingClientRect();
        const mid = r.left + r.width / 2;
        goTo(e.clientX < mid ? page - 1 : page + 1);
      } else if (Math.abs(dx) >= SWIPE_THRESHOLD) {
        goTo(page + (dx < 0 ? 1 : -1)); // 왼쪽 스와이프 → 다음
      }
    }
  }

  const showPanel = mode !== 'draw';
  // 판서 모드는 방향과 무관하게 가로(전체 채움) 단일 레이아웃. 그 외는 방향 반응형(세로 16:9).
  const slideBoxClass =
    mode === 'draw'
      ? 'absolute inset-0 flex items-center justify-center overflow-hidden'
      : 'relative flex items-center justify-center overflow-hidden landscape:absolute landscape:inset-0 portrait:aspect-video portrait:w-full';

  return (
    <main
      className="flex h-dvh w-screen overflow-hidden landscape:flex-row portrait:flex-col"
      style={{ backgroundColor: C.base, color: C.textPrimary }}
    >
      {/* ── 슬라이드 / 콘텐츠 영역 (세로 모드: 16:9 중앙 정렬, 여백 Dark Base) ── */}
      <section className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden">
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

        {/* 제스처 영역: 하단 버튼을 제외한 슬라이드 영역 전체 (세로 모드 레터박스 여백 포함) */}
        <div
          className="absolute inset-0 flex touch-none select-none items-center justify-center"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* 슬라이드 박스 (시각·좌표 기준, 세로 모드: 16:9 중앙 정렬) */}
          <div
            ref={slideRef}
            className={slideBoxClass}
            style={{
              backgroundColor: mode === 'script' ? C.base : slideColor(page),
              transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
              transformOrigin: 'center center',
            }}
          >
            {mode === 'script' ? (
              <p
                className="max-w-3xl px-8 text-center leading-relaxed"
                style={{ fontSize: 26, fontWeight: 500, color: C.textPrimary }}
              >
                {slideScript(page) || '스크립트 없음'}
              </p>
            ) : (
              <span className="text-7xl font-bold">{page}</span>
            )}
            {/* 판서 캔버스 오버레이 */}
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />

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

            {/* 페이지 번호 (슬라이드 영역 하단 중앙 — 모든 모드 동일) */}
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
                onPointerDown={(e) => e.stopPropagation()}
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

          {/* Q&A 화면 (Radial Menu로 진입) — 길게 눌러 메뉴로 복귀 */}
          {mode === 'qa' && (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-8 text-center"
              style={{ backgroundColor: C.base }}
            >
              <h2 className="text-2xl font-bold" style={{ color: C.textPrimary }}>
                Q&amp;A
              </h2>
              <p style={{ color: C.textSecondary }}>아직 들어온 질문이 없습니다</p>
              <p className="text-xs" style={{ color: C.textSecondary }}>
                길게 눌러 메뉴에서 슬라이드로 돌아갈 수 있어요
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── 우측 버튼 패널 (판서 모드에서는 숨김) ── */}
      {showPanel && (
        <nav
          className="flex shrink-0 landscape:h-full landscape:w-1/5 landscape:min-w-[88px] landscape:flex-col portrait:h-24 portrait:w-full portrait:flex-row"
          style={{ backgroundColor: C.surface }}
        >
          <ModeButton
            label="스크립트"
            active={mode === 'script'}
            onClick={() => toggleMode('script')}
          />
          <div
            className="shrink-0 landscape:h-px landscape:w-full portrait:h-full portrait:w-px"
            style={{ backgroundColor: C.border }}
          />
          <ModeButton
            label="레이저"
            active={mode === 'laser'}
            onClick={() => toggleMode('laser')}
          />
          <div
            className="shrink-0 landscape:h-px landscape:w-full portrait:h-full portrait:w-px"
            style={{ backgroundColor: C.border }}
          />
          {/* 판서 진입 시 패널이 숨겨지므로 active 표시는 불필요 */}
          <ModeButton label="판서" active={false} onClick={() => setMode('draw')} />
        </nav>
      )}

      {/* Radial Menu (롱프레스) */}
      {radial && (
        <RadialMenu cx={radial.cx} cy={radial.cy} sel={radial.sel} closing={radial.closing} />
      )}

      {/* 발표 종료 컨펌 */}
      {endConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
        >
          <div
            className="w-72 rounded-lg p-6"
            style={{ backgroundColor: C.base, border: `1px solid ${C.border}` }}
          >
            <p
              className="text-center text-base font-medium"
              style={{ color: C.textPrimary }}
            >
              발표를 종료할까요?
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setEndConfirm(false)}
                className="flex-1 rounded-xl py-3 text-sm font-medium"
                style={{ backgroundColor: C.surface, color: C.textSecondary }}
              >
                취소
              </button>
              <button
                onClick={endPresentation}
                className="flex-1 rounded-xl py-3 text-sm font-semibold"
                style={{ backgroundColor: PEN_RED, color: C.paper }}
              >
                종료
              </button>
            </div>
          </div>
        </div>
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
        @keyframes radialIn {
          0% {
            transform: translate(-50%, -50%) scale(0.7);
            opacity: 0;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.92;
          }
        }
        @keyframes radialOut {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.92;
          }
          100% {
            transform: translate(-50%, -50%) scale(0.7);
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

/**
 * Radial Menu (REMOTE_MOBILE_UX.md §Radial Menu)
 * 롱프레스 지점 중심으로 120°씩 3등분: 12시 슬라이드 / 4시 Q&A / 8시 발표 끝내기.
 */
function RadialMenu({
  cx,
  cy,
  sel,
  closing,
}: {
  cx: number;
  cy: number;
  sel: RadialSection | null;
  closing: boolean;
}) {
  const R = RADIAL_RADIUS;
  const sections: { key: RadialSection; label: string; center: number }[] = [
    { key: 'slide', label: '슬라이드', center: 270 }, // 12시
    { key: 'qa', label: 'Q&A', center: 30 }, // 4시
    { key: 'end', label: '발표 끝내기', center: 150 }, // 8시
  ];
  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: cx,
        top: cy,
        width: 2 * R,
        height: 2 * R,
        transform: 'translate(-50%, -50%)',
        opacity: 0.92,
        animation: `${closing ? 'radialOut' : 'radialIn'} 150ms forwards`,
      }}
    >
      <svg width={2 * R} height={2 * R} viewBox={`0 0 ${2 * R} ${2 * R}`}>
        {sections.map((s) => (
          <path
            key={s.key}
            d={sectorPath(s.center - 60, s.center + 60, R)}
            fill={sel === s.key ? C.accent : C.border}
            stroke={C.surface}
            strokeWidth={2}
          />
        ))}
      </svg>
      {sections.map((s) => {
        const rad = (s.center * Math.PI) / 180;
        return (
          <span
            key={s.key}
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-sm font-medium"
            style={{
              left: R + 0.62 * R * Math.cos(rad),
              top: R + 0.62 * R * Math.sin(rad),
              color: s.key === 'end' ? PEN_RED : C.paper,
            }}
          >
            {s.label}
          </span>
        );
      })}
    </div>
  );
}

/** 중심(R,R)·반지름 R 원에서 startDeg~endDeg 부채꼴 path (각도: 0=오른쪽, 시계방향) */
function sectorPath(startDeg: number, endDeg: number, R: number) {
  const pt = (deg: number) => {
    const r = (deg * Math.PI) / 180;
    return [R + R * Math.cos(r), R + R * Math.sin(r)];
  };
  const [x1, y1] = pt(startDeg);
  const [x2, y2] = pt(endDeg);
  return `M ${R} ${R} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`;
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
