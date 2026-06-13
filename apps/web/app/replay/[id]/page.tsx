'use client';
/**
 * 리플레이 플레이어 (PRD §19)
 * 오디오 currentTime 기준 타임라인 이벤트 재적용
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { api, type RecordingDetail } from '@/lib/api';
import { DrawingCanvas } from '@/components/DrawingCanvas';
import type { DrawEvent, TimelineEvent } from '@syncslide/shared';

export default function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const audioRef = useRef<HTMLAudioElement>(null);
  const laserTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [recording, setRecording] = useState<RecordingDetail | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [drawingsByPage, setDrawingsByPage] = useState<Record<number, DrawEvent[]>>({});
  const [laserPoint, setLaserPoint] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    api.getRecording(id).then(setRecording).catch(() => setError('리플레이를 불러올 수 없습니다'));
  }, [id]);

  const applyTimeline = useCallback(
    (currentMs: number) => {
      if (!recording) return;
      const timeline = recording.timeline as TimelineEvent[];

      let curPage = 1;
      const drawsByPage: Record<number, DrawEvent[]> = {};
      let curColor = '#FF3B30';
      let curThickness = 4;
      let inStroke = false;

      for (const ev of timeline) {
        if (ev.t > currentMs) break;

        switch (ev.type) {
          case 'SLIDE_CHANGE':
            curPage = ev.page;
            break;
          case 'DRAW_START':
            curColor = ev.color;
            curThickness = ev.thickness;
            drawsByPage[curPage] = [...(drawsByPage[curPage] ?? []), {
              type: 'start', page: curPage, color: curColor, thickness: curThickness,
            }];
            inStroke = true;
            break;
          case 'DRAW_MOVE':
            if (inStroke) {
              drawsByPage[curPage] = [...(drawsByPage[curPage] ?? []), {
                type: 'move', page: curPage, x: ev.x, y: ev.y,
              }];
            }
            break;
          case 'DRAW_END':
            if (inStroke) {
              drawsByPage[curPage] = [...(drawsByPage[curPage] ?? []), { type: 'end', page: curPage }];
              inStroke = false;
            }
            break;
          case 'DRAW_CLEAR':
            drawsByPage[ev.page] = [];
            break;
          case 'LASER_POINTER':
            setLaserPoint({ x: ev.x, y: ev.y });
            if (laserTimerRef.current) clearTimeout(laserTimerRef.current);
            laserTimerRef.current = setTimeout(() => setLaserPoint(null), 1200);
            break;
          case 'QA_SELECT':
          case 'QA_HIDE':
            break;
        }
      }

      setPage(curPage);
      setDrawingsByPage(drawsByPage);
    },
    [recording]
  );

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (audio) applyTimeline(audio.currentTime * 1000);
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-pebble">
        <p className="text-red-500">{error}</p>
        <Link href="/library" className="text-sm font-medium text-electric-violet hover:underline">
          보관함으로
        </Link>
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-pebble">
        <p className="text-slate-text">로딩 중...</p>
      </div>
    );
  }

  const images = recording.session.presentation.images;
  const slideUrl = images[page - 1];
  const drawings = drawingsByPage[page] ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-pebble">
      {/* 네비게이션 바 */}
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-mist bg-paper px-10">
        <Link href="/library" className="text-sm font-medium text-slate-text hover:text-deep-indigo">
          ← 보관함
        </Link>
        <h1 className="text-sm font-semibold text-midnight-ink">
          {recording.session.presentation.title} — 리플레이
        </h1>
        <div className="w-24 text-right text-xs text-slate-text">
          {page} / {images.length || '?'}
        </div>
      </header>

      {/* 슬라이드 — 다크 */}
      <div className="flex flex-1 items-center justify-center bg-black">
        <div
          className="relative"
          style={{ width: 'min(100vw, 177.78vh)', height: 'min(calc(100vh - 140px), 56.25vw)' }}
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
              style={{ backgroundColor: `hsl(${page * 60}, 40%, 15%)` }}
            >
              {page}
            </div>
          )}
          <DrawingCanvas drawings={drawings} laserPoint={laserPoint} />
        </div>
      </div>

      {/* 오디오 컨트롤 — 라이트 */}
      <div className="border-t border-mist bg-paper px-8 py-4">
        {recording.audioUrl ? (
          <audio
            ref={audioRef}
            src={recording.audioUrl}
            controls
            onTimeUpdate={handleTimeUpdate}
            onSeeked={handleTimeUpdate}
            className="w-full"
          />
        ) : (
          <p className="text-center text-sm text-slate-text">
            오디오 없이 저장된 발표입니다. 타임라인만 재생됩니다.
          </p>
        )}
      </div>
    </div>
  );
}
