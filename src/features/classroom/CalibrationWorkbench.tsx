import { useMemo, useState } from "react";
import { createInitialProfile, needLabels, scenarioLabels } from "./data/initialProfile";
import { mistakeCaseSeeds } from "./data/mistakeCases";
import { createRuleChangeApproval, ruleChangePolicy } from "./data/ruleGovernance";
import { DrawingCanvas } from "./components/DrawingCanvas";
import { PointValidationSummary } from "./components/PointValidationSummary";
import {
  getOutputCalibrationCaseStatus,
  OutputCalibrationPanel,
  type OutputCalibrationKey,
  type OutputCalibrationMark
} from "./components/OutputCalibrationPanel";
import { TestConsole, type CalibrationCase, type CalibrationStatus } from "./components/TestConsole";
import { generateEngineeringOutputs } from "./lib/engineeringRules";
import { createRandomProfile } from "./lib/randomProfile";
import { normalizeProfile } from "./lib/profileNormalization";
import { getLineArrayDecision } from "./lib/lineArrayRules";
import type { ClassroomProfile, LegacySpeakerPoint, LegacySpeakerType, LegacyWallAdjustability, Point, QuantityOverrides } from "./types";
import type { AppBrandId } from "./brand";

const calibrationStorageKey = "yiou-audio-calibration-cases";
const defaultCentralAirConditionerSize = { width: 0.8, depth: 0.8 };

