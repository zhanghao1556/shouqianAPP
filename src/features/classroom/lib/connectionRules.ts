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
  PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID
} from "./systemCapabilities";
import { LINE_ARRAY_PRODUCT_ID } from "./lineArrayRules";

export const DT_AUDIO_LINE_IN_LIMIT = 4;
export const DT_AUDIO_LINE_OUT_LIMIT = 4;

export const getPrimaryDtProduct = (selection: ProductRecommendation[]) =>
  selection.find((item) => item.productId === "DT2-Pro" && item.quantity > 0);

export const generateConnectionLines = (
  profile: ClassroomProfile,
  selection: ProductRecommendation[],
  brandId: AppBrandId = "yinyi",
  generatedPoints: GeneratedPoint[] = []
): ConnectionLine[] => {
  if (brandId === "yinman" || selection.some((item) => item.productId === LINE_ARRAY_PRODUCT_ID && item.quantity > 0)) {
    return generateProcessorDirectConnectionLines(profile, selection, brandId, generatedPoints);
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

  const usbDevice = selectPrimaryUsbDevice(
    shouldRouteExternalToLegacyAudio ? mediaDevices.filter(isAllInOneUsbDevice) : mediaDevices,
    hasRemoteOrRecording
  );
  if (usbDevice) {
    lines.push({
      id: "dt-usb-host-1",
      fromDevice: dtName,
      fromPort: "数字输入 / 输出接口 USB Type-B",
      toDevice: usbDevice,
      toPort: "USB 音频接口",
      cableType: "标配USB线",
      note: "阵列麦主机数字输入 / 输出接口使用 USB Type-B，承载数字音频输入 / 输出。"
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
      .filter((device) => !isRecordingHostAudioDevice(device) && !isAllInOneUsbDevice(device) && !isControlHostDevice(device))
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
    if (shouldRouteExternalToLegacyAudio) {
      lines.push(buildExternalToLegacyAudioLine(device, legacyAudioInputDevice, `microphone-line-legacy-${index + 1}`));
      return;
    }
    lines.push({
      id: `microphone-line-dt-${index + 1}`,
      fromDevice: device,
      fromPort: "音频输出",
      toDevice: dtName,
      toPort: "模拟输入 L/R/G",
      cableType: "音频线",
      note: getExternalMicrophoneConnectionNote(device)
    });
  });

  if (legacySound) {
    lines.push(...buildLegacySoundConnectionLines(profile, dtName));
    if (profile.scenario === "auditorium") return applyAudioLineCapacityRules(lines, dtName);
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

  return applyAudioLineCapacityRules(lines, dtName);
};

function generateProcessorDirectConnectionLines(
  profile: ClassroomProfile,
  selection: ProductRecommendation[],
  brandId: AppBrandId,
  generatedPoints: GeneratedPoint[]
): ConnectionLine[] {
  const arrayMic = selection.find((item) => (item.productId === PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID || item.productId === LINE_ARRAY_PRODUCT_ID) && item.quantity > 0);
  const processor = selection.find((item) => item.productId === AUDIO_PROCESSOR_HOST_PRODUCT_ID && item.quantity > 0);
  if (!arrayMic || !processor) return [];

  const lines: ConnectionLine[] = [];
  const coreName = processor.name;
  const capability = getBrandSystemCapability(brandId);
  const isLineArray = arrayMic.productId === LINE_ARRAY_PRODUCT_ID;
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

  Array.from({ length: arrayMic.quantity }, (_, index) => index + 1).forEach((index) => {
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

  const usbDevice = selectPrimaryUsbDevice(
    shouldRouteExternalToLegacyAudio ? mediaDevices.filter(isAllInOneUsbDevice) : mediaDevices,
    hasRemoteOrRecording
  );
  if (usbDevice) {
    lines.push({
      id: "processor-usb-host-1",
      fromDevice: coreName,
      fromPort: "USB 数字音频接口",
      toDevice: usbDevice,
      toPort: "USB 音频接口",
      cableType: "标配USB线",
      note: "智能音频处理主机通过 USB 承载数字音频输入 / 输出。"
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
    lines.push(
      shouldRouteExternalToLegacyAudio
        ? buildExternalToLegacyAudioLine(device, legacyAudioInputDevice, `processor-wired-mic-legacy-${index + 1}`)
        : {
            id: `processor-wired-mic-audio-${index + 1}`,
            fromDevice: device,
            fromPort: "音频输出",
            toDevice: coreName,
            toPort: "模拟音频输入",
            cableType: "音频线",
            note: "有线麦克风需自供电或由前级设备供电，再向智能音频处理主机提供音频信号。"
          }
    );
  });

  if (legacySound) {
    lines.push(...buildLegacySoundConnectionLines(profile, coreName));
    if (profile.scenario === "auditorium") return lines;
  }

  if (speakerCount > 0) {
    const directSpeakerCount = Math.min(speakerCount, capability.integratedSpeakerCapacity);
    const speakerPoints = generatedPoints.filter((point) => point.type === "speaker");
    const directSignalGroups = getSpeakerSignalGroups(speakerPoints.slice(0, directSpeakerCount));
    if (directSignalGroups.length) {
      directSignalGroups.forEach(({ mode, count }) => {
        lines.push({
          id: `processor-speaker-direct-${mode}`,
          fromDevice: coreName,
          fromPort: mode === "withoutLineArrayAfc" ? "功放输出（不送线阵AFC）" : "功放输出（AFC）",
          toDevice: `${speakerMode} ${getSpeakerSignalGroupLabel(mode)} × ${count}`,
          toPort: "音箱 + / -",
          cableType: "音箱线",
          note: mode === "withoutLineArrayAfc"
            ? "该扬声器分组保留安装和其他现有信号路径，不送线阵麦AFC扩声信号。"
            : "该扬声器分组承担线阵麦AFC扩声，现场复核阻抗、线径、极性和通道负载。",
          speakerSignalMode: mode
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
    if (speakerCount > capability.integratedSpeakerCapacity) {
      const externalAmplifier = selection.find((item) => item.productId === EXTERNAL_AMPLIFIER_PRODUCT_ID && item.quantity > 0);
      const externalSpeakerCount = Math.min(
        speakerCount - capability.integratedSpeakerCapacity,
        capability.totalSpeakerCapacity - capability.integratedSpeakerCapacity
      );
      if (externalAmplifier) {
        lines.push({
          id: "processor-lineout-amplifier",
          fromDevice: coreName,
          fromPort: "Line Out / 模拟输出",
          toDevice: externalAmplifier.name,
          toPort: "音频输入",
          cableType: "音频线",
          note: "第 9-16 只无源音箱通过一台教学模拟功放主机扩展。",
          speakerSignalMode: speakerPoints.slice(capability.integratedSpeakerCapacity).some((point) => point.speakerSignalMode === "withoutLineArrayAfc")
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
          speakerSignalMode: speakerPoints.slice(capability.integratedSpeakerCapacity).some((point) => point.speakerSignalMode)
            ? "afc"
            : undefined
        });
      }
    }
  }

  return lines;
}

function getSpeakerSignalGroups(points: GeneratedPoint[]): Array<{ mode: SpeakerSignalMode; count: number }> {
  if (!points.some((point) => point.speakerSignalMode)) return [];
  return (["withoutLineArrayAfc", "afc"] as const).flatMap((mode) => {
    const count = points.filter((point) => (point.speakerSignalMode ?? "afc") === mode).length;
    return count ? [{ mode, count }] : [];
  });
}

function getSpeakerSignalGroupLabel(mode: SpeakerSignalMode) {
  return mode === "withoutLineArrayAfc" ? "不送线阵AFC分组" : "AFC扩声分组";
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

function selectPrimaryUsbDevice(devices: string[], hasRemoteOrRecording: boolean) {
  const usbCandidates = devices.filter((device) => !isRecordingHostAudioDevice(device));
  const allInOne = usbCandidates.find(isAllInOneUsbDevice);
  if (allInOne) return allInOne;
  if (usbCandidates.length > 0) return usbCandidates[0];
  return devices.length === 0 && hasRemoteOrRecording ? "教室电脑" : "";
}

function isAllInOneUsbDevice(device: string) {
  return device.includes("一体机") || device.includes("会议屏") || device.includes("ClassIn");
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

export const hasExistingWirelessHandheld = (profile: ClassroomProfile) =>
  splitDeviceText(profile.existingDevices.legacyWirelessMic).some(isWirelessMicrophoneDevice);

function getExternalMicrophoneConnectionNote(device: string) {
  if (device.includes("无线接收机")) return "无线接收机信号输出优先使用 LINE OUT RCA；阵列麦主机模拟输入为 L/R/G。";
  if (isWirelessMicrophoneDevice(device)) return "现场外接无线手持麦需复核接收机输出接口，优先接入阵列麦主机模拟输入 L/R/G。";
  if (device.includes("有线")) return "阵列麦主机模拟输入不提供幻象供电；有线麦克风需自供电或由前级设备供电，并向阵列麦主机提供线路 / 麦克风音频信号。";
  return "外接麦克风需复核前级输出接口，优先接入阵列麦主机模拟输入 L/R/G。";
}
