import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

// Alchemy (`alchemy dev` / `alchemy deploy`) appends its own Cloudflare plugin.
export default defineConfig({
  server: {
    port: 3001,
  },
  resolve: {
    tsconfigPaths: true,
  },
  // Provided by workerd at runtime; lets a plain `vp build` succeed outside Alchemy.
  build: {
    rolldownOptions: {
      external: [/^cloudflare:/],
    },
  },
  plugins: lazyPlugins(() => [tailwindcss(), tanstackStart(), viteReact()]),
});
