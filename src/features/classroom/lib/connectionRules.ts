import type { AppBrandId } from "../brand";
import type { ClassroomProfile, ConnectionLine, GeneratedPoint, ProductRecommendation, SpeakerSignalMode } from "../types";
import {
  DT_SPK_OUTPUT_COUNT,
  EXTERNAL_AMPLIFIER_MAX_LINE_OUT_COUNT,
  EXTERNAL_AMPLIFIER_PRODUCT_ID,
  getExternalAmplifierChannelCountForSpeakers,
  getExternalAmplifierCountForSpeakers,
  getExternalAmplifierLineOutCountForSpeakers,
  getExternalAmplifierSummary,
  getExternalSpeakerCount,
  SPEAKERS_PER_SPK_OUTPUT,
  getSpeakerOutputSummary
} from "./speakerRules";
import {
  AUDIO_PROCESSOR_HOST_PRODUCT_ID,
  getBrandSystemCapability,
  LINE_ARRAY_MIC_CONVERTER_NAME,
  LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID,
  PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID
} from "./systemCapabilities";
import { getYinmanProcessorDirectSpeakerCapacity, LINE_ARRAY_PRODUCT_ID } from "./lineArrayRules";
import { HANGING_MIC_PRODUCT_ID } from "./hangingMicRules";
import {
  getSmallDisc01AudioRouting,
  SMALL_DISC_01_PRODUCT_ID,
  SMALL_DISC_02_PRODUCT_ID,
  SMALL_DISC_03_PRODUCT_ID,
  SMALL_DISC_AUDIO_EXTENDER_NAME,
  SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID,
  SMALL_DISC_MAIN_NAME,
  SMALL_DISC_RECORDING_NAME,
  SMALL_DISC_SLAVE_NAME
} from "./yinmanSmallDiscRules";
import {
  isUsbAudioAllInOneDevice,
  isUsbAudioTargetDevice,
  selectPrimaryUsbAudioDevice
} from "./usbAudioRules";

export const DT_AUDIO_LINE_IN_LIMIT = 4;
export const DT_AUDIO_LINE_OUT_LIMIT = 4;
export const WIRED_MIC_LINE_IN_POWER_NOTE = "有线麦直连LINE IN时，需自供电或前级供电，仅提供音频信号。";

const WIRED_MIC_TO_MIC_IN_NOTE = "卡侬母头按2=+、3=-、1=G接处理器MIC IN。";
const WIRED_MIC_TO_LINE_IN_NOTE = `卡侬母头按2=+、3=-、1=G接LINE IN。${WIRED_MIC_LINE_IN_POWER_NOTE}`;

export function filterUsbExclusiveAudioLines(lines: ConnectionLine[]) {
  const usbComputerDevices = new Set<string>();
  lines.forEach((line) => {
    if (!isUsbAudioConnection(line)) return;
    [line.fromDevice, line.toDevice]
      .map(normalizeConnectionDeviceName)
      .filter(isUsbAudioTargetDevice)
      .forEach((device) => usbComputerDevices.add(device));
  });
  if (!usbComputerDevices.size) return lines;
  const usbTarget = selectPrimaryUsbAudioDevice(Array.from(usbComputerDevices));
  return lines.filter((line) => {
    if (isUsbAudioConnection(line)) {
      const computerEndpoints = [line.fromDevice, line.toDevice]
        .map(normalizeConnectionDeviceName)
        .filter(isUsbAudioTargetDevice);
      return computerEndpoints.length === 0 || computerEndpoints.includes(usbTarget);
    }
    if (!isAnalogAudioConnection(line)) return true;
    return ![line.fromDevice, line.toDevice]
      .map(normalizeConnectionDeviceName)
      .some((device) => device === usbTarget);
  });
}

export const getPrimaryDtProduct = (selection: ProductRecommendation[]) =>
  selection.find((item) => item.productId === "DT2-Pro" && item.quantity > 0);

