import type {
  ClassroomProfile,
  CustomerSolutionSelection,
  GeneratedPoint,
  MicrophoneSolution,
  ProcessorTier,
  SpeakerProductOverride
} from "../types";
import type { AppBrandId } from "../brand";
import { hasExistingWirelessHandheld } from "./connectionRules";
import {
  getLineArrayDecision,
  getProcessorAlternativeTier,
  getProcessorInterfaceDemand,
  getProcessorTier,
  getProcessorTierName
} from "./lineArrayRules";
import { getSpeakerProductId } from "./speakerRules";
import {
  getHangingMicCoverageDemand,
  getHangingMicProcessorTier,
  getHangingMicRemainingCapacity,
  getHangingMicSupport
} from "./hangingMicRules";
import {
  getEffectiveYinmanMicrophoneSolution,
  getSmallDiscReviewMessage,
  isPureRecordingOrPatrolNeed,
  SMALL_DISC_MAIN_NAME,
  SMALL_DISC_RECORDING_NAME
} from "./yinmanSmallDiscRules";
import {
  getYinmanHybridProcessorInputDemand,
  getYinmanHybridProcessorTier,
  hasYinmanLineArraySupplements,
  isYinmanLineArrayOnlineCoverageComplete
} from "./systemCapabilities";
import { getReverberationRisk } from "./reverberationRules";

const microphoneLabels: Record<Exclude<MicrophoneSolution, "auto">, string> = {
  existingArray: "智能天花阵列麦克风",
  lineArray: "智能线阵麦克风",
  hangingMic: "吊麦",
  smallDisc01: SMALL_DISC_MAIN_NAME,
  smallDisc03: SMALL_DISC_RECORDING_NAME
};

const speakerLabels: Record<Exclude<SpeakerProductOverride, "auto">, string> = {
  ceiling: "吸顶音箱",
  wall: "壁挂音箱"
};

