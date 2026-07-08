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

export const svgToPngDataUrl = async (svg: SVGSVGElement) => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const viewBox = clone.viewBox.baseVal;
  const width = viewBox?.width || svg.getBoundingClientRect().width || 980;
  const height = viewBox?.height || svg.getBoundingClientRect().height || 680;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = svgExportStyle;
  clone.insertBefore(style, clone.firstChild);

  await inlineSvgImages(clone);

  const svgText = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const scale = 2;
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

const inlineSvgImages = async (svg: SVGSVGElement) => {
  const images = Array.from(svg.querySelectorAll("image"));
  const cache = new Map<string, Promise<string>>();

  await Promise.all(
    images.map(async (image) => {
      const href = image.getAttribute("href") || image.getAttributeNS("http://www.w3.org/1999/xlink", "href");
      if (!href || href.startsWith("data:")) return;
      const dataUrlPromise = cache.get(href) ?? imageUrlToDataUrl(href);
      cache.set(href, dataUrlPromise);
      const dataUrl = await dataUrlPromise;
      image.setAttribute("href", dataUrl);
      image.setAttributeNS("http://www.w3.org/1999/xlink", "href", dataUrl);
    })
  );
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
