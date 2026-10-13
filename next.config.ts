import type { NextConfig } from "next";
const config: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  distDir:
    process.env.NODE_ENV === "development" && process.env.GAMBLING_TEST_SERVER
      ? process.env.GAMBLING_TEST_SERVER === "demo"
        ? ".next-e2e-demo"
        : ".next-e2e"
      : process.env.NODE_ENV === "development" &&
          process.env.NEXT_PUBLIC_DEMO_MODE === "true"
        ? ".next-demo"
        : ".next",
};
export default config;
