import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(root, "output", "software-copyright", "screenshots");
fs.mkdirSync(outputDir, { recursive: true });

const browserExecutable = process.env.PLAYWRIGHT_BROWSER_PATH
  || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: "light"
});
const page = await context.newPage();

try {
  await page.goto("http://127.0.0.1:5174/", { waitUntil: "networkidle" });
  await page.addStyleTag({
    content: `
      .referenceNotice { display: none !important; }
      * { caret-color: transparent !important; }
    `
  });

  await page.getByLabel("项目名称", { exact: true }).fill("示例教室项目");
  await page.getByLabel("客户名称", { exact: true }).fill("示例客户");
  await page.getByLabel("长", { exact: true }).fill("18");
  await page.getByLabel("宽", { exact: true }).fill("9");
  await page.getByLabel("高", { exact: true }).fill("3.2");

  const ensurePressed = async (locator) => {
    if ((await locator.getAttribute("aria-pressed")) !== "true") await locator.click();
  };

  await ensurePressed(page.getByRole("button", { name: "普通教室", exact: true }));
  await ensurePressed(page.getByRole("button", { name: "互动课堂 学生区线上拾音与课堂互动", exact: true }));
  await ensurePressed(page.getByRole("button", { name: "本地扩声 吸顶音箱或音柱覆盖", exact: true }));
  await ensurePressed(page.getByRole("button", { name: "录播主机", exact: true }));
  await ensurePressed(page.getByRole("button", { name: "中控主机", exact: true }));
  await ensurePressed(page.getByRole("button", { name: "讲台电脑", exact: true }));
  await ensurePressed(page.getByRole("button", { name: "无线手持麦", exact: true }));

  await page.locator("svg.engineeringCanvas").first().waitFor({ state: "visible" });
  await page.waitForTimeout(400);

  const captureElement = async ({ key, selector, output }) => {
    const locator = page.locator(selector);
    await locator.waitFor({ state: "visible" });
    const dimensions = await locator.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight
    }));
    const outputPath = path.join(outputDir, output);
    await locator.screenshot({
      path: outputPath,
      animations: "disabled",
      caret: "hide",
      scale: "css"
    });
    return { key, outputPath, ...dimensions };
  };

  const resultsByKey = {};
  resultsByKey["01"] = await captureElement({
    key: "01",
    selector: "aside.workPanel.intakePanel",
    output: "01-presales-section-long.png"
  });
  resultsByKey["02"] = await captureElement({
    key: "02",
    selector: "section.workPanel.profileWorkPanel",
    output: "02-project-archive-section-long.png"
  });

  resultsByKey["04"] = await captureElement({
    key: "04",
    selector: "section.workPanel.outputWorkPanel .stackedOutputs > section.outputSection:nth-child(2)",
    output: "04-point-layout-section-long.png"
  });
  resultsByKey["05"] = await captureElement({
    key: "05",
    selector: "section.workPanel.outputWorkPanel .stackedOutputs > section.outputSection:nth-child(3)",
    output: "05-system-topology-section-long.png"
  });
  resultsByKey["07"] = await captureElement({
    key: "07",
    selector: "section.interfaceWiringPreview .interfaceWiringDataGrid",
    output: "07-port-usage-section-long.png"
  });

  const hideOutputDrawings = await page.addStyleTag({
    content: `
      section.outputWorkPanel .stackedOutputs > section.outputSection:nth-child(2),
      section.outputWorkPanel .stackedOutputs > section.outputSection:nth-child(3) {
        display: none !important;
      }
    `
  });
  resultsByKey["03"] = await captureElement({
    key: "03",
    selector: "section.workPanel.outputWorkPanel",
    output: "03-solution-content-long.png"
  });
  await hideOutputDrawings.evaluate((element) => element.remove());

  const hideInterfaceTable = await page.addStyleTag({
    content: ".interfaceWiringDataGrid { display: none !important; }"
  });
  resultsByKey["06"] = await captureElement({
    key: "06",
    selector: "section.interfaceWiringPreview",
    output: "06-interface-wiring-section-long.png"
  });
  await hideInterfaceTable.evaluate((element) => element.remove());

  const results = ["01", "02", "03", "04", "05", "06", "07"].map((key) => resultsByKey[key]);

  fs.writeFileSync(
    path.join(outputDir, "section-long-screenshot-manifest.json"),
    JSON.stringify(results, null, 2),
    "utf8"
  );
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
} finally {
  await context.close();
  await browser.close();
}
