/** @type {import('next').NextConfig} */
const apiTarget = (process.env.API_PROXY_TARGET ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

const nextConfig = {
  // 모노레포 공유 패키지(@syncslide/shared)를 Next가 트랜스파일하도록 지정
  transpilePackages: ['@syncslide/shared'],
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
