/** @type {import('next').NextConfig} */
const apiTarget = (process.env.API_PROXY_TARGET ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

// 같은 와이파이의 폰/다른 기기에서 LAN IP로 접속해 테스트할 때 Next 개발 서버가
// /_next/* 리소스(HMR 등)에 대한 cross-origin 요청을 막지 않도록 허용.
// 사설망 대역(192.168.*, 10.*, 172.16~31.*)을 와일드카드로 등록.
const allowedDevOrigins = ['192.168.*.*', '10.*.*.*', '172.16.*.*', '172.17.*.*', '172.18.*.*', '172.19.*.*', '*.trycloudflare.com'];

const nextConfig = {
  // 모노레포 공유 패키지(@syncslide/shared)를 Next가 트랜스파일하도록 지정
  transpilePackages: ['@syncslide/shared'],
  allowedDevOrigins,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