export function CalibrationWorkbench() {
  const [brandId, setBrandId] = useState<AppBrandId>(() => {
    const initialBrand = getInitialCalibrationBrand();
    window.__APP_BRAND__ = initialBrand;
    return initialBrand;
  });
  const [profile, setProfile] = useState<ClassroomProfile>(() => normalizeProfile(createInitialProfile()));
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [calibrationCases, setCalibrationCases] = useState<CalibrationCase[]>(() => loadCalibrationCases());
  const [quantityOverrides, setQuantityOverrides] = useState<QuantityOverrides>({});
  const [exportStatus, setExportStatus] = useState("");
  const outputs = useMemo(() => generateEngineeringOutputs(profile, quantityOverrides, brandId), [profile, quantityOverrides, brandId]);
  const microphoneDecision = useMemo(() => getLineArrayDecision(profile, outputs.generatedPoints), [profile, outputs.generatedPoints]);
  const arrayMicPoints = useMemo(() => outputs.generatedPoints.filter((point) => point.type === "arrayMic"), [outputs.generatedPoints]);
  const speakerPoints = useMemo(() => outputs.generatedPoints.filter((point) => point.type === "speaker"), [outputs.generatedPoints]);

  const updateCalibrationCases = (updater: (items: CalibrationCase[]) => CalibrationCase[]) => {
    setCalibrationCases((current) => {
      const next = updater(current);
      localStorage.setItem(calibrationStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const generateCases = (count: number) => {
    updateCalibrationCases((current) => [
      ...current,
      ...Array.from({ length: count }, (_, index) => {
        const profileIndex = current.length + index + 1;
        return {
          id: `${Date.now()}-${profileIndex}-${Math.random().toString(16).slice(2)}`,
          profile: normalizeProfile(createRandomProfile(profileIndex)),
          createdAt: new Date().toISOString(),
          status: "untested" as const,
          note: "",
          outputChecks: {},
          ruleChangeApproval: createRuleChangeApproval()
        };
      })
    ]);
  };

  const loadCase = (item: CalibrationCase) => {
    setProfile(normalizeProfile(item.profile));
    setQuantityOverrides({});
    setActiveCaseId(item.id);
  };

  const loadMistakeBookCases = () => {
    const createdAt = new Date().toISOString();
    const mistakeCases = mistakeCaseSeeds.map((seed, index) => ({
      id: `mistake-${createdAt}-${index + 1}`,
      profile: normalizeProfile(seed.profile),
      createdAt,
      status: "untested" as const,
      note: seed.note,
      outputChecks: {},
      ruleChangeApproval: createRuleChangeApproval()
    }));
    updateCalibrationCases(() => mistakeCases);
    setQuantityOverrides({});
    if (mistakeCases[0]) {
      setProfile(mistakeCases[0].profile);
      setActiveCaseId(mistakeCases[0].id);
    } else {
      setActiveCaseId(null);
    }
    setExportStatus(`已加载错题本 ${mistakeCases.length} 条，请用最新规则逐条复判。`);
  };

  const markCentralAirConditionerPoint = (position: Point, index = 0) => {
    const existingPoints = profile.engineeringConstraints.centralAirConditionerPoints ?? [];
    const existing = existingPoints[index];
    const count = Math.max(profile.engineeringConstraints.centralAirConditionerCount ?? 1, index + 1);
    const nextPoints = [...existingPoints];
    nextPoints[index] = {
      id: existing?.id ?? `central-ac-${Date.now()}-${index + 1}`,
      label: existing?.label ?? `中央空调${index + 1}`,
      position,
      size: existing?.size ?? defaultCentralAirConditionerSize
    };
    const nextProfile = normalizeProfile({
      ...profile,
      engineeringConstraints: {
        ...profile.engineeringConstraints,
        hasCentralAirConditioner: true,
        centralAirConditionerCount: count,
        centralAirConditionerPoints: nextPoints
      }
    });
    setProfile(nextProfile);
    setQuantityOverrides({});
    if (activeCaseId) {
      updateCalibrationCases((current) => current.map((item) => (item.id === activeCaseId ? { ...item, profile: nextProfile } : item)));
    }
  };

  const updateCentralAirConditionerCount = (count: number) => {
    const nextProfile = normalizeProfile({
      ...profile,
      engineeringConstraints: {
        ...profile.engineeringConstraints,
        hasCentralAirConditioner: count > 0 || profile.engineeringConstraints.hasCentralAirConditioner,
        centralAirConditionerCount: count,
        centralAirConditionerPoints: (profile.engineeringConstraints.centralAirConditionerPoints ?? []).slice(0, count)
      }
    });
    setProfile(nextProfile);
    setQuantityOverrides({});
    if (activeCaseId) {
      updateCalibrationCases((current) => current.map((item) => (item.id === activeCaseId ? { ...item, profile: nextProfile } : item)));
    }
  };

  const addManualArrayMicPoint = (position: Point) => {
    if (!activeCaseId) return;
    updateCalibrationCases((current) =>
      current.map((item) =>
        item.id === activeCaseId
          ? {
              ...item,
              manualArrayMicPoints: [...(item.manualArrayMicPoints ?? []), position]
            }
          : item
      )
    );
  };

  const removeLastManualArrayMicPoint = () => {
    if (!activeCaseId) return;
    updateCalibrationCases((current) =>
      current.map((item) =>
        item.id === activeCaseId
          ? {
              ...item,
              manualArrayMicPoints: (item.manualArrayMicPoints ?? []).slice(0, -1)
            }
          : item
      )
    );
  };

  const addManualSpeakerPoint = (input: { position: Point; type: LegacySpeakerType; wallAdjustability: LegacyWallAdjustability }) => {
    if (!activeCaseId) return;
    updateCalibrationCases((current) =>
      current.map((item) => {
        if (item.id !== activeCaseId) return item;
        const currentPoints = item.manualSpeakerPoints ?? [];
        const nextIndex = currentPoints.length + 1;
        return {
          ...item,
          manualSpeakerPoints: [
            ...currentPoints,
            {
              id: `manual-speaker-${Date.now()}-${nextIndex}`,
              label: `manual-speaker-${nextIndex}`,
              type: input.type,
              position: input.position,
              wallAdjustability: input.type === "wall" ? input.wallAdjustability : "unknown"
            }
          ]
        };
      })
    );
  };

  const removeLastManualSpeakerPoint = () => {
    if (!activeCaseId) return;
    updateCalibrationCases((current) =>
      current.map((item) =>
        item.id === activeCaseId
          ? {
              ...item,
              manualSpeakerPoints: (item.manualSpeakerPoints ?? []).slice(0, -1)
            }
          : item
      )
    );
  };

  const updateManualSpeakerPointTarget = (index: number, target: Point) => {
    if (!activeCaseId) return;
    updateCalibrationCases((current) =>
      current.map((item) => {
        if (item.id !== activeCaseId) return item;
        const manualSpeakerPoints = item.manualSpeakerPoints ?? [];
        if (!manualSpeakerPoints[index] || manualSpeakerPoints[index].type !== "wall") return item;
        const syncedPoints = getWallSpeakerSymmetricTargets(manualSpeakerPoints, index, target, item.profile);
        return {
          ...item,
          manualSpeakerPoints: syncedPoints
        };
      })
    );
  };

  const activeCase = calibrationCases.find((item) => item.id === activeCaseId);

  const updateOutputCheck = (key: OutputCalibrationKey, patch: Partial<OutputCalibrationMark>) => {
    if (!activeCaseId) return;
    updateCalibrationCases((current) => current.map((item) => {
      if (item.id !== activeCaseId) return item;
      const currentMark = item.outputChecks?.[key] ?? { status: "untested" as const, note: "" };
      const outputChecks = {
        ...(item.outputChecks ?? {}),
        [key]: { ...currentMark, ...patch }
      };
      return {
        ...item,
        outputChecks,
        status: patch.status ? getOutputCalibrationCaseStatus(outputChecks) : item.status
      };
    }));
  };

  const markCase = (id: string, status: CalibrationStatus) => {
    updateCalibrationCases((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              ruleChangeApproval: item.ruleChangeApproval ?? createRuleChangeApproval()
            }
          : item
      )
    );
  };

  const noteCase = (id: string, note: string) => {
    updateCalibrationCases((current) => current.map((item) => (item.id === id ? { ...item, note } : item)));
  };

  const resetCases = () => {
    updateCalibrationCases(() => []);
    setActiveCaseId(null);
  };

  const exportCalibrationCases = () => {
    const exportedAt = new Date().toISOString();
    const exportPayload = {
      exportedAt,
      ruleChangePolicy,
      cases: calibrationCases.map((item) => ({
        ...item,
        ruleChangeApproval: item.ruleChangeApproval ?? createRuleChangeApproval()
      }))
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `方案校准记录-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    setExportStatus(calibrationCases.length ? `已导出 ${calibrationCases.length} 条记录（${exportedAt.slice(11, 19)}）` : "当前没有记录，已导出空记录文件。");
  };

  const changeBrand = (nextBrand: AppBrandId) => {
    window.__APP_BRAND__ = nextBrand;
    setBrandId(nextBrand);
    setQuantityOverrides({});
    const url = new URL(window.location.href);
    url.searchParams.set("brand", nextBrand);
    window.history.replaceState(null, "", url);
  };

  return (
    <main className={`engineeringShell ${brandId === "yinman" ? "yinmanShell" : "yiouShell"}`}>
      <div className="calibrationBrandBar">
        <div>
          <strong>点位与系统校准台</strong>
          <span>当前品牌：{brandId === "yinman" ? "音曼" : "音翼"}</span>
        </div>
        <div className="brandSegmentedControl" role="group" aria-label="校准品牌">
          <button type="button" className={brandId === "yinyi" ? "active" : ""} onClick={() => changeBrand("yinyi")}>音翼</button>
          <button type="button" className={brandId === "yinman" ? "active" : ""} onClick={() => changeBrand("yinman")}>音曼</button>
        </div>
      </div>
      <section className="engineeringGrid calibrationWorkbenchGrid">
        <TestConsole
          brandId={brandId}
          cases={calibrationCases}
          activeCaseId={activeCaseId}
          onGenerateOne={() => generateCases(1)}
          onGenerateBatch={() => generateCases(5)}
          onLoadMistakeBook={loadMistakeBookCases}
          onReset={resetCases}
          onLoadCase={loadCase}
          onMarkCase={markCase}
          onNoteCase={noteCase}
          onExport={exportCalibrationCases}
          exportStatus={exportStatus}
        />
        <section className="workPanel compactPointMapPanel calibrationDetailPanel">
          <div className="panelHeader">
            <div>
              <span className="panelStep">01</span>
              <h2>当前案例点位与接线</h2>
              <p>{activeCaseId ? profile.projectName : "从左侧加载一条随机售前采集后查看点位图。"}</p>
            </div>
          </div>
          <div className="compactMicSummary">
            <span>阵麦 {arrayMicPoints.length} 只</span>
            <span>音箱 {speakerPoints.length} 只</span>
            <span>接线 {outputs.connectionLines.length} 条</span>
            <span>{outputs.audioPlan.mode}</span>
          </div>
          <MicrophoneRecommendationCalibration profile={profile} decision={microphoneDecision} />
          <OutputCalibrationPanel
            profile={profile}
            outputs={outputs}
            checks={activeCase?.outputChecks}
            enabled={Boolean(activeCaseId)}
            onChange={updateOutputCheck}
          />
          <PointValidationSummary result={outputs.pointValidation} mode="full" />
          <CalibrationPointMap
            profile={profile}
            outputs={outputs}
            activeCase={activeCase}
            onCentralAirConditionerPointChange={markCentralAirConditionerPoint}
            onCentralAirConditionerCountChange={updateCentralAirConditionerCount}
            onManualArrayMicPointAdd={activeCaseId ? addManualArrayMicPoint : undefined}
            onManualArrayMicPointRemoveLast={activeCaseId ? removeLastManualArrayMicPoint : undefined}
            onManualSpeakerPointAdd={activeCaseId ? addManualSpeakerPoint : undefined}
            onManualSpeakerPointRemoveLast={activeCaseId ? removeLastManualSpeakerPoint : undefined}
            onManualSpeakerPointTargetChange={activeCaseId ? updateManualSpeakerPointTarget : undefined}
          />
          <div className="panelHeader pointMapSubHeader">
            <div>
              <span className="panelStep">02</span>
              <h2>接线拓扑校准</h2>
              <p>按同一个方案输出检查接线关系和系统拓扑。</p>
            </div>
          </div>
          <div className="drawingBlock wiringDiagramBlock">
            <h4>接线与拓扑合并图</h4>
            <DrawingCanvas profile={profile} generatedPoints={outputs.generatedPoints} connectionLines={outputs.connectionLines} activeDrawing="system" />
          </div>
          <ConnectionLineTable lines={outputs.connectionLines} />
        </section>
      </section>
    </main>
  );
}

function MicrophoneRecommendationCalibration({
  profile,
  decision
}: {
  profile: ClassroomProfile;
  decision: ReturnType<typeof getLineArrayDecision>;
}) {
  const devices = [profile.existingDevices.computer, profile.existingDevices.recordingHost].filter(Boolean).join("；") || "无";
  return (
    <section className="microphoneRecommendationCalibration" aria-label="麦克风推荐校准">
      <div className="microphoneCalibrationHeader">
        <div>
          <span>麦克风推荐校准</span>
          <strong>{decision.recommended ? "推荐智能线阵麦克风" : "推荐智能语音阵列麦克风"}</strong>
        </div>
        <b className={decision.recommended ? "lineArrayVerdict" : "arrayMicVerdict"}>{decision.supported ? "能力可用" : "能力不满足"}</b>
      </div>
      <dl className="microphoneCalibrationFacts">
        <dt>场景 / 需求</dt><dd>{scenarioLabels[profile.scenario]}；{profile.needs.map((need) => needLabels[need]).join("、") || "未选择"}</dd>
        <dt>房间</dt><dd>{profile.roomGeometry.width}m × {profile.roomGeometry.length}m × {profile.roomGeometry.height}m</dd>
        <dt>责任区</dt><dd>{decision.activityZone.label}；{decision.activityZone.width}m × {decision.activityZone.depth}m</dd>
        <dt>设备推断</dt><dd>{devices}</dd>
        <dt>摆位</dt><dd>{decision.installation === "podium" ? "讲台摆放" : decision.installation === "tabletop" ? "会议桌摆放" : "责任区中心吊挂"}；({decision.position.x}m, {decision.position.y}m)</dd>
        <dt>推荐结论</dt><dd>{decision.recommendationReason}</dd>
      </dl>
      <div className="microphoneDecisionFactors">
        {decision.decisionFactors.map((factor) => <span key={factor}>{factor}</span>)}
      </div>
    </section>
  );
}

function getInitialCalibrationBrand(): AppBrandId {
  return new URLSearchParams(window.location.search).get("brand") === "yinman" ? "yinman" : "yinyi";
}

function loadCalibrationCases(): CalibrationCase[] {
  try {
    const raw = localStorage.getItem(calibrationStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CalibrationCase[] | { cases?: CalibrationCase[] };
    const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed.cases) ? parsed.cases : [];
    return items.map((item) => {
      const outputChecks = item.outputChecks ?? {};
      return {
        ...item,
        profile: normalizeProfile(item.profile),
        manualSpeakerPoints: item.manualSpeakerPoints ?? item.manualSpeakerVariants?.ceiling ?? item.manualSpeakerVariants?.wall ?? [],
        outputChecks,
        status: item.status === "fail" ? "fail" : getOutputCalibrationCaseStatus(outputChecks),
        ruleChangeApproval: item.ruleChangeApproval ?? createRuleChangeApproval()
      };
    });
  } catch {
    return [];
  }
}

function CalibrationPointMap({
  profile,
  outputs,
  activeCase,
  onCentralAirConditionerPointChange,
  onCentralAirConditionerCountChange,
  onManualArrayMicPointAdd,
  onManualArrayMicPointRemoveLast,
  onManualSpeakerPointAdd,
  onManualSpeakerPointRemoveLast,
  onManualSpeakerPointTargetChange
}: {
  profile: ClassroomProfile;
  outputs: ReturnType<typeof generateEngineeringOutputs>;
  activeCase?: CalibrationCase;
  onCentralAirConditionerPointChange: (position: Point, index?: number) => void;
  onCentralAirConditionerCountChange: (count: number) => void;
  onManualArrayMicPointAdd?: (position: Point) => void;
  onManualArrayMicPointRemoveLast?: () => void;
  onManualSpeakerPointAdd?: (input: { position: Point; type: LegacySpeakerType; wallAdjustability: LegacyWallAdjustability }) => void;
  onManualSpeakerPointRemoveLast?: () => void;
  onManualSpeakerPointTargetChange?: (index: number, target: Point) => void;
}) {
  const manualSpeakerPoints = activeCase?.manualSpeakerPoints ?? [];
  return (
    <div className="variantPointMapBlock">
      <div className="variantPointMapHeader">
        <strong>阵列麦与音箱点位图</strong>
        <span>人工阵麦 {activeCase?.manualArrayMicPoints?.length ?? 0} 个；人工音箱 {manualSpeakerPoints.length} 只</span>
      </div>
      <DrawingCanvas
        profile={profile}
        generatedPoints={outputs.generatedPoints}
        connectionLines={outputs.connectionLines}
        activeDrawing="installation"
        onCentralAirConditionerPointChange={onCentralAirConditionerPointChange}
        onCentralAirConditionerCountChange={onCentralAirConditionerCountChange}
        manualArrayMicPoints={activeCase?.manualArrayMicPoints ?? []}
        onManualArrayMicPointAdd={onManualArrayMicPointAdd}
        onManualArrayMicPointRemoveLast={onManualArrayMicPointRemoveLast}
        manualSpeakerPoints={manualSpeakerPoints}
        onManualSpeakerPointAdd={onManualSpeakerPointAdd}
        onManualSpeakerPointRemoveLast={onManualSpeakerPointRemoveLast}
        onManualSpeakerPointTargetChange={onManualSpeakerPointTargetChange}
      />
    </div>
  );
}

function ConnectionLineTable({ lines }: { lines: ReturnType<typeof generateEngineeringOutputs>["connectionLines"] }) {
  return (
    <div className="tableBox wiringLineTable">
      {lines.length ? (
        <table>
          <thead>
            <tr>
              <th>序号</th>
              <th>起点</th>
              <th>终点</th>
              <th>线材</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.id}>
                <td>{index + 1}</td>
                <td>{line.fromDevice} [{line.fromPort}]</td>
                <td>{line.toDevice} [{line.toPort}]</td>
                <td>{line.cableType}</td>
                <td>{line.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="emptyState">当前方案还没有生成接线关系。</div>
      )}
    </div>
  );
}

function getWallSpeakerSymmetricTargets(points: LegacySpeakerPoint[], index: number, rawTarget: Point, profile: ClassroomProfile) {
  const source = points?.[index];
  if (!source || source.type !== "wall") return points ?? [];
  const target = snapManualWallSpeakerTarget(rawTarget, points ?? [], index, profile);
  const mirrorTarget = { x: roundOne(profile.roomGeometry.width - target.x), y: target.y };
  return (points ?? []).map((point, pointIndex) => {
    if (pointIndex === index) return { ...point, target };
    if (point.type !== "wall") return point;
    const isSymmetricPair =
      Math.abs(point.position.y - source.position.y) <= 0.45 &&
      Math.abs(point.position.x - (profile.roomGeometry.width - source.position.x)) <= 0.45;
    return isSymmetricPair ? { ...point, target: mirrorTarget } : point;
  });
}

function snapManualWallSpeakerTarget(rawTarget: Point, points: LegacySpeakerPoint[], currentIndex: number, profile: ClassroomProfile) {
  const snapToleranceM = 0.45;
  let next = { ...rawTarget };
  points?.forEach((point, pointIndex) => {
    if (pointIndex === currentIndex || point.type !== "wall" || !point.target) return;
    next = {
      x: snapToValue(next.x, point.target.x, snapToleranceM),
      y: snapToValue(next.y, point.target.y, snapToleranceM)
    };
    next = {
      x: snapToValue(next.x, profile.roomGeometry.width - point.target.x, snapToleranceM),
      y: next.y
    };
  });
  return {
    x: roundOne(Math.max(0, Math.min(profile.roomGeometry.width, next.x))),
    y: roundOne(Math.max(0, Math.min(profile.roomGeometry.length, next.y)))
  };
}

function snapToValue(value: number, target: number, tolerance: number) {
  return Math.abs(value - target) <= tolerance ? target : value;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
