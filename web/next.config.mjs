import path from "path";
import { fileURLToPath } from "url";

/** @type {import('next').NextConfig} */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ORIGIN = process.env.NEUROVIS_API_ORIGIN || "http://localhost:3000";

const nextConfig = {
  /** Playwright (127.0.0.1) & mixed hostnames in dev — allow dev-only asset fetches. */
  allowedDevOrigins: ["127.0.0.1"],
  /**
   * Browser Csound (`@csound/browser`) uses the tab’s audio output; React 18 Strict
   * Mode remounts in dev, runs effect cleanups, and stops the engine immediately after Start — users
   * hear nothing. Keep strict mode off until Csound lives in a non-remounting provider/singleton.
   */
  reactStrictMode: false,
  /** Monorepo: parent folder has its own lockfile — keep tracing scoped to `web/`. */
  outputFileTracingRoot: path.join(__dirname),
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` },
    ];
  },
};

export default nextConfig;
