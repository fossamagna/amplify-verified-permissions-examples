
import esbuild from "esbuild";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export function build(key: string) {
  const result = esbuild.buildSync({
    bundle: true,
    write: false,
    outdir: path.dirname(key),
    // outbase: path.dirname(fn.key),
    entryPoints: [key],
    format: "esm",
    platform: "node",
    target: "node16",
    sourcemap: "inline",
    sourcesContent: false,
    tsconfigRaw: fs.readFileSync(path.join(__dirname, "resolvers", "tsconfig.json"), "utf-8"),
    external: ["@aws-appsync/utils"],
  });
  if (result.errors.length) {
    throw new Error("Could not build" + key + ": " + result.errors.join("\n"));
  }
  // fs.writeFileSync(result.outputFiles[0].path, result.outputFiles[0].text);
  return result.outputFiles[0];
}
