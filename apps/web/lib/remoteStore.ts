'use client';

/**
 * 발표자 리모컨 상태 store (Dev A, Phase 1~2).
 *
 * 소켓 인스턴스 자체는 컴포넌트의 ref에서 관리하고, 이 store는
 * UI가 구독하는 발표자측 상태(세션 상태/페이지/연결/모드)를 집약한다.
 * 줌·팬 같은 일시적 뷰 변환은 컴포넌트 로컬 상태로 둔다.
 */
import { create } from 'zustand';
import type { SessionStatus } from '@syncslide/shared';

/** 리모컨 4-모드 (REMOTE_MOBILE_UX.md §3) */
export type RemoteMode = 'slide' | 'script' | 'laser' | 'draw';

interface RemoteState {
  /** 세션 상태머신 미러 (서버가 진실의 원천, 리모컨은 반영만) */
  status: SessionStatus;
  /** 소켓 연결 여부 */
  connected: boolean;
  /** 현재 페이지 (1-base, 0이면 미시작) */
  currentPage: number;
  /** 전체 슬라이드 수 */
  totalPages: number;
  /** 현재 리모컨 모드 */
  mode: RemoteMode;

  setStatus: (status: SessionStatus) => void;
  setConnected: (connected: boolean) => void;
  setPage: (page: number) => void;
  setTotalPages: (n: number) => void;
  setMode: (mode: RemoteMode) => void;
  /** 같은 모드 버튼 재탭 시 슬라이드 모드로 토글 (스크립트/레이저) */
  toggleMode: (mode: RemoteMode) => void;
  reset: () => void;
}

const initial = {
  status: 'READY' as SessionStatus,
  connected: false,
  currentPage: 0,
  totalPages: 0,
  mode: 'slide' as RemoteMode,
};

export const useRemoteStore = create<RemoteState>((set) => ({
  ...initial,
  setStatus: (status) => set({ status }),
  setConnected: (connected) => set({ connected }),
  setPage: (page) => set({ currentPage: page }),
  setTotalPages: (n) => set({ totalPages: n }),
  setMode: (mode) => set({ mode }),
  toggleMode: (mode) =>
    set((s) => ({ mode: s.mode === mode ? 'slide' : mode })),
  reset: () => set(initial),
}));
