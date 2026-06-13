'use client';
/**
 * 청중 뷰어 — QR 스캔 후 진입, 로그인 불필요 (PRD §7.2, §7.5)
 * 슬라이드 영역: 다크 / Q&A 영역: 라이트
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { use } from 'react';
import { createSocket, type AppSocket } from '@/lib/socket';
import { api, type Question } from '@/lib/api';
import { DrawingCanvas } from '@/components/DrawingCanvas';
import { SOCKET_EVENTS, type DrawEvent } from '@syncslide/shared';

export default function LivePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const socketRef = useRef<AppSocket | null>(null);
  const laserTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title, setTitle] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [status, setStatus] = useState<'READY' | 'ACTIVE' | 'FINISHED'>('READY');
  const [page, setPage] = useState(1);
  const [drawingsByPage, setDrawingsByPage] = useState<Record<number, DrawEvent[]>>({});
  const [laserPoint, setLaserPoint] = useState<{ x: number; y: number } | null>(null);
  const [highlightedQ, setHighlightedQ] = useState<Question | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [nickname, setNickname] = useState('');
  const [content, setContent] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api.getSession(sessionId).then((s) => {
      setTitle(s.presentation.title);
      setImages(s.presentation.images);
      setQuestions(s.questions);
    }).catch(() => {});
  }, [sessionId]);

  const clearLaserTimer = useCallback(() => {
    if (laserTimerRef.current) clearTimeout(laserTimerRef.current);
  }, []);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { sessionId, role: 'audience' });
    });

    socket.on(SOCKET_EVENTS.SESSION_STATE, (state) => {
      setStatus(state.status);
      setPage(state.currentPage || 1);
    });

    socket.on(SOCKET_EVENTS.PRESENTER_ACTIVATE, () => setStatus('ACTIVE'));

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
      setQuestions((prev) => {
        const q = prev.find((q) => q.id === payload.questionId) ?? null;
        setHighlightedQ(q);
        return prev;
      });
    });

    socket.on(SOCKET_EVENTS.QUESTION_ADDED, (payload) => {
      setQuestions((prev) => [...prev, payload]);
    });

    socket.on(SOCKET_EVENTS.PRESENTATION_END, () => setStatus('FINISHED'));

    return () => {
      clearLaserTimer();
      socket.disconnect();
    };
  }, [sessionId, clearLaserTimer]);

  function submitQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    socketRef.current?.emit(SOCKET_EVENTS.QUESTION_SUBMIT, {
      sessionId,
      nickname: nickname.trim() || undefined,
      content: content.trim(),
    });
    setContent('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2500);
  }

  const slideUrl = images[page - 1];
  const drawings = drawingsByPage[page] ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-pebble">
      {/* 슬라이드 영역 — 다크 */}
      <div className="flex w-full items-center justify-center bg-black">
        <div
          className="relative w-full"
          style={{ aspectRatio: '16/9', maxHeight: '55vh' }}
        >
          {status === 'READY' && (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <p className="text-base font-medium text-silver">{title || 'SyncSlide'}</p>
              <p className="text-sm text-dark-border">발표 시작을 기다리는 중...</p>
            </div>
          )}
          {status === 'FINISHED' && (
            <div className="flex h-full items-center justify-center">
              <p className="text-silver">발표가 종료되었습니다</p>
            </div>
          )}
          {status === 'ACTIVE' && (
            slideUrl ? (
              <img src={slideUrl} alt={`슬라이드 ${page}`} className="absolute inset-0 h-full w-full object-contain" />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center text-6xl font-bold text-paper"
                style={{ backgroundColor: `hsl(${page * 60}, 40%, 15%)` }}
              >
                {page}
              </div>
            )
          )}

          {status === 'ACTIVE' && <DrawingCanvas drawings={drawings} laserPoint={laserPoint} />}

          {highlightedQ && (
            <div className="absolute inset-x-4 bottom-4 rounded-lg bg-dark-base/90 p-4 backdrop-blur-sm border border-dark-border">
              <p className="mb-1 text-xs font-semibold text-electric-violet">
                {highlightedQ.nickname ?? '익명'}의 질문
              </p>
              <p className="text-sm font-medium text-paper">{highlightedQ.content}</p>
            </div>
          )}
        </div>
      </div>

      {/* Q&A 영역 — 라이트 */}
      <div className="flex-1 p-6">
        <h2 className="mb-4 text-sm font-semibold text-midnight-ink">질문하기</h2>
        <form onSubmit={submitQuestion} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="닉네임 (선택)"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            className="rounded-lg border border-mist bg-paper px-4 py-2.5 text-sm text-deep-indigo placeholder-silver focus:border-electric-violet focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="질문을 입력하세요 (최대 300자)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={300}
              required
              className="flex-1 rounded-lg border border-mist bg-paper px-4 py-2.5 text-sm text-deep-indigo placeholder-silver focus:border-electric-violet focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-electric-violet px-5 py-2.5 text-sm font-semibold text-paper hover:opacity-90 transition-opacity"
            >
              전송
            </button>
          </div>
          {submitted && (
            <p className="text-xs font-medium text-electric-violet">질문이 전송되었습니다!</p>
          )}
        </form>
      </div>
    </div>
  );
}
