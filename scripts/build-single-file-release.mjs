import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getReleaseVersion } from "./release-version.mjs";

const root = process.cwd();
const dist = path.join(root, "dist");
const version = getReleaseVersion(root);
const args = new Set(process.argv.slice(2));
const brand = args.has("--brand") ? getArgValue("--brand") : "yinyi";
const arrayMicImage = getArgValue("--arrayMicImage");
const brandConfig = getBrandConfig(brand);
const releaseDir = path.join(root, "outputs", `${brandConfig.slug}-${version}-release`);
const out = path.join(releaseDir, `${brandConfig.appName}-${version}.html`);

const index = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const jsName = [...index.matchAll(/src="\.\/assets\/([^"]+\.js)"/g)][0]?.[1];
const cssName = [...index.matchAll(/href="\.\/assets\/([^"]+\.css)"/g)][0]?.[1];
const assetNames = fs.readdirSync(path.join(dist, "assets")).filter((name) => /\.(png|svg)$/i.test(name));

if (!jsName || !cssName) {
  throw new Error("Built assets were not found.");
}

const css = fs.readFileSync(path.join(dist, "assets", cssName), "utf8");
let js = fs.readFileSync(path.join(dist, "assets", jsName), "utf8");
const sourceAssetByHash = getSourceAssetHashMap();

const mimeByExt = {
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

for (const assetName of assetNames) {
  const ext = path.extname(assetName).toLowerCase();
  const sourceAssetName = getSourceAssetName(assetName);
  const replacement = getReplacementAsset(assetName, sourceAssetName);
  const assetPath = replacement?.path ?? path.join(dist, "assets", assetName);
  const mime = replacement?.mime ?? mimeByExt[ext];
  const dataUri = `data:${mime};base64,${fs.readFileSync(assetPath).toString("base64")}`;
  js = js.replaceAll(`new URL("${assetName}",import.meta.url).href`, JSON.stringify(dataUri));
}
js = isolateInlineBrandAssets(js);
js = js.replaceAll("</script", "<\\/script");

const html = index
  .replace(
    /<script type="module" crossorigin src="\.\/assets\/[^"]+\.js"><\/script>/,
    () => `<script>window.__YIOU_RELEASE_BUILD__=true;window.__YIOU_RELEASE_VERSION__=${JSON.stringify(version)};window.__APP_BRAND__=${JSON.stringify(brandConfig.id)};</script>\n    <script type="module">\n${js}\n</script>`
  )
  .replace(/<link rel="stylesheet" crossorigin href="\.\/assets\/[^"]+\.css">/, () => `<style>\n${css}\n</style>`);

fs.mkdirSync(releaseDir, { recursive: true });
fs.writeFileSync(out, transformBrandText(html), "utf8");
console.log(`Single-file release written: ${out}`);

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function getBrandConfig(value) {
  if (value === "yinman") {
    return {
      id: "yinman",
      slug: "yinman-ai-presales-tool",
      appName: "音曼AI售前工具",
      companyName: "音曼"
    };
  }
  return {
    id: "yinyi",
    slug: "yinyi-ai-presales-tool",
    appName: "音翼AI售前工具",
    companyName: "音翼科技"
  };
}

function getReplacementAsset(_assetName, sourceAssetName) {
  if (brandConfig.id === "yinyi") {
    if (sourceAssetName === "yinman-logo.png") return assetReplacement("yinyi-tech-logo.svg");
    if (sourceAssetName === "yinman-array-mic-pointmap.png") return assetReplacement("topology-array-mic.png");
    if (sourceAssetName === "yinman-array-mic-topology.png") return assetReplacement("topology-array-mic.png");
    if (sourceAssetName === "yinman-audio-processor.png") return assetReplacement("topology-audio-processor.png");
    if (sourceAssetName === "yinman-hanging-mic.png") return assetReplacement("topology-wired-mic.png");
    if (sourceAssetName === "yinman-hanging-mic-interface-panel.svg") return assetReplacement("topology-wired-mic.png");
    if (sourceAssetName === "yinman-small-disc-mic.png") return assetReplacement("topology-array-mic.png");
    if (sourceAssetName === "yinman-audio-extender.png") return assetReplacement("topology-audio-processor.png");
    if (sourceAssetName === "yinman-line-array-converter.png") return assetReplacement("topology-audio-processor.png");
    return undefined;
  }

  if (sourceAssetName === "yinyi-tech-logo.svg") return assetReplacement("yinman-logo.png");
  if (sourceAssetName === "yiou-logo.png") return assetReplacement("yinman-logo.png");
  if (sourceAssetName === "topology-array-mic.png") {
    if (arrayMicImage) {
      const resolved = path.resolve(root, arrayMicImage);
      if (!fs.existsSync(resolved)) {
        throw new Error(`Yinman array mic image was not found: ${resolved}`);
      }
      return { path: resolved, mime: mimeByExt[path.extname(resolved).toLowerCase()] };
    }
    return assetReplacement("yinman-array-mic-topology.png");
  }
  return undefined;
}

