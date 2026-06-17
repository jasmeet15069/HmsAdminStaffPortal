// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Choose the nitro deploy preset by build environment. The lovable wrapper only
// runs the nitro deploy plugin when a `nitro` option is present, so we always
// pass one (otherwise Vercel/Node builds emit no server output and 404).
//   - Vercel sets VERCEL=1 during its build  -> Vercel Build Output API (.vercel/output)
//   - jazverse / Node SSR build: run with NITRO_PRESET=node-server -> .output/server/index.mjs
//   - otherwise fall back to the lovable default (cloudflare-module)
const preset = process.env.VERCEL
  ? "vercel"
  : process.env.NITRO_PRESET || undefined;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    preset,
    // Same-origin /api proxy to the live Go API, mirroring the v1 frontend's
    // vercel.json rewrite. The browser calls relative /api/... (same origin),
    // so there is no cross-origin/CORS call; the server proxies to the backend.
    routeRules: {
      "/api/**": { proxy: "https://hmsadmin.jazverse.online/api/**" },
    },
  },
});
