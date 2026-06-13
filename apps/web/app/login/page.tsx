'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await api.login(email, password)
        : await api.register(email, password);
      setToken(res.token);
      router.push('/library');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-pebble p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-3xl font-bold text-midnight-ink">SyncSlide</h1>
        <p className="mb-8 text-sm text-slate-text">실시간 프레젠테이션 동기화 서비스</p>

        {/* 탭 */}
        <div className="mb-6 flex rounded-lg border border-mist bg-paper p-1">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === 'login'
                ? 'bg-electric-violet text-paper'
                : 'text-slate-text hover:text-deep-indigo'
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === 'register'
                ? 'bg-electric-violet text-paper'
                : 'text-slate-text hover:text-deep-indigo'
            }`}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-lg border border-mist bg-paper px-4 py-3 text-deep-indigo placeholder-silver focus:border-electric-violet focus:outline-none"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="rounded-lg border border-mist bg-paper px-4 py-3 text-deep-indigo placeholder-silver focus:border-electric-violet focus:outline-none"
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-electric-violet py-3 font-semibold text-paper hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
          </button>
        </form>
      </div>
    </main>
  );
}
