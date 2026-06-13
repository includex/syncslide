'use client';

/**
 * 발표자 리모컨 상태 store (Dev A, Phase 1).
 *
 * 소켓 인스턴스 자체는 컴포넌트의 ref에서 관리하고, 이 store는
 * UI가 구독하는 발표자측 상태(세션 상태/페이지/연결)를 집약한다.
 * Phase 2(도구 선택)·Phase 3(녹음 상태)에서 필드를 확장한다.
 */
import { create } from 'zustand';
import type { SessionStatus } from '@syncslide/shared';

interface RemoteState {
  /** 세션 상태머신 미러 (서버가 진실의 원천, 리모컨은 반영만) */
  status: SessionStatus;
  /** 소켓 연결 여부 */
  connected: boolean;
  /** 현재 페이지 (1-base, 0이면 미시작) */
  currentPage: number;
  /** 전체 슬라이드 수 */
  totalPages: number;

  setStatus: (status: SessionStatus) => void;
  setConnected: (connected: boolean) => void;
  setPage: (page: number) => void;
  setTotalPages: (n: number) => void;
  reset: () => void;
}

const initial = {
  status: 'READY' as SessionStatus,
  connected: false,
  currentPage: 0,
  totalPages: 0,
};

export const useRemoteStore = create<RemoteState>((set) => ({
  ...initial,
  setStatus: (status) => set({ status }),
  setConnected: (connected) => set({ connected }),
  setPage: (page) => set({ currentPage: page }),
  setTotalPages: (n) => set({ totalPages: n }),
  reset: () => set(initial),
}));
