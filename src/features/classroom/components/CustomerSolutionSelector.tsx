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
import ceilingSpeakerImage from "../../../assets/topology-ceiling-speaker.png";
import wallSpeakerImage from "../../../assets/topology-wall-speaker.png";

export type SolutionChangeKind = "microphone" | "speaker" | "processor";

interface CustomerSolutionSelectorProps {
  profile: ClassroomProfile;
  selection: CustomerSolutionSelection;
  onChange: (profile: ClassroomProfile, kind: SolutionChangeKind) => void;
}

export function CustomerSolutionSelector({ profile, selection, onChange }: CustomerSolutionSelectorProps) {
  const brand = getAppBrand();
  const arrayMicImage = brand.id === "yinman" ? yinmanArrayMicImage : topologyArrayMicImage;
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
          options={[
            { value: "existingArray", label: "智能天花阵列麦克风", imageSrc: arrayMicImage },
            { value: "lineArray", label: "智能线阵麦克风", imageSrc: lineArrayMicImage },
            ...(brand.id === "yinman" ? [{ value: "hangingMic", label: "吊麦", imageSrc: hangingMicImage }] : [])
          ]}
          selected={selection.microphone.selected}
          recommended={selection.microphone.recommended}
          userSelected={selection.microphone.userSelected}
          onSelect={(value) => setConstraints({ microphoneSolution: value as MicrophoneSolution }, "microphone")}
          onRestore={() => setConstraints({ microphoneSolution: "auto" }, "microphone")}
        />

        <SolutionChoiceGroup
          title="音箱"
          options={[
            { value: "wall", label: "壁挂音箱", imageSrc: wallSpeakerImage },
            { value: "ceiling", label: "吸顶音箱", imageSrc: ceilingSpeakerImage }
          ]}
          selected={selection.speaker.selected}
          recommended={selection.speaker.recommended}
          userSelected={selection.speaker.userSelected}
          onSelect={(value) => setConstraints({ speakerProductOverride: value as SpeakerProductOverride }, "speaker")}
          onRestore={() => setConstraints({ speakerProductOverride: "auto" }, "speaker")}
        />

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
      {selection.speaker.isNonRecommended ? (
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
      <div className={`solutionSegmentedControl${options.length > 2 ? " hasThreeOptions" : ""}`}>
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
