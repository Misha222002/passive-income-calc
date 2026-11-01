import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "**.cursor.com",
    "**.cursor.sh",
    "**.cloud.cursor.com",
    "**.agent.cvm.dev",
    "*.agent.cvm.dev",
    "**.cvm.dev",
    "p-4317-pod-o5a4p4gykjgfnpfgufb5tosxlm-c63f1fbfcf8a83031382-us3p.agent.cvm.dev",
  ],
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
