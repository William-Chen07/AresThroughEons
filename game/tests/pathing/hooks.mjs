// Lets Node load the repo's TypeScript imports in tests: extensionless paths (e.g. "./grid" → "./grid.ts"),
// folders ("./pathing" → "./pathing/index.ts") and the "@/" alias for game/src (as in vite.config.ts).
const SRC = new URL("../../src/", import.meta.url)

export async function resolve(specifier, context, next) {
  const aliased = specifier.startsWith("@/") ? new URL(specifier.slice(2), SRC).href : null
  const base = aliased ?? specifier
  if (!aliased && !specifier.startsWith(".")) return next(specifier, context)
  for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
    try {
      return await next(candidate, context)
    } catch {
      // try the next form
    }
  }
  return next(specifier, context)
}
