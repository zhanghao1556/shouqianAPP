import type { Need, ProductRecommendation } from "../types";
import {
  SMALL_DISC_01_PRODUCT_ID,
  SMALL_DISC_02_PRODUCT_ID,
  SMALL_DISC_03_PRODUCT_ID,
  SMALL_DISC_AUDIO_EXTENDER_NAME,
  SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID,
  SMALL_DISC_MAIN_NAME,
  SMALL_DISC_RECORDING_NAME,
  SMALL_DISC_SLAVE_NAME,
  SMALL_DISC_USB_CABLE_PRODUCT_ID
} from "../lib/yinmanSmallDiscRules";

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
    productId: "HANGING-MIC",
    name: "吊麦",
    category: "pickup",
    applyWhen: ["localAmplification"],
    source: "音曼吊麦产品资料、技术支持确认口径",
    installation: "仅用于讲台区域扩声，按3m拾音与扩声半径布置吊装点位。",
    wiring: "每只吊麦独占一路MIC输入，由MIC口直接供电；仅可接双麦处理器或六麦处理器。"
  },
  {
    productId: SMALL_DISC_01_PRODUCT_ID,
    name: SMALL_DISC_MAIN_NAME,
    category: "pickup",
    applyWhen: ["videoConference", "interactiveClass", "localAmplification", "recording", "remoteTeaching"],
    source: "小圆盘阵麦主麦产品资料、接线图及技术支持确认口径",
    installation: "采用吊杆安装，主麦优先布置在主要拾音区的核心位置。",
    wiring: "内置音频处理；本地扩声由SPK-OUT接功放，线上音频可使用客户自购USB音频线或音频扩展器。"
  },
  {
    productId: SMALL_DISC_02_PRODUCT_ID,
    name: SMALL_DISC_SLAVE_NAME,
    category: "pickup",
    applyWhen: ["videoConference", "interactiveClass", "localAmplification", "recording", "remoteTeaching"],
    source: "小圆盘阵麦从麦产品资料及技术支持确认口径",
    installation: "采用吊杆安装，按主要活动区覆盖需要补充主麦未覆盖位置。",
    wiring: "通过主麦MIC接口逐级连接，单段使用超五类纯铜网线并按T568B制作。"
  },
  {
    productId: SMALL_DISC_03_PRODUCT_ID,
    name: SMALL_DISC_RECORDING_NAME,
    category: "pickup",
    applyWhen: ["recording"],
    source: "小圆盘录音巡课阵麦产品资料及技术支持确认口径",
    installation: "采用吊杆安装，只覆盖讲台、会议桌等主要录音或巡课区域。",
    wiring: "麦克风级联后共用一个音频扩展器，由A OUT连接录播或巡课设备音频输入。"
  },
  {
    productId: SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID,
    name: SMALL_DISC_AUDIO_EXTENDER_NAME,
    category: "accessory",
    applyWhen: ["videoConference", "interactiveClass", "recording", "remoteTeaching"],
    source: "音频扩展器接线图及技术支持确认口径",
    installation: "安装在录播、会议终端或电脑附近，便于模拟音频接入。",
    wiring: "LINK接小圆盘阵麦，A OUT接录播或终端音频输入，双向音频时A IN接终端音频输出。"
  },
  {
    productId: SMALL_DISC_USB_CABLE_PRODUCT_ID,
    name: "USB音频线（客户自购）",
    category: "accessory",
    applyWhen: ["videoConference", "interactiveClass", "remoteTeaching"],
    source: "小圆盘阵麦主麦接线图及技术支持确认口径",
    installation: "由客户按电脑与麦克风安装距离另行采购。",
    wiring: "小圆盘阵麦USB接口直连电脑USB音频接口，同时承担供电和数字音频。"
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
