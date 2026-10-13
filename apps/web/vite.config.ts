import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

// Builds a standalone Node server (no Cloudflare/Alchemy involved). `vp build`
// produces `dist/client` (static assets) and `dist/server/server.js` (the SSR
// fetch handler), served by `server/node-entry.mjs` via `bun run start`.
export default defineConfig({
  server: {
    port: 3001,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: lazyPlugins(() => [tailwindcss(), tanstackStart(), viteReact()]),
});
