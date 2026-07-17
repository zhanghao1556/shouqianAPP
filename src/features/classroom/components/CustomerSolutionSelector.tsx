import { RotateCcw, TriangleAlert } from "lucide-react";
import type {
  ClassroomProfile,
  CustomerSolutionSelection,
  MicrophoneSolution,
  SpeakerProductOverride
} from "../types";
import { getAppBrand } from "../brand";
import topologyArrayMicImage from "../../../assets/topology-array-mic.png";
import yinmanArrayMicImage from "../../../assets/yinman-array-mic-topology.png";
import lineArrayMicImage from "../../../assets/line-array-mic.png";
import hangingMicImage from "../../../assets/yinman-hanging-mic.png";
import smallDiscMicImage from "../../../assets/yinman-small-disc-mic.png";
import audioExtenderImage from "../../../assets/yinman-audio-extender.png";
import computerImage from "../../../assets/topology-laptop.png";
import ceilingSpeakerImage from "../../../assets/topology-ceiling-speaker.png";
import wallSpeakerImage from "../../../assets/topology-wall-speaker.png";
import {
  getSmallDiscConnectionMode,
  isPureRecordingOrPatrolNeed,
  shouldShowSmallDiscConnectionChoice,
  SMALL_DISC_MAIN_NAME,
  SMALL_DISC_RECORDING_NAME
} from "../lib/yinmanSmallDiscRules";

export type SolutionChangeKind = "microphone" | "speaker" | "processor" | "connection";

interface CustomerSolutionSelectorProps {
  profile: ClassroomProfile;
  selection: CustomerSolutionSelection;
  onChange: (profile: ClassroomProfile, kind: SolutionChangeKind) => void;
}

export function CustomerSolutionSelector({ profile, selection, onChange }: CustomerSolutionSelectorProps) {
  const brand = getAppBrand();
  const arrayMicImage = brand.id === "yinman" ? yinmanArrayMicImage : topologyArrayMicImage;
  const pureRecordingOrPatrol = isPureRecordingOrPatrolNeed(profile);
  const microphoneOptions = brand.id === "yinman"
    ? [
        { value: "existingArray", label: "大圆盘阵麦", imageSrc: arrayMicImage },
        { value: "smallDisc01", label: SMALL_DISC_MAIN_NAME, imageSrc: smallDiscMicImage },
        ...(pureRecordingOrPatrol ? [{ value: "smallDisc03", label: SMALL_DISC_RECORDING_NAME, imageSrc: smallDiscMicImage }] : []),
        { value: "lineArray", label: "智能线阵麦克风", imageSrc: lineArrayMicImage },
        { value: "hangingMic", label: "吊麦", imageSrc: hangingMicImage }
      ]
    : [
        { value: "existingArray", label: "智能天花阵列麦克风", imageSrc: arrayMicImage },
        { value: "lineArray", label: "智能线阵麦克风", imageSrc: lineArrayMicImage }
      ];
  const speakerOptions = selection.microphone.selected === "smallDisc01"
    ? [{ value: "wall", label: "壁挂音箱", imageSrc: wallSpeakerImage }]
    : [
        { value: "wall", label: "壁挂音箱", imageSrc: wallSpeakerImage },
        { value: "ceiling", label: "吸顶音箱", imageSrc: ceilingSpeakerImage }
      ];
  const showSmallDiscConnectionChoice = shouldShowSmallDiscConnectionChoice(profile);
  const selectedConnectionMode = getSmallDiscConnectionMode(profile);
  const recommendedConnectionMode = profile.needs.includes("recording") ? "extender" : "usb";
  const setConstraints = (patch: Partial<ClassroomProfile["engineeringConstraints"]>, kind: SolutionChangeKind) => {
    onChange({
      ...profile,
      engineeringConstraints: { ...profile.engineeringConstraints, ...patch }
    }, kind);
  };

  return (
    <section className="customerSolutionPanel" aria-label="客户选型">
      <div className="customerSolutionHeader">
        <div>
          <span>客户选型</span>
          <h3>确认最终采用方案</h3>
        </div>
        <p>系统已选中推荐项，可按现场条件调整。</p>
      </div>

      <div className="customerSolutionGrid">
        <SolutionChoiceGroup
          title="麦克风"
          options={microphoneOptions}
          selected={selection.microphone.selected}
          recommended={selection.microphone.recommended}
          userSelected={selection.microphone.userSelected}
          onSelect={(value) => {
            const leavingSmallDisc01 = profile.engineeringConstraints.microphoneSolution === "smallDisc01" && value !== "smallDisc01";
            setConstraints({
              microphoneSolution: value as MicrophoneSolution,
              ...(value === "smallDisc01" ? { speakerProductOverride: "wall" as const } : leavingSmallDisc01 ? { speakerProductOverride: "auto" as const } : {}),
              ...(value === "hangingMic" || value === "smallDisc01" || value === "smallDisc03" ? { processorTier: "auto" as const } : {}),
              ...(value === "smallDisc01" ? { smallDiscConnectionMode: "auto" as const } : leavingSmallDisc01 ? { smallDiscConnectionMode: "auto" as const } : {})
            }, "microphone");
          }}
          onRestore={() => setConstraints({
            microphoneSolution: "auto",
            ...(profile.engineeringConstraints.microphoneSolution === "smallDisc01" ? { speakerProductOverride: "auto" as const } : {}),
            smallDiscConnectionMode: "auto",
            processorTier: "auto"
          }, "microphone")}
        />

        {selection.microphone.selected !== "smallDisc03" ? (
          <SolutionChoiceGroup
            title="音箱"
            options={speakerOptions}
            selected={selection.speaker.selected}
            recommended={selection.speaker.recommended}
            userSelected={selection.speaker.userSelected}
            onSelect={(value) => setConstraints({ speakerProductOverride: value as SpeakerProductOverride }, "speaker")}
            onRestore={() => setConstraints({ speakerProductOverride: "auto" }, "speaker")}
          />
        ) : null}

        {showSmallDiscConnectionChoice ? (
          <SolutionChoiceGroup
            title="连接方式"
            options={[
              { value: "usb", label: "USB直连", imageSrc: computerImage },
              { value: "extender", label: "音频扩展器", imageSrc: audioExtenderImage }
            ]}
            selected={selectedConnectionMode}
            recommended={recommendedConnectionMode}
            userSelected={(profile.engineeringConstraints.smallDiscConnectionMode ?? "auto") !== "auto"}
            onSelect={(value) => setConstraints({ smallDiscConnectionMode: value as "usb" | "extender" }, "connection")}
            onRestore={() => setConstraints({ smallDiscConnectionMode: "auto" }, "connection")}
          />
        ) : null}

      </div>

      {selection.microphone.isNonRecommended ? (
        <SelectionNote
          title={`麦克风：系统推荐 ${selection.microphone.recommendedLabel}`}
          advantages={selection.microphone.advantages}
          cautions={selection.microphone.cautions}
          recommendationReason={selection.microphone.recommendationReason}
          decisionFactors={selection.microphone.decisionFactors}
        />
      ) : null}
      {selection.microphone.selected !== "smallDisc03" && selection.speaker.isNonRecommended ? (
        <SelectionNote
          title={`音箱：系统推荐 ${selection.speaker.recommendedLabel}`}
          advantages={selection.speaker.advantages}
          cautions={selection.speaker.cautions}
          recommendationReason={selection.speaker.recommendationReason}
          decisionFactors={selection.speaker.decisionFactors}
        />
      ) : null}
      {selection.drawingBlocked ? (
        <div className="solutionBlockingMessage" role="alert">
          <TriangleAlert size={18} />
          <strong>{selection.blockingMessage}</strong>
        </div>
      ) : null}
      {selection.speaker.requiresSpecialReview ? (
        <div className="solutionReviewMessage" role="status">
          <TriangleAlert size={18} />
          <strong>需专项复核</strong>
          <span>顶面音箱不可安装，当前仍按客户选择生成吸顶方案。</span>
        </div>
      ) : null}
    </section>
  );
}

