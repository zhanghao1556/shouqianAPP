import { useEffect, useMemo, useState } from "react";
import { Download, Plus, RotateCcw } from "lucide-react";
import { auditoriumRearFillSpeakerLabels, createInitialProfile, podiumPositionLabels, scenarioLabels } from "./data/initialProfile";
import { createRuleChangeApproval, ruleChangePolicy } from "./data/ruleGovernance";
import { DrawingCanvas } from "./components/DrawingCanvas";
import { generateEngineeringOutputs } from "./lib/engineeringRules";
import { createRandomProfile } from "./lib/randomProfile";
import { normalizeProfile } from "./lib/profileNormalization";
import { getAmplificationScopeText, getLegacyDeviceSummary, getNeedText } from "./lib/profileText";
import type { ClassroomProfile, LegacySpeakerPoint, LegacySpeakerType, LegacyWallAdjustability, Point } from "./types";

type CalibrationMark = "untested" | "pass" | "fail";

interface WiringTopologyCalibrationCase {
  id: string;
  profile: ClassroomProfile;
  createdAt: string;
  wiringStatus: CalibrationMark;
  topologyStatus: CalibrationMark;
  pointMapStatus: CalibrationMark;
  note: string;
  wiringNote: string;
  topologyNote: string;
  pointMapNote: string;
  manualArrayMicPoints?: Point[];
  manualSpeakerPoints?: LegacySpeakerPoint[];
  ruleChangeApproval?: ReturnType<typeof createRuleChangeApproval>;
}

const wiringTopologyStorageKey = "yiou-audio-wiring-topology-calibration-cases";
const defaultCentralAirConditionerSize = { width: 0.8, depth: 0.8 };
const wiringTopologyGuardText = "接线拓扑校准只记录问题，不自动改业务规则；涉及音箱或阵麦的选型、数量、点位时，仍需你明确同意后再落地。";

const markLabels: Record<CalibrationMark, string> = {
  untested: "待校准",
  pass: "通过",
  fail: "不通过"
};

