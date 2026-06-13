'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getToken, clearToken, type Presentation } from '@/lib/api';

const STATUS_LABEL: Record<string, string> = {
  PROCESSING: '변환 중',
  READY: '준비 완료',
  FAILED: '변환 실패',
};

const STATUS_CLASS: Record<string, string> = {
  PROCESSING: 'bg-bone text-slate-text',
  READY: 'bg-electric-violet/10 text-electric-violet',
  FAILED: 'bg-red-50 text-red-500',
};

export default function LibraryPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    loadList();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!presentations.some((p) => p.status === 'PROCESSING')) return;
    const id = setInterval(loadList, 5000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentations]);

  async function loadList() {
    try {
      setPresentations(await api.getPresentations());
    } catch {
      router.push('/login');
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('pdf', file);
      form.append('title', file.name.replace(/\.pdf$/i, ''));
      await api.uploadPresentation(form);
      await loadList();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="min-h-screen bg-pebble">
      {/* 네비게이션 바 */}
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-mist bg-paper px-10">
        <span className="text-base font-semibold text-midnight-ink">내 발표 자료</span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-xl bg-electric-violet px-4 py-2 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {uploading ? '업로드 중...' : '+ PDF 업로드'}
          </button>
          <button
            onClick={() => { clearToken(); router.push('/login'); }}
            className="text-sm font-medium text-slate-text hover:text-deep-indigo"
          >
            로그아웃
          </button>
        </div>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleUpload}
      />

      <main className="mx-auto max-w-[1200px] p-8">
        {uploadError && (
          <p className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600">{uploadError}</p>
        )}

        {presentations.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-32">
            <p className="text-base text-slate-text">아직 업로드한 발표 자료가 없습니다</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border border-dashed border-electric-violet/40 px-8 py-4 text-sm font-medium text-electric-violet hover:border-electric-violet transition-colors"
            >
              PDF 파일 업로드하기
            </button>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {presentations.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/presentations/${p.id}`}
                  className="flex items-center justify-between rounded-lg border border-mist bg-paper px-6 py-5 hover:border-electric-violet/40 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-midnight-ink">{p.title}</p>
                    <p className="mt-1 text-sm text-slate-text">
                      {new Date(p.createdAt).toLocaleDateString('ko-KR')}
                      {p.images.length > 0 && ` · ${p.images.length}페이지`}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[p.status]}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
