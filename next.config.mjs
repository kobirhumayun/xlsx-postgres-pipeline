/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/backup": ["./backup/backup.sh"],
    "/api/restore": ["./backup/restore.sh"],
  },
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "128mb",
    },
  },
};

export default nextConfig;
