import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    // Windows: a lower-case drive letter in the cwd (e.g. "c:\\") vs __dirname ("C:\\")
    // otherwise makes the bundler include React twice and hooks crash.
    dedupe: ["react", "react-dom"],
  },
})