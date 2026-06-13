import Link from 'next/link';

const DEMO_SESSION = 'demo';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1200px] flex-col justify-center gap-10 px-16 py-24">
      <div>
        <h1 className="text-5xl font-bold text-midnight-ink leading-tight">
          발표를 <span className="text-electric-violet">더 스마트하게</span>
        </h1>
        <p className="mt-4 text-lg text-slate-text max-w-md">
          모바일 하나로 대형 스크린과 청중 화면을 실시간 동기화하는 프레젠테이션 서비스
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/library"
          className="rounded-xl bg-electric-violet px-6 py-3 font-semibold text-paper hover:opacity-90 transition-opacity"
        >
          발표 시작하기
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-electric-violet px-6 py-3 font-medium text-electric-violet hover:bg-electric-violet/5 transition-colors"
        >
          로그인
        </Link>
      </div>

      <div className="rounded-lg border border-mist bg-paper p-6 max-w-lg">
        <h2 className="text-base font-semibold text-midnight-ink">Phase 0 동기화 데모</h2>
        <p className="mt-1 text-sm text-slate-text">
          두 링크를 다른 탭에서 열고 리모컨에서 슬라이드를 넘기면 디스플레이가 즉시 따라옵니다.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href={`/remote/${DEMO_SESSION}`}
            className="rounded-xl border border-mist bg-bone px-4 py-2 text-sm font-medium text-deep-indigo hover:border-electric-violet/40 transition-colors"
          >
            📱 리모컨 (데모)
          </Link>
          <Link
            href={`/display/${DEMO_SESSION}`}
            className="rounded-xl border border-mist bg-bone px-4 py-2 text-sm font-medium text-deep-indigo hover:border-electric-violet/40 transition-colors"
          >
            🖥 디스플레이 (데모)
          </Link>
        </div>
      </div>
    </main>
  );
}
