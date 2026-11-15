// Lets Node load the repo's extensionless TypeScript imports (e.g. "./grid" → "./grid.ts") in tests.
// Resolve extensionless relative imports to .ts files (the repo uses bundler-style imports).
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context) } catch (err) {
    if (specifier.startsWith(".") && !specifier.endsWith(".ts")) return next(specifier + ".ts", context)
    throw err
  }
}
