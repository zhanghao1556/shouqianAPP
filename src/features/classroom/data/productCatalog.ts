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
    name: "智能天花阵列麦克风",
    category: "pickup",
    applyWhen: ["videoConference", "interactiveClass", "localAmplification", "recording", "remoteTeaching"],
    source: "智能天花阵列麦克风产品资料、互动课堂音频系统应用方案",
    installation: "适合录播、远程互动和较大教室，优先用于对拾音清晰度要求更高的项目。",
    wiring: "USB Type-B 接电脑 / 一体机；Line Out 接录播主机音频输入；模拟输入 L/R/G 可接无线接收机；功放输出 L+/L-/R+/R- 接无源音箱。"
  },
  {
    productId: "CEILING-SPEAKER",
    name: "吸顶音箱",
    category: "speaker",
    applyWhen: ["localAmplification", "interactiveClass"],
    source: "阵列麦功放输出端子说明、音翼大客户教室扩声规则",
    installation: "适合宽体型教室，或长度大于宽度且宽度超过 10m 的教室；系统根据扩声范围和教室尺寸自动生成覆盖点位。",
    wiring: "接阵列麦主机 SPK 功放输出口，音箱端保持正负极一致；每路 SPK 最多并联 2 只。"
  },
  {
    productId: "COLUMN-SPEAKER",
    name: "壁挂音箱",
    category: "speaker",
    applyWhen: ["localAmplification", "interactiveClass"],
    source: "阵列麦功放输出端子说明、音翼大客户教室扩声规则",
    installation: "适合长度大于宽度且宽度在 10m 内的教室，按壁挂音柱单侧覆盖极限 5m 估算，通常布置在前场左右两侧。",
    wiring: "接阵列麦主机 SPK 功放输出口，音柱端保持正负极一致；每路 SPK 最多并联 2 只。"
  },
  {
    productId: "WIRELESS-HANDHELD",
    name: "无线手持麦克风系统",
    category: "wireless",
    applyWhen: [],
    source: "无线手持麦克风系统规格资料、手持麦安装注意事项及接口说明、手持麦克风系统应用方案",
    installation: "接收机放置在讲台、设备柜或音频设备区，UHF、2.4G 和红外相关天线需引出金属柜并保持无遮挡；手持麦用于授课、主持、问答和临时发言，建议按 15m 以内最佳使用距离做现场复核。",
    wiring: "接收机优先使用 LINE OUT RCA 输出，单接 L 或 R 即可；也可按现场接口使用 BAL OUT 平衡输出或 6.35mm 输出。音频输出接入阵列麦主机模拟输入 L/R/G，USB-B 仅用于 PPT 翻页 / 电脑控制，不作为主音频链路。"
  },
  {
    productId: "YY-POWER-AMP",
    name: "教学模拟功放主机",
    category: "amplifier",
    applyWhen: ["localAmplification", "interactiveClass"],
    source: "教学模拟功放主机产品规格书.docx",
    installation: "用于阵列麦主机内置 SPK 输出容量不足时的外接功放扩展，建议随弱电机柜、讲台设备柜或音频设备区集中安装，便于供电、散热和维护。",
    wiring: "阵列麦主机 Line Out 接教学模拟功放主机音频输入；扩展音箱小于等于 4 只时一通道一只，大于 4 只时开始并线；1 根 Line Out 音频线默认带 2 个功放通道。"
  }
];
