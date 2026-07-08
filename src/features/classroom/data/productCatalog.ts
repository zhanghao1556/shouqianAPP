import type { Need, ProductRecommendation } from "../types";

export interface ClassroomProductRule {
  productId: string;
  name: string;
  category: ProductRecommendation["category"];
  applyWhen: Need[];
  source: string;
  installation: string;
  wiring: string;
}

export const classroomProductRules: ClassroomProductRule[] = [
  {
    productId: "DT2-Pro",
    name: "DT2 Pro 智能语音阵列麦克风",
    category: "pickup",
    applyWhen: ["videoConference", "interactiveClass", "localAmplification", "recording", "remoteTeaching"],
    source: "DT2 Pro 阵列麦说明书、ClassIn Mic DT2 Pro 白皮书",
    installation: "适合录播、远程互动和较大教室，优先用于对拾音清晰度要求更高的项目。",
    wiring: "USB Type-B 接电脑 / 一体机；Line Out 接录播主机音频输入；模拟输入 L/R/G 可接无线接收机；功放输出 L+/L-/R+/R- 接无源音箱。"
  },
  {
    productId: "CEILING-SPEAKER",
    name: "4寸吸顶音箱",
    category: "speaker",
    applyWhen: ["localAmplification", "interactiveClass"],
    source: "DT 系列功放输出端子说明、音翼大客户教室扩声规则",
    installation: "适合宽体型教室，或长度大于宽度且宽度超过 10m 的教室；系统根据扩声范围和教室尺寸自动生成覆盖点位。",
    wiring: "接 DT 系列 SPK 功放输出口，音箱端保持正负极一致；每路 SPK 最多并联 2 只。"
  },
  {
    productId: "COLUMN-SPEAKER",
    name: "2×3寸壁挂音柱",
    category: "speaker",
    applyWhen: ["localAmplification", "interactiveClass"],
    source: "DT 系列功放输出端子说明、音翼大客户教室扩声规则",
    installation: "适合长度大于宽度且宽度在 10m 内的教室，按壁挂音柱单侧覆盖极限 5m 估算，通常布置在前场左右两侧。",
    wiring: "接 DT 系列 SPK 功放输出口，音柱端保持正负极一致；每路 SPK 最多并联 2 只。"
  },
  {
    productId: "WIRELESS-HANDHELD",
    name: "音翼无线手持麦",
    category: "wireless",
    applyWhen: [],
    source: "WP1 手持麦安装注意事项及接口说明、手持麦克风系统应用方案",
    installation: "房间混响风险较高时，接收机放置在授课区设备侧，手持麦用于主持、问答和临时发言，减少远距离拾音受混响影响。",
    wiring: "接收机优先使用 LINE OUT RCA 输出，接入 DT 系列模拟输入 L/R/G；也可按现场接口使用 BAL OUT。"
  },
  {
    productId: "YY-POWER-AMP",
    name: "教学模拟功放主机",
    category: "amplifier",
    applyWhen: ["localAmplification", "interactiveClass"],
    source: "教学模拟功放主机产品规格书.docx",
    installation: "用于 DT 内置 SPK 输出容量不足时的外接功放扩展，建议随弱电机柜、讲台设备柜或音频设备区集中安装，便于供电、散热和维护。",
    wiring: "DT 阵麦 Line Out 接教学模拟功放主机音频输入；扩展音箱小于等于 4 只时一通道一只，大于 4 只时开始并线；1 根 Line Out 音频线默认带 2 个功放通道。"
  }
];
