import type {
  ClassroomProfile,
  CustomerSolutionSelection,
  MicrophoneSolution,
  SpeakerProductOverride
} from "../types";
import { getLineArrayDecision } from "./lineArrayRules";
import { getSpeakerProductId } from "./speakerRules";

const microphoneLabels: Record<Exclude<MicrophoneSolution, "auto">, string> = {
  existingArray: "智能语音阵列麦克风",
  lineArray: "智能线阵麦克风"
};

const speakerLabels: Record<Exclude<SpeakerProductOverride, "auto">, string> = {
  ceiling: "吸顶音箱",
  wall: "壁挂音柱"
};

export function getCustomerSolutionSelection(profile: ClassroomProfile): CustomerSolutionSelection {
  const automaticMicrophoneProfile = withMicrophoneSolution(profile, "auto");
  const automaticLineArrayDecision = getLineArrayDecision(automaticMicrophoneProfile);
  const recommendedMicrophone = automaticLineArrayDecision.recommended ? "lineArray" : "existingArray";
  const requestedMicrophone = profile.engineeringConstraints.microphoneSolution ?? "auto";
  const selectedMicrophone = requestedMicrophone === "auto" ? recommendedMicrophone : requestedMicrophone;
  const selectedLineArrayDecision = getLineArrayDecision(profile);
  const lineArraySupported = selectedMicrophone !== "lineArray" || selectedLineArrayDecision.selected;

  const automaticSpeakerProfile = withSpeakerOverride(profile, "auto");
  const recommendedSpeaker = getSpeakerProductId(automaticSpeakerProfile) === "CEILING-SPEAKER" ? "ceiling" : "wall";
  const requestedSpeaker = profile.engineeringConstraints.speakerProductOverride ?? "auto";
  const selectedSpeaker = requestedSpeaker === "auto" ? recommendedSpeaker : requestedSpeaker;
  const requiresSpecialReview = selectedSpeaker === "ceiling" && profile.engineeringConstraints.overheadSpeakerMounting === "unavailable";
  const drawingBlocked = requestedMicrophone === "lineArray" && !lineArraySupported;

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
    drawingBlocked,
    blockingMessage: drawingBlocked ? "该方案无法完整覆盖，建议改选阵麦" : undefined
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