function assetReplacement(sourceAssetName) {
  const replacementPath = path.join(root, "src", "assets", sourceAssetName);
  if (!fs.existsSync(replacementPath)) {
    throw new Error(`Replacement asset was not found: ${replacementPath}`);
  }
  return {
    path: replacementPath,
    mime: mimeByExt[path.extname(replacementPath).toLowerCase()]
  };
}

function isolateInlineBrandAssets(value) {
  let next = value;
  if (brandConfig.id === "yinyi") {
    next = replaceInlineAsset(next, "yinman-logo.png", "yinyi-tech-logo.svg");
    next = replaceInlineAsset(next, "yinman-array-mic-pointmap.png", "topology-array-mic.png");
    next = replaceInlineAsset(next, "yinman-array-mic-topology.png", "topology-array-mic.png");
    next = replaceInlineAsset(next, "yinman-audio-processor.png", "topology-audio-processor.png");
    next = replaceInlineAsset(next, "yinman-hanging-mic.png", "topology-wired-mic.png");
    next = replaceInlineAsset(next, "yinman-hanging-mic-interface-panel.svg", "topology-wired-mic.png");
    next = replaceInlineAsset(next, "yinman-small-disc-mic.png", "topology-array-mic.png");
    next = replaceInlineAsset(next, "yinman-audio-extender.png", "topology-audio-processor.png");
    next = replaceInlineAsset(next, "yinman-line-array-converter.png", "topology-audio-processor.png");
    return next;
  }

  next = replaceInlineAsset(next, "yinyi-tech-logo.svg", "yinman-logo.png");
  next = replaceInlineAsset(next, "yiou-logo.png", "yinman-logo.png");
  next = replaceInlineAsset(next, "topology-array-mic.png", "yinman-array-mic-topology.png");
  return next;
}

function replaceInlineAsset(value, forbiddenAssetName, replacementAssetName) {
  const forbidden = dataUriForSourceAsset(forbiddenAssetName);
  const replacement = dataUriForSourceAsset(replacementAssetName);
  return value.replaceAll(forbidden, replacement);
}

function dataUriForSourceAsset(sourceAssetName) {
  const assetPath = path.join(root, "src", "assets", sourceAssetName);
  if (!fs.existsSync(assetPath)) {
    throw new Error(`Source asset was not found: ${assetPath}`);
  }
  const mime = mimeByExt[path.extname(assetPath).toLowerCase()];
  return `data:${mime};base64,${fs.readFileSync(assetPath).toString("base64")}`;
}

function getSourceAssetHashMap() {
  const assetsDir = path.join(root, "src", "assets");
  const map = new Map();
  if (!fs.existsSync(assetsDir)) return map;
  for (const name of fs.readdirSync(assetsDir)) {
    if (!/\.(png|svg)$/i.test(name)) continue;
    const assetPath = path.join(assetsDir, name);
    map.set(hashFile(assetPath), name);
  }
  return map;
}

function getSourceAssetName(assetName) {
  const assetPath = path.join(dist, "assets", assetName);
  return sourceAssetByHash.get(hashFile(assetPath)) ?? "";
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function transformBrandText(value) {
  if (brandConfig.id !== "yinman") {
    return value
      .replace(/音曼AI售前工具/g, "音翼AI售前工具")
      .replace(/音曼售前方案/g, "音翼售前方案")
      .replace(/音曼/g, "音翼")
      .replace(/吊麦/g, "有线麦克风")
      .replace(/小圆盘阵麦01/g, "智能天花阵列麦克风")
      .replace(/小圆盘阵麦02/g, "智能天花阵列麦克风")
      .replace(/小圆盘阵麦03/g, "智能天花阵列麦克风")
      .replace(/小圆盘阵麦（内置处理）/g, "智能天花阵列麦克风")
      .replace(/小圆盘阵麦（录音巡课）/g, "智能天花阵列麦克风")
      .replace(/小圆盘阵麦从麦/g, "智能天花阵列麦克风从麦")
      .replace(/小圆盘阵麦/g, "智能天花阵列麦克风")
      .replace(/音频扩展器/g, "音频接口设备")
      .replace(/Yinman AI Presales Tool/g, "Yinyi AI Presales Tool");
  }
  return value
    .replace(/DT2 Pro 智能语音阵列麦克风/g, "智能天花阵列麦克风")
    .replace(/DT2 pro 智能语音阵列麦克风/gi, "智能天花阵列麦克风")
    .replace(/DT2 Pro/g, "智能天花阵列麦克风")
    .replace(/智能语音阵列麦克风/g, "智能天花阵列麦克风")
    .replace(/音翼科技/g, "音曼")
    .replace(/音翼/g, "音曼")
    .replace(/Yinyi AI Presales Tool/g, "Yinman AI Presales Tool");
}
