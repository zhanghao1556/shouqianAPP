const svgExportStyle = `
  text {
    font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
  }
  .cadTitle {
    fill: #111827;
    font-size: 17px;
    font-weight: 850;
  }
  .cadLabel {
    fill: #111827;
    font-size: 13px;
    font-weight: 850;
  }
  .cadSmall {
    fill: #111827;
    font-size: 11px;
    font-weight: 750;
  }
  .cadTiny {
    fill: #111827;
    font-size: 8.5px;
    font-weight: 750;
  }
  .cadPort {
    fill: #111827;
    font-size: 9px;
    font-weight: 850;
  }
  .cadLine {
    fill: none;
    stroke-width: 2;
  }
  .cadLine.green {
    stroke: #22c55e;
  }
  .cadLine.cyan {
    stroke: #06b6d4;
  }
  .cadLine.black {
    stroke: #111827;
  }
  .cadLine.usb {
    stroke: #2563eb;
  }
  .cadLine.ethernet {
    stroke: #7c3aed;
  }
  .cadLine.wireless {
    stroke: #16a34a;
    stroke-dasharray: 6 5;
  }
  .cadLine.audio {
    stroke: #0f766e;
  }
  .cadLine.speaker {
    stroke: #b45309;
  }
  .wiringLine,
  .topologyLine {
    stroke: #64748b;
    stroke-width: 2;
  }
`;

export const downloadSvgAsPng = async (svg: SVGSVGElement, filename: string) => {
  const pngDataUrl = await svgToPngDataUrl(svg);
  const pngBlob = await (await fetch(pngDataUrl)).blob();
  const pngUrl = URL.createObjectURL(pngBlob);
  downloadUrl(pngUrl, filename.endsWith(".png") ? filename : `${filename}.png`);
  URL.revokeObjectURL(pngUrl);
};

export const svgToPngDataUrl = async (svg: SVGSVGElement, options: { scale?: number } = {}) => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const interfaceWiringEnabled = __ENABLE_YINYI_INTERFACE_WIRING__ || __ENABLE_YINMAN_INTERFACE_WIRING__;
  if (interfaceWiringEnabled && clone.classList.contains("interfaceWiringCanvas")) {
    clone.removeAttribute("data-active-edge-id");
    clone.querySelectorAll(".is-active, .is-dimmed").forEach((element) => {
      element.classList.remove("is-active", "is-dimmed");
    });
    convertInterfaceForeignObjects(svg, clone);
  }

  const viewBox = clone.viewBox.baseVal;
  const width = viewBox?.width || svg.getBoundingClientRect().width || 980;
  const height = viewBox?.height || svg.getBoundingClientRect().height || 680;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `${svgExportStyle}\n${interfaceWiringEnabled ? getInterfaceWiringExportCss(svg) : ""}`;
  clone.insertBefore(style, clone.firstChild);

  await inlineSvgImages(clone);

  const svgText = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const scale = Math.max(1, options.scale ?? 2);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context is not available.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
};

const svgNamespace = "http://www.w3.org/2000/svg";

function convertInterfaceForeignObjects(sourceSvg: SVGSVGElement, cloneSvg: SVGSVGElement) {
  const sourceObjects = Array.from(sourceSvg.querySelectorAll("foreignObject"));
  const cloneObjects = Array.from(cloneSvg.querySelectorAll("foreignObject"));
  sourceObjects.forEach((sourceObject, index) => {
    const cloneObject = cloneObjects[index];
    if (!cloneObject) return;
    if (sourceObject.classList.contains("interfaceWiringNodeObject")) {
      cloneObject.replaceWith(renderInterfaceNodeAsSvg(sourceObject));
      return;
    }
    if (sourceObject.classList.contains("interfaceWiringLegendObject")) {
      cloneObject.replaceWith(renderInterfaceLegendAsSvg(sourceObject));
      return;
    }
    cloneObject.remove();
  });
}

