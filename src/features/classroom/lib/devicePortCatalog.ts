import type { DevicePortCapability, DevicePortProfile, InterfacePortDirection } from "../types";
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
export const PASSIVE_SPEAKER_PORT_PROFILE_ID = "PASSIVE-SPEAKER";
export const WIRELESS_RECEIVER_PORT_PROFILE_ID = "WIRELESS-RECEIVER";

const confirmedSource = "用户确认口径与设备安装资料";
const agentSource = "设备安装资料与公司Agent检索结果";

function port(
  id: string,
  panelLabel: string,
  interfaceType: string,
  direction: InterfacePortDirection,
  source = confirmedSource,
  confirmed = true
): DevicePortCapability {
  return { id, panelLabel, interfaceType, direction, maxConnections: 1, confirmed, source };
}

function numberedPorts(
  prefix: string,
  label: string,
  count: number,
  interfaceType: string,
  direction: InterfacePortDirection,
  source = agentSource
) {
  return Array.from({ length: count }, (_, index) => port(
    `${prefix}${index + 1}`,
    `${label}${index + 1}`,
    interfaceType,
    direction,
    source
  ));
}

export const devicePortCatalog: Record<string, DevicePortProfile> = {
  [PROCESSOR_AJ200_PORT_PROFILE_ID]: {
    productId: PROCESSOR_AJ200_PORT_PROFILE_ID,
    internalModel: "AJ200",
    customerName: "智能音频处理主机",
    ports: [
      ...numberedPorts("mic", "MIC", 2, "三芯麦克风接线端子（48V）", "input"),
      ...numberedPorts("lineIn", "LINE IN ", 2, "三芯差分接线端子（+/-/G）", "input"),
      ...numberedPorts("lineOut", "LINE OUT ", 2, "三芯差分接线端子（+/-/G）", "output"),
      port("hpIn", "HP IN", "3.5mm", "input", agentSource),
      port("hpOut", "HP OUT", "3.5mm", "output", agentSource),
      port("extmic", "EXTMIC", "RJ45", "input"),
      port("usb", "USB", "USB-B", "bidirectional", agentSource),
      port("lan", "LAN", "RJ45", "bidirectional", agentSource),
      port("rs232", "RS232", "三芯接线端子（Rx/Tx/G）", "bidirectional", agentSource),
      ...numberedPorts("spk", "SPK", 2, "扬声器接线端子（+/-）", "output")
    ]
  },
  [PROCESSOR_AJ350_PORT_PROFILE_ID]: {
    productId: PROCESSOR_AJ350_PORT_PROFILE_ID,
    internalModel: "AJ350",
    customerName: "智能音频处理主机",
    ports: [
      ...numberedPorts("lineIn", "LINE IN ", 4, "三芯差分接线端子（+/-/G）", "input", agentSource),
      ...numberedPorts("lineOut", "LINE OUT ", 4, "三芯差分接线端子（+/-/G）", "output", agentSource),
      port("amic", "AMIC", "RJ45", "input"),
      port("a1", "A1", "RJ45", "input"),
      port("a2", "A2", "RJ45", "input"),
      port("lan", "LAN", "RJ45", "bidirectional", agentSource),
      port("rs232", "RS232", "三芯接线端子（Rx/Tx/G）", "bidirectional", agentSource),
      port("usb", "USB", "USB Type-C", "bidirectional", agentSource),
      ...numberedPorts("spk", "SPK", 4, "扬声器接线端子（+/-）", "output")
    ]
  },
  [PROCESSOR_AJ600_PORT_PROFILE_ID]: {
    productId: PROCESSOR_AJ600_PORT_PROFILE_ID,
    internalModel: "AJ600",
    customerName: "智能音频处理主机",
    ports: [
      ...numberedPorts("mic", "MIC", 6, "三芯麦克风接线端子（48V）", "input"),
      ...numberedPorts("lineIn", "LINE IN ", 4, "三芯差分接线端子（+/-/G）", "input", agentSource),
      ...numberedPorts("lineOut", "LINE OUT ", 4, "三芯差分接线端子（+/-/G）", "output", agentSource),
      port("extmic", "EXTMIC", "RJ45", "input"),
      port("usb", "USB", "USB-B", "bidirectional", agentSource),
      port("lan", "LAN", "RJ45", "bidirectional", agentSource),
      port("rs232", "RS232", "三芯接线端子（Rx/Tx/G）", "bidirectional", agentSource),
      ...numberedPorts("spk", "SPK", 4, "扬声器接线端子（+/-）", "output")
    ]
  },
  [PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID]: {
    productId: PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID,
    internalModel: "RING08",
    customerName: "大圆盘阵麦",
    ports: [port("lan", "LAN 音频信号传输接口", "RJ45", "output")]
  },
  [LINE_ARRAY_PRODUCT_ID]: {
    productId: LINE_ARRAY_PRODUCT_ID,
    internalModel: "SA110",
    customerName: "智能线阵麦克风",
    ports: [port("rj45", "RJ45", "RJ45", "output", agentSource)]
  },
  [LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID]: {
    productId: LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID,
    customerName: "线阵拓展器",
    ports: [
      port("link", "LINK", "RJ45", "input"),
      port("micOut1", "麦克风输出1（面板标识待补录）", "接口形式待补录", "output", "用户提供实物图仅确认LINK侧", false),
      port("micOut2", "麦克风输出2（面板标识待补录）", "接口形式待补录", "output", "用户提供实物图仅确认LINK侧", false)
    ]
  },
  [HANGING_MIC_PRODUCT_ID]: {
    productId: HANGING_MIC_PRODUCT_ID,
    internalModel: "LB102",
    customerName: "吊麦",
    ports: [port("xlr", "音频输出", "XLR-3（1=G、2=+、3=-）", "output", agentSource)]
  },
  [SMALL_DISC_01_PRODUCT_ID]: {
    productId: SMALL_DISC_01_PRODUCT_ID,
    internalModel: "RING01",
    customerName: "小圆盘阵麦01",
    ports: [
      port("audioOut", "AUDIO OUT / SPK-OUT", "3.5mm", "output"),
      port("usb", "USB", "USB-B", "bidirectional"),
      port("mic", "MIC", "RJ45", "bidirectional"),
      port("link", "LINK", "RJ45", "bidirectional")
    ]
  },
  [SMALL_DISC_02_PRODUCT_ID]: {
    productId: SMALL_DISC_02_PRODUCT_ID,
    internalModel: "RING02",
    customerName: "小圆盘阵麦02",
    ports: [
      port("micOut", "MIC-OUT", "3.5mm", "output", agentSource),
      port("mic", "MIC", "RJ45", "bidirectional"),
      port("link", "LINK", "RJ45", "bidirectional")
    ]
  },
  [SMALL_DISC_03_PRODUCT_ID]: {
    productId: SMALL_DISC_03_PRODUCT_ID,
    internalModel: "RING03",
    customerName: "小圆盘阵麦03",
    ports: [
      port("micOut", "MIC-OUT", "3.5mm", "output", agentSource),
      port("mic", "MIC", "RJ45", "bidirectional", agentSource),
      port("link", "LINK", "RJ45", "bidirectional", agentSource)
    ]
  },
  [SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID]: {
    productId: SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID,
    internalModel: "RingOf-A",
    customerName: "01拓展器",
    ports: [
      port("link", "LINK", "RJ45", "bidirectional"),
      port("aIn", "A IN", "3.5mm", "input"),
      port("aOut", "A OUT", "3.5mm", "output")
    ]
  },
  [EXTERNAL_AMPLIFIER_PRODUCT_ID]: {
    productId: EXTERNAL_AMPLIFIER_PRODUCT_ID,
    customerName: "教学模拟功放主机",
    ports: [
      ...numberedPorts("lineIn", "LINE IN ", 4, "RCA/平衡输入", "input", agentSource),
      ...numberedPorts("spk", "CH", 4, "扬声器接线端子（+/-）", "output", agentSource)
    ]
  },
  [PASSIVE_SPEAKER_PORT_PROFILE_ID]: {
    productId: PASSIVE_SPEAKER_PORT_PROFILE_ID,
    customerName: "无源音箱",
    ports: [port("terminals", "+ / -", "扬声器接线端子", "input", agentSource)]
  },
  [WIRELESS_RECEIVER_PORT_PROFILE_ID]: {
    productId: WIRELESS_RECEIVER_PORT_PROFILE_ID,
    customerName: "无线接收机",
    ports: [
      port("balOut", "BAL OUT", "三芯差分接线端子（+/-/G）", "output", agentSource),
      port("lineOut", "LINE OUT", "RCA", "output", agentSource),
      port("micOut", "MIC OUT", "6.35mm", "output", agentSource),
      port("usb", "USB（PPT控制）", "USB-B", "output", agentSource)
    ]
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
