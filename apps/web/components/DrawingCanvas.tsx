'use client';
import { useEffect, useRef } from 'react';
import type { DrawEvent } from '@syncslide/shared';

interface Props {
  drawings: DrawEvent[];
  laserPoint?: { x: number; y: number } | null;
  className?: string;
}

const W = 1920;
const H = 1080;

export function DrawingCanvas({ drawings, laserPoint, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let inStroke = false;
    let firstPoint = true;

    for (const ev of drawings) {
      if (ev.type === 'clear') {
        ctx.clearRect(0, 0, W, H);
        inStroke = false;
        firstPoint = true;
      } else if (ev.type === 'start') {
        if (inStroke) ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = ev.color ?? '#FF3B30';
        ctx.lineWidth = (ev.thickness ?? 4) * 3;
        inStroke = false;
        firstPoint = true;
      } else if (ev.type === 'move') {
        const px = (ev.x ?? 0) * W;
        const py = (ev.y ?? 0) * H;
        if (firstPoint) {
          ctx.moveTo(px, py);
          firstPoint = false;
          inStroke = true;
        } else {
          ctx.lineTo(px, py);
        }
      } else if (ev.type === 'end') {
        if (inStroke) ctx.stroke();
        inStroke = false;
        firstPoint = true;
      }
    }
    if (inStroke) ctx.stroke();

    if (laserPoint) {
      const lx = laserPoint.x * W;
      const ly = laserPoint.y * H;
      const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 18);
      grad.addColorStop(0, 'rgba(255, 60, 60, 0.95)');
      grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx, ly, 18, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }
  }, [drawings, laserPoint]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className={className ?? 'pointer-events-none absolute inset-0 h-full w-full'}
    />
  );
}
