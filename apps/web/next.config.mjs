/** @type {import('next').NextConfig} */
const nextConfig = {
  // 모노레포 공유 패키지(@syncslide/shared)를 Next가 트랜스파일하도록 지정
  transpilePackages: ['@syncslide/shared'],
};

export default nextConfig;
