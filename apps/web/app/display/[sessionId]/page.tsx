'use client';
/**
 * 공연장 디스플레이 화면 (Dev B 소유) — 다크 테마 유지 (어두운 발표장 환경)
 * READY: QR 대기화면 / ACTIVE: 슬라이드 + 판서 + Q&A 팝업
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { use } from 'react';
import { createSocket, type AppSocket } from '@/lib/socket';
import { api, type Question, type SessionDetail } from '@/lib/api';
import { DrawingCanvas } from '@/components/DrawingCanvas';
import { SOCKET_EVENTS, type DrawEvent } from '@syncslide/shared';
import { slideColor } from '@/lib/demoSlides';

export default function DisplayPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const socketRef = useRef<AppSocket | null>(null);
  const laserTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [status, setStatus] = useState<'READY' | 'ACTIVE' | 'FINISHED'>('READY');
  const [page, setPage] = useState(1);
  const [drawingsByPage, setDrawingsByPage] = useState<Record<number, DrawEvent[]>>({});
  const [laserPoint, setLaserPoint] = useState<{ x: number; y: number } | null>(null);
  const [highlightedQ, setHighlightedQ] = useState<Question | null>(null);
  const [connected, setConnected] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [audienceUrl, setAudienceUrl] = useState('');

  useEffect(() => {
    setAudienceUrl(`${window.location.origin}/live/${sessionId}`);
  }, [sessionId]);

  useEffect(() => {
    if (!audienceUrl) return;
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(audienceUrl, { width: 300, margin: 2, color: { dark: '#000', light: '#fff' } })
        .then(setQrDataUrl);
    });
  }, [audienceUrl]);

  useEffect(() => {
    api.getSession(sessionId).then(setSession).catch(() => {});
  }, [sessionId]);

  const clearLaserTimer = useCallback(() => {
    if (laserTimerRef.current) clearTimeout(laserTimerRef.current);
  }, []);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { sessionId, role: 'display' });
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on(SOCKET_EVENTS.SESSION_STATE, (state) => {
      setStatus(state.status);
      setPage(state.currentPage || 1);
    });

    socket.on(SOCKET_EVENTS.PRESENTER_ACTIVATE, () => setStatus('ACTIVE'));
    // 발표자가 QR 띄우기 화면으로 → QR 대기화면 복귀
    socket.on(SOCKET_EVENTS.PRESENTER_STANDBY, () => setStatus('READY'));

    socket.on(SOCKET_EVENTS.SLIDE_CHANGE, (payload) => {
      setPage(payload.page);
      setLaserPoint(null);
    });

    socket.on(SOCKET_EVENTS.DRAW_EVENT, (payload) => {
      if (payload.type === 'laser') {
        setLaserPoint({ x: payload.x ?? 0, y: payload.y ?? 0 });
        clearLaserTimer();
        laserTimerRef.current = setTimeout(() => setLaserPoint(null), 1200);
        return;
      }
      setDrawingsByPage((prev) => {
        if (payload.type === 'clear') return { ...prev, [payload.page]: [] };
        return { ...prev, [payload.page]: [...(prev[payload.page] ?? []), payload as DrawEvent] };
      });
    });

    socket.on(SOCKET_EVENTS.QA_HIGHLIGHT, (payload) => {
      if (!payload.isVisible) { setHighlightedQ(null); return; }
      setSession((prev) => {
        if (!prev) return prev;
        const q = prev.questions.find((q) => q.id === payload.questionId) ?? null;
        setHighlightedQ(q);
        return prev;
      });
    });

    socket.on(SOCKET_EVENTS.QUESTION_ADDED, (payload) => {
      setSession((prev) =>
        prev ? { ...prev, questions: [...prev.questions, payload] } : prev
      );
    });

    socket.on(SOCKET_EVENTS.PRESENTATION_END, () => setStatus('FINISHED'));

    return () => {
      clearLaserTimer();
      socket.disconnect();
    };
  }, [sessionId, clearLaserTimer]);

  const images = session?.presentation.images ?? [];
  const slideUrl = images[page - 1];
  const drawings = drawingsByPage[page] ?? [];

  if (status !== 'ACTIVE') {
    return (
      <main className="flex h-screen w-screen flex-col items-center justify-center bg-dark-base">
        <div className="absolute right-4 top-4">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              connected
                ? 'bg-electric-violet/20 text-electric-violet'
                : 'bg-dark-border text-silver'
            }`}
          >
            {connected ? '● 연결됨' : '○ 끊김'}
          </span>
        </div>

        {status === 'FINISHED' ? (
          <p className="text-2xl font-medium text-silver">발표가 종료되었습니다</p>
        ) : (
          <div className="flex flex-col items-center gap-10">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-paper">
                {session?.presentation.title ?? 'SyncSlide'}
              </h1>
              <p className="mt-3 text-silver">QR을 스캔하면 발표 화면을 실시간으로 볼 수 있습니다</p>
            </div>

            {qrDataUrl ? (
              <div className="rounded-2xl bg-paper p-5 shadow-none">
                <img src={qrDataUrl} alt="청중 입장 QR" width={280} height={280} />
              </div>
            ) : (
              <div className="h-72 w-72 animate-pulse rounded-2xl bg-dark-surface" />
            )}

            <p className="text-sm text-dark-border break-all max-w-xs text-center">{audienceUrl}</p>
            <p className="text-sm text-silver">발표자가 리모컨 시작을 누르면 발표가 시작됩니다</p>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="flex h-screen w-screen items-center justify-center bg-black">
      <div
        className="relative"
        style={{ width: 'min(100vw, 177.78vh)', height: 'min(100vh, 56.25vw)' }}
      >
        {slideUrl ? (
          <img
            src={slideUrl}
            alt={`슬라이드 ${page}`}
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-9xl font-bold text-paper"
            style={{ backgroundColor: slideColor(page) }}
          >
            {page}
          </div>
        )}

        <DrawingCanvas drawings={drawings} laserPoint={laserPoint} />

        {highlightedQ && (
          <div className="absolute inset-x-8 bottom-10 rounded-xl bg-dark-base/90 p-6 backdrop-blur-sm border border-dark-border">
            <p className="mb-2 text-xs font-semibold text-electric-violet">
              {highlightedQ.nickname ?? '익명'}의 질문
            </p>
            <p className="text-xl font-semibold text-paper">{highlightedQ.content}</p>
          </div>
        )}
      </div>
    </main>
  );
}
