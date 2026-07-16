import type {
  ClassroomProfile,
  CustomerSolutionSelection,
  GeneratedPoint,
  MicrophoneSolution,
  ProcessorTier,
  SpeakerProductOverride
} from "../types";
import type { AppBrandId } from "../brand";
import {
  getLineArrayDecision,
  getProcessorAlternativeTier,
  getProcessorInterfaceDemand,
  getProcessorTier,
  getProcessorTierName
} from "./lineArrayRules";
import { getSpeakerProductId } from "./speakerRules";

const microphoneLabels: Record<Exclude<MicrophoneSolution, "auto">, string> = {
  existingArray: "智能天花阵列麦克风",
  lineArray: "智能线阵麦克风"
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
  const recommendedMicrophone = automaticLineArrayDecision.recommended ? "lineArray" : "existingArray";
  const requestedMicrophone = profile.engineeringConstraints.microphoneSolution ?? "auto";
  const selectedMicrophone = requestedMicrophone === "auto" ? recommendedMicrophone : requestedMicrophone;
  const selectedLineArrayDecision = getLineArrayDecision(profile, generatedPoints);
  const lineArraySupported = selectedMicrophone !== "lineArray" || selectedLineArrayDecision.selected;

  const automaticSpeakerProfile = withSpeakerOverride(profile, "auto");
  const recommendedSpeaker = getSpeakerProductId(automaticSpeakerProfile, brandId) === "CEILING-SPEAKER" ? "ceiling" : "wall";
  const requestedSpeaker = profile.engineeringConstraints.speakerProductOverride ?? "auto";
  const selectedSpeaker = requestedSpeaker === "auto" ? recommendedSpeaker : requestedSpeaker;
  const requiresSpecialReview = selectedSpeaker === "ceiling" && profile.engineeringConstraints.overheadSpeakerMounting === "unavailable";
  const drawingBlocked = requestedMicrophone === "lineArray" && !lineArraySupported;
  const lineArrayCount = generatedPoints.filter((point) => point.pickupKind === "lineArray").length;
  const speakerCount = generatedPoints.filter((point) => point.type === "speaker").length;
  const processor = brandId === "yinman" && lineArrayCount === 1
    ? getYinmanSingleLineProcessorSelection(profile, speakerCount)
    : undefined;

  return {
    microphone: {
      recommended: recommendedMicrophone,
      selected: selectedMicrophone,
      userSelected: requestedMicrophone !== "auto",
      isNonRecommended: selectedMicrophone !== recommendedMicrophone,
      selectedLabel: microphoneLabels[selectedMicrophone],
      recommendedLabel: microphoneLabels[recommendedMicrophone],
      advantages: selectedMicrophone === "lineArray"
        ? "含处理器的整套价格更低；短距摆放或定向声幕有利于抑制背向噪声。"
        : "覆盖范围和扩展能力更适合全场拾音及较大空间。",
      cautions: selectedMicrophone === "lineArray"
        ? "责任区宽度、纵深、最远发言距离和处理器接口容量需要同时满足。"
        : "需要结合安装位置、混响和多麦部署复核覆盖均匀性。",
      recommendationReason: automaticLineArrayDecision.recommendationReason,
      decisionFactors: automaticLineArrayDecision.decisionFactors,
      lineArraySupported
    },
    speaker: {
      recommended: recommendedSpeaker,
      selected: selectedSpeaker,
      userSelected: requestedSpeaker !== "auto",
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
    blockingMessage: drawingBlocked ? "该方案无法完整覆盖，建议改选阵麦" : undefined
  };
}

function getYinmanSingleLineProcessorSelection(
  profile: ClassroomProfile,
  speakerCount: number
): NonNullable<CustomerSolutionSelection["processor"]> {
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
