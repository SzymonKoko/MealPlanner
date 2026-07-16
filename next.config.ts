import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import path from "node:path";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd()),
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default withSerwist(nextConfig);
