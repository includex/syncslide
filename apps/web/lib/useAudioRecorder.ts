'use client';

/**
 * 모바일 마이크 오디오 녹음 (Dev A, Phase 3 / PRD §12).
 *
 * 발표 시작과 함께 녹음을 시작하고, 종료 시 Blob을 반환한다.
 * 권한 거부/미지원/오류여도 발표는 계속 진행한다(상태만 표시).
 */
import { useCallback, useRef, useState } from 'react';

export type RecorderStatus =
  | 'idle'
  | 'recording'
  | 'denied'
  | 'unsupported'
  | 'error'
  | 'stopped';

export function useAudioRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<RecorderStatus>('idle');

  const start = useCallback(async () => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setStatus('unsupported');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start();
      recorderRef.current = rec;
      setStatus('recording');
    } catch {
      // 권한 거부 등 — 녹음 없이 발표 진행
      setStatus('denied');
    }
  }, []);

  /** 녹음 정지 후 Blob 반환 (없으면 null) */
  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === 'inactive') {
        resolve(null);
        return;
      }
      rec.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: 'audio/webm' })
            : null;
        setStatus('stopped');
        resolve(blob);
      };
      rec.stop();
    });
  }, []);

  return { status, start, stop };
}
