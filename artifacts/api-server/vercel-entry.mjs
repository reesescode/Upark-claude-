// Vercel entrypoint for the API service (see /vercel.json).
// Vercel checks that the entrypoint exists before building, so this file is
// committed and re-exports the bundle that `pnpm run build` writes to dist/.
// The express import lets Vercel's Express detection recognise this file.
import "express";

export { default } from "./dist/vercel.mjs";
