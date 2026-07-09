import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const version = "1.1";
const args = new Set(process.argv.slice(2));
const brand = args.has("--brand") ? getArgValue("--brand") : "yinyi";
const arrayMicImage = getArgValue("--arrayMicImage");
const brandConfig = getBrandConfig(brand);
const releaseDir = path.join(root, "outputs", `${brandConfig.slug}-1.1-internal-test`);
const out = path.join(releaseDir, `${brandConfig.appName}-${version}-内部测试版.html`);

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
  const assetPath = getReplacementAssetPath(assetName) ?? path.join(dist, "assets", assetName);
  const dataUri = `data:${mime};base64,${fs.readFileSync(assetPath).toString("base64")}`;
  js = js.replaceAll(`new URL("${assetName}",import.meta.url).href`, JSON.stringify(dataUri));
}
js = js.replaceAll("</script", "<\\/script");

const html = index
  .replace(
    /<script type="module" crossorigin src="\.\/assets\/[^"]+\.js"><\/script>/,
    () => `<script>window.__YIOU_RELEASE_BUILD__=true;window.__APP_BRAND__=${JSON.stringify(brandConfig.id)};</script>\n    <script type="module">\n${js}\n</script>`
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

function getReplacementAssetPath(assetName) {
  if (brandConfig.id !== "yinman") return undefined;
  if (/yinyi-tech-logo/i.test(assetName)) {
    const logoPath = path.join(releaseDir, "yinman-logo.svg");
    fs.mkdirSync(releaseDir, { recursive: true });
    fs.writeFileSync(logoPath, createYinmanLogoSvg(), "utf8");
    return logoPath;
  }
  if (arrayMicImage && /topology-array-mic/i.test(assetName)) {
    const resolved = path.resolve(root, arrayMicImage);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Yinman array mic image was not found: ${resolved}`);
    }
    return resolved;
  }
  return undefined;
}

function transformBrandText(value) {
  if (brandConfig.id !== "yinman") {
    return value
      .replace(/音曼AI售前工具/g, "音翼AI售前工具")
      .replace(/音曼售前方案/g, "音翼售前方案")
      .replace(/音曼/g, "音翼")
      .replace(/Yinman AI Presales Tool/g, "Yinyi AI Presales Tool");
  }
  return value
    .replace(/DT2 Pro 智能语音阵列麦克风/g, "智能语音阵列麦克风")
    .replace(/DT2 pro 智能语音阵列麦克风/gi, "智能语音阵列麦克风")
    .replace(/DT2 Pro/g, "智能语音阵列麦克风")
    .replace(/音翼科技/g, "音曼")
    .replace(/音翼/g, "音曼")
    .replace(/Yinyi AI Presales Tool/g, "Yinman AI Presales Tool");
}

function createYinmanLogoSvg() {
  return `<svg width="320" height="112" viewBox="0 0 320 112" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="音曼">
  <rect x="10" y="10" width="92" height="92" rx="24" fill="#0b7a55"/>
  <path d="M34 66c12-28 32-34 58-30-18 8-30 22-36 44-5-12-12-15-22-14Z" fill="#ffffff"/>
  <path d="M42 44c8-10 20-16 35-17-11 7-19 16-24 28-3-5-7-8-11-11Z" fill="#c9f7df"/>
  <text x="122" y="66" font-family="Microsoft YaHei, PingFang SC, Arial, sans-serif" font-size="44" font-weight="800" fill="#08372b">音曼</text>
</svg>`;
}
