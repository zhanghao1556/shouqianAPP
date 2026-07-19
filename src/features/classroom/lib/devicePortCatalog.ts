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
export const RECORDING_HOST_PORT_PROFILE_ID = "EXTERNAL-RECORDING-HOST";
export const RECORDING_CAMERA_PORT_PROFILE_ID = "EXTERNAL-RECORDING-CAMERA";
export const CONTROL_HOST_PORT_PROFILE_ID = "EXTERNAL-CONTROL-HOST";
export const LAPTOP_PORT_PROFILE_ID = "EXTERNAL-LAPTOP";
export const OPS_ALL_IN_ONE_PORT_PROFILE_ID = "EXTERNAL-OPS-ALL-IN-ONE";
export const VIDEO_CONFERENCE_TERMINAL_PORT_PROFILE_ID = "EXTERNAL-VIDEO-CONFERENCE-TERMINAL";
export const HEADSET_SPLITTER_PORT_PROFILE_ID = "EXTERNAL-HEADSET-SPLITTER";
export const PASSIVE_SPEAKER_PORT_PROFILE_ID = "PASSIVE-SPEAKER";
export const WIRELESS_RECEIVER_PORT_PROFILE_ID = "WIRELESS-RECEIVER";
export const EXTERNAL_WIRED_MICROPHONE_PORT_PROFILE_ID = "EXTERNAL-WIRED-MICROPHONE";

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

const stereoTerminals: DevicePortTerminal[] = [
  { id: "left", label: "L", role: "signal", color: "#dc2626" },
  { id: "right", label: "R", role: "signal", color: "#ffffff" },
  { id: "ground", label: "G", role: "ground", color: "#6b7280" }
];