function renderInterfaceNodeAsSvg(sourceObject: Element) {
  const group = createSvgElement("g");
  group.setAttribute("data-interface-export-object", "node");
  const x = svgNumber(sourceObject.getAttribute("x"));
  const y = svgNumber(sourceObject.getAttribute("y"));
  const width = svgNumber(sourceObject.getAttribute("width"));
  const node = sourceObject.querySelector<HTMLElement>(".interfaceWiringNode");
  const category = node?.dataset.category ?? "device";
  const name = sourceObject.querySelector<HTMLElement>(".interfaceWiringNodeName")?.innerText.trim() ?? "";
  if (name) {
    appendFittedSvgText(group, name, x + width / 2, y + (category === "speaker" ? 11 : 15), {
      fontSize: category === "speaker" ? 10 : 14,
      fontWeight: 900,
      fill: "#172033",
      maxWidth: Math.max(24, width - 8),
      anchor: "middle"
    });
  }

  sourceObject.querySelectorAll<HTMLImageElement>("img.interfaceWiringPanelImage").forEach((image) => {
    const svgImage = createSvgElement("image");
    setSvgAttributes(svgImage, {
      x: x + svgNumber(image.style.left),
      y: y + svgNumber(image.style.top),
      width: svgNumber(image.style.width),
      height: svgNumber(image.style.height),
      preserveAspectRatio: "xMidYMid meet",
      opacity: image.classList.contains("unconfirmed") ? 0.94 : 1
    });
    const src = image.getAttribute("src");
    if (src) svgImage.setAttribute("href", src);
    group.appendChild(svgImage);
  });

  sourceObject.querySelectorAll<HTMLButtonElement>(".interfaceWiringPanelOptionButton.active").forEach((button) => {
    const buttonX = x + svgNumber(button.style.left);
    const buttonY = y + svgNumber(button.style.top);
    const buttonWidth = svgNumber(button.style.width);
    const buttonHeight = svgNumber(button.style.height);
    const frame = createSvgElement("rect");
    setSvgAttributes(frame, {
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight,
      rx: 3,
      fill: "rgba(235, 244, 255, 0.22)",
      stroke: "#0b5cad",
      "stroke-width": 2.4
    });
    group.appendChild(frame);
    const badge = createSvgElement("circle");
    setSvgAttributes(badge, {
      cx: buttonX + buttonWidth - 7,
      cy: buttonY + 7,
      r: 5,
      fill: "#0b5cad"
    });
    group.appendChild(badge);
    const check = createSvgElement("path");
    setSvgAttributes(check, {
      d: `M ${buttonX + buttonWidth - 9.4} ${buttonY + 7} l 1.6 1.7 3 -3.4`,
      fill: "none",
      stroke: "#ffffff",
      "stroke-width": 1.3,
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    });
    group.appendChild(check);
  });

  const interfaceNote = sourceObject.querySelector<HTMLElement>(".interfaceWiringNodeInterfaceNote");
  if (interfaceNote) {
    appendFittedSvgText(group, interfaceNote.innerText.trim(), x + width / 2, y + svgNumber(interfaceNote.style.top) + 10, {
      fontSize: 9,
      fontWeight: 800,
      fill: "#9a3412",
      maxWidth: Math.max(24, width - 12),
      anchor: "middle"
    });
  }

  const missingLabel = sourceObject.querySelector<HTMLElement>(".interfaceWiringMissingPanelLabel");
  if (missingLabel) {
    appendFittedSvgText(group, missingLabel.innerText.trim(), x + width / 2, y + svgNumber(missingLabel.style.top) + 11, {
      fontSize: 10,
      fontWeight: 800,
      fill: "#9a6700",
      maxWidth: Math.max(24, width - 16),
      anchor: "middle"
    });
  }

  sourceObject.querySelectorAll<HTMLElement>(".interfaceWiringLogicalTerminal").forEach((terminal) => {
    const centerX = x + svgNumber(terminal.style.left);
    const centerY = y + svgNumber(terminal.style.top);
    const fill = terminal.style.backgroundColor || "#334155";
    const circle = createSvgElement("circle");
    setSvgAttributes(circle, {
      cx: centerX,
      cy: centerY,
      r: 6.5,
      fill,
      stroke: terminal.classList.contains("light") ? "#64748b" : "#ffffff",
      "stroke-width": 1.2
    });
    group.appendChild(circle);
    appendFittedSvgText(group, terminal.innerText.trim(), centerX, centerY + 2.4, {
      fontSize: 7,
      fontWeight: 900,
      fill: terminal.classList.contains("light") ? "#172033" : "#ffffff",
      maxWidth: 10,
      anchor: "middle"
    });
  });

  sourceObject.querySelectorAll<HTMLElement>(".interfaceWiringUnlocatedAnchor").forEach((anchor) => {
    const circle = createSvgElement("circle");
    setSvgAttributes(circle, {
      cx: x + svgNumber(anchor.style.left),
      cy: y + svgNumber(anchor.style.top),
      r: 3,
      fill: "#ffffff",
      stroke: "#9a6700",
      "stroke-width": 1
    });
    group.appendChild(circle);
  });
  return group;
}

