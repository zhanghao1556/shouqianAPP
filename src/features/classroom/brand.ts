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
    .replace(/DT2 Pro 智能语音阵列麦克风/g, "智能天花阵列麦克风")
    .replace(/DT2 pro 智能语音阵列麦克风/gi, "智能天花阵列麦克风")
    .replace(/DT2 Pro/g, "智能天花阵列麦克风")
    .replace(/智能语音阵列麦克风/g, "智能天花阵列麦克风")
    .replace(/音翼科技/g, "音曼")
    .replace(/音翼/g, "音曼")
    .replace(/Yinyi AI Presales Tool/g, "Yinman AI Presales Tool");
}

export function getBrandLogoSrc(defaultLogoSrc: string, yinmanLogoSrc: string): string {
  return getAppBrand().id === "yinman" ? yinmanLogoSrc : defaultLogoSrc;
}
