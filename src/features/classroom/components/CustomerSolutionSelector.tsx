import { CircleDot, Mic, Radio, RotateCcw, TriangleAlert, Volume2 } from "lucide-react";
import type {
  ClassroomProfile,
  CustomerSolutionSelection,
  LineArrayInstallation,
  LineArrayMode,
  MicrophoneSolution,
  OverheadSpeakerMounting,
  ProcessorTier,
  SpeakerProductOverride
} from "../types";
import { CustomSelect } from "./Questionnaire";

export type SolutionChangeKind = "microphone" | "speaker";

interface CustomerSolutionSelectorProps {
  profile: ClassroomProfile;
  selection: CustomerSolutionSelection;
  onChange: (profile: ClassroomProfile, kind: SolutionChangeKind) => void;
}

export function CustomerSolutionSelector({ profile, selection, onChange }: CustomerSolutionSelectorProps) {
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
            { value: "existingArray", label: "智能语音阵列麦克风", icon: <Mic size={18} /> },
            { value: "lineArray", label: "智能线阵麦克风", icon: <Radio size={18} /> }
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
            { value: "wall", label: "壁挂音柱", icon: <Volume2 size={18} /> },
            { value: "ceiling", label: "吸顶音箱", icon: <CircleDot size={18} /> }
          ]}
          selected={selection.speaker.selected}
          recommended={selection.speaker.recommended}
          userSelected={selection.speaker.userSelected}
          onSelect={(value) => setConstraints({ speakerProductOverride: value as SpeakerProductOverride }, "speaker")}
          onRestore={() => setConstraints({ speakerProductOverride: "auto" }, "speaker")}
        />
      </div>

      <div className="solutionConditionGrid">
        <label>
          顶面音箱安装条件
          <CustomSelect
            value={profile.engineeringConstraints.overheadSpeakerMounting ?? "unknown"}
            options={[
              { value: "available", label: "可安装" },
              { value: "unavailable", label: "不可安装" },
              { value: "unknown", label: "待确认" }
            ]}
            onChange={(value) => setConstraints({ overheadSpeakerMounting: value as OverheadSpeakerMounting }, "speaker")}
          />
        </label>
      </div>

      {selection.microphone.selected === "lineArray" ? (
        <div className="lineArrayOptions" aria-label="线阵麦配置">
          <label>
            现场讲台
            <CustomSelect
              value={profile.engineeringConstraints.hasPodium === false ? "no" : "yes"}
              options={[{ value: "yes", label: "有讲台" }, { value: "no", label: "无讲台" }]}
              onChange={(value) => setConstraints({ hasPodium: value === "yes" }, "microphone")}
            />
          </label>
          <label>
            工作模式
            <CustomSelect
              value={profile.engineeringConstraints.lineArrayMode ?? "auto"}
              options={[
                { value: "auto", label: "跟随扩声范围" },
                { value: "front", label: "正面180度扩声" },
                { value: "full", label: "全场扩声" }
              ]}
              onChange={(value) => setConstraints({ lineArrayMode: value as LineArrayMode }, "microphone")}
            />
          </label>
          <label>
            安装方式
            <CustomSelect
              value={profile.engineeringConstraints.lineArrayInstallation ?? "auto"}
              options={[
                { value: "auto", label: "按讲台条件推荐" },
                { value: "podium", label: "讲台摆放" },
                { value: "hanging", label: "吊挂安装" }
              ]}
              onChange={(value) => setConstraints({ lineArrayInstallation: value as LineArrayInstallation }, "microphone")}
            />
          </label>
          <label>
            处理器档位
            <CustomSelect
              value={profile.engineeringConstraints.processorTier ?? "auto"}
              options={[
                { value: "auto", label: "自动推荐" },
                { value: "twoMic", label: "两麦处理器" },
                { value: "sixMic", label: "六麦处理器" },
                { value: "highPerformance", label: "高性能处理器" }
              ]}
              onChange={(value) => setConstraints({ processorTier: value as ProcessorTier }, "microphone")}
            />
          </label>
        </div>
      ) : null}

      {selection.microphone.isNonRecommended ? (
        <SelectionNote title={`麦克风：系统推荐 ${selection.microphone.recommendedLabel}`} advantages={selection.microphone.advantages} cautions={selection.microphone.cautions} />
      ) : null}
      {selection.speaker.isNonRecommended ? (
        <SelectionNote title={`音箱：系统推荐 ${selection.speaker.recommendedLabel}`} advantages={selection.speaker.advantages} cautions={selection.speaker.cautions} />
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
  options: Array<{ value: string; label: string; icon: React.ReactNode }>;
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
      <div className="solutionSegmentedControl">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={option.value === selected ? "active" : ""}
            aria-pressed={option.value === selected}
            onClick={() => onSelect(option.value)}
          >
            {option.icon}
            <span>{option.label}</span>
            {option.value === recommended ? <small>系统推荐</small> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectionNote({ title, advantages, cautions }: { title: string; advantages: string; cautions: string }) {
  return (
    <div className="selectionDecisionNote">
      <strong>{title}</strong>
      <span><b>优势</b>{advantages}</span>
      <span><b>注意事项</b>{cautions}</span>
    </div>
  );
}