const rs232Terminals: DevicePortTerminal[] = [
  { id: "rx", label: "RX", role: "signal", color: "#22c55e" },
  { id: "tx", label: "TX", role: "signal", color: "#eab308" },
  { id: "ground", label: "GND", role: "ground", color: "#111827" }
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

const calibratedBalancedAnchor = (
  width: number,
  height: number,
  positiveX: number,
  negativeX: number,
  groundX: number,
  terminalY: number
): DevicePortVisualAnchor => {
  const y = terminalY / height;
  return anchor(negativeX / width, y, {
    positive: { x: positiveX / width, y },
    negative: { x: negativeX / width, y },
    ground: { x: groundX / width, y }
  });
};

const calibratedRs232Anchor = (
  width: number,
  height: number,
  rxX: number,
  txX: number,
  groundX: number,
  terminalY: number
): DevicePortVisualAnchor => {
  const y = terminalY / height;
  return anchor(txX / width, y, {
    rx: { x: rxX / width, y },
    tx: { x: txX / width, y },
    ground: { x: groundX / width, y }
  });
};

const calibratedStereoAnchor = (
  width: number,
  height: number,
  leftX: number,
  rightX: number,
  groundX: number,
  terminalY: number
): DevicePortVisualAnchor => {
  const y = terminalY / height;
  return anchor(rightX / width, y, {
    left: { x: leftX / width, y },
    right: { x: rightX / width, y },
    ground: { x: groundX / width, y }
  });
};

const aj350BalancedAnchor = (
  positiveX: number,
  negativeX: number,
  groundX: number,
  terminalY: number
) => calibratedBalancedAnchor(1268, 206, positiveX, negativeX, groundX, terminalY);

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
      ...numberedPorts("mic", "MIC", 2, "三芯麦克风接线端子（+/-/G）", "input", confirmedSource, balancedTerminals, "mic-block"),
      ...numberedPorts("lineIn", "LINE IN ", 2, "三芯差分接线端子（+/-/G）", "input", agentSource, balancedTerminals, "line-in-block"),
      ...numberedPorts("lineOut", "LINE OUT ", 2, "三芯差分接线端子（+/-/G）", "output", agentSource, balancedTerminals, "line-out-block"),
      port("hpIn", "HP IN", "3.5mm TRS（L/R/G）", "input", confirmedSource, true, stereoTerminals),
      port("hpOut", "HP OUT", "3.5mm TRS（L/R/G）", "output", confirmedSource, true, stereoTerminals),
      port("extmic", "EXTMIC", "RJ45", "input", confirmedSource, true, rj45Terminals),
      port("usb", "USB", "USB-B", "bidirectional", agentSource),
      port("lan", "LAN", "RJ45", "bidirectional", agentSource, true, rj45Terminals),
      port("rs232", "RS232", "三芯接线端子（RX/TX/GND）", "bidirectional", confirmedSource, true, rs232Terminals),
      ...numberedPorts("spk", "SPK", 2, "扬声器接线端子（+/-）", "output", confirmedSource, speakerTerminals)
    ],
    interfacePanel: panel("aj200", 750 / 168, {
      spk1: speakerAnchor(41.5 / 750, 71 / 168, { x: 35 / 750, y: 71 / 168 }, { x: 48 / 750, y: 71 / 168 }),
      spk2: speakerAnchor(65.5 / 750, 71 / 168, { x: 59 / 750, y: 71 / 168 }, { x: 72 / 750, y: 71 / 168 }),
      mic1: calibratedBalancedAnchor(750, 168, 117, 127, 137, 54),
      mic2: calibratedBalancedAnchor(750, 168, 117, 127, 137, 111),
      lineIn1: calibratedBalancedAnchor(750, 168, 177, 187, 197, 54),
      lineIn2: calibratedBalancedAnchor(750, 168, 177, 187, 197, 111),
      lineOut1: calibratedBalancedAnchor(750, 168, 235, 245, 255, 54),
      lineOut2: calibratedBalancedAnchor(750, 168, 235, 245, 255, 111),
      hpIn: anchor(294 / 750, 84 / 168),
      hpOut: anchor(330 / 750, 84 / 168),
      extmic: anchor(388 / 750, 84 / 168),
      lan: anchor(452 / 750, 84 / 168),
      usb: anchor(509 / 750, 84 / 168),
      rs232: calibratedRs232Anchor(750, 168, 619, 629, 639, 78)
    }, "用户确认接口能力；按清晰工程面板重构并以孔位中心标定")
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
      port("rs232", "RS232", "三芯接线端子（RX/TX/GND）", "bidirectional", confirmedSource, true, rs232Terminals),
      port("usb", "USB", "USB Type-C", "bidirectional", agentSource),
      ...numberedPorts("spk", "SPK", 4, "扬声器接线端子（+/-）", "output", confirmedSource, speakerTerminals)
    ],
    interfacePanel: panel("aj350", 1268 / 206, {
      spk1: speakerAnchor(305 / 1268, 64 / 206, { x: 290 / 1268, y: 64 / 206 }, { x: 320 / 1268, y: 64 / 206 }),
      spk2: speakerAnchor(393.5 / 1268, 64 / 206, { x: 379 / 1268, y: 64 / 206 }, { x: 408 / 1268, y: 64 / 206 }),
      spk3: speakerAnchor(305 / 1268, 132 / 206, { x: 290 / 1268, y: 132 / 206 }, { x: 320 / 1268, y: 132 / 206 }),
      spk4: speakerAnchor(393.5 / 1268, 132 / 206, { x: 379 / 1268, y: 132 / 206 }, { x: 408 / 1268, y: 132 / 206 }),
      lineIn1: aj350BalancedAnchor(531.5, 551.5, 571, 87.5),
      lineIn2: aj350BalancedAnchor(591, 611, 631, 87.5),
      lineIn3: aj350BalancedAnchor(532, 552, 572, 125.5),
      lineIn4: aj350BalancedAnchor(590.5, 610.5, 631, 125.5),
      lineOut1: aj350BalancedAnchor(668, 688, 708, 87.5),
      lineOut2: aj350BalancedAnchor(727.5, 747, 767, 87.5),
      lineOut3: aj350BalancedAnchor(668, 688, 708, 125.5),
      lineOut4: aj350BalancedAnchor(727, 747, 767, 125.5),
      amic: anchor(837 / 1268, 103 / 206),
      a1: anchor(913 / 1268, 103 / 206),
      a2: anchor(989 / 1268, 103 / 206),
      lan: anchor(1065 / 1268, 103 / 206),
      rs232: calibratedRs232Anchor(1268, 206, 1138, 1148, 1158, 101),
      usb: anchor(1205 / 1268, 103 / 206)
    }, "用户确认接口能力；按清晰工程面板重构并以孔位中心标定")
  },
  [PROCESSOR_AJ600_PORT_PROFILE_ID]: {
    productId: PROCESSOR_AJ600_PORT_PROFILE_ID,
    internalModel: "AJ600",
    customerName: "智能音频处理主机",
    ports: [
      ...numberedPorts("mic", "MIC", 6, "MIC多针插座逻辑通道（+/-/G）", "input", confirmedSource, balancedTerminals, "mic-block"),
      ...numberedPorts("lineIn", "LINE IN ", 4, "多针差分接线端子（+/-/G）", "input", agentSource, balancedTerminals, "line-in-block"),
      ...numberedPorts("lineOut", "LINE OUT ", 4, "多针差分接线端子（+/-/G）", "output", agentSource, balancedTerminals, "line-out-block"),
      port("extmic", "EXTMIC", "RJ45", "input", confirmedSource, true, rj45Terminals),
      port("usb", "USB", "USB-B", "bidirectional", agentSource),
      port("lan", "LAN", "RJ45", "bidirectional", agentSource, true, rj45Terminals),
      port("rs232", "RS232", "三芯接线端子（RX/TX/GND）", "bidirectional", confirmedSource, true, rs232Terminals),
      ...numberedPorts("spk", "SPK", 4, "扬声器接线端子（+/-）", "output", confirmedSource, speakerTerminals)
    ],
    interfacePanel: panel("aj600", 724 / 124, {
      spk1: speakerAnchor(37 / 724, 44 / 124, { x: 32 / 724, y: 44 / 124 }, { x: 42 / 724, y: 44 / 124 }),
      spk2: speakerAnchor(57 / 724, 44 / 124, { x: 52 / 724, y: 44 / 124 }, { x: 62 / 724, y: 44 / 124 }),
      spk3: speakerAnchor(37 / 724, 86 / 124, { x: 32 / 724, y: 86 / 124 }, { x: 42 / 724, y: 86 / 124 }),
      spk4: speakerAnchor(57 / 724, 86 / 124, { x: 52 / 724, y: 86 / 124 }, { x: 62 / 724, y: 86 / 124 }),
      mic1: calibratedBalancedAnchor(724, 124, 104, 114, 124, 56),
      mic2: calibratedBalancedAnchor(724, 124, 104, 114, 124, 86),
      mic3: calibratedBalancedAnchor(724, 124, 134, 144, 154, 56),
      mic4: calibratedBalancedAnchor(724, 124, 134, 144, 154, 86),
      mic5: calibratedBalancedAnchor(724, 124, 164, 174, 184, 56),
      mic6: calibratedBalancedAnchor(724, 124, 164, 174, 184, 86),
      lineIn1: calibratedBalancedAnchor(724, 124, 214, 224, 234, 56),
      lineIn2: calibratedBalancedAnchor(724, 124, 214, 224, 234, 86),
      lineIn3: calibratedBalancedAnchor(724, 124, 244, 254, 264, 56),
      lineIn4: calibratedBalancedAnchor(724, 124, 244, 254, 264, 86),
      lineOut1: calibratedBalancedAnchor(724, 124, 299, 309, 319, 56),
      lineOut2: calibratedBalancedAnchor(724, 124, 299, 309, 319, 86),
      lineOut3: calibratedBalancedAnchor(724, 124, 329, 339, 349, 56),
      lineOut4: calibratedBalancedAnchor(724, 124, 329, 339, 349, 86),
      extmic: anchor(398 / 724, 66 / 124),
      lan: anchor(454 / 724, 66 / 124),
      usb: anchor(506 / 724, 67 / 124),
      rs232: calibratedRs232Anchor(724, 124, 606, 616, 626, 67)
    }, "用户指定采用AJ600上面板接口；按清晰工程面板重构并以孔位中心标定；MIC1-MIC6为同一多针插座内逻辑通道")
  },
  [PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID]: {
    productId: PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID,
    internalModel: "RING08",
    customerName: "大圆盘阵麦",
    ports: [port("lan", "RJ45 音频信号接口", "RJ45", "output", confirmedSource, true, rj45Terminals)],
    interfacePanel: panel("ring08", 1, {
      lan: anchor(0.5, 301 / 600)
    }, "用户确认RJ45接口；按完整圆盘背面重构清晰工程图")
  },
  [LINE_ARRAY_PRODUCT_ID]: {
    productId: LINE_ARRAY_PRODUCT_ID,
    internalModel: "SA110",
    customerName: "智能线阵麦克风",
    ports: [port("rj45", "RJ45", "RJ45", "output", confirmedSource, true, rj45Terminals)],
    interfacePanel: panel("lineArray", 1482 / 294, {
      rj45: anchor(749 / 1482, 139 / 294)
    }, "用户提供SA110完整背面接线图；按原接口位置重构清晰工程图")
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
    ports: [port(
      "xlr",
      "卡侬母头",
      "XLR-3 卡侬母头（1=G、2=+、3=-）",
      "output",
      "用户确认吊麦采用卡侬母头，针序1=G、2=+、3=-",
      true,
      xlrTerminals
    )],
    interfacePanel: panel("hangingMic", 760 / 1560, {
      xlr: anchor(380 / 760, 1430 / 1560, {
        pin2: { x: 345 / 760, y: 1400 / 1560 },
        pin3: { x: 415 / 760, y: 1400 / 1560 },
        pin1: { x: 380 / 760, y: 1455 / 1560 }
      })
    }, "吊麦本体按用户提供实物图重构；卡侬母头与针序按用户确认")
  },
  [EXTERNAL_WIRED_MICROPHONE_PORT_PROFILE_ID]: {
    productId: EXTERNAL_WIRED_MICROPHONE_PORT_PROFILE_ID,
    customerName: "有线麦克风",
    ports: [port(
      "xlr",
      "卡侬母头",
      "XLR-3 卡侬母头（1=G、2=+、3=-）",
      "output",
      "用户确认利旧有线麦采用与吊麦相同的卡侬母头及针序",
      true,
      xlrTerminals
    )],
    interfacePanel: panel("wiredMicrophone", 760 / 1240, {
      xlr: anchor(380 / 760, 1120 / 1240, {
        pin2: { x: 347 / 760, y: 1092 / 1240 },
        pin3: { x: 413 / 760, y: 1092 / 1240 },
        pin1: { x: 380 / 760, y: 1146 / 1240 }
      })
    }, "有线麦本体按现有实物图重构；卡侬母头与针序按用户确认")
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
    interfacePanel: panel("ring01", 1, {
      audioOut: anchor(171 / 600, 288 / 600),
      usb: anchor(229 / 600, 429 / 600),
      mic: anchor(309 / 600, 433 / 600),
      link: anchor(300 / 600, 163 / 600)
    }, "用户确认RING01底面接口；移除旧红色序号并重构清晰工程图")
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
      micOut: anchor(162 / 600, 270 / 600),
      mic: anchor(306 / 600, 437 / 600),
      link: anchor(300 / 600, 92 / 600)
    }, "用户确认RING03底面接口；移除旧红色序号并重构清晰工程图")
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
    interfacePanel: panel("ringOfA", 400 / 500, {
      aOut: anchor(98 / 400, 115 / 500),
      aIn: anchor(208 / 400, 115 / 500),
      link: anchor(200 / 400, 345 / 500)
    }, "用户指定01拓展器；按A OUT、A IN与LINK实际分面重构清晰工程图")
  },
  [EXTERNAL_AMPLIFIER_PRODUCT_ID]: {
    productId: EXTERNAL_AMPLIFIER_PRODUCT_ID,
    customerName: "教学模拟功放主机",
    ports: [
      ...numberedPorts("lineIn", "LINE IN ", 4, "平衡输入（+/-/G）", "input", agentSource, balancedTerminals),
      ...numberedPorts("spk", "SPK", 4, "扬声器接线柱（+/-）", "output", agentSource, speakerTerminals)
    ],
    interfacePanel: panel("ap150", 1200 / 500, {
      lineIn1: calibratedBalancedAnchor(1200, 500, 160, 184, 208, 294),
      lineIn2: calibratedBalancedAnchor(1200, 500, 160, 184, 208, 374),
      lineIn3: calibratedBalancedAnchor(1200, 500, 244, 268, 292, 294),
      lineIn4: calibratedBalancedAnchor(1200, 500, 244, 268, 292, 374),
      spk1: speakerAnchor(516 / 1200, 222 / 500, { x: 516 / 1200, y: 128 / 500 }, { x: 516 / 1200, y: 316 / 500 }),
      spk2: speakerAnchor(668 / 1200, 222 / 500, { x: 668 / 1200, y: 128 / 500 }, { x: 668 / 1200, y: 316 / 500 }),
      spk3: speakerAnchor(822 / 1200, 222 / 500, { x: 822 / 1200, y: 128 / 500 }, { x: 822 / 1200, y: 316 / 500 }),
      spk4: speakerAnchor(974 / 1200, 222 / 500, { x: 974 / 1200, y: 128 / 500 }, { x: 974 / 1200, y: 316 / 500 })
    }, "用户提供功放背面资料；只保留LINE IN与SPK接线区并重构清晰工程图")
  },
  [COMPUTER_REAR_PANEL_PORT_PROFILE_ID]: {
    productId: COMPUTER_REAR_PANEL_PORT_PROFILE_ID,
    customerName: "讲台电脑",
    ports: [
      port("usbAudio", "USB 2.0", "USB-A 2.0（USB Audio一进一出、内置232串口信号）", "bidirectional", "用户确认讲台电脑接线口径"),
      port("audioOut", "LINE OUT", "3.5mm TRS（L/R/G）", "output", "用户提供讲台电脑背面图", true, stereoTerminals),
      port("audioIn", "LINE IN", "3.5mm TRS（L/R/G）", "input", "用户提供讲台电脑背面图", true, stereoTerminals),
      port("headset", "HEADSET", "3.5mm TRRS", "bidirectional", "用户提供讲台电脑背面图")
    ],
    interfacePanel: panel("podiumComputer", 760 / 420, {
      usbAudio: anchor(140 / 760, 154 / 420),
      audioOut: calibratedStereoAnchor(760, 420, 326, 340, 354, 154),
      audioIn: calibratedStereoAnchor(760, 420, 496, 510, 524, 154),
      headset: anchor(660 / 760, 154 / 420)
    }, "用户要求讲台电脑接口图以USB Audio和3.5mm音频输入输出为主；HDMI等非接线接口降为次要信息")
  },
  [RECORDING_HOST_PORT_PROFILE_ID]: {
    productId: RECORDING_HOST_PORT_PROFILE_ID,
    customerName: "录播主机",
    ports: [
      port("lineIn35", "LINE IN（3.5mm）", "3.5mm TRS（L/R/G）", "input", confirmedSource, true, stereoTerminals),
      port("lineInBalanced", "LINE IN（+/-/G）", "3Pin凤凰端子（+/-/G）", "input", confirmedSource, true, balancedTerminals),
      port("lineInLrg", "LINE IN（L/R/G）", "3Pin凤凰端子（L/R/G）", "input", confirmedSource, true, stereoTerminals)
    ],
    interfacePanel: panel("recordingLineInput", 960 / 260, {
      lineIn35: calibratedStereoAnchor(960, 260, 153, 168, 183, 137),
      lineInBalanced: calibratedBalancedAnchor(960, 260, 431, 480, 529, 130),
      lineInLrg: calibratedStereoAnchor(960, 260, 743, 792, 841, 130)
    }, "用户确认录播主机三种LINE IN任选其一；禁止连接MIC IN")
  },
  [RECORDING_CAMERA_PORT_PROFILE_ID]: {
    productId: RECORDING_CAMERA_PORT_PROFILE_ID,
    customerName: "录播摄像机",
    ports: [
      port("lineIn35", "LINE IN（3.5mm）", "3.5mm TRS（L/R/G）", "input", confirmedSource, true, stereoTerminals),
      port("lineInBalanced", "LINE IN（+/-/G）", "3Pin凤凰端子（+/-/G）", "input", confirmedSource, true, balancedTerminals),
      port("lineInLrg", "LINE IN（L/R/G）", "3Pin凤凰端子（L/R/G）", "input", confirmedSource, true, stereoTerminals)
    ],
    interfacePanel: panel("recordingLineInput", 960 / 260, {
      lineIn35: calibratedStereoAnchor(960, 260, 153, 168, 183, 137),
      lineInBalanced: calibratedBalancedAnchor(960, 260, 431, 480, 529, 130),
      lineInLrg: calibratedStereoAnchor(960, 260, 743, 792, 841, 130)
    }, "用户确认录播摄像机三种LINE IN任选其一；禁止连接MIC IN")
  },
  [CONTROL_HOST_PORT_PROFILE_ID]: {
    productId: CONTROL_HOST_PORT_PROFILE_ID,
    customerName: "中控主机",
    ports: [port("rs232", "RS232", "3Pin凤凰端子（RX/TX/GND）", "bidirectional", confirmedSource, true, rs232Terminals)],
    interfacePanel: panel("controlHost", 720 / 240, {
      rs232: calibratedRs232Anchor(720, 240, 269, 360, 451, 115)
    }, "用户确认中控使用RX/TX/GND凤凰端子并与处理器RS232交叉连接")
  },
  [LAPTOP_PORT_PROFILE_ID]: {
    productId: LAPTOP_PORT_PROFILE_ID,
    customerName: "笔记本电脑",
    ports: [
      port("usbAudio", "USB Audio", "USB-A", "bidirectional", confirmedSource),
      port("headset", "HEADSET", "3.5mm TRRS耳麦复合口", "bidirectional", confirmedSource)
    ],
    interfacePanel: panel("laptop", 760 / 220, {
      usbAudio: anchor(207 / 760, 110 / 220),
      headset: anchor(553 / 760, 110 / 220)
    }, "用户确认笔记本USB优先；模拟音频必须先经过耳麦分线器")
  },
  [OPS_ALL_IN_ONE_PORT_PROFILE_ID]: {
    productId: OPS_ALL_IN_ONE_PORT_PROFILE_ID,
    customerName: "一体机",
    ports: [
      port("usbAudio", "USB Audio", "USB-A", "bidirectional", confirmedSource),
      port("audioOut", "LINE OUT", "3.5mm TRS（L/R/G）", "output", confirmedSource, true, stereoTerminals),
      port("audioIn", "LINE IN", "3.5mm TRS（L/R/G）", "input", confirmedSource, true, stereoTerminals)
    ],
    interfacePanel: panel("opsAllInOne", 900 / 260, {
      usbAudio: anchor(295 / 900, 112 / 260),
      audioOut: calibratedStereoAnchor(900, 260, 625, 640, 655, 112),
      audioIn: calibratedStereoAnchor(900, 260, 775, 790, 805, 112)
    }, "用户确认ClassIn与会议一体机接口相同；参考通用OPS后板布局重构，USB Audio优先")
  },
  [VIDEO_CONFERENCE_TERMINAL_PORT_PROFILE_ID]: {
    productId: VIDEO_CONFERENCE_TERMINAL_PORT_PROFILE_ID,
    customerName: "视频会议终端",
    ports: [
      port("audioOut", "LINE OUT", "3.5mm TRS（L/R/G）", "output", confirmedSource, true, stereoTerminals),
      port("audioIn", "LINE IN", "3.5mm TRS（L/R/G）", "input", confirmedSource, true, stereoTerminals)
    ],
    interfacePanel: panel("conferenceTerminal", 760 / 220, {
      audioOut: calibratedStereoAnchor(760, 220, 220, 235, 250, 112),
      audioIn: calibratedStereoAnchor(760, 220, 510, 525, 540, 112)
    }, "用户确认视频会议终端使用独立3.5mm LINE IN与LINE OUT")
  },
  [HEADSET_SPLITTER_PORT_PROFILE_ID]: {
    productId: HEADSET_SPLITTER_PORT_PROFILE_ID,
    customerName: "耳麦分线器",
    ports: [
      port("trrs", "TRRS", "3.5mm TRRS", "bidirectional", confirmedSource),
      port("headphoneOut", "HEADPHONE OUT", "3.5mm TRS（L/R/G）", "output", confirmedSource, true, stereoTerminals),
      port("micIn", "MIC IN", "3.5mm TS（信号/G）", "input", confirmedSource, true, [
        { id: "signal", label: "SIG", role: "signal", color: "#dc2626" },
        { id: "ground", label: "G", role: "ground", color: "#6b7280" }
      ])
    ],
    interfacePanel: panel("headsetSplitter", 760 / 240, {
      trrs: anchor(135 / 760, 125 / 240),
      headphoneOut: calibratedStereoAnchor(760, 240, 540, 555, 570, 82),
      micIn: anchor(555 / 760, 172 / 240, {
        signal: { x: 548 / 760, y: 172 / 240 },
        ground: { x: 562 / 760, y: 172 / 240 }
      })
    }, "用户确认笔记本模拟接线需使用耳麦分线器")
  },
  [PASSIVE_SPEAKER_PORT_PROFILE_ID]: {
    productId: PASSIVE_SPEAKER_PORT_PROFILE_ID,
    customerName: "无源音箱",
    ports: [port("terminals", "+ / -", "扬声器接线端子", "input", agentSource, true, speakerTerminals)],
    interfacePanel: panel("passiveSpeaker", 1 / 2, {
      terminals: speakerAnchor(0.5, 0.64, { x: 0.58, y: 0.64 }, { x: 0.42, y: 0.64 })
    }, "无源音箱完整背面接口重构工程图")
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
    interfacePanel: panel("wirelessReceiver", 1000 / 250, {
      balOut: anchor(0.408, 0.48, {
        positive: { x: 0.391, y: 0.48 },
        negative: { x: 0.408, y: 0.48 },
        ground: { x: 0.426, y: 0.48 }
      }),
      lineOut: anchor(0.495, 0.48),
      micOut: anchor(0.586, 0.48),
      usb: anchor(0.174, 0.46)
    }, "《手持麦接收机说明书》完整后面板；按已确认接口位置重构清晰工程图")
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