export function getCustomerSolutionSelection(
  profile: ClassroomProfile,
  generatedPoints: GeneratedPoint[] = [],
  brandId: AppBrandId = "yinyi"
): CustomerSolutionSelection {
  const automaticMicrophoneProfile = withMicrophoneSolution(profile, "auto");
  const automaticLineArrayDecision = getLineArrayDecision(automaticMicrophoneProfile, generatedPoints);
  const recommendedMicrophone: Exclude<MicrophoneSolution, "auto"> = brandId === "yinman" && isPureRecordingOrPatrolNeed(profile)
    ? "smallDisc03"
    : automaticLineArrayDecision.recommended ? "lineArray" : "existingArray";
  const rawRequestedMicrophone = profile.engineeringConstraints.microphoneSolution ?? "auto";
  const requestedMicrophone = getEffectiveYinmanMicrophoneSolution(profile, brandId);
  const selectedMicrophone = requestedMicrophone === "auto" ? recommendedMicrophone : requestedMicrophone;
  const selectedLineArrayDecision = getLineArrayDecision(profile, generatedPoints);
  const lineArraySupported = selectedMicrophone !== "lineArray" || selectedLineArrayDecision.selected;
  const usesHybridLineArray = hasYinmanLineArraySupplements(generatedPoints);
  const hybridCoverageComplete = isYinmanLineArrayOnlineCoverageComplete(profile, generatedPoints);
  const lineArrayCoverageWarning = selectedMicrophone === "lineArray" && !hybridCoverageComplete
    ? selectedLineArrayDecision.coverageWarning
    : undefined;

  const automaticSpeakerProfile = withSpeakerOverride(profile, "auto");
  const recommendedSpeaker = selectedMicrophone === "smallDisc01"
    ? "wall"
    : getSpeakerProductId(automaticSpeakerProfile, brandId) === "CEILING-SPEAKER" ? "ceiling" : "wall";
  const requestedSpeaker = selectedMicrophone === "smallDisc01" ? "auto" : profile.engineeringConstraints.speakerProductOverride ?? "auto";
  const selectedSpeaker = selectedMicrophone === "smallDisc01" ? "wall" : requestedSpeaker === "auto" ? recommendedSpeaker : requestedSpeaker;
  const requiresSpecialReview = selectedSpeaker === "ceiling" && profile.engineeringConstraints.overheadSpeakerMounting === "unavailable";
  const hangingMicSupport = getHangingMicSupport(profile, brandId);
  const hangingMicDemand = getHangingMicCoverageDemand(profile);
  const hangingMicTier = getHangingMicProcessorTier(profile, hangingMicDemand);
  const hangingMicCapacity = getHangingMicRemainingCapacity(profile, hangingMicTier);
  const hangingMicCapacityWarning = selectedMicrophone === "hangingMic" && hangingMicCapacity < hangingMicDemand
    ? `讲台区按3m覆盖需要${hangingMicDemand}只，当前剩余MIC容量仅支持${hangingMicCapacity}只。`
    : undefined;
  const smallDiscCount = generatedPoints.filter((point) => point.pickupKind === "smallDisc01" || point.pickupKind === "smallDisc02" || point.pickupKind === "smallDisc03").length;
  const smallDiscReviewWarning = selectedMicrophone === "smallDisc01" || selectedMicrophone === "smallDisc03"
    ? getSmallDiscReviewMessage(selectedMicrophone, smallDiscCount)
    : undefined;
  const drawingBlocked = (requestedMicrophone === "lineArray" && !lineArraySupported) ||
    (selectedMicrophone === "hangingMic" && (!hangingMicSupport.supported || hangingMicCapacity === 0));
  const lineArrayCount = generatedPoints.filter((point) => point.pickupKind === "lineArray").length;
  const speakerCount = generatedPoints.filter((point) => point.type === "speaker").length;
  const processor = brandId === "yinman" && lineArrayCount === 1
    ? getYinmanSingleLineProcessorSelection(profile, speakerCount, usesHybridLineArray)
    : undefined;

  return {
    microphone: {
      recommended: recommendedMicrophone,
      selected: selectedMicrophone,
      userSelected: rawRequestedMicrophone !== "auto" && requestedMicrophone !== "auto",
      isNonRecommended: selectedMicrophone !== recommendedMicrophone,
      selectedLabel: getMicrophoneLabel(selectedMicrophone, brandId),
      recommendedLabel: getMicrophoneLabel(recommendedMicrophone, brandId),
      advantages: selectedMicrophone === "smallDisc01"
        ? "整套成本最低，内置处理并可按覆盖需要级联从麦。"
        : selectedMicrophone === "smallDisc03"
          ? "成本较低，适合直接录音和巡课设备拾音。"
          : selectedMicrophone === "hangingMic"
        ? "成本低于线阵麦加处理器方案；MIC接口够用时优先配置价格更低的双麦处理器。"
        : selectedMicrophone === "lineArray"
          ? "含处理器的整套价格更低；短距摆放或定向声幕有利于抑制背向噪声。"
          : "覆盖范围和扩展能力更适合全场拾音及较大空间。",
      cautions: selectedMicrophone === "smallDisc01"
        ? "效果相对较弱，本地扩声只提供壁挂音箱；线上直连所需USB音频线由客户自购。"
        : selectedMicrophone === "smallDisc03"
          ? "仅用于直接录音或巡课拾音，不用于本地扩声、视频会议或线上互动。"
          : selectedMicrophone === "hangingMic"
        ? "只用于讲台区域扩声，每只占用一路带供电MIC输入；系统按吊麦、利旧麦克风和新增无线接收机合计MIC占用，超过2路时自动配置六麦处理器。六麦处理器接口更多、价格较高，带独立触摸屏，可控制音箱音量及麦克风静音/开音。"
        : selectedMicrophone === "lineArray"
          ? "责任区宽度、纵深、最远发言距离和处理器接口容量需要同时满足。"
          : "需要结合安装位置、混响和多麦部署复核覆盖均匀性。",
      recommendationReason: recommendedMicrophone === "smallDisc03"
        ? "当前为纯录音或巡课需求，系统优先采用低成本录音巡课阵麦。"
        : automaticLineArrayDecision.recommendationReason,
      decisionFactors: recommendedMicrophone === "smallDisc03"
        ? ["功能：只承担主要区域录音或巡课拾音", "成本：低于内置处理型和大圆盘阵麦方案"]
        : automaticLineArrayDecision.decisionFactors,
      lineArraySupported,
      lineArrayCoverageWarning,
      hangingMicCapacityWarning,
      smallDiscReviewWarning
    },
    speaker: {
      recommended: recommendedSpeaker,
      selected: selectedSpeaker,
      userSelected: selectedMicrophone !== "smallDisc01" && requestedSpeaker !== "auto",
      isNonRecommended: selectedSpeaker !== recommendedSpeaker,
      selectedLabel: speakerLabels[selectedSpeaker],
      recommendedLabel: speakerLabels[recommendedSpeaker],
      advantages: selectedSpeaker === "ceiling"
        ? "覆盖更均匀，前后排声压差更容易控制。"
        : "安装和检修更直观，顶面施工依赖较少。",
      cautions: selectedSpeaker === "ceiling"
        ? "顶面承重、开孔、走线、检修及灯具空调避让需要复核。"
        : "需要复核墙面条件、门窗遮挡、覆盖均匀性和啸叫余量。",
      recommendationReason: selectedSpeaker === recommendedSpeaker
        ? "当前选择与系统推荐一致。"
        : `当前现场条件优先推荐${speakerLabels[recommendedSpeaker]}。`,
      decisionFactors: [],
      requiresSpecialReview
    },
    processor,
    drawingBlocked,
    blockingMessage: drawingBlocked
      ? selectedMicrophone === "hangingMic"
        ? !hangingMicSupport.supported ? hangingMicSupport.reason : "处理器没有可用MIC输入，无法生成吊麦方案"
        : "该方案无法完整覆盖，建议改选阵麦"
      : undefined
  };
}

