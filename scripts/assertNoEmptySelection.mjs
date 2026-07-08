import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workDir = resolve(root, "work", "random-presales");
const bundledRunner = resolve(workDir, "assertNoEmptySelectionRunner.mjs");

await mkdir(workDir, { recursive: true });
await build({
  entryPoints: [resolve(root, "scripts", "randomPresalesRunner.ts")],
  outfile: bundledRunner,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  sourcemap: false,
  logLevel: "silent"
});

const runner = await import(`${pathToFileURL(bundledRunner).href}?t=${Date.now()}`);

const failures = [];
for (let index = 1; index <= 80; index += 1) {
  const { profile, outputs } = runner.generateRandomPresalesCase(index);
  const hasGeometry = profile.roomGeometry.length > 0 && profile.roomGeometry.width > 0 && profile.roomGeometry.height > 0;
  if (hasGeometry && outputs.productSelection.length === 0) {
    failures.push({
      index,
      scenario: profile.scenario,
      needs: profile.needs,
      geometry: profile.roomGeometry,
      completeness: outputs.completeness.filter((item) => item.blocking && !item.complete)
    });
  }
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

console.log("ok: no empty product selection for valid random geometry");
