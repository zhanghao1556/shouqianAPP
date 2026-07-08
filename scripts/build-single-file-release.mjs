import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const releaseDir = path.join(root, "outputs", "yinyi-ai-presales-tool-1.1-internal-test");
const out = path.join(releaseDir, "音翼AI售前工具-1.1-内部测试版.html");

const index = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const jsName = [...index.matchAll(/src="\.\/assets\/([^"]+\.js)"/g)][0]?.[1];
const cssName = [...index.matchAll(/href="\.\/assets\/([^"]+\.css)"/g)][0]?.[1];
const assetNames = fs.readdirSync(path.join(dist, "assets")).filter((name) => /\.(png|svg)$/i.test(name));

if (!jsName || !cssName) {
  throw new Error("Built assets were not found.");
}

const css = fs.readFileSync(path.join(dist, "assets", cssName), "utf8");
let js = fs.readFileSync(path.join(dist, "assets", jsName), "utf8");

const mimeByExt = {
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

for (const assetName of assetNames) {
  const ext = path.extname(assetName).toLowerCase();
  const mime = mimeByExt[ext];
  const dataUri = `data:${mime};base64,${fs.readFileSync(path.join(dist, "assets", assetName)).toString("base64")}`;
  js = js.replaceAll(`new URL("${assetName}",import.meta.url).href`, JSON.stringify(dataUri));
}
js = js.replaceAll("</script", "<\\/script");

const html = index
  .replace(
    /<script type="module" crossorigin src="\.\/assets\/[^"]+\.js"><\/script>/,
    () => `<script>window.__YIOU_RELEASE_BUILD__=true;</script>\n    <script type="module">\n${js}\n</script>`
  )
  .replace(/<link rel="stylesheet" crossorigin href="\.\/assets\/[^"]+\.css">/, () => `<style>\n${css}\n</style>`);

fs.mkdirSync(releaseDir, { recursive: true });
fs.writeFileSync(out, html, "utf8");
console.log(`Single-file release written: ${out}`);