function SolutionChoiceGroup({
  title,
  options,
  selected,
  recommended,
  userSelected,
  onSelect,
  onRestore
}: {
  title: string;
  options: Array<{ value: string; label: string; imageSrc: string; badge?: string }>;
  selected: string;
  recommended: string;
  userSelected: boolean;
  onSelect: (value: string) => void;
  onRestore: () => void;
}) {
  return (
    <div className="solutionChoiceGroup">
      <div className="solutionChoiceTitle">
        <strong>{title}</strong>
        {userSelected ? (
          <button type="button" className="restoreRecommendationButton" onClick={onRestore} title="恢复系统推荐" aria-label={`${title}恢复系统推荐`}>
            <RotateCcw size={15} />
          </button>
        ) : null}
      </div>
      <div className={`solutionSegmentedControl${options.length === 1 ? " singleOption" : options.length === 3 ? " hasThreeOptions" : ""}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={option.value === selected ? "active" : ""}
            aria-pressed={option.value === selected}
            onClick={() => onSelect(option.value)}
          >
            <img src={option.imageSrc} alt="" />
            <span>{option.label}</span>
            {option.value === recommended || option.badge ? <small>{option.value === recommended ? "系统推荐" : option.badge}</small> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectionNote({
  title,
  advantages,
  cautions,
  recommendationReason,
  decisionFactors
}: {
  title: string;
  advantages: string;
  cautions: string;
  recommendationReason: string;
  decisionFactors: string[];
}) {
  return (
    <div className="selectionDecisionNote">
      <strong>{title}</strong>
      <span><b>不推荐原因</b>{recommendationReason}</span>
      {decisionFactors.map((factor) => <span key={factor}><b>判断维度</b>{factor}</span>)}
      <span><b>优势</b>{advantages}</span>
      <span><b>注意事项</b>{cautions}</span>
    </div>
  );
}
