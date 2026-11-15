// Loaded with node --import: registers the resolve hook in hooks.mjs.
import { register } from "node:module"
register("./hooks.mjs", import.meta.url)