export const generateConnectionLines = (
  profile: ClassroomProfile,
  selection: ProductRecommendation[],
  brandId: AppBrandId = "yinyi",
  generatedPoints: GeneratedPoint[] = []
): ConnectionLine[] => {
  if (selection.some((item) => item.productId === SMALL_DISC_01_PRODUCT_ID && item.quantity > 0)) {
    return filterUsbExclusiveAudioLines(generateSmallDisc01ConnectionLines(profile, selection));
  }
  if (selection.some((item) => item.productId === SMALL_DISC_03_PRODUCT_ID && item.quantity > 0)) {
    return filterUsbExclusiveAudioLines(generateSmallDisc03ConnectionLines(profile, selection));
  }
  if (brandId === "yinman" || selection.some((item) => item.productId === LINE_ARRAY_PRODUCT_ID && item.quantity > 0)) {
    return filterUsbExclusiveAudioLines(generateProcessorDirectConnectionLines(profile, selection, brandId, generatedPoints));
  }
  const dt = getPrimaryDtProduct(selection);
  if (!dt) return [];

  const lines: ConnectionLine[] = [];
  const dtName = dt.name;
  const hasRemoteOrRecording =
    profile.needs.includes("videoConference") || profile.needs.includes("remoteTeaching") || profile.needs.includes("recording");
  const hasSpeaker = selection.some((item) => item.category === "speaker" && item.quantity > 0);
  const hasWireless = selection.some((item) => item.productId === "WIRELESS-HANDHELD" && item.quantity > 0);
  const speakerMode = selection.find((item) => item.category === "speaker" && item.quantity > 0)?.name ?? "音翼音箱";
  const legacySound = profile.existingDevices.legacySoundSystem.trim();
  const recordingDevices = uniqueDeviceList(splitDeviceText(profile.existingDevices.recordingHost));
  const computerDevices = uniqueDeviceList(splitDeviceText(profile.existingDevices.computer));
  const mediaDevices = uniqueDeviceList([...recordingDevices, ...computerDevices]);
  const existingMicrophoneDevices = splitDeviceText(profile.existingDevices.legacyWirelessMic);
  const legacyAudioInputDevice = getLegacyAudioInputDevice(profile);
  const shouldRouteExternalToLegacyAudio = Boolean(legacySound && legacyAudioInputDevice);

  const usbDevice = selectPrimaryUsbAudioDevice(
    shouldRouteExternalToLegacyAudio ? mediaDevices.filter(isUsbAudioAllInOneDevice) : mediaDevices,
    hasRemoteOrRecording ? "教室电脑" : ""
  );
  if (usbDevice) {
    lines.push({
      id: "dt-usb-host-1",
      fromDevice: dtName,
      fromPort: "数字输入 / 输出接口 USB Type-B",
      toDevice: usbDevice,
      toPort: "USB 音频接口",
      cableType: "标配USB线",
      note: "同一根USB线承载USB Audio一进一出；内置232串口信号，可用于连接调试软件。"
    });
  }

  mediaDevices.filter(isControlHostDevice).forEach((device, index) => {
    lines.push({
      id: `control-host-network-${index + 1}`,
      fromDevice: dtName,
      fromPort: "网络 / 控制接口",
      toDevice: device,
      toPort: "网络控制接口",
      cableType: "网线",
      note: "中控主机使用网线接入主麦控制接口。"
    });
  });

  recordingDevices.filter(isRecordingHostAudioDevice).forEach((device, index) => {
    if (shouldRouteExternalToLegacyAudio) {
      lines.push(buildExternalToLegacyAudioLine(device, legacyAudioInputDevice, `recording-host-legacy-audio-${index + 1}`));
      return;
    }
    lines.push({
      id: `dt-recording-host-audio-${index + 1}`,
      fromDevice: dtName,
      fromPort: "Line Out / 模拟输出",
      toDevice: device,
      toPort: "音频输入",
      cableType: "音频线",
      note: "录播主机使用音频线接入阵列麦主机模拟输出。"
    });
  });

  if (shouldRouteExternalToLegacyAudio) {
    mediaDevices
      .filter((device) => !isRecordingHostAudioDevice(device) && !isUsbAudioAllInOneDevice(device) && !isControlHostDevice(device))
      .forEach((device, index) => {
        lines.push(buildExternalToLegacyAudioLine(device, legacyAudioInputDevice, `media-legacy-audio-${index + 1}`));
      });
  }

  const legacyWirelessMicrophones = existingMicrophoneDevices
    .filter(isWirelessMicrophoneDevice)
    .map(getLegacyWirelessMicrophoneLabel);
  const wirelessMicrophones = legacyWirelessMicrophones.length > 0 ? legacyWirelessMicrophones : hasWireless ? ["无线手持麦"] : [];
  const wiredMicrophones = existingMicrophoneDevices.filter((device) => !isWirelessMicrophoneDevice(device));
  const wirelessReceiverName = `${legacyWirelessMicrophones.length > 0 ? "利旧无线接收机" : "无线接收机"} × ${wirelessMicrophones.length}`;

  wirelessMicrophones.forEach((device, index) => {
    lines.push({
      id: `wireless-mic-signal-${index + 1}`,
      fromDevice: device,
      fromPort: "无线发射",
      toDevice: wirelessReceiverName,
      toPort: "无线接收",
      cableType: "无线信号",
      note: "无线话筒先到无线接收机，接收机再输出音频到阵列麦主机模拟输入。"
    });
  });

  if (wirelessMicrophones.length > 0) {
    lines.push(
      shouldRouteExternalToLegacyAudio
        ? buildExternalToLegacyAudioLine(wirelessReceiverName, legacyAudioInputDevice, "wireless-receiver-line-legacy")
        : {
            id: "wireless-receiver-line-dt",
            fromDevice: wirelessReceiverName,
            fromPort: "LINE OUT RCA / BAL OUT",
            toDevice: dtName,
            toPort: "模拟输入 L/R/G",
            cableType: "音频线",
            note: getExternalMicrophoneConnectionNote("无线接收机")
          }
    );
  }

  wiredMicrophones.forEach((device, index) => {
    lines.push({
      id: `microphone-line-dt-${index + 1}`,
      fromDevice: getWiredMicrophoneUnitLabel(device, index, wiredMicrophones.length),
      fromPort: "卡侬母头（XLR-3）",
      toDevice: dtName,
      toPort: "模拟输入 L/R/G",
      cableType: "麦克风线",
      note: WIRED_MIC_TO_LINE_IN_NOTE
    });
  });

  if (legacySound) {
    lines.push(...buildLegacySoundConnectionLines(profile, dtName));
    if (profile.scenario === "auditorium") {
      return applyAudioLineCapacityRules(filterUsbExclusiveAudioLines(lines), dtName);
    }
  }

  if (hasSpeaker) {
    const speakerCount = selection.find((item) => item.category === "speaker" && item.quantity > 0)?.quantity ?? 2;
    const externalSpeakerCount = getExternalSpeakerCount(speakerCount);
    const externalAmplifierCount = getExternalAmplifierCountForSpeakers(speakerCount);
    const externalAmplifierChannelCount = getExternalAmplifierChannelCountForSpeakers(speakerCount);
    const externalAmplifierLineOutCount = getExternalAmplifierLineOutCountForSpeakers(speakerCount);
    const externalAmplifierName =
      selection.find((item) => item.productId === EXTERNAL_AMPLIFIER_PRODUCT_ID)?.name ?? "教学模拟功放主机";
    lines.push({
      id: "dt-speaker-group-1",
      fromDevice: dtName,
      fromPort: "SPK 功放输出 1",
      toDevice: `${speakerMode} SPK1 单声道分组`,
      toPort: "音箱 + / -",
      cableType: "音箱线",
      note: `无感扩声为单声道扩声，不区分左右声道；阵列麦主机共有 ${DT_SPK_OUTPUT_COUNT} 路 SPK 功放输出，每路最多并联 ${SPEAKERS_PER_SPK_OUTPUT} 只音箱；音箱端保持极性一致。${getSpeakerOutputSummary(speakerCount)}`
    });
    lines.push({
      id: "dt-speaker-group-2",
      fromDevice: dtName,
      fromPort: "SPK 功放输出 2",
      toDevice: `${speakerMode} SPK2 单声道分组`,
      toPort: "音箱 + / -",
      cableType: "音箱线",
      note: "音箱线正负极需保持一致；按现场听音区复核覆盖角度、声压均匀度和啸叫余量。"
    });
    if (speakerCount >= 4) {
      lines.push({
        id: "dt-speaker-fill",
        fromDevice: dtName,
        fromPort: "SPK 功放输出 3 / 4",
        toDevice: `${speakerMode} 后场补声`,
        toPort: "音箱 + / -",
        cableType: "音箱线",
        note: `音箱大于 4 只时，按每一排从前往后依次分配 SPK 输出；每排默认 2 只，同排接同一组。特别宽的吸顶场景可一排 3-4 只，需复核单路并联数量和负载。每路最多并联 ${SPEAKERS_PER_SPK_OUTPUT} 只。`
      });
    }
    if (externalAmplifierCount > 0) {
      lines.push({
        id: "dt-lineout-amplifier",
        fromDevice: dtName,
        fromPort: externalAmplifierLineOutCount > 1 ? `Line Out 1-${externalAmplifierLineOutCount}` : "Line Out 1",
        toDevice: `${externalAmplifierName} × ${externalAmplifierCount}`,
        toPort: `音频输入 / ${externalAmplifierChannelCount} 个功放通道`,
        cableType: "音频线",
        note: `${getExternalAmplifierSummary(speakerCount)}超过内置 SPK 的 ${externalSpeakerCount} 只音箱由扩展功放承载；阵麦 1 根 Line Out 音频线默认带 2 个功放通道，单台扩展功放最多占用 ${EXTERNAL_AMPLIFIER_MAX_LINE_OUT_COUNT} 根 Line Out 音频线。`
      });
      lines.push({
        id: "amplifier-speaker-extension",
        fromDevice: externalAmplifierName,
        fromPort: "CH1-CH4 功放输出",
        toDevice: `${speakerMode} 扩展分组`,
        toPort: "音箱 + / -",
        cableType: "音箱线",
        note: "扩展功放带载音箱小于等于 4 只时一通道一只；大于 4 只时开始并线，每通道最多 2 只；现场复核阻抗、线径、极性和通道负载。"
      });
    }
  }

  return applyAudioLineCapacityRules(filterUsbExclusiveAudioLines(lines), dtName);
};