function renderInterfaceLegendAsSvg(sourceObject: Element) {
  const group = createSvgElement("g");
  group.setAttribute("data-interface-export-object", "legend");
  const x = svgNumber(sourceObject.getAttribute("x"));
  const y = svgNumber(sourceObject.getAttribute("y"));
  const width = svgNumber(sourceObject.getAttribute("width"));
  const height = svgNumber(sourceObject.getAttribute("height"));
  const columns = [90, 100, Math.max(100, width - 190)];
  const background = createSvgElement("rect");
  setSvgAttributes(background, {
    x,
    y,
    width,
    height,
    rx: 4,
    fill: "#ffffff",
    stroke: "#8297ad",
    "stroke-width": 1
  });
  group.appendChild(background);
  const titleBackground = createSvgElement("rect");
  setSvgAttributes(titleBackground, { x, y, width, height: 24, fill: "#edf3f8" });
  group.appendChild(titleBackground);
  appendFittedSvgText(group, sourceObject.querySelector<HTMLElement>(".interfaceWiringLegend > strong")?.innerText.trim() ?? "线材图例", x + 8, y + 16, {
    fontSize: 11,
    fontWeight: 900,
    fill: "#172033",
    maxWidth: width - 16,
    anchor: "start"
  });

  const headerCells = Array.from(sourceObject.querySelectorAll<HTMLTableCellElement>("thead th"));
  const dataRows = Array.from(sourceObject.querySelectorAll<HTMLTableRowElement>("tbody tr"));
  const rowHeight = 28;
  const tableTop = y + 24;
  const totalRows = 1 + dataRows.length;
  for (let row = 0; row <= totalRows; row += 1) {
    const line = createSvgElement("line");
    setSvgAttributes(line, {
      x1: x,
      y1: tableTop + row * rowHeight,
      x2: x + width,
      y2: tableTop + row * rowHeight,
      stroke: "#c8d3df",
      "stroke-width": 1
    });
    group.appendChild(line);
  }
  let dividerX = x;
  columns.slice(0, -1).forEach((columnWidth) => {
    dividerX += columnWidth;
    const line = createSvgElement("line");
    setSvgAttributes(line, {
      x1: dividerX,
      y1: tableTop,
      x2: dividerX,
      y2: tableTop + totalRows * rowHeight,
      stroke: "#dde5ed",
      "stroke-width": 1
    });
    group.appendChild(line);
  });

  headerCells.forEach((cell, index) => {
    const cellX = x + columns.slice(0, index).reduce((sum, column) => sum + column, 0);
    appendFittedSvgText(group, cell.innerText.trim(), cellX + 6, tableTop + 18, {
      fontSize: 9.5,
      fontWeight: 900,
      fill: "#475569",
      maxWidth: columns[index] - 12,
      anchor: "start"
    });
  });
  dataRows.forEach((row, rowIndex) => {
    const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>("td"));
    const centerY = tableTop + (rowIndex + 1) * rowHeight + rowHeight / 2;
    const swatch = cells[0]?.querySelector<HTMLElement>(".interfaceWiringLegendSwatch i");
    if (swatch) {
      const line = createSvgElement("line");
      setSvgAttributes(line, {
        x1: x + 8,
        y1: centerY,
        x2: x + Math.min(70, columns[0] - 8),
        y2: centerY,
        stroke: swatch.style.backgroundColor || "#475569",
        "stroke-width": 6,
        "stroke-linecap": "round"
      });
      group.appendChild(line);
    }
    [1, 2].forEach((cellIndex) => {
      const cellX = x + columns.slice(0, cellIndex).reduce((sum, column) => sum + column, 0);
      appendFittedSvgText(group, cells[cellIndex]?.innerText.trim() ?? "", cellX + 6, centerY + 3.3, {
        fontSize: 9.5,
        fontWeight: 700,
        fill: "#172033",
        maxWidth: columns[cellIndex] - 12,
        anchor: "start"
      });
    });
  });
  return group;
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(name: K) {
  return document.createElementNS(svgNamespace, name);
}