function getYinmanSingleLineProcessorSelection(
  profile: ClassroomProfile,
  speakerCount: number,
  usesHybridLineArray: boolean
): NonNullable<CustomerSolutionSelection["processor"]> {
  if (usesHybridLineArray) {
    const newWirelessInputDemand = !hasExistingWirelessHandheld(profile) && getReverberationRisk(profile) === "high" ? 1 : 0;
    const selected = getYinmanHybridProcessorTier(profile, newWirelessInputDemand);
    const alternative = selected === "twoMic" ? "sixMic" : "twoMic";
    const interfaceDemand = getYinmanHybridProcessorInputDemand(profile, newWirelessInputDemand);
    const selectedLabel = getProcessorTierName(selected);
    const alternativeLabel = getProcessorTierName(alternative);
    return {
      recommended: selected,
      selected,
      userSelected: false,
      isNonRecommended: false,
      selectedLabel,
      recommendedLabel: selectedLabel,
      advantages: selected === "twoMic"
        ? "满足线阵麦与后场补充拾音接入，优先控制整套成本。"
        : "为线阵麦、后场补充拾音和其他麦克风输入保留足够接口。",
      cautions: "后场补充拾音阵麦采用麦克风端级联，共用一个扩展麦克风接口。",
      recommendationReason: `系统按接口需求自动配置${selectedLabel}；线阵麦使用双MIC输入，补充拾音阵麦级联后使用扩展麦克风接口。`,
      decisionFactors: [
        `接口：当前MIC输入需求为${interfaceDemand}路，补充拾音阵麦数量不重复占用处理器MIC口`,
        "成本：接口满足时优先采用成本较低的处理器",
        "连接：线阵麦经信号转换器接入，后场补充拾音阵麦共用扩展麦克风接口"
      ],
      alternative,
      alternativeLabel,
      interfaceDemand
    };
  }
  const recommended = "highPerformance" as const;
  const selected = getProcessorTier(profile, "yinman", 1, speakerCount);
  const alternative = getProcessorAlternativeTier(profile, speakerCount);
  const interfaceDemand = getProcessorInterfaceDemand(profile, speakerCount);
  const selectedLabel = getProcessorTierName(selected);
  const alternativeLabel = getProcessorTierName(alternative);
  const copy = getProcessorChoiceCopy(selected, interfaceDemand);

  return {
    recommended,
    selected,
    userSelected: (profile.engineeringConstraints.processorTier ?? "auto") !== "auto",
    isNonRecommended: selected !== recommended,
    selectedLabel,
    recommendedLabel: getProcessorTierName(recommended),
    advantages: copy.advantages,
    cautions: copy.cautions,
    recommendationReason: `单只线阵麦默认优先高性能处理器，处理效果更好；当前约需${interfaceDemand}路接口，${alternativeLabel}作为${alternative === "twoMic" ? "经济" : "多接口"}备选。`,
    decisionFactors: [
      "效果：高性能处理器成本较高，默认优先保障声音处理效果",
      `接口：当前约需${interfaceDemand}路，${alternativeLabel}${alternative === "twoMic" ? "成本更低但接口较少" : "接口更充足"}`,
      "成本：双麦处理器价格更低；六麦处理器适合接口需求较多的系统"
    ],
    alternative,
    alternativeLabel,
    interfaceDemand
  };
}

function getProcessorChoiceCopy(selected: Exclude<ProcessorTier, "auto">, interfaceDemand: number) {
  if (selected === "twoMic") {
    return {
      advantages: "整套成本更低，适合接口需求不超过2路的单麦方案。",
      cautions: interfaceDemand > 2 ? `当前约需${interfaceDemand}路接口，双麦处理器接口不足，建议改选六麦处理器。` : "接口余量较少，增加外接设备时需要重新复核。"
    };
  }
  if (selected === "sixMic") {
    return {
      advantages: "接口更充足，适合外接设备较多或需要较多输入输出的系统。",
      cautions: "单麦且接口需求较少时成本高于双麦处理器。"
    };
  }
  return {
    advantages: "单只线阵麦优先保障声音处理效果，系统链路更匹配。",
    cautions: "价格高于双麦处理器；接口需求较多时需改选六麦处理器。"
  };
}

function getMicrophoneLabel(solution: Exclude<MicrophoneSolution, "auto">, brandId: AppBrandId) {
  if (solution === "existingArray" && brandId === "yinman") return "大圆盘阵麦";
  return microphoneLabels[solution];
}

function withMicrophoneSolution(profile: ClassroomProfile, microphoneSolution: MicrophoneSolution): ClassroomProfile {
  return {
    ...profile,
    engineeringConstraints: { ...profile.engineeringConstraints, microphoneSolution }
  };
}

function withSpeakerOverride(profile: ClassroomProfile, speakerProductOverride: SpeakerProductOverride): ClassroomProfile {
  return {
    ...profile,
    engineeringConstraints: { ...profile.engineeringConstraints, speakerProductOverride }
  };
}
