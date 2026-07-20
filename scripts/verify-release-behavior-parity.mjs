import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const outputsDir = path.join(root, "outputs");
const releaseVersion = "2.0";
const requestedBrand = getArgValue("--brand");
const browser = await launchBrowser();
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const filePath = path.join(root, "dist", relativePath);
  if (!filePath.startsWith(path.join(root, "dist")) || !fs.existsSync(filePath)) {
    response.writeHead(404).end();
    return;
  }
  response.setHeader("Content-Type", filePath.endsWith(".css") ? "text/css" : filePath.endsWith(".js") ? "text/javascript" : "text/html");
  response.end(fs.readFileSync(filePath));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const distUrl = `http://127.0.0.1:${address.port}/`;

try {
  const brands = requestedBrand ? [requestedBrand] : ["yinyi", "yinman"];
  for (const brand of brands) {
    if (brand !== "yinyi" && brand !== "yinman") throw new Error(`Unknown release brand: ${brand}`);
    const appName = brand === "yinman" ? "音曼AI售前工具" : "音翼AI售前工具";
    const expected = await renderFixture(distUrl, brand, false);
    const releasePath = path.join(latestReleaseDir(appName), `${appName}-${releaseVersion}.html`);
    const actual = await renderFixture(pathToFileUrl(releasePath), brand, true);
    const mismatches = Object.keys(expected)
      .filter((key) => actual[key] !== expected[key]);
    if (mismatches.length > 0) {
      for (const key of mismatches) {
        console.error(JSON.stringify(describeDifference(key, expected[key], actual[key]), null, 2));
      }
      throw new Error(`${appName} final release behavior differs from current dist for the fixed classroom fixture.`);
    }
    console.log(`PASS ${appName}: final HTML matches current dist business output`);
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

async function renderFixture(url, brand, isRelease) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  if (!isRelease) {
    await context.addInitScript((brandId) => {
      window.__APP_BRAND__ = brandId;
      window.__YIOU_RELEASE_BUILD__ = true;
    }, brand);
  }
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForSelector(".engineeringShell");

  const scenario = page.getByRole("button", { name: "普通教室", exact: true });
  if (!(await scenario.getAttribute("class")).includes("active")) await scenario.click();
  const localAmplification = page.getByRole("button", { name: /本地扩声/ });
  if (!(await localAmplification.getAttribute("class")).includes("active")) await localAmplification.click();

  const dimensions = page.locator('input[type="number"]');
  await dimensions.nth(0).fill("6");
  await dimensions.nth(1).fill("11.5");
  await dimensions.nth(2).fill("2.6");
  await page.getByRole("button", { name: "吊顶情况", exact: true }).click();
  await page.getByRole("option", { name: "无吊顶 / 裸顶", exact: true }).click();

  const pointMap = normalizeRuntimeSvgIds(await page.locator("svg.engineeringCanvas").first().evaluate((svg) => {
    const clone = svg.cloneNode(true);
    clone.querySelectorAll("image").forEach((image) => {
      image.removeAttribute("href");
      image.removeAttribute("xlink:href");
    });
    return clone.outerHTML;
  }));
  const deviceList = await page.locator(".tableBox").first().textContent();
  const brandLabel = brand === "yinman" ? "音曼" : "音翼";
  const wiringSelector = `svg[aria-label="${brandLabel}接口接线图"]`;
  await page.waitForSelector(wiringSelector);
  const interfaceWiring = normalizeRuntimeSvgIds(await page.locator(wiringSelector).evaluate((svg) => {
    const clone = svg.cloneNode(true);
    clone.querySelectorAll("image, img").forEach((image) => {
      image.removeAttribute("href");
      image.removeAttribute("xlink:href");
      image.removeAttribute("src");
    });
    return clone.outerHTML;
  }));
  const interfaceUsage = (await page.locator(".interfaceWiringPortTable").textContent()).replace(/\s+/g, " ").trim();
  const customerText = await page.locator("body").innerText();
  const internalModels = brand === "yinman"
    ? ["AJ200", "AJ350", "AJ600", "SA110", "AP150", "RING08"]
    : ["DT1", "DT2", "DT2 Pro", "AJ200", "AJ350", "AJ600", "SA110", "AP150"];
  for (const model of internalModels) {
    if (customerText.includes(model)) {
      throw new Error(`Customer-visible ${brandLabel} output exposes internal model: ${model}`);
    }
  }
  if (customerText.includes("张灏")) {
    throw new Error(`Customer-visible ${brandLabel} output exposes a personal contact name.`);
  }
  await context.close();
  return {
    pointMap,
    deviceList: deviceList.replace(/\s+/g, " ").trim(),
    interfaceWiring,
    interfaceUsage
  };
}

async function launchBrowser() {
  const candidates = [
    undefined,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe"
  ];
  for (const executablePath of candidates) {
    if (executablePath && !fs.existsSync(executablePath)) continue;
    try {
      return await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error("No Chromium-compatible browser is available for release behavior verification.");
}

function latestReleaseDir(appName) {
  const pattern = new RegExp(`^${escapeRegExp(appName)}-${escapeRegExp(releaseVersion)}-(\\d{6})-(\\d+)$`);
  const match = fs.readdirSync(outputsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ entry, match: entry.name.match(pattern) }))
    .filter((item) => item.match)
    .sort((a, b) => Number(b.match[1]) - Number(a.match[1]) || Number(b.match[2]) - Number(a.match[2]))[0];
  if (!match) throw new Error(`No release directory found for ${appName}.`);
  return path.join(outputsDir, match.entry.name);
}

function pathToFileUrl(filePath) {
  return `file:///${filePath.replaceAll("\\", "/").replaceAll("#", "%23")}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function normalizeRuntimeSvgIds(value) {
  const ids = new Map();
  return value.replace(/_r_[a-z0-9]+_/gi, (id) => {
    if (!ids.has(id)) ids.set(id, `__runtime_svg_id_${ids.size}__`);
    return ids.get(id);
  });
}

function describeDifference(key, expected, actual) {
  const limit = Math.min(expected.length, actual.length);
  let index = 0;
  while (index < limit && expected[index] === actual[index]) index += 1;
  const start = Math.max(0, index - 120);
  const end = index + 240;
  return {
    key,
    expectedLength: expected.length,
    actualLength: actual.length,
    firstDifference: index,
    expectedContext: expected.slice(start, end),
    actualContext: actual.slice(start, end)
  };
}
