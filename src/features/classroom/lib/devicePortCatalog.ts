import type {
  DeviceInterfacePanel,
  DevicePortCapability,
  DevicePortProfile,
  DevicePortTerminal,
  DevicePortVisualAnchor,
  InterfacePortDirection
} from "../types";
import { HANGING_MIC_PRODUCT_ID } from "./hangingMicRules";
import { LINE_ARRAY_PRODUCT_ID } from "./lineArrayRules";
import { EXTERNAL_AMPLIFIER_PRODUCT_ID } from "./speakerRules";
import {
  LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID,
  PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID
} from "./systemCapabilities";
import {
  SMALL_DISC_01_PRODUCT_ID,
  SMALL_DISC_02_PRODUCT_ID,
  SMALL_DISC_03_PRODUCT_ID,
  SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID
} from "./yinmanSmallDiscRules";

export const PROCESSOR_AJ200_PORT_PROFILE_ID = "YINMAN-PROCESSOR-AJ200";
export const PROCESSOR_AJ350_PORT_PROFILE_ID = "YINMAN-PROCESSOR-AJ350";
export const PROCESSOR_AJ600_PORT_PROFILE_ID = "YINMAN-PROCESSOR-AJ600";
export const COMPUTER_REAR_PANEL_PORT_PROFILE_ID = "COMPUTER-REAR-PANEL";
export const PASSIVE_SPEAKER_PORT_PROFILE_ID = "PASSIVE-SPEAKER";
export const WIRELESS_RECEIVER_PORT_PROFILE_ID = "WIRELESS-RECEIVER";

const confirmedSource = "用户确认口径与设备安装资料";
const agentSource = "设备安装资料与公司Agent检索结果";

const speakerTerminals: DevicePortTerminal[] = [
  { id: "positive", label: "+", role: "positive", color: "#dc2626" },
  { id: "negative", label: "-", role: "negative", color: "#ffffff" }
];

const balancedTerminals: DevicePortTerminal[] = [
  { id: "positive", label: "+", role: "positive", color: "#dc2626" },
  { id: "negative", label: "-", role: "negative", color: "#ffffff" },
  { id: "ground", label: "G", role: "ground", color: "#64748b" }
];

const xlrTerminals: DevicePortTerminal[] = [
  { id: "pin2", label: "2 (+)", role: "positive", color: "#dc2626" },
  { id: "pin3", label: "3 (-)", role: "negative", color: "#ffffff" },
  { id: "pin1", label: "1 (G)", role: "ground", color: "#64748b" }
];

const t568bColors = ["#fbbf24", "#f97316", "#86efac", "#2563eb", "#93c5fd", "#16a34a", "#d6d3d1", "#92400e"];
const t568bLabels = ["1 白橙", "2 橙", "3 白绿", "4 蓝", "5 白蓝", "6 绿", "7 白棕", "8 棕"];
const rj45Terminals: DevicePortTerminal[] = t568bLabels.map((label, index) => ({
  id: `pin${index + 1}`,
  label,
  role: "pin",
  color: t568bColors[index]
}));

const anchor = (
  x: number,
  y: number,
  terminalAnchors?: DevicePortVisualAnchor["terminalAnchors"]
): DevicePortVisualAnchor => ({ x, y, terminalAnchors });

const balancedAnchor = (x: number, y: number, spread = 0.012): DevicePortVisualAnchor => anchor(x, y, {
  positive: { x: x - spread, y },
  ground: { x, y },
  negative: { x: x + spread, y }
});

const aj350BalancedAnchor = (
  positiveX: number,
  negativeX: number,
  groundX: number,
  terminalY: number
): DevicePortVisualAnchor => {
  const width = 1268;
  const height = 206;
  const y = terminalY / height;
  return anchor(negativeX / width, y, {
    positive: { x: positiveX / width, y },
    negative: { x: negativeX / width, y },
    ground: { x: groundX / width, y }
  });
};