function generateSmallDisc01ConnectionLines(
  profile: ClassroomProfile,
  selection: ProductRecommendation[]
): ConnectionLine[] {
  const lines: ConnectionLine[] = [];
  const slaveCount = selection.find((item) => item.productId === SMALL_DISC_02_PRODUCT_ID)?.quantity ?? 0;
  const mainName = SMALL_DISC_MAIN_NAME;
  for (let index = 0; index < slaveCount; index += 1) {
    lines.push({
      id: `small-disc-01-cascade-${index + 1}`,
      fromDevice: index === 0 ? mainName : `${SMALL_DISC_SLAVE_NAME} ${index}`,
      fromPort: "MIC",
      toDevice: `${SMALL_DISC_SLAVE_NAME} ${index + 1}`,
      toPort: "LINK",
      cableType: "超五类纯铜网线（T568B）",
      note: "小圆盘阵麦在麦克风端逐级连接；单段超过20m时需专项复核。"
    });
  }

  const audioRouting = getSmallDisc01AudioRouting(profile);
  if (audioRouting.usbDevice) {
    lines.push({
      id: "small-disc-01-usb-host",
      fromDevice: mainName,
      fromPort: "USB数字音频接口",
      toDevice: audioRouting.usbDevice,
      toPort: "USB音频接口",
      cableType: "USB音频线（客户自购）",
      note: "USB只连接电脑或一体机；同一根USB线同时承担供电和USB Audio一进一出；内置232串口信号，可用于连接调试软件；线材按安装距离由客户另行采购。"
    });
  }
  if (audioRouting.directOutputTarget) {
    lines.push({
      id: "small-disc-01-direct-audio-output",
      fromDevice: mainName,
      fromPort: "AUDIO OUT / SPK-OUT",
      toDevice: audioRouting.directOutputTarget,
      toPort: "音频输入",
      cableType: "音频线",
      note: "小圆盘阵麦01本体音频输出可在软件中配置并连接带音频输入的设备。"
    });
  }
  if (audioRouting.needsExtender) {
    appendSmallDisc01ExtenderLines(
      lines,
      selection,
      audioRouting.extenderOutputTargets,
      audioRouting.extenderInputSources
    );
  }

  const speakerProduct = selection.find((item) => item.category === "speaker" && item.quantity > 0);
  if (speakerProduct) {
    const amplifier = selection.find((item) => item.productId === EXTERNAL_AMPLIFIER_PRODUCT_ID && item.quantity > 0)?.name ?? "教学模拟功放主机";
    lines.push(
      {
        id: "small-disc-01-amplifier",
        fromDevice: mainName,
        fromPort: "AUDIO OUT / SPK-OUT",
        toDevice: amplifier,
        toPort: "音频输入",
        cableType: "音频线",
        note: "小圆盘阵麦01本体音频输出在软件中配置为本地扩声并送入功放。"
      },
      {
        id: "small-disc-01-wall-speakers",
        fromDevice: amplifier,
        fromPort: "功放输出",
        toDevice: `${speakerProduct.name} × ${speakerProduct.quantity}`,
        toPort: "音箱 + / -",
        cableType: "音箱线",
        note: "壁挂音箱由教学模拟功放主机驱动，现场复核阻抗、极性和通道负载。"
      }
    );
  }
  return lines;
}

