import Link from 'next/link';

const DEMO_SESSION = 'demo';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 p-8">
      <div>
        <h1 className="text-4xl font-bold">SyncSlide</h1>
        <p className="mt-2 text-neutral-400">
          모바일을 리모컨처럼 — 실시간 프레젠테이션 동기화
        </p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-lg font-semibold">Phase 0 동기화 데모</h2>
        <p className="mt-1 text-sm text-neutral-400">
          두 링크를 다른 탭/기기에서 열고, 리모컨에서 슬라이드를 넘기면
          디스플레이가 즉시 따라옵니다.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href={`/remote/${DEMO_SESSION}`}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500"
          >
            📱 리모컨 열기
          </Link>
          <Link
            href={`/display/${DEMO_SESSION}`}
            className="rounded-lg border border-neutral-700 px-4 py-2 font-medium hover:bg-neutral-800"
          >
            🖥️ 디스플레이 열기
          </Link>
        </div>
      </div>
    </main>
  );
}