function setSvgAttributes(element: Element, attributes: Record<string, string | number>) {
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
}

function appendFittedSvgText(
  parent: SVGElement,
  value: string,
  x: number,
  y: number,
  options: { fontSize: number; fontWeight: number; fill: string; maxWidth: number; anchor: "start" | "middle" }
) {
  const text = createSvgElement("text");
  setSvgAttributes(text, {
    x,
    y,
    fill: options.fill,
    "font-family": '"Microsoft YaHei", "PingFang SC", Arial, sans-serif',
    "font-size": options.fontSize,
    "font-weight": options.fontWeight,
    "text-anchor": options.anchor
  });
  const estimatedWidth = Array.from(value).length * options.fontSize * 0.62;
  if (estimatedWidth > options.maxWidth) {
    text.setAttribute("textLength", String(options.maxWidth));
    text.setAttribute("lengthAdjust", "spacingAndGlyphs");
  }
  text.textContent = value;
  parent.appendChild(text);
}

function svgNumber(value: string | null | undefined) {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

const inlineSvgImages = async (svg: SVGSVGElement) => {
  const images = Array.from(svg.querySelectorAll("image, img"));
  const cache = new Map<string, Promise<string>>();

  await Promise.all(
    images.map(async (image) => {
      const isHtmlImage = image.tagName.toLowerCase() === "img";
      const href = isHtmlImage
        ? image.getAttribute("src")
        : image.getAttribute("href") || image.getAttributeNS("http://www.w3.org/1999/xlink", "href");
      if (!href || href.startsWith("data:")) return;
      const dataUrlPromise = cache.get(href) ?? imageUrlToDataUrl(href);
      cache.set(href, dataUrlPromise);
      const dataUrl = await dataUrlPromise;
      if (isHtmlImage) {
        image.setAttribute("src", dataUrl);
      } else {
        image.setAttribute("href", dataUrl);
        image.setAttributeNS("http://www.w3.org/1999/xlink", "href", dataUrl);
      }
    })
  );
};

const getInterfaceWiringExportCss = (svg: SVGSVGElement) => {
  if (!svg.classList.contains("interfaceWiringCanvas")) return "";
  return Array.from(document.styleSheets).flatMap((sheet) => {
    try {
      return Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .filter((text) => text.includes("interfaceWiring"));
    } catch {
      return [];
    }
  }).join("\n");
};

const imageUrlToDataUrl = async (href: string) => {
  const url = new URL(href, document.baseURI).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image export asset failed: ${url}`);
  const blob = await response.blob();
  return blobToDataUrl(blob);
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Image export asset read failed."));
    reader.readAsDataURL(blob);
  });

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image export failed."));
    image.src = url;
  });

const downloadUrl = (url: string, filename: string) => {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};