function appendSmallDisc01ExtenderLines(
  lines: ConnectionLine[],
  selection: ProductRecommendation[],
  outputTargets: string[],
  inputSources: string[]
) {
    const extender = selection.find((item) => item.productId === SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID)?.name ?? SMALL_DISC_AUDIO_EXTENDER_NAME;
    lines.push({
      id: "small-disc-01-link-extender",
      fromDevice: SMALL_DISC_MAIN_NAME,
      fromPort: "LINK",
      toDevice: extender,
      toPort: "LINK",
      cableType: "超五类纯铜网线（T568B）",
      note: "01拓展器通过LINK为小圆盘阵麦01扩展模拟音频输入和输出。"
    });
    const outputDevices = outputTargets.length ? outputTargets : ["录播/会议终端"];
    outputDevices.forEach((device, index) => {
      lines.push({
        id: `small-disc-01-extender-output-${index + 1}`,
        fromDevice: extender,
        fromPort: "A OUT",
        toDevice: device,
        toPort: "音频输入",
        cableType: "3.5mm音频线",
        note: "小圆盘阵麦拾音经扩展器模拟输出接入终端。"
      });
    });
    if (inputSources.length > 0) {
      const inputDevice = inputSources[0];
      lines.push({
        id: "small-disc-01-extender-input",
        fromDevice: inputDevice,
        fromPort: "音频输出",
        toDevice: extender,
        toPort: "A IN",
        cableType: "3.5mm音频线",
        note: "终端回传音频接入扩展器A IN。"
      });
    }
}

function generateSmallDisc03ConnectionLines(
  profile: ClassroomProfile,
  selection: ProductRecommendation[]
): ConnectionLine[] {
  const count = selection.find((item) => item.productId === SMALL_DISC_03_PRODUCT_ID)?.quantity ?? 0;
  const extender = selection.find((item) => item.productId === SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID)?.name ?? SMALL_DISC_AUDIO_EXTENDER_NAME;
  const lines: ConnectionLine[] = [];
  for (let index = 1; index < count; index += 1) {
    lines.push({
      id: `small-disc-03-cascade-${index}`,
      fromDevice: `${SMALL_DISC_RECORDING_NAME} ${index}`,
      fromPort: "MIC",
      toDevice: `${SMALL_DISC_RECORDING_NAME} ${index + 1}`,
      toPort: "LINK",
      cableType: "超五类纯铜网线（T568B）",
      note: "小圆盘阵麦03逐级连接；单段超过20m时需专项复核。"
    });
  }
  const firstMicName = count > 1 ? `${SMALL_DISC_RECORDING_NAME} 1` : SMALL_DISC_RECORDING_NAME;
  lines.push({
    id: "small-disc-03-link-extender",
    fromDevice: firstMicName,
    fromPort: "LINK",
    toDevice: extender,
    toPort: "LINK",
    cableType: "超五类纯铜网线（T568B）",
    note: "整条麦克风级联系统共用一个音频扩展器。"
  });
  const recordingDevices = uniqueDeviceList(splitDeviceText(profile.existingDevices.recordingHost));
  const targets = recordingDevices.length ? recordingDevices : ["录播/巡课设备"];
  targets.forEach((device, index) => {
    lines.push({
      id: `small-disc-03-recording-output-${index + 1}`,
      fromDevice: extender,
      fromPort: "A OUT",
      toDevice: device,
      toPort: "音频输入",
      cableType: "3.5mm音频线",
      note: "小圆盘阵麦03拾音经扩展器输出到录播或巡课设备。"
    });
  });
  return lines;
}

