import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SyncSlide',
  description: '실시간 프레젠테이션 동기화 서비스',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
