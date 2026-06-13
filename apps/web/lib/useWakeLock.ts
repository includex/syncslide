'use client';

/**
 * Screen Wake Lock 훅 (PRD §12.3).
 *
 * 발표자 모드 진입 시 화면 꺼짐을 방지한다. 미지원 브라우저에서는
 * 경고만 남기고 발표는 그대로 진행한다.
 * visibilitychange로 탭이 다시 보일 때 자동 재획득한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type WakeLockStatus = 'idle' | 'active' | 'unsupported' | 'error';

export function useWakeLock() {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const enabledRef = useRef(false);
  const [status, setStatus] = useState<WakeLockStatus>('idle');

  const acquire = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      setStatus('unsupported');
      return;
    }
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      sentinelRef.current = sentinel;
      sentinel.addEventListener('release', () => {
        sentinelRef.current = null;
      });
      setStatus('active');
    } catch {
      // 권한 거부/정책 등 — 발표는 계속 진행
      setStatus('error');
    }
  }, []);

  const enable = useCallback(() => {
    enabledRef.current = true;
    void acquire();
  }, [acquire]);

  const release = useCallback(() => {
    enabledRef.current = false;
    void sentinelRef.current?.release();
    sentinelRef.current = null;
    setStatus('idle');
  }, []);

  // 탭이 다시 활성화되면 재획득 (브라우저가 자동 해제하므로)
  useEffect(() => {
    const onVisible = () => {
      if (enabledRef.current && document.visibilityState === 'visible') {
        void acquire();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void sentinelRef.current?.release();
      sentinelRef.current = null;
    };
  }, [acquire]);

  return { status, enable, release };
}
