import type { PresentationDetail, SessionDetail, RecordingDetail } from './api';

// 목업용 슬라이드 이미지 (무료 플레이스홀더)
export const MOCK_IMAGES = [
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&h=1080&fit=crop',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1920&h=1080&fit=crop',
];

export const MOCK_PRESENTATION: PresentationDetail = {
  id: 'demo',
  title: 'SyncSlide 데모 발표',
  pdfUrl: '',
  images: MOCK_IMAGES,
  scripts: [],
  status: 'READY',
  createdAt: new Date(Date.now() - 3600000).toISOString(),
  sessions: [
    {
      id: 'demo',
      presentationId: 'demo',
      status: 'FINISHED',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      recording: { id: 'demo-recording', audioUrl: null },
      questions: [],
    },
  ],
};

export const MOCK_SESSION: SessionDetail = {
  id: 'demo',
  presentationId: 'demo',
  status: 'READY',
  createdAt: new Date().toISOString(),
  presentation: {
    title: 'SyncSlide 데모 발표',
    images: MOCK_IMAGES,
    scripts: [],
  },
  questions: [
    { id: 'q1', sessionId: 'demo', nickname: '김철수', content: '슬라이드 몇 장까지 지원하나요?', createdAt: new Date().toISOString() },
    { id: 'q2', sessionId: 'demo', nickname: '이영희', content: '리플레이는 얼마나 오래 저장되나요?', createdAt: new Date().toISOString() },
    { id: 'q3', sessionId: 'demo', nickname: '박민준', content: '오프라인에서도 사용 가능한가요?', createdAt: new Date().toISOString() },
  ],
};

export const MOCK_RECORDING: RecordingDetail = {
  id: 'demo-recording',
  sessionId: 'demo',
  audioUrl: null,
  timeline: [
    { t: 0, type: 'SESSION_START' },
    { t: 2000, type: 'SLIDE_CHANGE', page: 1 },
    { t: 8000, type: 'SLIDE_CHANGE', page: 2 },
    { t: 15000, type: 'DRAW_START', color: '#7270ff', thickness: 4 },
    { t: 15200, type: 'DRAW_MOVE', x: 0.3, y: 0.4 },
    { t: 15400, type: 'DRAW_MOVE', x: 0.5, y: 0.6 },
    { t: 15600, type: 'DRAW_END' },
    { t: 20000, type: 'SLIDE_CHANGE', page: 3 },
    { t: 30000, type: 'SLIDE_CHANGE', page: 4 },
    { t: 40000, type: 'SLIDE_CHANGE', page: 5 },
    { t: 50000, type: 'SESSION_END' },
  ],
  createdAt: new Date(Date.now() - 3600000).toISOString(),
  session: {
    presentation: {
      title: 'SyncSlide 데모 발표',
      images: MOCK_IMAGES,
    },
  },
};
