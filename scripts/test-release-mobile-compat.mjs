import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium, devices, webkit } from "playwright";

const root = process.cwd();
const args = process.argv.slice(2);
const releaseVersion = "2.0";
const brand = getArgValue("--brand") ?? "yinyi";
if (brand !== "yinyi" && brand !== "yinman") {
  throw new Error(`Unsupported brand: ${brand}`);
}

const brandLabel = brand === "yinman" ? "音曼" : "音翼";
const releaseHtml = `${brandLabel}AI售前工具-${releaseVersion}.html`;
const releaseDir = getLatestReleaseDir();
const releasePath = path.join(releaseDir, releaseHtml);

if (!fs.existsSync(releasePath)) {
  throw new Error(`Release HTML not found: ${releasePath}`);
}

function getLatestReleaseDir() {
  const outputsDir = path.join(root, "outputs");
  const releasePattern = new RegExp(`^${brandLabel}AI售前工具-${releaseVersion.replace(".", "\\.")}-(\\d{6})(?:-(\\d+))?$`);
  if (!fs.existsSync(outputsDir)) {
    throw new Error(`Outputs directory not found: ${outputsDir}`);
  }
  const candidates = fs
    .readdirSync(outputsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const match = entry.name.match(releasePattern);
      if (!match) return null;
      const fullPath = path.join(outputsDir, entry.name);
      if (!fs.existsSync(path.join(fullPath, releaseHtml))) return null;
      return {
        fullPath,
        date: Number(match[1]),
        index: match[2] ? Number(match[2]) : 0,
        mtimeMs: fs.statSync(fullPath).mtimeMs
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.date - a.date || b.index - a.index || b.mtimeMs - a.mtimeMs);
  if (!candidates.length) {
    throw new Error(`No release directory found under ${outputsDir}`);
  }
  return candidates[0].fullPath;
}

const html = fs.readFileSync(releasePath, "utf8");
const knownMojibakePattern = new RegExp(["\\u7f08\\u517c", "\\u935e", "\\u5a34\\u5b2d\\u7602", "\\u9417", "\\ufffd"].join("|"));
const structuralChecks = {
  hasInlineScript: /<script>[\s\S]*<\/script>/.test(html),
  hasInlineStyle: /<style>[\s\S]*<\/style>/.test(html),
  hasNoExternalAssetTags: !/(?:src|href)="\.\/assets\//.test(html),
  hasChineseTitle: html.includes(`<title>${brandLabel}AI售前工具</title>`),
  hasReleaseVersion: html.includes(`window.__YIOU_RELEASE_VERSION__="${releaseVersion}"`),
  hasNoInternalTestLabel: !html.includes("内部测试版") && !html.includes("内部测试报告"),
  hasNoKnownMojibake: !knownMojibakePattern.test(html)
};

const server = http.createServer((req, res) => {
  const rawPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const file = rawPath === "/" ? releaseHtml : rawPath.replace(/^\//, "");
  const resolved = path.resolve(releaseDir, file);

  if (!resolved.startsWith(releaseDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(resolved, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": file.endsWith(".txt") || file.endsWith(".md") ? "text/plain; charset=utf-8" : "text/html; charset=utf-8"
    });
    res.end(data);
  });
});

const listen = () =>
  new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}/${encodeURIComponent(releaseHtml)}`);
    });
  });

const close = () => new Promise((resolve) => server.close(resolve));

async function launchChromium() {
  const channels = ["chrome", "msedge", undefined];
  let lastError;

  for (const channel of channels) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function launchWebKitIfAvailable() {
  try {
    const browser = await webkit.launch({ headless: true });
    return { browser, actualEngine: "WebKit" };
  } catch {
    const browser = await launchChromium();
    return { browser, actualEngine: "Chromium fallback with iPhone profile" };
  }
}

async function runCase({ browser, contextOptions, name, url }) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];

  page.on("pageerror", (error) => errors.push(String(error.message || error)));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!text.includes("Failed to load resource: the server responded with a status of 404")) {
        errors.push(text);
      }
    }
  });

  await page.goto(url, { waitUntil: "load", timeout: 15000 });
  await page.waitForTimeout(500);

  const result = await page.evaluate((activeBrandLabel) => {
    const bodyText = document.body?.innerText || "";
    const firstDimensionValues = Array.from(document.querySelectorAll('input[type="number"]'))
      .slice(0, 3)
      .map((input) => input.value);
    const firstTextValues = Array.from(document.querySelectorAll("input"))
      .filter((input) => input.type !== "file" && input.type !== "number" && !input.readOnly)
      .slice(0, 2)
      .map((input) => input.value);
    return {
      title: document.title,
      h1: document.querySelector("h1")?.textContent?.trim() || "",
      bodyLength: bodyText.length,
      rootChildren: document.querySelector("#root")?.children.length || 0,
      pointMapCount: document.querySelectorAll(`svg[aria-label="${activeBrandLabel}阵列麦与音箱点位图"]`).length,
      fallbackStillVisible: bodyText.includes("页面正在加载"),
      hasWorkbench: bodyText.includes(`${activeBrandLabel}AI售前工具`),
      hasPointMapText: bodyText.includes("点位图"),
      hasReleaseBuildMarker: window.__YIOU_RELEASE_BUILD__ === true,
      firstDimensionValues,
      firstTextValues,
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  }, brandLabel);

  await context.close();

  const passed =
    result.h1 === `${brandLabel}AI售前工具` &&
    result.rootChildren > 0 &&
    !result.fallbackStillVisible &&
    result.hasWorkbench &&
    result.hasPointMapText &&
    result.hasReleaseBuildMarker &&
    result.firstDimensionValues.length === 3 &&
    result.firstDimensionValues.every((value) => value === "0") &&
    result.firstTextValues.every((value) => value === "") &&
    errors.length === 0;

  return { name, passed, result, errors };
}

function getArgValue(name) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
}

if (Object.values(structuralChecks).some((passed) => !passed)) {
  console.log(JSON.stringify({ structuralChecks }, null, 2));
  process.exitCode = 1;
} else {
  const httpUrl = await listen();
  const chromiumBrowser = await launchChromium();
  const webkitLaunch = await launchWebKitIfAvailable();

  try {
    const cases = [
      {
        browser: chromiumBrowser,
        contextOptions: devices["Pixel 7"],
        name: "Android Chrome - Pixel 7 / HTTP",
        url: httpUrl
      },
      {
        browser: webkitLaunch.browser,
        contextOptions: devices["iPhone 14"],
        name: `iOS Safari - iPhone 14 (${webkitLaunch.actualEngine}) / HTTP`,
        url: httpUrl
      }
    ];

    const results = [];
    for (const testCase of cases) {
      results.push(await runCase(testCase));
    }

    console.log(JSON.stringify({ structuralChecks, httpUrl, results }, null, 2));

    if (results.some((result) => !result.passed)) {
      process.exitCode = 1;
    }
  } finally {
    await chromiumBrowser.close();
    await webkitLaunch.browser.close();
    await close();
  }
}
