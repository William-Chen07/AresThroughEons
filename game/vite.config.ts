import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, searchForWorkspaceRoot } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    // Windows: a lower-case drive letter in the cwd (e.g. "c:\\") vs __dirname ("C:\\")
    // otherwise makes the bundler include React twice and hooks crash.
    dedupe: ["react", "react-dom"],
  },
  server: {
    // Menu audio is imported from the repo's root Audio/ folder (see src/lib/sound.ts).
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), path.resolve(__dirname, "../Audio")] },
    // Local dev: forward /api calls to the deployed site, whose functions hold the NASA key
    // (Vercel env NASA_API_KEY). Changes to api/ files only take effect once deployed.
    proxy: {
      "/api": { target: "https://ares-through-eons.vercel.app", changeOrigin: true },
    },
  },
})
