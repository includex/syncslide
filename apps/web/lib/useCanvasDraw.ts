'use client';

/**
 * 판서 Canvas 렌더링 훅 (Dev A, Phase 2).
 *
 * 정규화 좌표(0~1) 스트로크를 보관하고 캔버스에 렌더한다.
 * 화면 방향 전환/리사이즈 시 백킹 스토어를 갱신하고 스트로크에서 재렌더하므로
 * 판서 상태가 유지된다 (REMOTE_MOBILE_UX.md §7).
 */
import { useCallback, useEffect, useRef } from 'react';

export interface NPoint {
  x: number;
  y: number;
}
type Stroke = NPoint[];

export const PEN_COLOR = '#FF6B6B'; // 코랄 레드 (REMOTE_MOBILE_UX.md §3.4)
export const PEN_WIDTH = 4;

export function useCanvasDraw(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke | null>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = PEN_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PEN_COLOR;
    const all = currentRef.current
      ? [...strokesRef.current, currentRef.current]
      : strokesRef.current;
    for (const stroke of all) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      stroke.forEach((p, i) => {
        const px = p.x * width;
        const py = p.y * height;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
  }, [canvasRef]);

  /** 백킹 스토어를 레이아웃 크기에 맞추고 재렌더 (리사이즈/회전 시) */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    render();
  }, [canvasRef, render]);

  const beginStroke = useCallback(
    (p: NPoint) => {
      currentRef.current = [p];
      render();
    },
    [render]
  );

  const extendStroke = useCallback(
    (p: NPoint) => {
      if (!currentRef.current) return;
      currentRef.current.push(p);
      render();
    },
    [render]
  );

  const endStroke = useCallback(() => {
    if (currentRef.current && currentRef.current.length > 0) {
      strokesRef.current.push(currentRef.current);
    }
    currentRef.current = null;
    render();
  }, [render]);

  /** 현재 페이지 판서 전체 삭제 */
  const clear = useCallback(() => {
    strokesRef.current = [];
    currentRef.current = null;
    render();
  }, [render]);

  // 리사이즈/회전 대응
  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    };
  }, [resize]);

  return { beginStroke, extendStroke, endStroke, clear, resize };
}
