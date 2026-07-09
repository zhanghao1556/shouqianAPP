export type AppBrandId = "yinyi" | "yinman";

export interface AppBrandConfig {
  id: AppBrandId;
  companyName: string;
  appName: string;
  defaultPlanName: string;
  reportProducer: string;
}

const brandConfigs: Record<AppBrandId, AppBrandConfig> = {
  yinyi: {
    id: "yinyi",
    companyName: "音翼科技",
    appName: "音翼AI售前工具",
    defaultPlanName: "音翼售前方案",
    reportProducer: "Yinyi AI Presales Tool"
  },
  yinman: {
    id: "yinman",
    companyName: "音曼",
    appName: "音曼AI售前工具",
    defaultPlanName: "音曼售前方案",
    reportProducer: "Yinman AI Presales Tool"
  }
};

export function getAppBrand(): AppBrandConfig {
  if (typeof window !== "undefined" && (window.__APP_BRAND__ === "yinman" || window.location.port === "5180")) {
    return brandConfigs.yinman;
  }
  return brandConfigs.yinyi;
}

export function formatBrandText(value: string): string {
  if (getAppBrand().id !== "yinman") return value;
  return value
    .replace(/DT2 Pro 智能语音阵列麦克风/g, "智能语音阵列麦克风")
    .replace(/DT2 pro 智能语音阵列麦克风/gi, "智能语音阵列麦克风")
    .replace(/DT2 Pro/g, "智能语音阵列麦克风")
    .replace(/音翼科技/g, "音曼")
    .replace(/音翼/g, "音曼")
    .replace(/Yinyi AI Presales Tool/g, "Yinman AI Presales Tool");
}

export function getBrandLogoSrc(defaultLogoSrc: string): string {
  if (getAppBrand().id !== "yinman") return defaultLogoSrc;
  const svg = `<svg width="320" height="112" viewBox="0 0 320 112" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="音曼">
  <rect x="10" y="10" width="92" height="92" rx="24" fill="#0b7a55"/>
  <path d="M34 66c12-28 32-34 58-30-18 8-30 22-36 44-5-12-12-15-22-14Z" fill="#ffffff"/>
  <path d="M42 44c8-10 20-16 35-17-11 7-19 16-24 28-3-5-7-8-11-11Z" fill="#c9f7df"/>
  <text x="122" y="66" font-family="Microsoft YaHei, PingFang SC, Arial, sans-serif" font-size="44" font-weight="800" fill="#08372b">音曼</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
