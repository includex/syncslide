'use client';

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const DEMO = process.env.NEXT_PUBLIC_DEMO === 'true';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (DEMO) return 'demo-token';
  return localStorage.getItem('syncslide_token');
}

export function setToken(token: string): void {
  if (!DEMO) localStorage.setItem('syncslide_token', token);
}

export function clearToken(): void {
  if (!DEMO) localStorage.removeItem('syncslide_token');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 백엔드 서버 주소를 확인해 주세요.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ── Demo mode API ─────────────────────────────────────────────────

function demoApi() {
  // dynamic import to avoid bundling mock data in production
  return import('./mockData');
}

export const api = {
  register: async (email: string, _password: string) => {
    if (DEMO) return { token: 'demo-token', userId: 'demo-user' } as AuthResponse;
    return request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: _password }),
    });
  },

  login: async (email: string, _password: string) => {
    if (DEMO) return { token: 'demo-token', userId: 'demo-user' } as AuthResponse;
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: _password }),
    });
  },

  getPresentations: async () => {
    if (DEMO) {
      const { MOCK_PRESENTATION } = await demoApi();
      return [MOCK_PRESENTATION] as Presentation[];
    }
    return request<Presentation[]>('/api/presentations');
  },

  getPresentation: async (id: string) => {
    if (DEMO) {
      const { MOCK_PRESENTATION } = await demoApi();
      return MOCK_PRESENTATION;
    }
    return request<PresentationDetail>(`/api/presentations/${id}`);
  },

  uploadPresentation: async (formData: FormData) => {
    if (DEMO) {
      const { MOCK_PRESENTATION } = await demoApi();
      return MOCK_PRESENTATION as Presentation;
    }
    return request<Presentation>('/api/presentations', { method: 'POST', body: formData });
  },

  createSession: async (_presentationId: string) => {
    if (DEMO) {
      // 매번 고유 세션 id 발급 — 공유 'demo' 세션의 stale 상태(이전 ACTIVE)를
      // 물려받아 디스플레이가 QR 대기화면 대신 슬라이드를 띄우던 버그 방지.
      const id = `demo-${Date.now()}`;
      return { id, presentationId: 'demo', status: 'READY', createdAt: new Date().toISOString() } as Session;
    }
    return request<Session>(`/api/presentations/${_presentationId}/sessions`, { method: 'POST' });
  },

  getSession: async (id: string) => {
    if (DEMO) {
      const { MOCK_SESSION } = await demoApi();
      return { ...MOCK_SESSION, id };
    }
    return request<SessionDetail>(`/api/sessions/${id}`);
  },

  saveRecording: async (sessionId: string, formData: FormData) => {
    if (DEMO) {
      const { MOCK_RECORDING } = await demoApi();
      return MOCK_RECORDING as Recording;
    }
    return request<Recording>(`/api/sessions/${sessionId}/recording`, { method: 'POST', body: formData });
  },

  getRecording: async (id: string) => {
    if (DEMO) {
      const { MOCK_RECORDING } = await demoApi();
      return { ...MOCK_RECORDING, id };
    }
    return request<RecordingDetail>(`/api/recordings/${id}`);
  },
};

// ── Types ─────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  userId: string;
}

export interface Presentation {
  id: string;
  title: string;
  pdfUrl: string;
  images: string[];
  status: 'PROCESSING' | 'READY' | 'FAILED';
  createdAt: string;
}

export interface PresentationDetail extends Presentation {
  sessions: (Session & { recording: { id: string } | null })[];
}

export interface Session {
  id: string;
  presentationId: string;
  status: string;
  createdAt: string;
}

export interface SessionDetail extends Session {
  presentation: { title: string; images: string[] };
  questions: Question[];
}

export interface Question {
  id: string;
  sessionId: string;
  nickname?: string | null;
  content: string;
  createdAt: string;
}

export interface Recording {
  id: string;
  sessionId: string;
  audioUrl?: string | null;
  timeline: unknown[];
  createdAt: string;
}

export interface RecordingDetail extends Recording {
  session: {
    presentation: { title: string; images: string[] };
  };
}
