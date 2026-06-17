'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getToken, type PresentationDetail } from '@/lib/api';

function useQrDataUrl(url: string): string {
  const [qr, setQr] = useState('');
  useEffect(() => {
    if (!url) return;
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(url, { width: 240, margin: 2, color: { dark: '#000', light: '#fff' } })
        .then(setQr);
    });
  }, [url]);
  return qr;
}

function loadScripts(presentationId: string): string[] {
  try {
    const raw = localStorage.getItem(`scripts-${presentationId}`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveScripts(presentationId: string, scripts: string[]): void {
  localStorage.setItem(`scripts-${presentationId}`, JSON.stringify(scripts));
}

export default function PresentationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [presentation, setPresentation] = useState<PresentationDetail | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeSession, setActiveSession] = useState<{ id: string } | null>(null);
  const [scripts, setScripts] = useState<string[]>([]);
  const [tab, setTab] = useState<'slides' | 'sessions'>('slides');

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    api.getPresentation(id)
      .then((p) => {
        setPresentation(p);
        // 서버 scripts 우선, 없으면 localStorage fallback
        if (p.scripts && p.scripts.length > 0) {
          setScripts(p.scripts);
          saveScripts(id, p.scripts);
        } else {
          setScripts(loadScripts(id));
        }
      })
      .catch(() => router.push('/library'));
  }, [id, router]);

  const remoteUrl = activeSession ? `${typeof window !== 'undefined' ? window.location.origin : ''}/remote/${activeSession.id}` : '';
  const remoteQr = useQrDataUrl(remoteUrl);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScriptChange = useCallback((idx: number, value: string) => {
    setScripts((prev) => {
      const next = [...prev];
      next[idx] = value;
      saveScripts(id, next);
      // 서버에 debounce 저장 (1초 후)
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        api.saveScripts(id, next).catch(() => {});
      }, 1000);
      return next;
    });
  }, [id]);

  async function startSession() {
    setError('');
    setCreating(true);
    try {
      const session = await api.createSession(id);
      setActiveSession(session);
      setPresentation((prev) =>
        prev ? { ...prev, sessions: [session as typeof prev.sessions[0], ...prev.sessions] } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '세션 생성 실패');
    } finally {
      setCreating(false);
    }
  }

  if (!presentation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-pebble">
        <p className="text-slate-text">로딩 중...</p>
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const isReady = presentation.status === 'READY';

  return (
    <div className="min-h-screen bg-pebble">
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-mist bg-paper px-10">
        <Link href="/library" className="text-sm font-medium text-slate-text hover:text-deep-indigo">
          ← 보관함
        </Link>
      </header>

      <main className="mx-auto max-w-[1200px] p-8">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-midnight-ink">{presentation.title}</h1>
          <p className="mt-2 text-sm text-slate-text">
            {presentation.images.length > 0 ? `${presentation.images.length}페이지` : '변환 중...'}
            {' · '}
            {new Date(presentation.createdAt).toLocaleDateString('ko-KR')}
          </p>
        </div>

        {/* 발표 시작 패널 */}
        <div className="mb-8 rounded-lg border border-mist bg-paper p-6">
          <h2 className="mb-4 text-sm font-semibold text-midnight-ink">새 발표 시작</h2>
          {!isReady ? (
            <p className="text-sm text-slate-text">
              {presentation.status === 'PROCESSING'
                ? 'PDF 변환이 완료된 후 발표를 시작할 수 있습니다.'
                : 'PDF 변환에 실패했습니다. 보관함에서 재업로드 해주세요.'}
            </p>
          ) : activeSession ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              {/* 리모컨 QR */}
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs font-semibold text-slate-text">📱 리모컨 (스마트폰으로 스캔)</p>
                {remoteQr ? (
                  <div className="rounded-xl bg-paper p-3 shadow-sm border border-mist">
                    <img src={remoteQr} alt="리모컨 QR" width={180} height={180} />
                  </div>
                ) : (
                  <div className="h-[180px] w-[180px] animate-pulse rounded-xl bg-bone" />
                )}
                <Link
                  href={remoteUrl}
                  className="text-xs text-electric-violet underline underline-offset-2"
                >
                  직접 열기 →
                </Link>
              </div>

              {/* 디스플레이 버튼 */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-slate-text">🖥 디스플레이 (대형 스크린)</p>
                <a
                  href={`${origin}/display/${activeSession.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-mist bg-bone px-4 py-2.5 text-center text-sm font-medium text-deep-indigo hover:border-electric-violet/40 transition-colors"
                >
                  디스플레이 열기
                </a>
                <p className="text-xs text-slate-text">새 탭에서 열려요</p>
              </div>
            </div>
          ) : (
            <>
              {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
              <button
                onClick={startSession}
                disabled={creating}
                className="rounded-xl bg-electric-violet px-6 py-3 font-semibold text-paper hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {creating ? '생성 중...' : '발표 시작'}
              </button>
            </>
          )}
        </div>

        {/* 탭 */}
        <div className="mb-4 flex gap-4 border-b border-mist">
          <button
            onClick={() => setTab('slides')}
            className={`pb-3 text-sm font-semibold transition-colors ${tab === 'slides' ? 'border-b-2 border-electric-violet text-electric-violet' : 'text-slate-text'}`}
          >
            슬라이드 & 스크립트
          </button>
          <button
            onClick={() => setTab('sessions')}
            className={`pb-3 text-sm font-semibold transition-colors ${tab === 'sessions' ? 'border-b-2 border-electric-violet text-electric-violet' : 'text-slate-text'}`}
          >
            과거 발표 ({presentation.sessions.length})
          </button>
        </div>

        {/* 슬라이드 & 스크립트 탭 */}
        {tab === 'slides' && (
          <div>
            {presentation.images.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-mist bg-paper">
                <p className="text-sm text-slate-text">
                  {presentation.status === 'PROCESSING' ? 'PDF 변환 중...' : '슬라이드 없음'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {presentation.images.map((url, i) => (
                  <div key={i} className="flex gap-4 rounded-lg border border-mist bg-paper p-4">
                    <div className="flex-shrink-0">
                      <p className="mb-2 text-xs font-semibold text-slate-text">{i + 1}페이지</p>
                      <img
                        src={url}
                        alt={`슬라이드 ${i + 1}`}
                        className="w-48 rounded border border-mist object-cover"
                        style={{ aspectRatio: '16/9' }}
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <p className="text-xs font-semibold text-slate-text">스크립트</p>
                      <textarea
                        value={scripts[i] ?? ''}
                        onChange={(e) => handleScriptChange(i, e.target.value)}
                        placeholder="이 슬라이드에서 말할 내용을 입력하세요..."
                        className="flex-1 resize-none rounded-lg border border-mist bg-bone p-3 text-sm text-deep-indigo placeholder-silver focus:border-electric-violet focus:outline-none"
                        rows={4}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 과거 발표 탭 */}
        {tab === 'sessions' && (
          <div className="flex flex-col gap-6">
            {presentation.sessions.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-mist bg-paper">
                <p className="text-sm text-slate-text">아직 발표 기록이 없어요</p>
              </div>
            ) : (
              presentation.sessions.map((s, i) => (
                <div key={s.id} className="rounded-lg border border-mist bg-paper p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-midnight-ink">
                      발표 {presentation.sessions.length - i}회차 · {new Date(s.createdAt).toLocaleString('ko-KR')}
                    </p>
                    {s.recording && (
                      <Link
                        href={`/replay/${s.recording.id}`}
                        className="rounded-xl border border-electric-violet px-4 py-1.5 text-sm font-medium text-electric-violet hover:bg-electric-violet/5 transition-colors"
                      >
                        리플레이 보기
                      </Link>
                    )}
                  </div>

                  {/* 녹음 파일 */}
                  {s.recording?.audioUrl ? (
                    <div className="mb-4">
                      <p className="mb-2 text-xs font-semibold text-slate-text">녹음 파일</p>
                      <audio controls src={s.recording.audioUrl} className="w-full" />
                    </div>
                  ) : (
                    <p className="mb-4 text-xs text-fog">녹음 없음</p>
                  )}

                  {/* Q&A */}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-text">
                      받은 질문 ({s.questions?.length ?? 0}개)
                    </p>
                    {s.questions?.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {s.questions.map((q) => (
                          <div key={q.id} className="rounded-lg bg-bone p-3">
                            <p className="mb-1 text-xs text-slate-text">{q.nickname ?? '익명'}</p>
                            <p className="text-sm text-deep-indigo">{q.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-fog">질문 없음</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
