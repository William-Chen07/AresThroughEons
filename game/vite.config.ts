import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, searchForWorkspaceRoot, type Plugin } from "vite"

/**
 * On Vercel, each file in api/ is a serverless function. This makes the local
 * dev server answer the same addresses by running the same files, so features
 * that use them work on localhost too.
 */
function devApi(): Plugin {
  return {
      name: "dev-api",
      configureServer(server) {
        server.middlewares.use("/api/space-weather", async (_request, response) => {
          try {
            const handler = (await server.ssrLoadModule("/api/space-weather.ts")) as { GET: () => Promise<Response> }
            const answer = await handler.GET()
            response.statusCode = answer.status
            answer.headers.forEach((value, name) => response.setHeader(name, value))
            response.end(await answer.text())
          } catch (reason) {
            response.statusCode = 500
            response.end(String(reason))
          }
        })
      },
    }
  }

  export default defineConfig(({ mode }) => {
    // Lets api/ functions read NASA_API_KEY from game/.env.local during local development.
    Object.assign(process.env, loadEnv(mode, process.cwd(), "NASA_"))
    return {
    plugins: [react(), tailwindcss(), devApi()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
      // Windows: a lower-case drive letter in the cwd (e.g. "c:\\") vs __dirname ("C:\\")
      // otherwise makes the bundler include React twice and hooks crash.
      dedupe: ["react", "react-dom"],
    },
    server: {
      // Menu audio is imported from the repo's root Audio/ folder (see src/lib/sound.ts).
      fs: { allow: [searchForWorkspaceRoot(process.cwd()), path.resolve(__dirname, "../Audio")] },
    },
  }
})