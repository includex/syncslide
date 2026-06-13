'use client';
import { useEffect, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getToken, type PresentationDetail } from '@/lib/api';

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

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    api.getPresentation(id)
      .then(setPresentation)
      .catch(() => router.push('/library'));
  }, [id, router]);

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
      {/* 네비게이션 바 */}
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-mist bg-paper px-10">
        <Link href="/library" className="text-sm font-medium text-slate-text hover:text-deep-indigo">
          ← 보관함
        </Link>
      </header>

      <main className="mx-auto max-w-[1200px] p-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-midnight-ink">{presentation.title}</h1>
          <p className="mt-2 text-sm text-slate-text">
            {presentation.images.length > 0 ? `${presentation.images.length}페이지` : '변환 중...'}
            {' · '}
            {new Date(presentation.createdAt).toLocaleDateString('ko-KR')}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 슬라이드 미리보기 */}
          {presentation.images.length > 0 && (
            <div className="rounded-lg border border-mist bg-paper p-6 lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold text-midnight-ink">슬라이드 미리보기</h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {presentation.images.slice(0, 8).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`슬라이드 ${i + 1}`}
                    className="aspect-video w-full rounded object-cover border border-mist"
                  />
                ))}
                {presentation.images.length > 8 && (
                  <div className="flex aspect-video items-center justify-center rounded border border-mist bg-bone text-sm text-slate-text">
                    +{presentation.images.length - 8}장
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 발표 시작 패널 */}
          <div className="rounded-lg border border-mist bg-paper p-6">
            <h2 className="mb-4 text-sm font-semibold text-midnight-ink">새 발표 시작</h2>

            {!isReady ? (
              <p className="text-sm text-slate-text">
                {presentation.status === 'PROCESSING'
                  ? 'PDF 변환이 완료된 후 발표를 시작할 수 있습니다.'
                  : 'PDF 변환에 실패했습니다. 보관함에서 재업로드 해주세요.'}
              </p>
            ) : activeSession ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-electric-violet">세션이 생성되었습니다!</p>
                <a
                  href={`${origin}/display/${activeSession.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-mist bg-bone px-4 py-2.5 text-center text-sm font-medium text-deep-indigo hover:border-electric-violet/40 transition-colors"
                >
                  🖥 디스플레이 열기
                </a>
                <Link
                  href={`/remote/${activeSession.id}`}
                  className="block rounded-xl bg-electric-violet px-4 py-2.5 text-center text-sm font-semibold text-paper hover:opacity-90 transition-opacity"
                >
                  📱 리모컨 열기
                </Link>
                <p className="text-xs text-slate-text">
                  디스플레이는 대형 스크린에서, 리모컨은 스마트폰에서 여세요.
                </p>
              </div>
            ) : (
              <>
                {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
                <button
                  onClick={startSession}
                  disabled={creating}
                  className="w-full rounded-xl bg-electric-violet py-3 font-semibold text-paper hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {creating ? '생성 중...' : '발표 시작'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* 과거 세션 / 리플레이 */}
        {presentation.sessions.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-midnight-ink">과거 발표</h2>
            <div className="rounded-lg border border-mist bg-paper">
              {presentation.sessions.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between px-6 py-4 ${
                    i !== 0 ? 'border-t border-mist' : ''
                  }`}
                >
                  <span className="text-sm text-slate-text">
                    {new Date(s.createdAt).toLocaleString('ko-KR')}
                  </span>
                  {s.recording ? (
                    <Link
                      href={`/replay/${s.recording.id}`}
                      className="rounded-xl border border-electric-violet px-4 py-1.5 text-sm font-medium text-electric-violet hover:bg-electric-violet/5 transition-colors"
                    >
                      리플레이 보기
                    </Link>
                  ) : (
                    <span className="text-sm text-fog">저장 없음</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