export function WiringTopologyCalibrationWorkbench() {
  const [cases, setCases] = useState<WiringTopologyCalibrationCase[]>(() => loadCases());
  const [activeCaseId, setActiveCaseId] = useState<string | null>(cases[0]?.id ?? null);
  const [exportStatus, setExportStatus] = useState("");
  const activeCase = useMemo(() => cases.find((item) => item.id === activeCaseId) ?? cases[0], [activeCaseId, cases]);
  const profile = activeCase?.profile ?? normalizeProfile(createInitialProfile());
  const outputs = useMemo(() => generateEngineeringOutputs(profile), [profile]);
  const arrayMicCount = outputs.generatedPoints.filter((point) => point.type === "arrayMic").length;
  const speakerCount = outputs.generatedPoints.filter((point) => point.type === "speaker").length;

  useEffect(() => {
    localStorage.setItem(wiringTopologyStorageKey, JSON.stringify(cases));
  }, [cases]);

  const updateCases = (updater: (items: WiringTopologyCalibrationCase[]) => WiringTopologyCalibrationCase[]) => {
    setCases((current) => {
      const next = updater(current);
      localStorage.setItem(wiringTopologyStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const generateCases = (count: number) => {
    const createdAt = new Date().toISOString();
    const nextCases = Array.from({ length: count }, (_, index) => {
      const profileIndex = cases.length + index + 1;
      return createCase(createConfirmedCalibrationProfile(profileIndex), createdAt);
    });
    updateCases((current) => [...current, ...nextCases]);
    if (!activeCaseId && nextCases[0]) setActiveCaseId(nextCases[0].id);
  };

  const resetCases = () => {
    updateCases(() => []);
    setActiveCaseId(null);
    setExportStatus("");
  };

  const updateActiveProfile = (nextProfile: ClassroomProfile) => {
    if (!activeCase) return;
    updateCases((current) => current.map((item) => (item.id === activeCase.id ? { ...item, profile: normalizeProfile(nextProfile) } : item)));
  };

  const markCase = (id: string, field: "wiringStatus" | "topologyStatus" | "pointMapStatus", value: CalibrationMark) => {
    updateCases((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const noteCase = (id: string, field: "note" | "wiringNote" | "topologyNote" | "pointMapNote", value: string) => {
    updateCases((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
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
    updateActiveProfile({
      ...profile,
      engineeringConstraints: {
        ...profile.engineeringConstraints,
        hasCentralAirConditioner: true,
        centralAirConditionerCount: count,
        centralAirConditionerPoints: nextPoints
      }
    });
  };

  const updateCentralAirConditionerCount = (count: number) => {
    updateActiveProfile({
      ...profile,
      engineeringConstraints: {
        ...profile.engineeringConstraints,
        hasCentralAirConditioner: count > 0 || profile.engineeringConstraints.hasCentralAirConditioner,
        centralAirConditionerCount: count,
        centralAirConditionerPoints: (profile.engineeringConstraints.centralAirConditionerPoints ?? []).slice(0, count)
      }
    });
  };

  const addManualArrayMicPoint = (position: Point) => {
    if (!activeCase) return;
    updateCases((current) =>
      current.map((item) =>
        item.id === activeCase.id ? { ...item, manualArrayMicPoints: [...(item.manualArrayMicPoints ?? []), position] } : item
      )
    );
  };

  const removeLastManualArrayMicPoint = () => {
    if (!activeCase) return;
    updateCases((current) =>
      current.map((item) =>
        item.id === activeCase.id ? { ...item, manualArrayMicPoints: (item.manualArrayMicPoints ?? []).slice(0, -1) } : item
      )
    );
  };

  const addManualSpeakerPoint = (input: { position: Point; type: LegacySpeakerType; wallAdjustability: LegacyWallAdjustability }) => {
    if (!activeCase) return;
    updateCases((current) =>
      current.map((item) => {
        if (item.id !== activeCase.id) return item;
        const nextIndex = (item.manualSpeakerPoints ?? []).length + 1;
        return {
          ...item,
          manualSpeakerPoints: [
            ...(item.manualSpeakerPoints ?? []),
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
    if (!activeCase) return;
    updateCases((current) =>
      current.map((item) =>
        item.id === activeCase.id ? { ...item, manualSpeakerPoints: (item.manualSpeakerPoints ?? []).slice(0, -1) } : item
      )
    );
  };

  const updateManualSpeakerPointTarget = (index: number, target: Point) => {
    if (!activeCase) return;
    updateCases((current) =>
      current.map((item) => {
        if (item.id !== activeCase.id) return item;
        return {
          ...item,
          manualSpeakerPoints: (item.manualSpeakerPoints ?? []).map((point, pointIndex) => (pointIndex === index ? { ...point, target } : point))
        };
      })
    );
  };

  const exportCases = () => {
    const exportedAt = new Date().toISOString();
    const payload = {
      exportedAt,
      calibrationType: "wiring-topology",
      ruleChangePolicy,
      cases: cases.map((item) => ({
        ...item,
        systemSummary: getCaseSystemSummary(item.profile),
        connectionLines: generateEngineeringOutputs(item.profile).connectionLines,
        productSelection: generateEngineeringOutputs(item.profile).productSelection.map(({ productId, name, category, quantity, where, wiring }) => ({
          productId,
          name,
          category,
          quantity,
          where,
          wiring
        })),
        ruleChangeApproval: item.ruleChangeApproval ?? createRuleChangeApproval()
      }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `接线拓扑校准记录-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    setExportStatus(cases.length ? `已导出 ${cases.length} 条接线拓扑记录（${exportedAt.slice(11, 19)}）` : "当前没有记录，已导出空记录文件。");
  };

  const counts = getMarkCounts(cases);

  return (
    <main className="engineeringShell yiouShell">
      <header className="engineeringHeader yiouHeader selectionHeader">
        <div>
          <span className="sectionBadge">5176</span>
          <h1>接线拓扑图校准台</h1>
          <p>校准接口接线、系统拓扑和单张点位图，不调整自动规则。</p>
        </div>
        <div className="outputActions">
          <button type="button" onClick={() => generateCases(1)}>
            <Plus size={16} /> 生成 1 条
          </button>
          <button type="button" onClick={() => generateCases(5)}>
            <Plus size={16} /> 批量 5 条
          </button>
          <button type="button" onClick={exportCases}>
            <Download size={16} /> 导出记录
          </button>
          <button type="button" onClick={resetCases}>
            <RotateCcw size={16} /> 清空
          </button>
        </div>
      </header>

      <section className="engineeringGrid wiringCalibrationGrid">
        <section className="workPanel testConsole selectionCasePanel">
          <div className="panelHeader">
            <div>
              <span className="panelStep">01</span>
              <h2>校准用例</h2>
              <p>当前共 {cases.length} 条；接线不通过 {counts.wiringFail} 条，拓扑不通过 {counts.topologyFail} 条，点位图不通过 {counts.pointMapFail} 条。</p>
            </div>
          </div>
          <div className="ruleGuardNotice">
            <strong>规则变更锁</strong>
            <span>{wiringTopologyGuardText}</span>
          </div>
          {exportStatus && <div className="exportStatus">{exportStatus}</div>}
          <div className="testStats">
            <span>总计 {cases.length}</span>
            <span className="pass">接线通过 {counts.wiringPass}</span>
            <span className="pass">拓扑通过 {counts.topologyPass}</span>
            <span className="pass">点位通过 {counts.pointMapPass}</span>
            <span className="fail">不通过 {counts.totalFail}</span>
          </div>

          <div className="selectionCaseList">
            {cases.length ? (
              cases.map((item, index) => {
                const summary = getCaseSystemSummary(item.profile);
                return (
                  <article className={item.id === activeCase?.id ? "selectionCaseCard active" : "selectionCaseCard"} key={item.id}>
                    <button type="button" className="selectionCaseLoadButton" onClick={() => setActiveCaseId(item.id)}>
                      <strong>{index + 1}. {item.profile.projectName}</strong>
                      <span>{scenarioLabels[item.profile.scenario]} / {getNeedText(item.profile)} / {getAmplificationScopeText(item.profile)}</span>
                      <span>房间：宽 {item.profile.roomGeometry.width}m x 长 {item.profile.roomGeometry.length}m x 高 {item.profile.roomGeometry.height}m</span>
                      <span>系统：{summary}</span>
                      <span>接线：{markLabels[item.wiringStatus]}；拓扑：{markLabels[item.topologyStatus]}；点位图：{markLabels[item.pointMapStatus]}</span>
                    </button>
                    <CalibrationMarkRow
                      label="接线"
                      value={item.wiringStatus}
                      onChange={(value) => markCase(item.id, "wiringStatus", value)}
                    />
                    <CalibrationMarkRow
                      label="拓扑"
                      value={item.topologyStatus}
                      onChange={(value) => markCase(item.id, "topologyStatus", value)}
                    />
                    <CalibrationMarkRow
                      label="点位图"
                      value={item.pointMapStatus}
                      onChange={(value) => markCase(item.id, "pointMapStatus", value)}
                    />
                    <textarea value={item.note} onChange={(event) => noteCase(item.id, "note", event.target.value)} placeholder="整体备注：这个用例还有什么需要复核" />
                  </article>
                );
              })
            ) : (
              <div className="emptySelectionState">请先生成接线拓扑校准用例。</div>
            )}
          </div>
        </section>

        <section className="workPanel wiringDetailPanel">
          <div className="panelHeader">
            <div>
              <span className="panelStep">02</span>
              <h2>接线与拓扑</h2>
              <p>{activeCase ? activeCase.profile.projectName : "从左侧选择一条用例后查看接线拓扑。"}</p>
            </div>
          </div>
          <div className="selectionDetailGrid wiringFactGrid">
            <SelectionInfoCard title="售前条件" items={getProfileFacts(profile)} />
            <SelectionInfoCard title="设备与接口" items={getOutputFacts(outputs)} />
            <SelectionInfoCard title="人工标注" items={activeCase ? getMarkFacts(activeCase) : ["当前没有用例"]} />
          </div>
          <div className="drawingBlock wiringDiagramBlock">
            <h4>接线与拓扑合并图</h4>
            <DrawingCanvas profile={profile} generatedPoints={outputs.generatedPoints} connectionLines={outputs.connectionLines} activeDrawing="system" />
          </div>
          <ConnectionLineTable lines={outputs.connectionLines} />
          {activeCase && (
            <div className="wiringNoteGrid">
              <textarea value={activeCase.wiringNote} onChange={(event) => noteCase(activeCase.id, "wiringNote", event.target.value)} placeholder="接线备注：接口、端口、线材、数量哪里不对" />
              <textarea value={activeCase.topologyNote} onChange={(event) => noteCase(activeCase.id, "topologyNote", event.target.value)} placeholder="拓扑备注：系统角色、信号流、扩展设备哪里不对" />
            </div>
          )}

          <div className="panelHeader pointMapSubHeader">
            <div>
              <span className="panelStep">03</span>
              <h2>单张点位图</h2>
              <p>保留点位图校准能力，但 5176 只显示这一张点位图。</p>
            </div>
          </div>
          <div className="compactMicSummary">
            <span>阵麦 {arrayMicCount} 个</span>
            <span>音箱 {speakerCount} 只</span>
            <span>接线 {outputs.connectionLines.length} 条</span>
            <span>{outputs.audioPlan.mode}</span>
          </div>
          <div className="variantPointMapBlock">
            <div className="variantPointMapHeader">
              <strong>阵列麦与音箱点位图</strong>
              <span>人工阵麦 {activeCase?.manualArrayMicPoints?.length ?? 0} 个；人工音箱 {activeCase?.manualSpeakerPoints?.length ?? 0} 只</span>
            </div>
            <DrawingCanvas
              profile={profile}
              generatedPoints={outputs.generatedPoints}
              connectionLines={outputs.connectionLines}
              activeDrawing="installation"
              onCentralAirConditionerPointChange={activeCase ? markCentralAirConditionerPoint : undefined}
              onCentralAirConditionerCountChange={activeCase ? updateCentralAirConditionerCount : undefined}
              manualArrayMicPoints={activeCase?.manualArrayMicPoints ?? []}
              onManualArrayMicPointAdd={activeCase ? addManualArrayMicPoint : undefined}
              onManualArrayMicPointRemoveLast={activeCase ? removeLastManualArrayMicPoint : undefined}
              manualSpeakerPoints={activeCase?.manualSpeakerPoints ?? []}
              onManualSpeakerPointAdd={activeCase ? addManualSpeakerPoint : undefined}
              onManualSpeakerPointRemoveLast={activeCase ? removeLastManualSpeakerPoint : undefined}
              onManualSpeakerPointTargetChange={activeCase ? updateManualSpeakerPointTarget : undefined}
            />
          </div>
          {activeCase && (
            <textarea className="pointMapNote" value={activeCase.pointMapNote} onChange={(event) => noteCase(activeCase.id, "pointMapNote", event.target.value)} placeholder="点位图备注：阵麦、音箱、空调或人工点位哪里需要校准" />
          )}
        </section>
      </section>
    </main>
  );
}

function CalibrationMarkRow({ label, value, onChange }: { label: string; value: CalibrationMark; onChange: (value: CalibrationMark) => void }) {
  return (
    <div className="calibrationMarkRow">
      <span>{label}</span>
      <div className="markButtons">
        <button className={value === "pass" ? "mark pass active" : "mark pass"} type="button" onClick={() => onChange("pass")}>
          通过
        </button>
        <button className={value === "fail" ? "mark fail active" : "mark fail"} type="button" onClick={() => onChange("fail")}>
          不通过
        </button>
        <button className={value === "untested" ? "mark active" : "mark"} type="button" onClick={() => onChange("untested")}>
          待校准
        </button>
      </div>
    </div>
  );
}

function SelectionInfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="selectionInfoCard">
      <h3>{title}</h3>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
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

function createCase(profile: ClassroomProfile, createdAt: string): WiringTopologyCalibrationCase {
  return {
    id: `wiring-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    profile,
    createdAt,
    wiringStatus: "untested",
    topologyStatus: "untested",
    pointMapStatus: "untested",
    note: "",
    wiringNote: "",
    topologyNote: "",
    pointMapNote: "",
    ruleChangeApproval: createRuleChangeApproval()
  };
}

function createConfirmedCalibrationProfile(index: number) {
  return ensureConfirmedProfile(normalizeProfile(createRandomProfile(index)));
}

function ensureConfirmedProfile(profile: ClassroomProfile): ClassroomProfile {
  return {
    ...profile,
    engineeringConstraints: {
      ...profile.engineeringConstraints,
      ceiling: profile.engineeringConstraints.ceiling === "unknown" ? "suspended" : profile.engineeringConstraints.ceiling,
      podiumPosition: profile.engineeringConstraints.podiumPosition === "unknown" ? "frontCenter" : profile.engineeringConstraints.podiumPosition,
      auditoriumRearFillSpeakers:
        profile.scenario === "auditorium"
          ? profile.engineeringConstraints.auditoriumRearFillSpeakers === "unknown" || !profile.engineeringConstraints.auditoriumRearFillSpeakers
            ? "absent"
            : profile.engineeringConstraints.auditoriumRearFillSpeakers
          : profile.engineeringConstraints.auditoriumRearFillSpeakers
    },
    acousticEnvironment: {
      ...profile.acousticEnvironment,
      floorMaterial: profile.acousticEnvironment.floorMaterial === "unknown" ? "tile" : profile.acousticEnvironment.floorMaterial,
      wallMaterial: profile.acousticEnvironment.wallMaterial === "unknown" ? "painted" : profile.acousticEnvironment.wallMaterial,
      softTreatment: profile.acousticEnvironment.softTreatment === "unknown" ? "none" : profile.acousticEnvironment.softTreatment,
      furnishingDensity: profile.acousticEnvironment.furnishingDensity === "unknown" ? "normal" : profile.acousticEnvironment.furnishingDensity
    },
    existingDevices: {
      ...profile.existingDevices,
      legacySpeakerPoints: (profile.existingDevices.legacySpeakerPoints ?? []).map((point) => ({
        ...point,
        wallAdjustability: point.type === "wall" && point.wallAdjustability === "unknown" ? "universal" : point.wallAdjustability
      }))
    }
  };
}

function loadCases(): WiringTopologyCalibrationCase[] {
  try {
    const raw = localStorage.getItem(wiringTopologyStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WiringTopologyCalibrationCase[] | { cases?: WiringTopologyCalibrationCase[] };
    const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed.cases) ? parsed.cases : [];
    return items.map((item) => ({
      ...item,
      profile: ensureConfirmedProfile(normalizeProfile(item.profile)),
      wiringStatus: item.wiringStatus ?? "untested",
      topologyStatus: item.topologyStatus ?? "untested",
      pointMapStatus: item.pointMapStatus ?? "untested",
      note: item.note ?? "",
      wiringNote: item.wiringNote ?? "",
      topologyNote: item.topologyNote ?? "",
      pointMapNote: item.pointMapNote ?? "",
      manualArrayMicPoints: item.manualArrayMicPoints ?? [],
      manualSpeakerPoints: item.manualSpeakerPoints ?? [],
      ruleChangeApproval: item.ruleChangeApproval ?? createRuleChangeApproval()
    }));
  } catch {
    return [];
  }
}

function getProfileFacts(profile: ClassroomProfile) {
  return [
    `场景：${scenarioLabels[profile.scenario]}`,
    `需求：${getNeedText(profile)}`,
    `扩声范围：${getAmplificationScopeText(profile)}`,
    `房间：宽 ${profile.roomGeometry.width}m x 长 ${profile.roomGeometry.length}m x 高 ${profile.roomGeometry.height}m`,
    `讲台：${podiumPositionLabels[profile.engineeringConstraints.podiumPosition]}`,
    profile.scenario === "auditorium"
      ? `后排补声：${auditoriumRearFillSpeakerLabels[profile.engineeringConstraints.auditoriumRearFillSpeakers ?? "unknown"]}`
      : "",
    `利旧：${getLegacyDeviceSummary(profile)}`
  ].filter(Boolean);
}

function getOutputFacts(outputs: ReturnType<typeof generateEngineeringOutputs>) {
  const productText = outputs.productSelection.length
    ? outputs.productSelection.map((item) => `${item.name} x ${item.quantity}`).join("；")
    : "未生成设备清单";
  return [
    `设备：${productText}`,
    `接线条目：${outputs.connectionLines.length} 条`,
    `阵麦点位：${outputs.generatedPoints.filter((point) => point.type === "arrayMic").length} 个`,
    `音箱点位：${outputs.generatedPoints.filter((point) => point.type === "speaker").length} 只`
  ];
}

function getMarkFacts(item: WiringTopologyCalibrationCase) {
  return [
    `接线：${markLabels[item.wiringStatus]}`,
    `拓扑：${markLabels[item.topologyStatus]}`,
    `点位图：${markLabels[item.pointMapStatus]}`,
    item.note ? `整体备注：${item.note}` : "整体备注：未填写"
  ];
}

function getCaseSystemSummary(profile: ClassroomProfile) {
  const outputs = generateEngineeringOutputs(profile);
  const mics = outputs.generatedPoints.filter((point) => point.type === "arrayMic").length;
  const speakers = outputs.generatedPoints.filter((point) => point.type === "speaker").length;
  const amplifier = outputs.productSelection.find((item) => item.category === "amplifier");
  return `${mics} 个阵麦 / ${speakers} 只音箱 / ${outputs.connectionLines.length} 条接线${amplifier ? ` / ${amplifier.name} x ${amplifier.quantity}` : ""}`;
}

function getMarkCounts(cases: WiringTopologyCalibrationCase[]) {
  const wiringPass = cases.filter((item) => item.wiringStatus === "pass").length;
  const topologyPass = cases.filter((item) => item.topologyStatus === "pass").length;
  const pointMapPass = cases.filter((item) => item.pointMapStatus === "pass").length;
  const wiringFail = cases.filter((item) => item.wiringStatus === "fail").length;
  const topologyFail = cases.filter((item) => item.topologyStatus === "fail").length;
  const pointMapFail = cases.filter((item) => item.pointMapStatus === "fail").length;
  return {
    wiringPass,
    topologyPass,
    pointMapPass,
    wiringFail,
    topologyFail,
    pointMapFail,
    totalFail: cases.filter((item) => item.wiringStatus === "fail" || item.topologyStatus === "fail" || item.pointMapStatus === "fail").length
  };
}