function generateProcessorDirectConnectionLines(
  profile: ClassroomProfile,
  selection: ProductRecommendation[],
  brandId: AppBrandId,
  generatedPoints: GeneratedPoint[]
): ConnectionLine[] {
  const arrayMic = selection.find((item) => (
    item.productId === PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID ||
    item.productId === LINE_ARRAY_PRODUCT_ID ||
    item.productId === HANGING_MIC_PRODUCT_ID
  ) && item.quantity > 0);
  const processor = selection.find((item) => item.productId === AUDIO_PROCESSOR_HOST_PRODUCT_ID && item.quantity > 0);
  if (!arrayMic || !processor) return [];

  const lines: ConnectionLine[] = [];
  const coreName = processor.name;
  const capability = getBrandSystemCapability(brandId);
  const processorTier = coreName.includes("双麦") ? "twoMic" : coreName.includes("六麦") ? "sixMic" : "highPerformance";
  const directSpeakerCapacity = brandId === "yinman"
    ? getYinmanProcessorDirectSpeakerCapacity(processorTier)
    : capability.integratedSpeakerCapacity;
  const isLineArray = arrayMic.productId === LINE_ARRAY_PRODUCT_ID;
  const isHangingMic = arrayMic.productId === HANGING_MIC_PRODUCT_ID;
  const hasRemoteOrRecording =
    profile.needs.includes("videoConference") || profile.needs.includes("remoteTeaching") || profile.needs.includes("recording");
  const speakerProduct = selection.find((item) => item.category === "speaker" && item.quantity > 0);
  const speakerCount = speakerProduct?.quantity ?? 0;
  const speakerMode = speakerProduct?.name ?? "无源音箱";
  const legacySound = profile.existingDevices.legacySoundSystem.trim();
  const recordingDevices = uniqueDeviceList(splitDeviceText(profile.existingDevices.recordingHost));
  const computerDevices = uniqueDeviceList(splitDeviceText(profile.existingDevices.computer));
  const mediaDevices = uniqueDeviceList([...recordingDevices, ...computerDevices]);
  const existingMicrophoneDevices = splitDeviceText(profile.existingDevices.legacyWirelessMic);
  const legacyAudioInputDevice = getLegacyAudioInputDevice(profile);
  const shouldRouteExternalToLegacyAudio = Boolean(legacySound && legacyAudioInputDevice);
  const hybridSupplements = isLineArray
    ? generatedPoints.filter((point) => point.pickupKind === "smallDisc02")
    : [];

  if (isLineArray && hybridSupplements.length) {
    const converterName = selection.find((item) => item.productId === LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID)?.name ?? LINE_ARRAY_MIC_CONVERTER_NAME;
    const linePoints = generatedPoints.filter((point) => point.pickupKind === "lineArray");
    linePoints.forEach((point, index) => {
      lines.push({
        id: `line-array-converter-${index + 1}`,
        fromDevice: point.label,
        fromPort: "RJ45 模拟麦克风信号接口",
        toDevice: converterName,
        toPort: "线阵麦输入",
        cableType: "网线",
        note: "线阵麦使用独立网线接入信号转换器；8m内使用常规网线，8-20m使用超六类屏蔽线，禁止接PoE网口。"
      });
    });
    lines.push({
      id: "line-array-converter-processor",
      fromDevice: converterName,
      fromPort: "双路麦克风输出",
      toDevice: coreName,
      toPort: "MIC1 + MIC2",
      cableType: "两路麦克风音频线",
      note: "线阵麦经信号转换后占用处理器MIC1与MIC2。"
    });

    const farToNearSupplements = [...hybridSupplements].sort(
      (a, b) => b.position.y - a.position.y || a.position.x - b.position.x
    );
    farToNearSupplements.slice(0, -1).forEach((point, index) => {
      const nextPoint = farToNearSupplements[index + 1];
      lines.push({
        id: `line-array-supplement-cascade-${index + 1}`,
        fromDevice: point.label,
        fromPort: "MIC",
        toDevice: nextPoint.label,
        toPort: "LINK",
        cableType: "超五类纯铜网线（T568B）",
        note: "后场补充拾音阵麦从远端向处理器方向逐级连接，单段超过20m时需专项复核。"
      });
    });
    const nearestSupplement = farToNearSupplements.at(-1);
    if (nearestSupplement) {
      lines.push({
        id: "line-array-supplement-extmic",
        fromDevice: nearestSupplement.label,
        fromPort: "MIC",
        toDevice: coreName,
        toPort: "EXTMIC",
        cableType: "超五类纯铜网线（T568B）",
        note: "整条后场补充拾音阵麦级联链共用处理器一个EXTMIC接口。"
      });
    }
  }

  Array.from({ length: arrayMic.quantity }, (_, index) => index + 1).forEach((index) => {
    if (isLineArray && hybridSupplements.length) return;
    if (isHangingMic) {
      lines.push({
        id: `hanging-mic-processor-${index}`,
        fromDevice: `吊麦 ${index}`,
        fromPort: "卡侬母头（XLR-3）",
        toDevice: coreName,
        toPort: `MIC IN ${index}`,
        cableType: "麦克风线",
        note: "卡侬母头按2=+、3=-、1=G接处理器MIC IN。"
      });
      return;
    }
    lines.push({
      id: `array-mic-processor-network-${index}`,
      fromDevice: `${isLineArray ? "智能线阵麦克风" : "智能天花阵列麦克风"} ${index}`,
      fromPort: isLineArray ? "RJ45 模拟麦克风信号接口" : "网络音频接口",
      toDevice: coreName,
      toPort: `阵麦输入 ${index}`,
      cableType: "网线",
      note: isLineArray
        ? "每只线阵麦使用独立网线传输模拟麦克风信号；8m内使用常规网线，8-20m使用超六类屏蔽线，禁止接PoE网口。"
        : "每只阵列麦使用独立网线直连智能音频处理主机，不采用主从级联。"
    });
  });

  const usbDevice = selectPrimaryUsbAudioDevice(
    shouldRouteExternalToLegacyAudio ? mediaDevices.filter(isUsbAudioAllInOneDevice) : mediaDevices,
    hasRemoteOrRecording ? "教室电脑" : ""
  );
  if (usbDevice) {
    lines.push({
      id: "processor-usb-host-1",
      fromDevice: coreName,
      fromPort: "USB 数字音频接口",
      toDevice: usbDevice,
      toPort: "USB 音频接口",
      cableType: "标配USB线",
      note: "同一根USB线承载USB Audio一进一出；内置232串口信号，可用于连接调试软件。"
    });
  }

  mediaDevices.filter(isControlHostDevice).forEach((device, index) => {
    lines.push({
      id: `processor-control-host-${index + 1}`,
      fromDevice: coreName,
      fromPort: "网络 / 控制接口",
      toDevice: device,
      toPort: "网络控制接口",
      cableType: "网线",
      note: "中控主机通过网线接入智能音频处理主机控制接口。"
    });
  });

  recordingDevices.filter(isRecordingHostAudioDevice).forEach((device, index) => {
    lines.push(
      shouldRouteExternalToLegacyAudio
        ? buildExternalToLegacyAudioLine(device, legacyAudioInputDevice, `recording-host-legacy-audio-${index + 1}`)
        : {
            id: `processor-recording-host-audio-${index + 1}`,
            fromDevice: coreName,
            fromPort: "Line Out / 模拟输出",
            toDevice: device,
            toPort: "音频输入",
            cableType: "音频线",
            note: "录播主机使用音频线接入智能音频处理主机模拟输出。"
          }
    );
  });

  const legacyWirelessMicrophones = existingMicrophoneDevices
    .filter(isWirelessMicrophoneDevice)
    .map(getLegacyWirelessMicrophoneLabel);
  const hasNewWireless = selection.some((item) => item.productId === "WIRELESS-HANDHELD" && item.quantity > 0);
  const wirelessMicrophones = legacyWirelessMicrophones.length ? legacyWirelessMicrophones : hasNewWireless ? ["无线手持麦"] : [];
  const wiredMicrophones = existingMicrophoneDevices.filter((device) => !isWirelessMicrophoneDevice(device));
  const wirelessReceiverName = `${legacyWirelessMicrophones.length ? "利旧无线接收机" : "无线接收机"} × ${wirelessMicrophones.length}`;

  wirelessMicrophones.forEach((device, index) => {
    lines.push({
      id: `processor-wireless-mic-signal-${index + 1}`,
      fromDevice: device,
      fromPort: "无线发射",
      toDevice: wirelessReceiverName,
      toPort: "无线接收",
      cableType: "无线信号",
      note: "无线话筒先到无线接收机，再由接收机输出音频。"
    });
  });
  if (wirelessMicrophones.length) {
    lines.push(
      shouldRouteExternalToLegacyAudio
        ? buildExternalToLegacyAudioLine(wirelessReceiverName, legacyAudioInputDevice, "processor-wireless-receiver-legacy")
        : {
            id: "processor-wireless-receiver-audio",
            fromDevice: wirelessReceiverName,
            fromPort: "LINE OUT RCA / BAL OUT",
            toDevice: coreName,
            toPort: "模拟音频输入",
            cableType: "音频线",
            note: "无线接收机音频输出接入智能音频处理主机。"
          }
    );
  }
  wiredMicrophones.forEach((device, index) => {
    const usesLineInput = processorTier === "highPerformance";
    lines.push({
      id: `processor-wired-mic-audio-${index + 1}`,
      fromDevice: getWiredMicrophoneUnitLabel(device, index, wiredMicrophones.length),
      fromPort: "卡侬母头（XLR-3）",
      toDevice: coreName,
      toPort: usesLineInput ? "LINE IN" : "MIC IN",
      cableType: "麦克风线",
      note: usesLineInput ? WIRED_MIC_TO_LINE_IN_NOTE : WIRED_MIC_TO_MIC_IN_NOTE
    });
  });

  if (legacySound) {
    lines.push(...buildLegacySoundConnectionLines(profile, coreName));
    if (profile.scenario === "auditorium") return lines;
  }

  if (speakerCount > 0) {
    const directSpeakerCount = Math.min(speakerCount, directSpeakerCapacity);
    const speakerPoints = generatedPoints.filter((point) => point.type === "speaker");
    const directSignalGroups = getSpeakerSignalGroups(speakerPoints.slice(0, directSpeakerCount));
    if (directSignalGroups.length) {
      directSignalGroups.forEach(({ mode, count, afcSendLevelOffset }) => {
        const isCenterFill = mode === "afc" && afcSendLevelOffset !== undefined;
        lines.push({
          id: `processor-speaker-direct-${mode}${isCenterFill ? "-center-fill" : ""}`,
          fromDevice: coreName,
          fromPort: mode === "withoutLineArrayAfc" ? "功放输出（不送线阵AFC）" : isCenterFill ? "功放输出（AFC中置补声）" : "功放输出（AFC）",
          toDevice: `${speakerMode} ${getSpeakerSignalGroupLabel(mode, isCenterFill)} × ${count}`,
          toPort: "音箱 + / -",
          cableType: "音箱线",
          note: mode === "withoutLineArrayAfc"
            ? "该扬声器分组保留安装和其他现有信号路径，不送线阵麦AFC扩声信号。"
            : isCenterFill
              ? `后墙中置分组只补充侧墙音箱未覆盖的中间区域；AFC初始 ${afcSendLevelOffset}dB，现场与侧墙组做延时和增益对齐。`
            : "该扬声器分组承担线阵麦AFC扩声，现场复核阻抗、线径、极性和通道负载。",
          speakerSignalMode: mode,
          afcSendLevelOffset
        });
      });
    } else {
      lines.push({
        id: "processor-speaker-direct",
        fromDevice: coreName,
        fromPort: "功放输出",
        toDevice: `${speakerMode} 主机直驱分组 × ${directSpeakerCount}`,
        toPort: "音箱 + / -",
        cableType: "音箱线",
        note: `智能音频处理主机直接推动前 ${directSpeakerCount} 只无源音箱，现场复核阻抗、线径、极性和通道负载。`
      });
    }
    if (speakerCount > directSpeakerCapacity) {
      const externalAmplifier = selection.find((item) => item.productId === EXTERNAL_AMPLIFIER_PRODUCT_ID && item.quantity > 0);
      const externalSpeakerCount = Math.min(
        speakerCount - directSpeakerCapacity,
        capability.totalSpeakerCapacity - directSpeakerCapacity
      );
      if (externalAmplifier) {
        lines.push({
          id: "processor-lineout-amplifier",
          fromDevice: coreName,
          fromPort: "Line Out / 模拟输出",
          toDevice: externalAmplifier.name,
          toPort: "音频输入",
          cableType: "音频线",
          note: `第 ${directSpeakerCapacity + 1}-${Math.min(speakerCount, capability.totalSpeakerCapacity)} 只无源音箱通过一台教学模拟功放主机扩展。`,
          speakerSignalMode: speakerPoints.slice(directSpeakerCapacity).some((point) => point.speakerSignalMode === "withoutLineArrayAfc")
            ? undefined
            : speakerPoints.some((point) => point.speakerSignalMode) ? "afc" : undefined
        });
        lines.push({
          id: "processor-amplifier-speakers",
          fromDevice: externalAmplifier.name,
          fromPort: "功放输出",
          toDevice: `${speakerMode} 扩展分组 × ${externalSpeakerCount}`,
          toPort: "音箱 + / -",
          cableType: "音箱线",
          note: "超过主机直驱容量的无源音箱由教学模拟功放主机承载。",
          speakerSignalMode: speakerPoints.slice(directSpeakerCapacity).some((point) => point.speakerSignalMode)
            ? "afc"
            : undefined
        });
      }
    }
  }

  return lines;
}