const speakerAnchor = (
  x: number,
  y: number,
  positive?: { x: number; y: number },
  negative?: { x: number; y: number }
): DevicePortVisualAnchor => anchor(x, y, {
  positive: positive ?? { x: x - 0.008, y },
  negative: negative ?? { x: x + 0.008, y }
});

const panel = (
  assetKey: string,
  aspectRatio: number,
  portAnchors: Record<string, DevicePortVisualAnchor>,
  source = agentSource,
  confirmed = true
): DeviceInterfacePanel => ({ assetKey, aspectRatio, confirmed, source, portAnchors });

function port(
  id: string,
  panelLabel: string,
  interfaceType: string,
  direction: InterfacePortDirection,
  source = confirmedSource,
  confirmed = true,
  terminals: DevicePortTerminal[] = [],
  physicalGroupId?: string
): DevicePortCapability {
  return { id, panelLabel, interfaceType, direction, maxConnections: 1, confirmed, source, terminals, physicalGroupId };
}

function numberedPorts(
  prefix: string,
  label: string,
  count: number,
  interfaceType: string,
  direction: InterfacePortDirection,
  source = agentSource,
  terminals: DevicePortTerminal[] = [],
  physicalGroupId?: string
) {
  return Array.from({ length: count }, (_, index) => port(
    `${prefix}${index + 1}`,
    `${label}${index + 1}`,
    interfaceType,
    direction,
    source,
    true,
    terminals,
    physicalGroupId
  ));
}

