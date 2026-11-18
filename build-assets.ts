import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";

/**
 * Minifies html/main.js into html/main.min.js while preserving the
 * `{{SSR_STATE}}` placeholder verbatim. app.ts substitutes that token with
 * the injected state script at request time, so it must survive minification
 * byte-for-byte (esbuild otherwise rewrites the raw `{{SSR_STATE}}` token).
 */
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, "html", "main.js");
const OUT = path.join(ROOT, "html", "main.min.js");
const PLACEHOLDER = "{{SSR_STATE}}";
// Undeclared globals are never renamed by esbuild, so this sentinel is safe.
const SENTINEL = "__VGJR_SSR_STATE_SENTINEL_9F3A__";

const source = fs.readFileSync(SRC, "utf-8");
if (!source.includes(PLACEHOLDER)) {
	throw new Error(`Expected ${PLACEHOLDER} to be present in ${SRC}`);
}

const result = await transform(source.replaceAll(PLACEHOLDER, SENTINEL), {
	minify: true,
	target: "es2022",
});

const output = result.code.replaceAll(SENTINEL, PLACEHOLDER);
if (!output.includes(PLACEHOLDER)) {
	throw new Error(`Failed to preserve ${PLACEHOLDER} in minified output`);
}

fs.writeFileSync(OUT, output);
console.log(`Wrote ${OUT} (${Buffer.byteLength(output)} bytes, placeholder preserved)`);
