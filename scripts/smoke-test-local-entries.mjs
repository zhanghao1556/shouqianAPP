import fs from "node:fs";
import { chromium } from "playwright";

const entries = [
  { name: "main desktop", url: "http://127.0.0.1:5174/", viewport: { width: 1440, height: 1000 }, mobile: false, brand: "yinyi" },
  { name: "mobile preview", url: "http://127.0.0.1:5177/", viewport: { width: 390, height: 844 }, mobile: true, brand: "yinyi" },
  { name: "yinman desktop", url: "http://127.0.0.1:5180/", viewport: { width: 1440, height: 1000 }, mobile: false, brand: "yinman" }
];

if (process.argv.includes("--all")) {
  entries.splice(
    1,
    0,
    { name: "point calibration", url: "http://127.0.0.1:5175/", viewport: { width: 1440, height: 1000 } },
    { name: "reverb calibration", url: "http://127.0.0.1:5176/", viewport: { width: 1440, height: 1000 } }
  );
}

async function launchBrowser() {
  const executablePaths = [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe"
  ].filter((executablePath) => fs.existsSync(executablePath));
  const attempts = [{ channel: "chrome" }, { channel: "msedge" }, ...executablePaths.map((executablePath) => ({ executablePath })), {}];
  let lastError;

  for (const options of attempts) {
    try {
      return await chromium.launch({ ...options, headless: true });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function checkEntry(browser, entry) {
  const context = await browser.newContext({ viewport: entry.viewport });
  const page = await context.newPage();
  const errors = [];

  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => errors.push(`request: ${request.url()} (${request.failure()?.errorText ?? "failed"})`));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`);
  });

  try {
    const response = await page.goto(entry.url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForSelector("#root > *", { timeout: 15000 });
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector("h1")?.textContent?.trim() ?? "",
      bodyLength: document.body?.innerText.length ?? 0,
      mobileScope: document.documentElement.classList.contains("mobilePreviewMode"),
      yinyiShell: Boolean(document.querySelector(".yiouShell")),
      yinmanShell: Boolean(document.querySelector(".yinmanShell")),
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    const checks = {
      httpOk: Boolean(response?.ok()),
      rendered: state.bodyLength > 100,
      noHorizontalOverflow: state.scrollWidth <= state.innerWidth + 1,
      mobileScope: entry.mobile === undefined || state.mobileScope === entry.mobile,
      brandScope: entry.brand === undefined || (entry.brand === "yinman" ? state.yinmanShell && !state.yinyiShell : state.yinyiShell && !state.yinmanShell),
      noRuntimeErrors: errors.length === 0
    };
    return { name: entry.name, url: entry.url, passed: Object.values(checks).every(Boolean), checks, state, errors };
  } catch (error) {
    return { name: entry.name, url: entry.url, passed: false, checks: {}, state: null, errors: [...errors, String(error.message ?? error)] };
  } finally {
    await context.close();
  }
}

const browser = await launchBrowser();
try {
  const results = [];
  for (const entry of entries) results.push(await checkEntry(browser, entry));
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => !result.passed)) process.exitCode = 1;
} finally {
  await browser.close();
}