export const devicePortCatalog: Record<string, DevicePortProfile> = {
  [PROCESSOR_AJ200_PORT_PROFILE_ID]: {
    productId: PROCESSOR_AJ200_PORT_PROFILE_ID,
    internalModel: "AJ200",
    customerName: "智能音频处理主机",
    ports: [
      ...numberedPorts("mic", "MIC", 2, "三芯麦克风接线端子（48V）", "input", confirmedSource, balancedTerminals, "mic-block"),
      ...numberedPorts("lineIn", "LINE IN ", 2, "三芯差分接线端子（+/-/G）", "input", agentSource, balancedTerminals, "line-in-block"),
      ...numberedPorts("lineOut", "LINE OUT ", 2, "三芯差分接线端子（+/-/G）", "output", agentSource, balancedTerminals, "line-out-block"),
      port("hpIn", "HP IN", "3.5mm", "input", agentSource),
      port("hpOut", "HP OUT", "3.5mm", "output", agentSource),
      port("extmic", "EXTMIC", "RJ45", "input", confirmedSource, true, rj45Terminals),
      port("usb", "USB", "USB-B", "bidirectional", agentSource),
      port("lan", "LAN", "RJ45", "bidirectional", agentSource, true, rj45Terminals),
      port("rs232", "RS232", "三芯接线端子（Rx/Tx/G）", "bidirectional", agentSource, true, balancedTerminals),
      ...numberedPorts("spk", "SPK", 2, "扬声器接线端子（+/-）", "output", confirmedSource, speakerTerminals)
    ],
    interfacePanel: panel("aj200", 750 / 168, {
      spk1: speakerAnchor(0.058, 0.42, { x: 0.047, y: 0.42 }, { x: 0.064, y: 0.42 }),
      spk2: speakerAnchor(0.087, 0.42, { x: 0.078, y: 0.42 }, { x: 0.096, y: 0.42 }),
      mic1: balancedAnchor(0.169, 0.32),
      mic2: balancedAnchor(0.169, 0.66),
      lineIn1: balancedAnchor(0.249, 0.32),
      lineIn2: balancedAnchor(0.249, 0.66),
      lineOut1: balancedAnchor(0.326, 0.32),
      lineOut2: balancedAnchor(0.326, 0.66),
      hpIn: anchor(0.392, 0.5),
      hpOut: anchor(0.44, 0.5),
      extmic: anchor(0.518, 0.47),
      lan: anchor(0.603, 0.47),
      usb: anchor(0.678, 0.5),
      rs232: balancedAnchor(0.838, 0.52)
    }, "AJ200上面板图；MIC两路逻辑口按用户确认口径")
  },
  [PROCESSOR_AJ350_PORT_PROFILE_ID]: {
    productId: PROCESSOR_AJ350_PORT_PROFILE_ID,
    internalModel: "AJ350",
    customerName: "智能音频处理主机",
    ports: [
      ...numberedPorts("lineIn", "LINE IN ", 4, "三芯差分接线端子（+/-/G）", "input", agentSource, balancedTerminals),
      ...numberedPorts("lineOut", "LINE OUT ", 4, "三芯差分接线端子（+/-/G）", "output", agentSource, balancedTerminals),
      port("amic", "AMIC", "RJ45", "input", confirmedSource, true, rj45Terminals),
      port("a1", "A1", "RJ45", "input", confirmedSource, true, rj45Terminals),
      port("a2", "A2", "RJ45", "input", confirmedSource, true, rj45Terminals),
      port("lan", "LAN", "RJ45", "bidirectional", agentSource, true, rj45Terminals),
      port("rs232", "RS232", "三芯接线端子（Rx/Tx/G）", "bidirectional", agentSource, true, balancedTerminals),
      port("usb", "USB", "USB Type-C", "bidirectional", agentSource),
      ...numberedPorts("spk", "SPK", 4, "扬声器接线端子（+/-）", "output", confirmedSource, speakerTerminals)
    ],
    interfacePanel: panel("aj350", 1268 / 206, {
      spk1: speakerAnchor(0.24, 0.35, { x: 0.229, y: 0.31 }, { x: 0.252, y: 0.31 }),
      spk2: speakerAnchor(0.31, 0.35, { x: 0.299, y: 0.31 }, { x: 0.322, y: 0.31 }),
      spk3: speakerAnchor(0.24, 0.67, { x: 0.229, y: 0.64 }, { x: 0.252, y: 0.64 }),
      spk4: speakerAnchor(0.31, 0.67, { x: 0.299, y: 0.64 }, { x: 0.322, y: 0.64 }),
      lineIn1: aj350BalancedAnchor(531.5, 551.5, 571, 87.5),
      lineIn2: aj350BalancedAnchor(591, 611, 631, 87.5),
      lineIn3: aj350BalancedAnchor(532, 552, 572, 125.5),
      lineIn4: aj350BalancedAnchor(590.5, 610.5, 631, 125.5),
      lineOut1: aj350BalancedAnchor(668, 688, 708, 87.5),
      lineOut2: aj350BalancedAnchor(727.5, 747, 767, 87.5),
      lineOut3: aj350BalancedAnchor(668, 688, 708, 125.5),
      lineOut4: aj350BalancedAnchor(727, 747, 767, 125.5),
      amic: anchor(0.66, 0.5),
      a1: anchor(0.72, 0.5),
      a2: anchor(0.78, 0.5),
      lan: anchor(0.84, 0.5),
      rs232: balancedAnchor(0.905, 0.52),
      usb: anchor(0.95, 0.5)
    }, "AJ350完整背面接口图")
  },
  [PROCESSOR_AJ600_PORT_PROFILE_ID]: {
    productId: PROCESSOR_AJ600_PORT_PROFILE_ID,
    internalModel: "AJ600",
    customerName: "智能音频处理主机",
    ports: [
      ...numberedPorts("mic", "MIC", 6, "MIC多针插座逻辑通道（48V，+/-/G）", "input", confirmedSource, balancedTerminals, "mic-block"),
      ...numberedPorts("lineIn", "LINE IN ", 4, "多针差分接线端子（+/-/G）", "input", agentSource, balancedTerminals, "line-in-block"),
      ...numberedPorts("lineOut", "LINE OUT ", 4, "多针差分接线端子（+/-/G）", "output", agentSource, balancedTerminals, "line-out-block"),
      port("extmic", "EXTMIC", "RJ45", "input", confirmedSource, true, rj45Terminals),
      port("usb", "USB", "USB-B", "bidirectional", agentSource),
      port("lan", "LAN", "RJ45", "bidirectional", agentSource, true, rj45Terminals),
      port("rs232", "RS232", "三芯接线端子（Rx/Tx/G）", "bidirectional", agentSource, true, balancedTerminals),
      ...numberedPorts("spk", "SPK", 4, "扬声器接线端子（+/-）", "output", confirmedSource, speakerTerminals)
    ],
    interfacePanel: panel("aj600", 724 / 174, {
      spk1: speakerAnchor(0.052, 0.31, { x: 0.043, y: 0.31 }, { x: 0.061, y: 0.31 }),
      spk2: speakerAnchor(0.088, 0.31, { x: 0.079, y: 0.31 }, { x: 0.097, y: 0.31 }),
      spk3: speakerAnchor(0.052, 0.64, { x: 0.043, y: 0.64 }, { x: 0.061, y: 0.64 }),
      spk4: speakerAnchor(0.088, 0.64, { x: 0.079, y: 0.64 }, { x: 0.097, y: 0.64 }),
      mic1: balancedAnchor(0.155, 0.31),
      mic2: balancedAnchor(0.155, 0.65),
      mic3: balancedAnchor(0.198, 0.31),
      mic4: balancedAnchor(0.198, 0.65),
      mic5: balancedAnchor(0.24, 0.31),
      mic6: balancedAnchor(0.24, 0.65),
      lineIn1: balancedAnchor(0.311, 0.31),
      lineIn2: balancedAnchor(0.311, 0.65),
      lineIn3: balancedAnchor(0.362, 0.31),
      lineIn4: balancedAnchor(0.362, 0.65),
      lineOut1: balancedAnchor(0.434, 0.31),
      lineOut2: balancedAnchor(0.434, 0.65),
      lineOut3: balancedAnchor(0.485, 0.31),
      lineOut4: balancedAnchor(0.485, 0.65),
      extmic: anchor(0.551, 0.42),
      lan: anchor(0.624, 0.42),
      usb: anchor(0.698, 0.42),
      rs232: balancedAnchor(0.849, 0.52)
    }, "用户指定采用AJ600上面板接口图；MIC1-MIC6为同一MIC多针插座内的逻辑通道")
  },
  [PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID]: {
    productId: PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID,
    internalModel: "RING08",
    customerName: "大圆盘阵麦",
    ports: [port("lan", "RJ45 音频信号接口", "RJ45", "output", confirmedSource, true, rj45Terminals)],
    interfacePanel: panel("ring08", 923 / 616, {
      lan: anchor(0.5, 0.51)
    }, "RING08完整背面接口图")
  },
  [LINE_ARRAY_PRODUCT_ID]: {
    productId: LINE_ARRAY_PRODUCT_ID,
    internalModel: "SA110",
    customerName: "智能线阵麦克风",
    ports: [port("rj45", "RJ45", "RJ45", "output", confirmedSource, true, rj45Terminals)],
    interfacePanel: panel("lineArray", 1482 / 294, {
      rj45: anchor(0.505, 0.47)
    }, "用户提供SA110完整背面接线图")
  },
  [LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID]: {
    productId: LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID,
    customerName: "线阵拓展器",
    ports: [
      port("link", "LINK", "RJ45", "input", confirmedSource, true, rj45Terminals),
      port("micOut1", "麦克风输出1", "6Pin凤凰端子（前3针：+/-/G）", "output", confirmedSource, true, balancedTerminals, "mic-output-block"),
      port("micOut2", "麦克风输出2", "6Pin凤凰端子（后3针：+/-/G）", "output", confirmedSource, true, balancedTerminals, "mic-output-block")
    ],
    interfacePanel: panel("lineArrayConverter", 760 / 280, {
      link: anchor(175 / 760, 137 / 280),
      micOut1: anchor(449 / 760, 133 / 280, {
        positive: { x: 396 / 760, y: 133 / 280 },
        negative: { x: 449 / 760, y: 133 / 280 },
        ground: { x: 502 / 760, y: 133 / 280 }
      }),
      micOut2: anchor(608 / 760, 133 / 280, {
        positive: { x: 555 / 760, y: 133 / 280 },
        negative: { x: 608 / 760, y: 133 / 280 },
        ground: { x: 661 / 760, y: 133 / 280 }
      })
    }, "用户提供线阵拓展器两端实物照片并确认6Pin顺序为+/-/G/+/-/G")
  },
  [HANGING_MIC_PRODUCT_ID]: {
    productId: HANGING_MIC_PRODUCT_ID,
    internalModel: "LB102",
    customerName: "吊麦",
    ports: [port("xlr", "音频输出", "XLR-3（1=G、2=+、3=-）", "output", agentSource, true, xlrTerminals)]
  },
  [SMALL_DISC_01_PRODUCT_ID]: {
    productId: SMALL_DISC_01_PRODUCT_ID,
    internalModel: "RING01",
    customerName: "小圆盘阵麦01",
    ports: [
      port("audioOut", "AUDIO OUT / SPK-OUT", "3.5mm", "output"),
      port("usb", "USB", "USB-B", "bidirectional"),
      port("mic", "MIC", "RJ45", "bidirectional", confirmedSource, true, rj45Terminals),
      port("link", "LINK", "RJ45", "bidirectional", confirmedSource, true, rj45Terminals)
    ],
    interfacePanel: panel("ring01", 582 / 540, {
      audioOut: anchor(0.285, 0.48),
      usb: anchor(0.382, 0.715),
      mic: anchor(0.515, 0.715),
      link: anchor(0.5, 0.285)
    }, "RING01完整底面接口图")
  },
  [SMALL_DISC_02_PRODUCT_ID]: {
    productId: SMALL_DISC_02_PRODUCT_ID,
    internalModel: "RING02",
    customerName: "小圆盘阵麦02",
    ports: [
      port("micOut", "MIC-OUT", "3.5mm", "output", agentSource),
      port("mic", "MIC", "RJ45", "bidirectional", confirmedSource, true, rj45Terminals),
      port("link", "LINK", "RJ45", "bidirectional", confirmedSource, true, rj45Terminals)
    ]
  },
  [SMALL_DISC_03_PRODUCT_ID]: {
    productId: SMALL_DISC_03_PRODUCT_ID,
    internalModel: "RING03",
    customerName: "小圆盘阵麦03",
    ports: [
      port("micOut", "MIC-OUT", "3.5mm", "output", agentSource),
      port("mic", "MIC", "RJ45", "bidirectional", agentSource, true, rj45Terminals),
      port("link", "LINK", "RJ45", "bidirectional", agentSource, true, rj45Terminals)
    ],
    interfacePanel: panel("ring03", 1, {
      micOut: anchor(0.27, 0.45),
      mic: anchor(0.51, 0.73),
      link: anchor(0.5, 0.16)
    }, "RING03完整底面接口图")
  },
  [SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID]: {
    productId: SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID,
    internalModel: "RingOf-A",
    customerName: "01拓展器",
    ports: [
      port("link", "LINK", "RJ45", "bidirectional", confirmedSource, true, rj45Terminals),
      port("aIn", "A IN", "3.5mm", "input"),
      port("aOut", "A OUT", "3.5mm", "output")
    ],
    interfacePanel: panel("ringOfA", 215 / 270, {
      aOut: anchor(0.245, 0.23),
      aIn: anchor(0.52, 0.23),
      link: anchor(0.5, 0.72)
    }, "用户指定01拓展器；Agent安装手册接口图仅裁切设备面板")
  },
  [EXTERNAL_AMPLIFIER_PRODUCT_ID]: {
    productId: EXTERNAL_AMPLIFIER_PRODUCT_ID,
    customerName: "教学模拟功放主机",
    ports: [
      ...numberedPorts("lineIn", "LINE IN ", 4, "平衡输入（+/-/G）", "input", agentSource, balancedTerminals),
      ...numberedPorts("spk", "SPK", 4, "扬声器接线柱（+/-）", "output", agentSource, speakerTerminals)
    ],
    interfacePanel: panel("ap150", 1835 / 420, {
      lineIn1: balancedAnchor(0.603, 0.53),
      lineIn2: balancedAnchor(0.63, 0.67),
      lineIn3: balancedAnchor(0.653, 0.53),
      lineIn4: balancedAnchor(0.675, 0.67),
      spk1: speakerAnchor(0.704, 0.49, { x: 0.704, y: 0.28 }, { x: 0.704, y: 0.68 }),
      spk2: speakerAnchor(0.752, 0.49, { x: 0.752, y: 0.28 }, { x: 0.752, y: 0.68 }),
      spk3: speakerAnchor(0.8, 0.49, { x: 0.8, y: 0.28 }, { x: 0.8, y: 0.68 }),
      spk4: speakerAnchor(0.848, 0.49, { x: 0.848, y: 0.28 }, { x: 0.848, y: 0.68 })
    }, "教学模拟功放主机完整背面接口图")
  },
  [COMPUTER_REAR_PANEL_PORT_PROFILE_ID]: {
    productId: COMPUTER_REAR_PANEL_PORT_PROFILE_ID,
    customerName: "电脑 / 一体机",
    ports: [
      port("usbAudio", "USB 2.0", "USB-A 2.0（USB Audio一进一出、内置RS232调试）", "bidirectional", "用户确认讲台电脑接线口径"),
      port("audioOut", "LINE OUT", "3.5mm", "output", "用户提供讲台电脑背面图"),
      port("audioIn", "LINE IN", "3.5mm", "input", "用户提供讲台电脑背面图"),
      port("headset", "HEADSET", "3.5mm TRRS", "bidirectional", "用户提供讲台电脑背面图")
    ],
    interfacePanel: panel("podiumComputer", 357 / 1123, {
      usbAudio: anchor(0.295, 0.225),
      audioOut: anchor(0.228, 0.911),
      audioIn: anchor(0.518, 0.911),
      headset: anchor(0.808, 0.911)
    }, "用户提供讲台电脑完整背面照片；左上角接口面板说明书式裁切线稿；讲台电脑与一体机共用显示；音频口颜色与用途按用户确认")
  },
  [PASSIVE_SPEAKER_PORT_PROFILE_ID]: {
    productId: PASSIVE_SPEAKER_PORT_PROFILE_ID,
    customerName: "无源音箱",
    ports: [port("terminals", "+ / -", "扬声器接线端子", "input", agentSource, true, speakerTerminals)],
    interfacePanel: panel("passiveSpeaker", 1 / 2, {
      terminals: speakerAnchor(0.5, 0.64, { x: 0.58, y: 0.64 }, { x: 0.42, y: 0.64 })
    }, "无源音箱完整背面接线线稿")
  },
  [WIRELESS_RECEIVER_PORT_PROFILE_ID]: {
    productId: WIRELESS_RECEIVER_PORT_PROFILE_ID,
    customerName: "无线接收机",
    ports: [
      port("balOut", "BAL OUT", "三芯差分接线端子（+/-/G）", "output", agentSource, true, balancedTerminals),
      port("lineOut", "LINE OUT", "RCA", "output", agentSource),
      port("micOut", "MIC OUT", "6.35mm", "output", agentSource),
      port("usb", "USB（PPT控制）", "USB-B", "output", agentSource)
    ],
    interfacePanel: panel("wirelessReceiver", 747 / 190, {
      balOut: anchor(0.408, 0.48, {
        positive: { x: 0.391, y: 0.48 },
        negative: { x: 0.408, y: 0.48 },
        ground: { x: 0.426, y: 0.48 }
      }),
      lineOut: anchor(0.495, 0.48),
      micOut: anchor(0.586, 0.48),
      usb: anchor(0.174, 0.46)
    }, "《手持麦接收机说明书》完整后面板图；公司Agent图像引用 img_9b36155b6699")
  }
};

export function getDevicePortProfile(productId: string) {
  return devicePortCatalog[productId];
}

export function getDevicePortCapability(productId: string, portId: string) {
  return getDevicePortProfile(productId)?.ports.find((item) => item.id === portId);
}

export function getDevicePortsByPrefix(productId: string, prefix: string) {
  return getDevicePortProfile(productId)?.ports.filter((item) => item.id.startsWith(prefix)) ?? [];
}