function getSpeakerSignalGroups(points: GeneratedPoint[]): Array<{ mode: SpeakerSignalMode; count: number; afcSendLevelOffset?: number }> {
  if (!points.some((point) => point.speakerSignalMode)) return [];
  const groups = new Map<string, { mode: SpeakerSignalMode; count: number; afcSendLevelOffset?: number }>();
  points.forEach((point) => {
    const mode = point.speakerSignalMode ?? "afc";
    const afcSendLevelOffset = point.afcSendLevelOffset;
    const key = `${mode}:${afcSendLevelOffset ?? "default"}`;
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { mode, count: 1, afcSendLevelOffset });
  });
  return Array.from(groups.values()).sort((a, b) => {
    if (a.mode !== b.mode) return a.mode === "withoutLineArrayAfc" ? -1 : 1;
    return (a.afcSendLevelOffset ?? 0) - (b.afcSendLevelOffset ?? 0);
  });
}

function getSpeakerSignalGroupLabel(mode: SpeakerSignalMode, isCenterFill = false) {
  return mode === "withoutLineArrayAfc" ? "不送线阵AFC分组" : isCenterFill ? "后墙中置AFC补声分组" : "AFC扩声分组";
}

function splitDeviceText(value: string) {
  return value
    .split(/[、,，;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueDeviceList(devices: string[]) {
  return Array.from(new Set(devices));
}

function normalizeConnectionDeviceName(device: string) {
  return device.replace(/\s*[×xX]\s*\d+\s*$/i, "").trim();
}

function isUsbAudioConnection(line: ConnectionLine) {
  return /USB/i.test(`${line.fromPort} ${line.toPort} ${line.cableType}`);
}

function isAnalogAudioConnection(line: ConnectionLine) {
  return /音频|LINE|3\.5|6\.35|RCA/i.test(`${line.fromPort} ${line.toPort} ${line.cableType}`);
}

function getLegacyAudioInputDevice(profile: ClassroomProfile) {
  const items = splitDeviceText(profile.existingDevices.legacySoundSystem);
  if (items.includes("调音台")) return "调音台";
  if (items.includes("音频处理器")) return "音频处理器";
  if (items.includes("功放")) return "功放";
  return "";
}

function buildExternalToLegacyAudioLine(fromDevice: string, toDevice: string, id: string): ConnectionLine {
  return {
    id,
    fromDevice,
    fromPort: getExternalDeviceAudioOutputPort(fromDevice),
    toDevice,
    toPort: "音频输入",
    cableType: "音频线",
    note: "外接设备已接入原有音频系统，现场复核接口、电平和信号流向。"
  };
}

function getExternalDeviceAudioOutputPort(device: string) {
  if (device.includes("无线接收机")) return "LINE OUT RCA / BAL OUT";
  return "音频输出";
}

function buildLegacySoundConnectionLines(profile: ClassroomProfile, dtName: string): ConnectionLine[] {
  const items = splitDeviceText(profile.existingDevices.legacySoundSystem);
  const chain = getLegacySoundChain(items);
  const inputDevice = chain[0];
  const lines: ConnectionLine[] = inputDevice
    ? [
    {
      id: "dt-legacy-audio-system",
      fromDevice: dtName,
      fromPort: isLegacyFirstLevelAudioDevice(inputDevice) ? "Line Out 1-2 / 模拟输出" : "Line Out / 模拟输出",
          toDevice: inputDevice,
          toPort: isLegacyFirstLevelAudioDevice(inputDevice) ? "原有音频系统输入 1-2" : "原有音频系统输入",
      cableType: isLegacyFirstLevelAudioDevice(inputDevice) ? "两进两出音频线" : "音频线",
      note: "主麦音频输出接入原有音频系统，现场复核接口、电平和信号流向。"
    }
      ]
    : [];
  if (chain.length < 2) return lines;

  return [
    ...lines,
    ...chain.slice(1).map((toDevice, index) => {
    const fromDevice = chain[index];
    return {
      id: `legacy-sound-chain-${index + 1}`,
      fromDevice,
      fromPort: getLegacyDeviceOutputPort(fromDevice),
      toDevice,
      toPort: getLegacyDeviceInputPort(toDevice),
      cableType: getLegacyCableType(fromDevice, toDevice),
      note: "原有音频系统内部链路按现场设备串联，需复核接口、电平、阻抗和负载。"
    };
    })
  ];
}

function getLegacySoundChain(items: string[]) {
  const hasMixer = items.includes("调音台");
  const hasProcessor = items.includes("音频处理器");
  const hasFeedbackSuppressor = items.includes("反馈抑制器");
  const hasAmplifier = items.includes("功放");
  const hasActiveSpeaker = items.includes("有源音箱");
  const hasPassiveSpeaker = items.includes("无源音箱");
  const chain = [
    hasMixer ? "调音台" : "",
    hasProcessor ? "音频处理器" : ""
  ].filter(Boolean);

  if (hasFeedbackSuppressor && hasAmplifier && chain.length > 0) chain.push("反馈抑制器");
  if (hasAmplifier) chain.push("功放");
  if (hasPassiveSpeaker) chain.push("无源音箱");
  else if (hasActiveSpeaker) chain.push("有源音箱");

  return chain;
}

function getLegacyDeviceInputPort(device: string) {
  if (device === "无源音箱") return "音箱 + / -";
  if (device === "有源音箱") return "线路输入";
  return "音频输入";
}

function getLegacyDeviceOutputPort(device: string) {
  if (device === "功放") return "功放输出";
  return "音频输出";
}

function getLegacyCableType(fromDevice: string, toDevice: string) {
  if (fromDevice === "功放" && toDevice === "无源音箱") return "音箱线";
  return "音频线";
}

function isLegacyFirstLevelAudioDevice(device: string) {
  return device === "调音台" || device === "音频处理器" || device === "功放";
}

function applyAudioLineCapacityRules(lines: ConnectionLine[], dtName: string) {
  const outputLineCount = lines
    .filter((line) => isDtAudioOutputLine(line, dtName))
    .reduce((sum, line) => sum + getAudioConnectionCount(line), 0);
  let inputLineCount = 0;

  return lines.map((line) => {
    if (isDtAudioInputLine(line, dtName)) {
      const count = getAudioConnectionCount(line);
      inputLineCount += count;
      if (inputLineCount > DT_AUDIO_LINE_IN_LIMIT) {
        return {
          ...line,
          toPort: `${line.toPort}（Line In超4）`,
          cableType: "无法接入（Line In超4）",
          note: `${line.note} 阵列麦主机 Line In 上限为 ${DT_AUDIO_LINE_IN_LIMIT} 路，超过上限的输入无法直接接入。`
        };
      }
    }

    if (isDtAudioOutputLine(line, dtName) && outputLineCount > DT_AUDIO_LINE_OUT_LIMIT) {
      return {
        ...line,
        fromPort: `${line.fromPort}（Line Out超4并联）`,
        cableType: `${line.cableType}（Line Out并联）`,
        note: `${line.note} 阵列麦主机 Line Out 上限为 ${DT_AUDIO_LINE_OUT_LIMIT} 路；输出为相同 AFC / AEC 信号时，超过上限可并联。`
      };
    }

    return line;
  });
}

function isDtAudioInputLine(line: ConnectionLine, dtName: string) {
  return line.toDevice === dtName && line.cableType.includes("音频");
}

function isDtAudioOutputLine(line: ConnectionLine, dtName: string) {
  return line.fromDevice === dtName && line.cableType.includes("音频");
}

function getAudioConnectionCount(line: ConnectionLine) {
  const lineOutPortMatch = line.fromPort.match(/Line Out\s*(\d+)\s*-\s*(\d+)/i);
  if (lineOutPortMatch) return Math.abs(Number(lineOutPortMatch[2]) - Number(lineOutPortMatch[1])) + 1;
  return getQuantityFromText(line.fromDevice) ?? getQuantityFromText(line.toDevice) ?? 1;
}

function getQuantityFromText(value: string) {
  const match = value.match(/[×xX]\s*(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function isControlHostDevice(device: string) {
  return device.includes("中控");
}

function isRecordingHostAudioDevice(device: string) {
  return device.includes("录播主机");
}

function isWirelessMicrophoneDevice(device: string) {
  if (device.includes("接收机")) return false;
  return device.includes("无线手持") || device.includes("手持");
}

function getLegacyWirelessMicrophoneLabel(device: string) {
  return device.startsWith("利旧") ? device : `利旧${device}`;
}

function getWiredMicrophoneUnitLabel(device: string, index: number, total: number) {
  const legacyLabel = getLegacyWirelessMicrophoneLabel(device);
  return total > 1 ? `${legacyLabel} ${index + 1}` : legacyLabel;
}

export const hasExistingWirelessHandheld = (profile: ClassroomProfile) =>
  splitDeviceText(profile.existingDevices.legacyWirelessMic).some(isWirelessMicrophoneDevice);

function getExternalMicrophoneConnectionNote(device: string) {
  if (device.includes("无线接收机")) return "无线接收机信号输出优先使用 LINE OUT RCA；阵列麦主机模拟输入为 L/R/G。";
  if (isWirelessMicrophoneDevice(device)) return "现场外接无线手持麦需复核接收机输出接口，优先接入阵列麦主机模拟输入 L/R/G。";
  if (device.includes("有线")) return WIRED_MIC_TO_LINE_IN_NOTE;
  return "外接麦克风需复核前级输出接口，优先接入阵列麦主机模拟输入 L/R/G。";
}
