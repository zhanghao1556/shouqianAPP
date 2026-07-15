import { useState } from "react";
import type { ClassroomProfile, ConnectionLine, DrawingType, GeneratedPoint, LegacySpeakerPoint, LegacySpeakerType, LegacyWallAdjustability, Point } from "../types";
import { DT_AUDIO_LINE_IN_LIMIT, DT_AUDIO_LINE_OUT_LIMIT } from "../lib/connectionRules";
import { generateEngineeringPoints, getArrayMicCentralAirRequiredClearance, getArrayMicEffectiveAmplificationRadius, getArrayMicInstallLabel, getCanvasRoomLayout, toCanvasPoint } from "../lib/drawingEngine";
import { isMeetingScenario } from "../lib/scenarioRules";
import {
  CEILING_SPEAKER_IDEAL_COVERAGE_RADIUS_M,
  MAX_SPEAKERS_PER_DT,
  getExternalAmplifierLineOutCountForSpeakers,
  getExternalSpeakerCount,
  getSpeakerOutputGroups
} from "../lib/speakerRules";
import { formatBrandText, getAppBrand } from "../brand";
import topologyArrayMicImage from "../../../assets/topology-array-mic.png";
import topologyAllInOneImage from "../../../assets/topology-all-in-one.png";
import topologyAmplifierImage from "../../../assets/topology-amplifier.png";
import topologyAudioProcessorImage from "../../../assets/topology-audio-processor.png";
import topologyCeilingSpeakerImage from "../../../assets/topology-ceiling-speaker.png";
import topologyControlHostImage from "../../../assets/topology-control-host.png";
import topologyFeedbackSuppressorImage from "../../../assets/topology-feedback-suppressor.png";
import topologyHandheldMicImage from "../../../assets/topology-handheld-mic.png";
import topologyLegacyHandheldMicImage from "../../../assets/topology-legacy-handheld-mic.png";
import topologyLegacyWirelessReceiverImage from "../../../assets/topology-legacy-wireless-receiver.png";
import topologyLaptopImage from "../../../assets/topology-laptop.png";
import topologyMixerImage from "../../../assets/topology-mixer.png";
import topologyPodiumComputerImage from "../../../assets/topology-podium-computer.png";
import topologyRecordingCameraImage from "../../../assets/topology-recording-camera.png";
import topologyRecordingHostImage from "../../../assets/topology-recording-host.png";
import topologyVideoConferenceTerminalImage from "../../../assets/topology-video-conference-terminal.png";
import topologyWallSpeakerImage from "../../../assets/topology-wall-speaker.png";
import topologyWiredMicImage from "../../../assets/topology-wired-mic.png";
import topologyWirelessReceiverImage from "../../../assets/topology-wireless-receiver.png";
import yinmanAudioProcessorImage from "../../../assets/yinman-audio-processor.png";
import yinmanArrayMicPointMapImage from "../../../assets/yinman-array-mic-pointmap.png";
import yinmanArrayMicTopologyImage from "../../../assets/yinman-array-mic-topology.png";
import lineArrayMicImage from "../../../assets/line-array-mic.png";

const pointColors: Record<GeneratedPoint["type"], string> = {
  arrayMic: "#00a6a6",
  speaker: "#00dede"
};

const WALL_SPEAKER_MIN_MOUNTING_ANGLE = 36;
const WALL_SPEAKER_MAX_MOUNTING_ANGLE = 144;
const LEGACY_CEILING_SPEAKER_COVERAGE_RADIUS_M = CEILING_SPEAKER_IDEAL_COVERAGE_RADIUS_M;
const ARRAY_MIC_CENTRAL_AIR_RISK_CLEARANCE_M = 1;
const LECTURE_AUDIENCE_START_BEHIND_MIC_M = 1;
const LECTURE_STEP_RISE_PER_M = 0.2;

interface DrawingCanvasProps {
  profile: ClassroomProfile;
  generatedPoints: GeneratedPoint[];
  connectionLines: ConnectionLine[];
  activeDrawing: DrawingType;
  micOnly?: boolean;
  onCentralAirConditionerPointChange?: (position: Point, index: number) => void;
  onCentralAirConditionerCountChange?: (count: number) => void;
  onLegacySpeakerPointAdd?: (input: { position: Point; type: LegacySpeakerType; wallAdjustability: LegacyWallAdjustability }) => void;
  onLegacySpeakerPointRemoveLast?: () => void;
  onLegacySpeakerPointTargetChange?: (index: number, target: Point) => void;
  manualArrayMicPoints?: Point[];
  onManualArrayMicPointAdd?: (position: Point) => void;
  onManualArrayMicPointRemoveLast?: () => void;
  manualSpeakerPoints?: LegacySpeakerPoint[];
  onManualSpeakerPointAdd?: (input: { position: Point; type: LegacySpeakerType; wallAdjustability: LegacyWallAdjustability }) => void;
  onManualSpeakerPointRemoveLast?: () => void;
  onManualSpeakerPointTargetChange?: (index: number, target: Point) => void;
  manualSpeakerFixedType?: LegacySpeakerType;
}

export function DrawingCanvas({
  profile,
  generatedPoints,
  connectionLines,
  activeDrawing,
  micOnly = false,
  onCentralAirConditionerPointChange,
  onCentralAirConditionerCountChange,
  onLegacySpeakerPointAdd,
  onLegacySpeakerPointRemoveLast,
  onLegacySpeakerPointTargetChange,
  manualArrayMicPoints,
  onManualArrayMicPointAdd,
  onManualArrayMicPointRemoveLast,
  manualSpeakerPoints,
  onManualSpeakerPointAdd,
  onManualSpeakerPointRemoveLast,
  onManualSpeakerPointTargetChange,
  manualSpeakerFixedType
}: DrawingCanvasProps) {
  const roomReady = profile.roomGeometry.length > 0 && profile.roomGeometry.width > 0;

  if (!roomReady) {
    return (
      <div className="canvasEmpty">
        <strong>需要填写教室长宽后生成图纸</strong>
        <span>缺少尺寸时不生成阵列麦、音箱点位和数量。</span>
      </div>
    );
  }

  if (activeDrawing === "system") return <SystemDiagram profile={profile} connections={connectionLines} generatedPoints={generatedPoints} />;
  if (activeDrawing === "wiring") return <WiringDiagram connections={connectionLines} />;
  if (activeDrawing === "topology") return <TopologyDiagram profile={profile} connections={connectionLines} generatedPoints={generatedPoints} />;
  return (
    <InstallationDiagram
      profile={profile}
      generatedPoints={generatedPoints}
      micOnly={micOnly}
      onCentralAirConditionerPointChange={onCentralAirConditionerPointChange}
      onCentralAirConditionerCountChange={onCentralAirConditionerCountChange}
      onLegacySpeakerPointAdd={onLegacySpeakerPointAdd}
      onLegacySpeakerPointRemoveLast={onLegacySpeakerPointRemoveLast}
      onLegacySpeakerPointTargetChange={onLegacySpeakerPointTargetChange}
      manualArrayMicPoints={manualArrayMicPoints}
      onManualArrayMicPointAdd={onManualArrayMicPointAdd}
      onManualArrayMicPointRemoveLast={onManualArrayMicPointRemoveLast}
      manualSpeakerPoints={manualSpeakerPoints}
      onManualSpeakerPointAdd={onManualSpeakerPointAdd}
      onManualSpeakerPointRemoveLast={onManualSpeakerPointRemoveLast}
      onManualSpeakerPointTargetChange={onManualSpeakerPointTargetChange}
      manualSpeakerFixedType={manualSpeakerFixedType}
    />
  );
}

function InstallationDiagram({
  profile,
  generatedPoints,
  micOnly,
  onCentralAirConditionerPointChange,
  onCentralAirConditionerCountChange,
  onLegacySpeakerPointAdd,
  onLegacySpeakerPointRemoveLast,
  onLegacySpeakerPointTargetChange,
  manualArrayMicPoints = [],
  onManualArrayMicPointAdd,
  onManualArrayMicPointRemoveLast,
  manualSpeakerPoints = [],
  onManualSpeakerPointAdd,
  onManualSpeakerPointRemoveLast,
  onManualSpeakerPointTargetChange,
  manualSpeakerFixedType
}: {
  profile: ClassroomProfile;
  generatedPoints: GeneratedPoint[];
  micOnly: boolean;
  onCentralAirConditionerPointChange?: (position: Point, index: number) => void;
  onCentralAirConditionerCountChange?: (count: number) => void;
  onLegacySpeakerPointAdd?: (input: { position: Point; type: LegacySpeakerType; wallAdjustability: LegacyWallAdjustability }) => void;
  onLegacySpeakerPointRemoveLast?: () => void;
  onLegacySpeakerPointTargetChange?: (index: number, target: Point) => void;
  manualArrayMicPoints?: Point[];
  onManualArrayMicPointAdd?: (position: Point) => void;
  onManualArrayMicPointRemoveLast?: () => void;
  manualSpeakerPoints?: LegacySpeakerPoint[];
  onManualSpeakerPointAdd?: (input: { position: Point; type: LegacySpeakerType; wallAdjustability: LegacyWallAdjustability }) => void;
  onManualSpeakerPointRemoveLast?: () => void;
  onManualSpeakerPointTargetChange?: (index: number, target: Point) => void;
  manualSpeakerFixedType?: LegacySpeakerType;
}) {
  const [addingCentralAir, setAddingCentralAir] = useState(false);
  const [addingLegacySpeaker, setAddingLegacySpeaker] = useState(false);
  const [addingManualArrayMic, setAddingManualArrayMic] = useState(false);
  const [addingManualSpeaker, setAddingManualSpeaker] = useState(false);
  const [aimingLegacySpeaker, setAimingLegacySpeaker] = useState(false);
  const [aimingManualSpeaker, setAimingManualSpeaker] = useState(false);
  const [legacySpeakerType, setLegacySpeakerType] = useState<LegacySpeakerType>("ceiling");
  const [legacyWallAdjustability, setLegacyWallAdjustability] = useState<LegacyWallAdjustability>("universal");
  const [manualSpeakerType, setManualSpeakerType] = useState<LegacySpeakerType>(manualSpeakerFixedType ?? "ceiling");
  const [manualSpeakerWallAdjustability, setManualSpeakerWallAdjustability] = useState<LegacyWallAdjustability>("universal");
  const width = 980;
  const height = getInstallationCanvasHeight(profile, width);
  const hasLineArray = generatedPoints.some((point) => point.pickupKind === "lineArray");
  const room = getCanvasRoomLayout(profile, width, height);
  const arrayMicCanvasPoints = generatedPoints
    .filter((point) => point.type === "arrayMic")
    .map((point) => toCanvasPoint(point.position, profile, width, height));
  const legacySpeakerPoints = micOnly ? [] : (profile.existingDevices.legacySpeakerPoints ?? []);
  const existingLegacyWallAdjustability = legacySpeakerPoints.find((point) => point.type === "wall")?.wallAdjustability;
  const lockedLegacyWallAdjustability = existingLegacyWallAdjustability === "universal" || existingLegacyWallAdjustability === "fixed" ? existingLegacyWallAdjustability : undefined;
  const existingManualWallAdjustability = manualSpeakerPoints.find((point) => point.type === "wall")?.wallAdjustability;
  const lockedManualWallAdjustability = existingManualWallAdjustability === "universal" || existingManualWallAdjustability === "fixed" ? existingManualWallAdjustability : undefined;
  const centralAirPoints = profile.engineeringConstraints.centralAirConditionerPoints ?? [];
  const hasCentralAirConditioner = profile.engineeringConstraints.hasCentralAirConditioner;
  const canMarkCentralAir = (hasCentralAirConditioner || centralAirPoints.length > 0) && Boolean(onCentralAirConditionerPointChange);
  const hasLegacySoundSystem = profile.existingDevices.legacySoundSystem.trim().length > 0;
  const canMarkLegacySpeaker = !micOnly && (hasLegacySoundSystem || legacySpeakerPoints.length > 0) && Boolean(onLegacySpeakerPointAdd);
  const canMarkManualArrayMic = Boolean(onManualArrayMicPointAdd);
  const canMarkManualSpeaker = Boolean(onManualSpeakerPointAdd);
  const lastLegacyWallSpeakerIndex = findLastWallSpeakerIndex(legacySpeakerPoints);
  const lastManualWallSpeakerIndex = findLastWallSpeakerIndex(manualSpeakerPoints);
  const canAimLegacySpeaker =
    Boolean(onLegacySpeakerPointTargetChange) &&
    lastLegacyWallSpeakerIndex >= 0 &&
    legacySpeakerPoints[lastLegacyWallSpeakerIndex]?.wallAdjustability !== "fixed";
  const canAimManualSpeaker = Boolean(onManualSpeakerPointTargetChange) && lastManualWallSpeakerIndex >= 0;
  const dimGeneratedSpeakers = addingManualSpeaker || manualSpeakerPoints.length > 0;
  const visibleGeneratedPoints = generatedPoints;
  const visibleSpeakerGroups = getSpeakerGroups(visibleGeneratedPoints);
  const visibleMergedSpeakerLabelIds = getMergedSpeakerLabelIds(visibleGeneratedPoints, visibleSpeakerGroups);
  const visiblePointBodyObstacles = getGeneratedPointBodyObstacles(profile, visibleGeneratedPoints, width, height);
  const visiblePointLabelLayouts = getGeneratedPointLabelLayouts(profile, visibleGeneratedPoints, visibleSpeakerGroups, width, height, visibleMergedSpeakerLabelIds, visiblePointBodyObstacles);
  const visiblePointLabelObstacles = getPointLabelLayoutObstacles(visiblePointLabelLayouts);
  const installationViewBox = getInstallationVisibleFrame({
    profile,
    width,
    height,
    room,
    generatedPoints: visibleGeneratedPoints,
    generatedPointLabelLayouts: visiblePointLabelLayouts,
    hiddenGeneratedLabelIds: visibleMergedSpeakerLabelIds.hiddenIds,
    arrayMicCanvasPoints,
    centralAirPoints,
    legacySpeakerPoints,
    manualArrayMicPoints,
    manualSpeakerPoints,
    micOnly
  });
  const titleX = installationViewBox.x + installationViewBox.width / 2;
  const footerX = titleX;

  const handleCanvasClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!addingCentralAir && !addingLegacySpeaker && !addingManualArrayMic && !addingManualSpeaker && !aimingLegacySpeaker && !aimingManualSpeaker) return;
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = installationViewBox.x + ((event.clientX - rect.left) / rect.width) * installationViewBox.width;
    const y = installationViewBox.y + ((event.clientY - rect.top) / rect.height) * installationViewBox.height;
    if (x < room.x || x > room.x + room.width || y < room.y || y > room.y + room.height) return;
    const roomPosition = getRoomPositionFromCanvas(x, y, profile, room);
    if (aimingLegacySpeaker && onLegacySpeakerPointTargetChange) {
      if (lastLegacyWallSpeakerIndex >= 0) {
        const speakerPoint = legacySpeakerPoints[lastLegacyWallSpeakerIndex];
        onLegacySpeakerPointTargetChange(
          lastLegacyWallSpeakerIndex,
          clampWallSpeakerTargetToMountingAngle(speakerPoint.position, roomPosition, profile)
        );
      }
      setAimingLegacySpeaker(false);
      return;
    }
    if (aimingManualSpeaker && onManualSpeakerPointTargetChange) {
      if (lastManualWallSpeakerIndex >= 0) {
        const speakerPoint = manualSpeakerPoints[lastManualWallSpeakerIndex];
        onManualSpeakerPointTargetChange(
          lastManualWallSpeakerIndex,
          clampWallSpeakerTargetToMountingAngle(speakerPoint.position, roomPosition, profile)
        );
      }
      setAimingManualSpeaker(false);
      return;
    }
    if (addingCentralAir && onCentralAirConditionerPointChange) {
      onCentralAirConditionerPointChange(roomPosition, centralAirPoints.length);
      setAddingCentralAir(false);
      return;
    }
    if (addingManualArrayMic && onManualArrayMicPointAdd) {
      onManualArrayMicPointAdd(roomPosition);
      setAddingManualArrayMic(false);
      return;
    }
    if (addingManualSpeaker && onManualSpeakerPointAdd) {
      const position =
        manualSpeakerType === "wall"
          ? snapLegacyWallSpeakerPosition(x, y, profile, room, manualSpeakerPoints)
          : snapLegacyCeilingSpeakerPosition(roomPosition, profile, manualSpeakerPoints);
      if (!position) return;
      onManualSpeakerPointAdd({
        position,
        type: manualSpeakerType,
        wallAdjustability: manualSpeakerType === "wall" ? lockedManualWallAdjustability ?? manualSpeakerWallAdjustability : "unknown"
      });
      setAddingManualSpeaker(false);
      return;
    }
    if (addingLegacySpeaker && onLegacySpeakerPointAdd) {
      const position =
        legacySpeakerType === "wall"
          ? snapLegacyWallSpeakerPosition(x, y, profile, room, legacySpeakerPoints)
          : snapLegacyCeilingSpeakerPosition(roomPosition, profile, legacySpeakerPoints);
      if (!position) return;
      onLegacySpeakerPointAdd({
        position,
        type: legacySpeakerType,
        wallAdjustability: legacySpeakerType === "wall" ? lockedLegacyWallAdjustability ?? legacyWallAdjustability : "unknown"
      });
      setAddingLegacySpeaker(false);
    }
  };

  const adjustCentralAirCount = (delta: number) => {
    if (!onCentralAirConditionerCountChange) return;
    const nextCount = Math.max(0, Math.min(8, centralAirPoints.length + delta));
    onCentralAirConditionerCountChange(nextCount);
    if (delta < 0) setAddingCentralAir(false);
  };

  const removeLastLegacySpeakerPoint = () => {
    onLegacySpeakerPointRemoveLast?.();
    setAddingLegacySpeaker(false);
    setAimingLegacySpeaker(false);
  };

  const removeLastManualArrayMicPoint = () => {
    onManualArrayMicPointRemoveLast?.();
    setAddingManualArrayMic(false);
  };

  const removeLastManualSpeakerPoint = () => {
    onManualSpeakerPointRemoveLast?.();
    setAddingManualSpeaker(false);
    setAimingManualSpeaker(false);
  };

  return (
    <div className="canvasFrame">
      {canMarkCentralAir && (
        <div className="canvasToolBar">
          <span>中央空调 {centralAirPoints.length} 台</span>
          {onCentralAirConditionerCountChange && (
            <>
              <button type="button" onClick={() => adjustCentralAirCount(-1)} disabled={centralAirPoints.length <= 0}>
                -
              </button>
              <button
                type="button"
                className={addingCentralAir ? "active" : ""}
                onClick={() => {
                  setAddingCentralAir((value) => !value);
                  setAddingLegacySpeaker(false);
                  setAddingManualArrayMic(false);
                  setAddingManualSpeaker(false);
                  setAimingLegacySpeaker(false);
                  setAimingManualSpeaker(false);
                }}
                disabled={!hasCentralAirConditioner || centralAirPoints.length >= 8}
              >
                +
              </button>
            </>
          )}
          <span>
            {!hasCentralAirConditioner && centralAirPoints.length
              ? "未选择有中央空调，可用 - 删除残留点位"
              : addingCentralAir
                ? "请在图上点击新增中央空调中心"
                : centralAirPoints.length
                  ? "中央空调距离会影响阵麦语音还原度"
                  : "点击 + 后在图上标注位置"}
          </span>
        </div>
      )}
      {canMarkLegacySpeaker && (
        <div className="canvasToolBar legacySpeakerToolBar">
          <span>利旧音箱 {legacySpeakerPoints.length} 只</span>
          <div className="compactToggleGroup">
            <button type="button" className={legacySpeakerType === "ceiling" ? "active" : ""} onClick={() => setLegacySpeakerType("ceiling")}>
              吸顶
            </button>
            <button type="button" className={legacySpeakerType === "wall" ? "active" : ""} onClick={() => setLegacySpeakerType("wall")}>
              壁挂
            </button>
          </div>
          <div className="compactToggleGroup">
            <button
              type="button"
              className={(lockedLegacyWallAdjustability ?? legacyWallAdjustability) === "universal" ? "active" : ""}
              onClick={() => setLegacyWallAdjustability("universal")}
              disabled={legacySpeakerType !== "wall" || Boolean(lockedLegacyWallAdjustability)}
            >
              万向
            </button>
            <button
              type="button"
              className={(lockedLegacyWallAdjustability ?? legacyWallAdjustability) === "fixed" ? "active" : ""}
              onClick={() => setLegacyWallAdjustability("fixed")}
              disabled={legacySpeakerType !== "wall" || Boolean(lockedLegacyWallAdjustability)}
            >
              固定
            </button>
          </div>
          <button type="button" onClick={removeLastLegacySpeakerPoint} disabled={!legacySpeakerPoints.length}>
            -
          </button>
          <button
            type="button"
            className={addingLegacySpeaker ? "active" : ""}
            onClick={() => {
              setAddingLegacySpeaker((value) => !value);
              setAddingCentralAir(false);
              setAddingManualArrayMic(false);
              setAddingManualSpeaker(false);
              setAimingLegacySpeaker(false);
              setAimingManualSpeaker(false);
            }}
            disabled={!hasLegacySoundSystem}
          >
            +
          </button>
          <button
            type="button"
            className={aimingLegacySpeaker ? "active" : ""}
            onClick={() => {
              setAimingLegacySpeaker((value) => !value);
              setAddingCentralAir(false);
              setAddingLegacySpeaker(false);
              setAddingManualArrayMic(false);
              setAddingManualSpeaker(false);
              setAimingManualSpeaker(false);
            }}
            disabled={!canAimLegacySpeaker}
          >
            方向
          </button>
          <span>
            {!hasLegacySoundSystem && legacySpeakerPoints.length
              ? "未选择原有音频系统，可用 - 删除残留利旧点位"
              : addingLegacySpeaker
              ? legacySpeakerType === "wall"
                ? "请点墙边，离墙太远不会新增"
                : "请点吸顶音箱中心"
              : aimingLegacySpeaker
                ? "请点击该壁挂音箱的指向位置"
              : lockedLegacyWallAdjustability
                ? `壁挂统一为${lockedLegacyWallAdjustability === "universal" ? "万向" : "固定"}`
                : legacySpeakerPoints.length
                  ? "可混合标注吸顶和壁挂"
                  : "选择类型后点 + 标注"}
          </span>
        </div>
      )}
      {canMarkManualArrayMic && (
        <div className="canvasToolBar manualArrayMicToolBar">
          <span>人工阵麦 {manualArrayMicPoints.length} 个</span>
          <button type="button" onClick={removeLastManualArrayMicPoint} disabled={!manualArrayMicPoints.length}>
            -
          </button>
          <button
            type="button"
            className={addingManualArrayMic ? "active" : ""}
            onClick={() => {
              setAddingManualArrayMic((value) => !value);
              setAddingCentralAir(false);
              setAddingLegacySpeaker(false);
              setAddingManualSpeaker(false);
              setAimingLegacySpeaker(false);
              setAimingManualSpeaker(false);
            }}
          >
            +
          </button>
          <span>{addingManualArrayMic ? "请点击你认为正确的阵麦中心" : "用于校准，不改系统推荐"}</span>
        </div>
      )}
      {canMarkManualSpeaker && (
        <div className="canvasToolBar manualSpeakerToolBar">
          <span>人工音箱 {manualSpeakerPoints.length} 只</span>
          <div className="compactToggleGroup">
            <button
              type="button"
              className={manualSpeakerType === "ceiling" ? "active" : ""}
              onClick={() => setManualSpeakerType("ceiling")}
            >
              吸顶
            </button>
            <button
              type="button"
              className={manualSpeakerType === "wall" ? "active" : ""}
              onClick={() => setManualSpeakerType("wall")}
            >
              壁挂
            </button>
          </div>
          <div className="compactToggleGroup">
            <button
              type="button"
              className={(lockedManualWallAdjustability ?? manualSpeakerWallAdjustability) === "universal" ? "active" : ""}
              onClick={() => setManualSpeakerWallAdjustability("universal")}
              disabled={manualSpeakerType !== "wall" || Boolean(lockedManualWallAdjustability)}
            >
              万向
            </button>
            <button
              type="button"
              className={(lockedManualWallAdjustability ?? manualSpeakerWallAdjustability) === "fixed" ? "active" : ""}
              onClick={() => setManualSpeakerWallAdjustability("fixed")}
              disabled={manualSpeakerType !== "wall" || Boolean(lockedManualWallAdjustability)}
            >
              固定
            </button>
          </div>
          <button type="button" onClick={removeLastManualSpeakerPoint} disabled={!manualSpeakerPoints.length}>
            -
          </button>
          <button
            type="button"
            className={addingManualSpeaker ? "active" : ""}
            onClick={() => {
              setAddingManualSpeaker((value) => !value);
              setAddingCentralAir(false);
              setAddingLegacySpeaker(false);
              setAddingManualArrayMic(false);
              setAimingLegacySpeaker(false);
              setAimingManualSpeaker(false);
            }}
          >
            +
          </button>
          <button
            type="button"
            className={aimingManualSpeaker ? "active" : ""}
            onClick={() => {
              setAimingManualSpeaker((value) => !value);
              setAddingCentralAir(false);
              setAddingLegacySpeaker(false);
              setAddingManualArrayMic(false);
              setAddingManualSpeaker(false);
              setAimingLegacySpeaker(false);
            }}
            disabled={!canAimManualSpeaker}
          >
            方向
          </button>
          <span>
            {addingManualSpeaker
              ? manualSpeakerType === "wall"
                ? "点墙边标注，离墙太远不会新增"
                : "点吸顶音箱中心"
              : lockedManualWallAdjustability
                ? `壁挂统一${lockedManualWallAdjustability === "universal" ? "万向" : "固定"}`
                : "人工校准用，不改系统推荐"}
          </span>
        </div>
      )}
      <svg
        viewBox={`${installationViewBox.x} ${installationViewBox.y} ${installationViewBox.width} ${installationViewBox.height}`}
        className={addingCentralAir || addingLegacySpeaker || addingManualArrayMic || addingManualSpeaker || aimingLegacySpeaker || aimingManualSpeaker ? "engineeringCanvas cadCanvas installationCanvas markingCanvas" : "engineeringCanvas cadCanvas installationCanvas"}
        style={{ aspectRatio: `${installationViewBox.width} / ${installationViewBox.height}` }}
        role="img"
        aria-label={micOnly ? `${getAppBrand().id === "yinman" ? "音曼" : "音翼"}${hasLineArray ? "线阵麦" : "阵列麦"}点位图` : `${getAppBrand().id === "yinman" ? "音曼" : "音翼"}${hasLineArray ? "线阵麦" : "阵列麦"}与音箱点位图`}
        onClick={handleCanvasClick}
      >
        <defs>
          <radialGradient id="arrayMicCoverageGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00a6a6" stopOpacity="0.14" />
            <stop offset="70%" stopColor="#00a6a6" stopOpacity="0.055" />
            <stop offset="100%" stopColor="#00a6a6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="speakerCoverageGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
            <stop offset="28%" stopColor="#f59e0b" stopOpacity="0.16" />
            <stop offset="64%" stopColor="#f59e0b" stopOpacity="0.065" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="wallSpeakerCoverageGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="24%" stopColor="#f59e0b" stopOpacity="0.18" />
            <stop offset="58%" stopColor="#f59e0b" stopOpacity="0.075" />
            <stop offset="86%" stopColor="#f59e0b" stopOpacity="0.025" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
          <filter id="arrayMicCoverageBlur" x="-8%" y="-8%" width="116%" height="116%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
          <filter id="speakerCoverageBlur" x="-8%" y="-8%" width="116%" height="116%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
        </defs>
        <rect x={installationViewBox.x} y={installationViewBox.y} width={installationViewBox.width} height={installationViewBox.height} fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
        <rect x={room.x} y={room.y} width={room.width} height={room.height} fill="#ffffff" stroke="#111827" strokeWidth="0.9" />
        <text x={titleX} y={installationViewBox.y + 38} textAnchor="middle" className="cadTitle">
          {micOnly ? `${hasLineArray ? "线阵麦" : "阵列麦"}点位图` : `${hasLineArray ? "线阵麦" : "阵列麦"}与音箱点位图`}
        </text>
        <line x1={room.x} y1={room.y} x2={room.x + room.width} y2={room.y} stroke="#111827" strokeWidth="0.8" strokeDasharray="5 4" />
        {!isMeetingScenario(profile.scenario) && <PodiumMarker profile={profile} width={width} height={height} />}
        <LectureAudienceStepMarker profile={profile} generatedPoints={visibleGeneratedPoints} width={width} height={height} />
        <text x={footerX} y={installationViewBox.y + installationViewBox.height - 18} textAnchor="middle" className="cadSmall">
          房间 宽 {profile.roomGeometry.width}m x 长 {profile.roomGeometry.length}m
        </text>
        <DistanceAnnotations profile={profile} generatedPoints={visibleGeneratedPoints} width={width} height={height} />
        {centralAirPoints.map((point) => (
          <CentralAirConditionerMarker key={point.id} point={point} profile={profile} width={width} height={height} labelObstacles={[...visiblePointBodyObstacles, ...visiblePointLabelObstacles]} />
        ))}

        {visibleGeneratedPoints.map((point) => (
          <GeneratedPointMarker
            key={point.id}
            point={point}
            profile={profile}
            width={width}
            height={height}
            arrayMicCanvasPoints={arrayMicCanvasPoints}
            groupLabel={visibleSpeakerGroups.get(point.id)}
            extraLabelLine={visibleMergedSpeakerLabelIds.primaryId === point.id ? "其他同理" : undefined}
            hideLabel={visibleMergedSpeakerLabelIds.hiddenIds.has(point.id)}
            labelPlacement={visiblePointLabelLayouts.get(point.id)}
            muted={dimGeneratedSpeakers && point.type === "speaker"}
          />
        ))}
        {legacySpeakerPoints.map((point) => (
          <LegacySpeakerMarker key={point.id} point={point} profile={profile} width={width} height={height} arrayMicCanvasPoints={arrayMicCanvasPoints} />
        ))}
        {manualArrayMicPoints.map((point, index) => (
          <ManualArrayMicMarker key={`manual-array-mic-${index}`} point={point} index={index} profile={profile} width={width} height={height} />
        ))}
        {manualSpeakerPoints.map((point, index) => (
          <ManualSpeakerMarker
            key={point.id || `manual-speaker-${index}`}
            point={point}
            profile={profile}
            width={width}
            height={height}
            arrayMicCanvasPoints={arrayMicCanvasPoints}
          />
        ))}
      </svg>
      <Legend micOnly={micOnly} hasManualArrayMic={manualArrayMicPoints.length > 0} hasLineArray={hasLineArray} />
    </div>
  );
}

function ManualSpeakerMarker({
  point,
  profile,
  width,
  height,
  arrayMicCanvasPoints
}: {
  point: LegacySpeakerPoint;
  profile: ClassroomProfile;
  width: number;
  height: number;
  arrayMicCanvasPoints: Array<{ x: number; y: number }>;
}) {
  const canvasPoint = toCanvasPoint(point.position, profile, width, height);
  const meterPx = getMeterPixels(profile, width, height);
  const diameter = visualSize(0.102 * meterPx * 2, 20, 36);
  const ceilingCoverageRadius = CEILING_SPEAKER_IDEAL_COVERAGE_RADIUS_M * meterPx;
  const wallCoverageLength = 3.5 * meterPx;
  const manualTarget = point.target ? toCanvasPoint(point.target, profile, width, height) : undefined;
  const wallTarget =
    point.type === "wall" && manualTarget
      ? clampWallSpeakerTargetCanvasToMountingAngle(canvasPoint, manualTarget, profile, width, height)
    : point.type === "wall" && point.wallAdjustability === "universal"
      ? clampWallSpeakerTargetCanvasToMountingAngle(canvasPoint, getWallSpeakerTarget(canvasPoint, arrayMicCanvasPoints, width, height, wallCoverageLength), profile, width, height)
      : clampWallSpeakerTargetCanvasToMountingAngle(canvasPoint, getFixedLegacyWallSpeakerTarget(canvasPoint, profile, width, height), profile, width, height);
  const labelLines = [
    point.type === "ceiling" ? "人工吸顶" : "人工壁挂",
    point.type === "wall" ? getLegacyWallAdjustText(point.wallAdjustability) : "",
    point.type === "wall" ? `水平角度 ${getWallSpeakerMountingAngle(canvasPoint, wallTarget, profile, width, height)}°` : "",
    `距前墙 ${point.position.y.toFixed(1)}m`
  ].filter(Boolean);
  const labelWidth = point.type === "wall" ? 104 : 78;
  const labelHeight = 12 + labelLines.length * 12;
  const x = clampNumber(canvasPoint.x + 14, 34, width - labelWidth - 28);
  const y = clampNumber(canvasPoint.y - labelHeight - 12, 58, height - labelHeight - 44);

  return (
    <g>
      {point.type === "ceiling" ? (
        <>
          <circle cx={canvasPoint.x} cy={canvasPoint.y} r={ceilingCoverageRadius} fill="url(#speakerCoverageGradient)" filter="url(#speakerCoverageBlur)" opacity="0.54" />
          <circle cx={canvasPoint.x} cy={canvasPoint.y} r={ceilingCoverageRadius} fill="none" stroke="#c026d3" strokeWidth="0.75" strokeDasharray="5 4" opacity="0.58" />
          <CeilingSpeakerSymbol x={canvasPoint.x} y={canvasPoint.y} diameter={diameter} color="#c026d3" />
        </>
      ) : (
        <WallSpeakerSymbol x={canvasPoint.x} y={canvasPoint.y} targetX={wallTarget.x} targetY={wallTarget.y} coverageLength={wallCoverageLength} color="#c026d3" />
      )}
      <line x1={canvasPoint.x} y1={canvasPoint.y} x2={x} y2={y + 10} stroke="#d946ef" strokeWidth="0.55" />
      <rect x={x} y={y} width={labelWidth} height={labelHeight} rx="4" fill="#ffffff" stroke="#c026d3" strokeWidth="0.7" opacity="0.96" />
      {labelLines.map((line, index) => (
        <text key={`${point.id}-${index}`} x={x + 7} y={y + 16 + index * 12} className="cadTiny" fill={index === 0 ? "#a21caf" : "#64748b"}>
          {line}
        </text>
      ))}
    </g>
  );
}

function CentralAirConditionerMarker({
  point,
  profile,
  width,
  height,
  labelObstacles = []
}: {
  point: NonNullable<ClassroomProfile["engineeringConstraints"]["centralAirConditionerPoints"]>[number];
  profile: ClassroomProfile;
  width: number;
  height: number;
  labelObstacles?: LabelObstacle[];
}) {
  const canvasPoint = toCanvasPoint(point.position, profile, width, height);
  const meterPx = getMeterPixels(profile, width, height);
  const requiredClearanceM = getArrayMicCentralAirRequiredClearance(profile);
  const bodyWidth = Math.max(18, point.size.width * meterPx);
  const bodyHeight = Math.max(12, point.size.depth * meterPx);
  const riskX = canvasPoint.x - bodyWidth / 2 - ARRAY_MIC_CENTRAL_AIR_RISK_CLEARANCE_M * meterPx;
  const riskY = canvasPoint.y - bodyHeight / 2 - ARRAY_MIC_CENTRAL_AIR_RISK_CLEARANCE_M * meterPx;
  const riskWidth = bodyWidth + ARRAY_MIC_CENTRAL_AIR_RISK_CLEARANCE_M * meterPx * 2;
  const riskHeight = bodyHeight + ARRAY_MIC_CENTRAL_AIR_RISK_CLEARANCE_M * meterPx * 2;
  const forbiddenX = canvasPoint.x - bodyWidth / 2 - requiredClearanceM * meterPx;
  const forbiddenY = canvasPoint.y - bodyHeight / 2 - requiredClearanceM * meterPx;
  const forbiddenWidth = bodyWidth + requiredClearanceM * meterPx * 2;
  const forbiddenHeight = bodyHeight + requiredClearanceM * meterPx * 2;
  const labelWidth = 126;
  const labelHeight = 47;
  const ownBodyObstacle = {
    x: canvasPoint.x - bodyWidth / 2 - 4,
    y: canvasPoint.y - bodyHeight / 2 - 4,
    width: bodyWidth + 8,
    height: bodyHeight + 8
  };
  const labelPlacement = pickBestAuxiliaryLabelPlacement(
    [
      { x: canvasPoint.x + 16, y: canvasPoint.y - labelHeight - 16, side: "right" as const },
      { x: canvasPoint.x + 16, y: canvasPoint.y + 16, side: "right" as const },
      { x: canvasPoint.x - labelWidth - 16, y: canvasPoint.y - labelHeight - 16, side: "left" as const },
      { x: canvasPoint.x - labelWidth - 16, y: canvasPoint.y + 16, side: "left" as const }
    ],
    profile,
    canvasPoint,
    width,
    height,
    labelWidth,
    labelHeight,
    [ownBodyObstacle, ...labelObstacles]
  );
  const labelX = labelPlacement.x;
  const labelY = labelPlacement.y;

  return (
    <g>
      <rect x={riskX} y={riskY} width={riskWidth} height={riskHeight} rx="8" fill="#fff7ed" stroke="#f59e0b" strokeWidth="0.7" strokeDasharray="6 5" opacity="0.42" />
      <rect x={forbiddenX} y={forbiddenY} width={forbiddenWidth} height={forbiddenHeight} rx="6" fill="#fef2f2" stroke="#ef4444" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.7" />
      <rect x={canvasPoint.x - bodyWidth / 2} y={canvasPoint.y - bodyHeight / 2} width={bodyWidth} height={bodyHeight} rx="3" fill="#ffffff" stroke="#2563eb" strokeWidth="1.2" />
      <line x1={canvasPoint.x - bodyWidth * 0.38} y1={canvasPoint.y} x2={canvasPoint.x + bodyWidth * 0.38} y2={canvasPoint.y} stroke="#2563eb" strokeWidth="0.8" />
      <line x1={canvasPoint.x} y1={canvasPoint.y - bodyHeight * 0.36} x2={canvasPoint.x} y2={canvasPoint.y + bodyHeight * 0.36} stroke="#2563eb" strokeWidth="0.8" />
      <circle cx={canvasPoint.x} cy={canvasPoint.y} r="2.5" fill="#2563eb" />
      <line x1={canvasPoint.x} y1={canvasPoint.y} x2={labelX} y2={labelY + 12} stroke="#94a3b8" strokeWidth="0.55" />
      <rect x={labelX} y={labelY} width={labelWidth} height={labelHeight} rx="4" fill="#ffffff" stroke="#2563eb" strokeWidth="0.75" opacity="0.96" />
      <text x={labelX + 7} y={labelY + 14} className="cadTiny" fill="#1d4ed8" fontWeight="850">
        中央空调
      </text>
      <text x={labelX + 7} y={labelY + 27} className="cadTiny" fill="#ef4444">
        安全距 {requiredClearanceM.toFixed(1)}m
      </text>
      <text x={labelX + 7} y={labelY + 40} className="cadTiny" fill="#b45309">
        一米内会降低语音还原度
      </text>
    </g>
  );
}

function ManualArrayMicMarker({
  point,
  index,
  profile,
  width,
  height
}: {
  point: Point;
  index: number;
  profile: ClassroomProfile;
  width: number;
  height: number;
}) {
  const canvasPoint = toCanvasPoint(point, profile, width, height);
  const meterPx = getMeterPixels(profile, width, height);
  const size = visualSize(0.6 * meterPx, 24, 42);
  const labelWidth = 80;
  const labelHeight = 28;
  const labelX = clampNumber(canvasPoint.x + 14, 34, width - labelWidth - 28);
  const labelY = clampNumber(canvasPoint.y - labelHeight - 14, 58, height - labelHeight - 44);
  return (
    <g>
      <rect x={canvasPoint.x - size / 2} y={canvasPoint.y - size / 2} width={size} height={size} fill="#ffffff" stroke="#7c3aed" strokeWidth="2" strokeDasharray="5 3" />
      <line x1={canvasPoint.x - size / 2} y1={canvasPoint.y - size / 2} x2={canvasPoint.x + size / 2} y2={canvasPoint.y + size / 2} stroke="#7c3aed" strokeWidth="1.1" />
      <line x1={canvasPoint.x + size / 2} y1={canvasPoint.y - size / 2} x2={canvasPoint.x - size / 2} y2={canvasPoint.y + size / 2} stroke="#7c3aed" strokeWidth="1.1" />
      <ArrayMicDirectionDot x={canvasPoint.x} y={canvasPoint.y - size / 2 + 4.8} />
      <line x1={canvasPoint.x} y1={canvasPoint.y} x2={labelX} y2={labelY + 10} stroke="#a78bfa" strokeWidth="0.55" />
      <rect x={labelX} y={labelY} width={labelWidth} height={labelHeight} rx="4" fill="#ffffff" fillOpacity="0.72" stroke="#7c3aed" strokeWidth="0.7" strokeDasharray="4 3" />
      <text x={labelX + 7} y={labelY + 16} className="cadTiny" fill="#6d28d9">
        人工阵麦{index + 1}
      </text>
    </g>
  );
}

function ArrayMicDirectionDot({ x, y }: { x: number; y: number }) {
  return <line x1={x} y1={y - 2.2} x2={x} y2={y + 2.2} stroke="#111111" strokeWidth="2.8" strokeLinecap="round" />;
}

function LegacySpeakerMarker({
  point,
  profile,
  width,
  height,
  arrayMicCanvasPoints
}: {
  point: NonNullable<ClassroomProfile["existingDevices"]["legacySpeakerPoints"]>[number];
  profile: ClassroomProfile;
  width: number;
  height: number;
  arrayMicCanvasPoints: Array<{ x: number; y: number }>;
}) {
  const canvasPoint = toCanvasPoint(point.position, profile, width, height);
  const meterPx = getMeterPixels(profile, width, height);
  const diameter = visualSize(0.102 * meterPx * 2, 20, 36);
  const ceilingCoverageRadius = LEGACY_CEILING_SPEAKER_COVERAGE_RADIUS_M * meterPx;
  const wallCoverageLength = 3.5 * meterPx;
  const manualTarget = point.target ? toCanvasPoint(point.target, profile, width, height) : undefined;
  const wallTarget =
    point.type === "wall" && manualTarget
      ? clampWallSpeakerTargetCanvasToMountingAngle(canvasPoint, manualTarget, profile, width, height)
      : point.type === "wall" && point.wallAdjustability === "universal"
      ? clampWallSpeakerTargetCanvasToMountingAngle(canvasPoint, getWallSpeakerTarget(canvasPoint, arrayMicCanvasPoints, width, height, wallCoverageLength), profile, width, height)
      : clampWallSpeakerTargetCanvasToMountingAngle(canvasPoint, getFixedLegacyWallSpeakerTarget(canvasPoint, profile, width, height), profile, width, height);
  const labelLines = [
    point.type === "ceiling" ? "利旧吸顶" : "利旧壁挂",
    point.type === "wall" ? getLegacyWallAdjustText(point.wallAdjustability) : "",
    point.type === "wall" ? `水平角度 ${getWallSpeakerMountingAngle(canvasPoint, wallTarget, profile, width, height)}°` : "",
    `距前墙 ${point.position.y.toFixed(1)}m`
  ].filter(Boolean);
  const labelWidth = point.type === "wall" ? 104 : 78;
  const labelHeight = 12 + labelLines.length * 12;
  const x = clampNumber(canvasPoint.x + 14, 34, width - labelWidth - 28);
  const y = clampNumber(canvasPoint.y - labelHeight - 12, 58, height - labelHeight - 44);

  return (
    <g>
      {point.type === "ceiling" ? (
        <>
          <circle
            cx={canvasPoint.x}
            cy={canvasPoint.y}
            r={ceilingCoverageRadius}
            fill="url(#speakerCoverageGradient)"
            filter="url(#speakerCoverageBlur)"
            opacity="0.74"
          />
          <circle
            cx={canvasPoint.x}
            cy={canvasPoint.y}
            r={ceilingCoverageRadius}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="0.6"
            strokeDasharray="5 4"
            opacity="0.38"
          />
          <CeilingSpeakerSymbol x={canvasPoint.x} y={canvasPoint.y} diameter={diameter} color="#64748b" />
        </>
      ) : (
        <WallSpeakerSymbol
          x={canvasPoint.x}
          y={canvasPoint.y}
          targetX={wallTarget.x}
          targetY={wallTarget.y}
          coverageLength={wallCoverageLength}
          color="#64748b"
        />
      )}
      <line x1={canvasPoint.x} y1={canvasPoint.y} x2={x} y2={y + 10} stroke="#94a3b8" strokeWidth="0.55" />
      <rect x={x} y={y} width={labelWidth} height={labelHeight} rx="4" fill="#ffffff" stroke="#64748b" strokeWidth="0.7" opacity="0.96" />
      {labelLines.map((line, index) => (
        <text key={`${point.id}-${index}`} x={x + 7} y={y + 16 + index * 12} className="cadTiny" fill={index === 0 ? "#475569" : "#64748b"}>
          {line}
        </text>
      ))}
    </g>
  );
}

function getLegacyWallAdjustText(value: ClassroomProfile["existingDevices"]["legacySpeakerPoints"][number]["wallAdjustability"]) {
  if (value === "universal") return "万向支架";
  if (value === "fixed") return "固定角度";
  return "调节待确认";
}

function getFixedLegacyWallSpeakerTarget(
  speaker: { x: number; y: number },
  profile: ClassroomProfile,
  width: number,
  height: number
) {
  const room = getCanvasRoomLayout(profile, width, height);
  const distances = [
    { side: "left" as const, value: Math.abs(speaker.x - room.x) },
    { side: "right" as const, value: Math.abs(speaker.x - (room.x + room.width)) },
    { side: "front" as const, value: Math.abs(speaker.y - room.y) },
    { side: "back" as const, value: Math.abs(speaker.y - (room.y + room.height)) }
  ].sort((a, b) => a.value - b.value);
  const nearestSide = distances[0]?.side ?? "left";
  if (nearestSide === "left") return { x: speaker.x + room.width * 0.35, y: speaker.y };
  if (nearestSide === "right") return { x: speaker.x - room.width * 0.35, y: speaker.y };
  if (nearestSide === "front") return { x: speaker.x, y: speaker.y + room.height * 0.35 };
  return { x: speaker.x, y: speaker.y - room.height * 0.35 };
}

function getRoomPositionFromCanvas(
  x: number,
  y: number,
  profile: ClassroomProfile,
  room: ReturnType<typeof getCanvasRoomLayout>
) {
  return {
    x: oneDecimal(((x - room.x) / room.width) * profile.roomGeometry.width),
    y: oneDecimal(((y - room.y) / room.height) * profile.roomGeometry.length)
  };
}

function snapLegacyWallSpeakerPosition(
  x: number,
  y: number,
  profile: ClassroomProfile,
  room: ReturnType<typeof getCanvasRoomLayout>,
  legacySpeakerPoints: ClassroomProfile["existingDevices"]["legacySpeakerPoints"]
): Point | null {
  const distances = [
    { side: "left" as const, value: Math.abs(x - room.x) },
    { side: "right" as const, value: Math.abs(x - (room.x + room.width)) },
    { side: "front" as const, value: Math.abs(y - room.y) },
    { side: "back" as const, value: Math.abs(y - (room.y + room.height)) }
  ].sort((a, b) => a.value - b.value);
  const wallSnapTolerance = Math.max(12, room.meterPx * 0.45);
  if ((distances[0]?.value ?? Number.POSITIVE_INFINITY) > wallSnapTolerance) return null;
  const side = distances[0]?.side ?? "left";
  const raw = getRoomPositionFromCanvas(x, y, profile, room);
  const aligned = alignLegacySpeakerPosition(raw, profile, legacySpeakerPoints.filter((point) => point.type === "wall"));
  if (side === "left") return { x: 0, y: aligned.y };
  if (side === "right") return { x: profile.roomGeometry.width, y: aligned.y };
  if (side === "front") return { x: aligned.x, y: 0 };
  return { x: aligned.x, y: profile.roomGeometry.length };
}

function snapLegacyCeilingSpeakerPosition(
  position: Point,
  profile: ClassroomProfile,
  legacySpeakerPoints: ClassroomProfile["existingDevices"]["legacySpeakerPoints"]
) {
  const aligned = alignLegacySpeakerPosition(position, profile, legacySpeakerPoints.filter((point) => point.type === "ceiling"));
  return keepCeilingSpeakerInsideWallClearance(keepCeilingSpeakerAwayFromArrayMics(keepCeilingSpeakerInsideWallClearance(aligned, profile), profile), profile);
}

function keepCeilingSpeakerAwayFromArrayMics(position: Point, profile: ClassroomProfile) {
  const arrayMics = generateEngineeringPoints(profile).filter((point) => point.type === "arrayMic");
  return arrayMics.reduce((next, mic) => {
    const dx = next.x - mic.position.x;
    const dy = next.y - mic.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= 2) return next;
    const fallbackAngle = -Math.PI / 2;
    const angle = distance > 0.01 ? Math.atan2(dy, dx) : fallbackAngle;
    return {
      x: oneDecimal(clampNumber(mic.position.x + Math.cos(angle) * 2, getCeilingSpeakerWallBounds(profile).minX, getCeilingSpeakerWallBounds(profile).maxX)),
      y: oneDecimal(clampNumber(mic.position.y + Math.sin(angle) * 2, getCeilingSpeakerWallBounds(profile).minY, getCeilingSpeakerWallBounds(profile).maxY))
    };
  }, position);
}

function keepCeilingSpeakerInsideWallClearance(position: Point, profile: ClassroomProfile) {
  const bounds = getCeilingSpeakerWallBounds(profile);
  return {
    x: oneDecimal(clampNumber(position.x, bounds.minX, bounds.maxX)),
    y: oneDecimal(clampNumber(position.y, bounds.minY, bounds.maxY))
  };
}

function getCeilingSpeakerWallBounds(profile: ClassroomProfile) {
  const { width, length } = profile.roomGeometry;
  const minSide = 0.5;
  const minFront = 1.5;
  const minBack = 2;
  const minX = Math.min(minSide, Math.max(0.3, width / 2));
  const maxX = Math.max(minX, width - minX);
  const minY = Math.min(minFront, Math.max(0.3, length / 2));
  const maxY = Math.max(minY, length - Math.min(minBack, Math.max(0.3, length / 2)));
  return { minX, maxX, minY, maxY };
}

function findLastWallSpeakerIndex(points: LegacySpeakerPoint[]) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].type === "wall") return index;
  }
  return -1;
}

function alignLegacySpeakerPosition(position: Point, profile: ClassroomProfile, existingPoints: ClassroomProfile["existingDevices"]["legacySpeakerPoints"]) {
  const snapToleranceM = 0.45;
  let next = { ...position };
  for (const point of existingPoints) {
    next = {
      x: snapToValue(next.x, point.position.x, snapToleranceM),
      y: snapToValue(next.y, point.position.y, snapToleranceM)
    };
    next = {
      x: snapToValue(next.x, profile.roomGeometry.width - point.position.x, snapToleranceM),
      y: next.y
    };
  }
  return {
    x: oneDecimal(clampNumber(next.x, 0, profile.roomGeometry.width)),
    y: oneDecimal(clampNumber(next.y, 0, profile.roomGeometry.length))
  };
}

function snapToValue(value: number, target: number, tolerance: number) {
  return Math.abs(value - target) <= tolerance ? target : value;
}

function getInstallationCanvasHeight(profile: ClassroomProfile, width: number) {
  const ratio = profile.roomGeometry.length / Math.max(profile.roomGeometry.width, 0.1);
  return Math.round(Math.max(430, Math.min(920, width * ratio + 170)));
}

function LectureAudienceStepMarker({
  profile,
  generatedPoints,
  width,
  height
}: {
  profile: ClassroomProfile;
  generatedPoints: GeneratedPoint[];
  width: number;
  height: number;
}) {
  if (profile.scenario !== "lectureClassroom") return null;
  const room = getCanvasRoomLayout(profile, width, height);
  const primaryMic = generatedPoints
    .filter((point) => point.type === "arrayMic")
    .sort((a, b) => a.position.y - b.position.y)[0];
  const primaryMicY = primaryMic?.position.y ?? Math.min(3.2, Math.max(1.6, profile.roomGeometry.length - 1.2));
  const audienceStartM = Math.min(profile.roomGeometry.length, primaryMicY + LECTURE_AUDIENCE_START_BEHIND_MIC_M);
  const audienceDepthM = Math.max(0, profile.roomGeometry.length - audienceStartM);
  if (audienceDepthM < 0.8) return null;

  const startY = room.y + (audienceStartM / profile.roomGeometry.length) * room.height;
  const audienceHeight = room.y + room.height - startY;
  const stepCount = Math.floor(audienceDepthM);
  const maxStepHeight = oneDecimal(stepCount * LECTURE_STEP_RISE_PER_M);
  const stepLines = Array.from({ length: stepCount }, (_, index) => {
    const distance = index + 1;
    const y = startY + (distance / audienceDepthM) * audienceHeight;
    return {
      distance,
      y,
      height: oneDecimal(distance * LECTURE_STEP_RISE_PER_M)
    };
  });

  return (
    <g>
      <rect x={room.x + 4} y={startY} width={room.width - 8} height={audienceHeight} rx="2" fill="#f8fbff" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth="0.6" />
      <text x={room.x + 10} y={startY + 14} className="cadTiny" fill="#475569">
        听众区起点 +0.0m
      </text>
      <text x={room.x + room.width - 10} y={Math.max(startY + 14, room.y + room.height - 10)} textAnchor="end" className="cadTiny" fill="#475569">
        末排约 +{maxStepHeight.toFixed(1)}m
      </text>
      {stepLines.map((step) => (
        <g key={step.distance}>
          <line x1={room.x + 6} y1={step.y} x2={room.x + room.width - 6} y2={step.y} stroke="#cbd5e1" strokeWidth="0.45" />
          {(step.distance === 1 || step.distance % 2 === 0 || step.distance === stepCount) && (
            <text x={room.x + room.width - 10} y={step.y - 3} textAnchor="end" className="cadTiny" fill="#64748b">
              +{step.height.toFixed(1)}m
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

function PodiumMarker({ profile, width, height }: { profile: ClassroomProfile; width: number; height: number }) {
  const room = getCanvasRoomLayout(profile, width, height);
  if (profile.scenario === "auditorium") {
    const maxStageWidthM = Math.max(0.5, profile.roomGeometry.width - 0.1);
    const stageWidthM = Math.max(0.5, Math.min(maxStageWidthM, profile.engineeringConstraints.stageSize?.width ?? profile.roomGeometry.width * 0.72));
    const stageDepthM = Math.max(0.6, Math.min(profile.roomGeometry.length, profile.engineeringConstraints.stageSize?.depth ?? profile.roomGeometry.length * 0.18));
    const stageWidth = stageWidthM * room.meterPx;
    const stageHeight = Math.max(12, stageDepthM * room.meterPx);
    const x = room.x + (room.width - stageWidth) / 2;
    const y = room.y;
    return (
      <g>
        <rect x={x} y={y} width={stageWidth} height={stageHeight} rx="2" fill="#f8fafc" stroke="#64748b" strokeWidth="0.7" />
        <text x={x + stageWidth / 2} y={y + Math.min(stageHeight / 2 + 3, stageHeight - 5)} textAnchor="middle" className="cadTiny" fill="#334155">
          居中舞台 {stageWidthM.toFixed(1)}m x {stageDepthM.toFixed(1)}m
        </text>
      </g>
    );
  }
  if (profile.scenario === "combinedClassroom") {
    const teachingWidthM = Math.max(0.5, Math.min(profile.roomGeometry.width, profile.engineeringConstraints.teachingAreaSize?.width ?? profile.roomGeometry.width));
    const teachingDepthM = Math.max(0.6, Math.min(profile.roomGeometry.length - 0.4, profile.engineeringConstraints.teachingAreaSize?.depth ?? profile.roomGeometry.length * 0.5));
    const teachingWidth = teachingWidthM * room.meterPx;
    const teachingHeight = Math.max(12, teachingDepthM * room.meterPx);
    const x = room.x + (room.width - teachingWidth) / 2;
    const y = room.y;
    const seatingY = y + teachingHeight;
    const seatingHeight = Math.max(0, room.y + room.height - seatingY);
    return (
      <g>
        <rect x={x} y={y} width={teachingWidth} height={teachingHeight} rx="2" fill="#eef8ff" stroke="#0b5cad" strokeWidth="0.7" />
        <text x={x + 8} y={y + 14} className="cadTiny" fill="#0b5cad">
          上课区 {teachingWidthM.toFixed(1)}m x {teachingDepthM.toFixed(1)}m
        </text>
        {seatingHeight > 16 && (
          <>
            <rect x={room.x + 4} y={seatingY + 4} width={room.width - 8} height={seatingHeight - 8} rx="2" fill="none" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth="0.6" />
            <text x={room.x + 12} y={seatingY + 20} className="cadTiny" fill="#64748b">
              坐席区
            </text>
          </>
        )}
      </g>
    );
  }
  const podiumPosition = profile.engineeringConstraints.podiumPosition ?? "frontCenter";
  const podiumDepthM = 0.7;
  const frontClearanceM = 1.2;
  const minSideAisleM = 0.9;
  const podiumWidthM = Math.min(1.8, Math.max(1.2, profile.roomGeometry.width - minSideAisleM * 2));
  const podiumWidth = Math.min(room.width * 0.28, podiumWidthM * room.meterPx);
  const podiumHeight = Math.max(10, podiumDepthM * room.meterPx);
  const x =
    podiumPosition === "frontLeft"
      ? room.x + minSideAisleM * room.meterPx
      : podiumPosition === "frontRight"
        ? room.x + room.width - minSideAisleM * room.meterPx - podiumWidth
        : room.x + (room.width - podiumWidth) / 2;
  const y = room.y + frontClearanceM * room.meterPx;
  return (
    <g>
      <rect x={x} y={y} width={podiumWidth} height={podiumHeight} rx="2" fill="#f8fafc" stroke="#64748b" strokeWidth="0.7" />
      <text x={x + podiumWidth / 2} y={y + podiumHeight / 2 + 3} textAnchor="middle" className="cadTiny" fill="#334155">
        {getPodiumMarkerText(profile, podiumPosition)}
      </text>
    </g>
  );
}

function getPodiumMarkerText(profile: ClassroomProfile, position: ClassroomProfile["engineeringConstraints"]["podiumPosition"]) {
  if (profile.scenario === "auditorium") return "居中舞台";
  if (position === "frontLeft") return "左侧讲台";
  if (position === "frontRight") return "右侧讲台";
  if (position === "unknown") return "讲台待确认";
  return "居中讲台";
}

function WiringDiagram({ connections }: { connections: ConnectionLine[] }) {
  const rowHeight = 112;
  const topPadding = 82;
  const bottomPadding = 52;
  const maxLabelLength = Math.max(
    18,
    ...connections.flatMap((line) => [line.fromDevice.length, line.toDevice.length, line.fromPort.length, line.toPort.length, line.cableType.length])
  );
  const canvasWidth = Math.max(980, Math.min(1360, 900 + Math.max(0, maxLabelLength - 24) * 8));
  const canvasHeight = Math.max(560, topPadding + Math.max(1, connections.length) * rowHeight + bottomPadding);
  const blockWidth = Math.min(280, Math.max(210, (canvasWidth - 360) / 2));
  const blockHeight = 78;
  const fromX = 56;
  const toX = canvasWidth - fromX - blockWidth;
  const lineStartX = fromX + blockWidth + 34;
  const lineEndX = toX - 34;
  const cableX = (lineStartX + lineEndX) / 2;

  return (
    <div className="canvasFrame">
      <svg
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        className="engineeringCanvas cadCanvas adaptiveCadCanvas"
        style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
        role="img"
        aria-label={`${getAppBrand().id === "yinman" ? "音曼" : "音翼"}接口接线图`}
      >
        <rect x="18" y="18" width={canvasWidth - 36} height={canvasHeight - 40} fill="#ffffff" stroke="#111827" strokeWidth="1" />
        <text x={canvasWidth / 2} y="46" textAnchor="middle" className="cadTitle">
          接口接线图
        </text>
        <text x={fromX + blockWidth / 2} y={70} textAnchor="middle" className="cadLabel">
          输出 / 来源设备
        </text>
        <text x={toX + blockWidth / 2} y={70} textAnchor="middle" className="cadLabel">
          输入 / 目标设备
        </text>

        {connections.length === 0 && (
          <text x={canvasWidth / 2} y={canvasHeight / 2} textAnchor="middle" className="cadLabel" fill="#64748b">
            暂无接口接线关系
          </text>
        )}

        {connections.map((connection, index) => {
          const y = topPadding + index * rowHeight;
          const lineY = y + blockHeight / 2;
          const isBidirectional = connection.cableType.includes("USB");
          return (
            <g key={connection.id}>
              <WiringDeviceBlock x={fromX} y={y} w={blockWidth} h={blockHeight} title={formatBrandText(connection.fromDevice)} port={formatBrandText(connection.fromPort)} />
              <WiringDeviceBlock x={toX} y={y} w={blockWidth} h={blockHeight} title={formatBrandText(connection.toDevice)} port={formatBrandText(connection.toPort)} />
              <line x1={lineStartX} y1={lineY} x2={lineEndX} y2={lineY} stroke="#111827" strokeWidth="1.5" />
              {isBidirectional && <path d={`M ${lineStartX + 9} ${lineY - 5} L ${lineStartX} ${lineY} L ${lineStartX + 9} ${lineY + 5}`} fill="none" stroke="#111827" strokeWidth="1.5" />}
              <path d={`M ${lineEndX - 9} ${lineY - 5} L ${lineEndX} ${lineY} L ${lineEndX - 9} ${lineY + 5}`} fill="none" stroke="#111827" strokeWidth="1.5" />
              <text x={cableX} y={lineY - 10} textAnchor="middle" className="cadSmall">
                {connection.cableType}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TopologyDiagram({ profile, connections, generatedPoints }: { profile: ClassroomProfile; connections: ConnectionLine[]; generatedPoints: GeneratedPoint[] }) {
  const topologyConnections = getVisibleTopologyConnections(profile, connections);
  const topology = getTopologyModel(profile, topologyConnections, generatedPoints);
  const devices = topology.nodes.map((node) => node.key);
  const blockWidth = 190;
  const blockHeight = 96;
  const notes = getTopologyBottomLeftNotes(topologyConnections);
  const layout = getTopologyLayout(devices, blockWidth, blockHeight, 980, 620);
  const positions = getRadialTopologyPositions(devices, topology.edges, topology.nodes, {
    centerX: layout.centerX,
    centerY: layout.centerY,
    blockWidth,
    blockHeight,
    radiusX: layout.radiusX,
    radiusY: layout.radiusY,
    minX: layout.minX,
    maxX: layout.maxX,
    minY: layout.minY,
    maxY: layout.maxY,
    preferredMinX: layout.preferredMinX,
    preferredMaxX: layout.preferredMaxX,
    preferredMinY: layout.preferredMinY,
    preferredMaxY: layout.preferredMaxY
  });
  const firstLevelDevices = new Set([getTopologyMainDevice(devices), ...getLegacyAudioCenterKeys(devices)]);
  const centeredDeviceKey = firstLevelDevices.size === 1 ? Array.from(firstLevelDevices)[0] : undefined;
  const topologyNodeMap = new Map(topology.nodes.map((node) => [node.key, node]));
  const frame = getCompactTopologyFrame(positions, topology.nodes, topology.edges, blockWidth, notes.length, centeredDeviceKey);
  const noteBoxWidth = notes.length ? Math.min(frame.width - 72, Math.max(...notes.map((note) => note.length * 12)) + 28) : 0;
  const noteBoxHeight = notes.length ? notes.length * 18 + 22 : 0;
  const noteBoxX = 32;
  const noteBoxY = frame.height - noteBoxHeight - 32;
  return (
    <div className="canvasFrame">
      <svg
        viewBox={`0 0 ${frame.width} ${frame.height}`}
        className="engineeringCanvas cadCanvas adaptiveCadCanvas"
        style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
        role="img"
        aria-label={`${getAppBrand().id === "yinman" ? "音曼" : "音翼"}系统拓扑图`}
      >
        <rect x="18" y="18" width={frame.width - 36} height={frame.height - 40} fill="#ffffff" stroke="#111827" strokeWidth="1" />
        <text x={frame.width / 2} y="54" textAnchor="middle" className="cadTitle">
          系统拓扑图
        </text>
        {topology.edges.map((edge) => {
          const from = frame.positions.get(edge.from)!;
          const to = frame.positions.get(edge.to)!;
          const fromNode = topologyNodeMap.get(edge.from)!;
          const toNode = topologyNodeMap.get(edge.to)!;
          return (
            <TopologyEdgeLine
              key={edge.id}
              edge={edge}
              from={from}
              to={to}
              fromNode={fromNode}
              toNode={toNode}
              blockWidth={blockWidth}
            />
          );
        })}
        {topology.nodes.map((node) => {
          const p = frame.positions.get(node.key)!;
          return <TopologyDeviceBlock key={node.key} node={node} x={p.x} y={p.y} w={blockWidth} h={blockHeight} />;
        })}
        {notes.length > 0 && (
          <g aria-label="拓扑图备注">
            <rect x={noteBoxX} y={noteBoxY} width={noteBoxWidth} height={noteBoxHeight} rx="6" fill="#fff7ed" stroke="#fed7aa" strokeWidth="1" />
            {notes.map((note, index) => (
              <text key={note} x={noteBoxX + 14} y={noteBoxY + 23 + index * 18} textAnchor="start" className="cadSmall" style={{ fill: "#b45309" }}>
                {note}
              </text>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

function SystemDiagram({ profile, connections, generatedPoints }: { profile: ClassroomProfile; connections: ConnectionLine[]; generatedPoints: GeneratedPoint[] }) {
  const topologyConnections = getVisibleTopologyConnections(profile, connections);
  const topology = getTopologyModel(profile, topologyConnections, generatedPoints);
  const devices = topology.nodes.map((node) => node.key);
  const padding = 42;
  const blockWidth = 180;
  const blockHeight = 96;
  const topologyLayout = getTopologyLayout(devices, blockWidth, blockHeight, 920, 430);
  const canvasWidth = Math.max(920, topologyLayout.width);
  const innerWidth = canvasWidth - padding * 2;
  const titleY = 48;
  const topologyY = 72;
  const topologyHeight = topologyLayout.height;
  const detailY = topologyY + topologyHeight + 32;
  const rowHeight = 32;
  const detailHeight = 56 + Math.max(1, connections.length) * rowHeight + 26;
  const canvasHeight = detailY + detailHeight + 36;
  const positions = getRadialTopologyPositions(devices, topology.edges, topology.nodes, {
    centerX: canvasWidth / 2,
    centerY: topologyY + topologyLayout.centerY,
    blockWidth,
    blockHeight,
    radiusX: topologyLayout.radiusX,
    radiusY: topologyLayout.radiusY,
    minX: padding + 18,
    maxX: padding + innerWidth - blockWidth - 18,
    minY: topologyY + topologyLayout.minY,
    maxY: topologyY + topologyLayout.maxY,
    preferredMinX: padding + 18 + topologyLayout.expansionMargin,
    preferredMaxX: padding + innerWidth - blockWidth - 18 - topologyLayout.expansionMargin,
    preferredMinY: topologyY + topologyLayout.preferredMinY,
    preferredMaxY: topologyY + topologyLayout.preferredMaxY
  });
  const detailLeft = padding;
  const detailWidth = innerWidth;
  const fromDeviceX = detailLeft + 20;
  const fromPortX = detailLeft + detailWidth * 0.23;
  const lineStartX = detailLeft + detailWidth * 0.39;
  const lineEndX = detailLeft + detailWidth * 0.55;
  const cableX = (lineStartX + lineEndX) / 2;
  const toDeviceX = detailLeft + detailWidth * 0.59;
  const toPortX = detailLeft + detailWidth * 0.78;
  const topologyNodeMap = new Map(topology.nodes.map((node) => [node.key, node]));

  return (
    <div className="canvasFrame">
      <svg
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        className="engineeringCanvas cadCanvas adaptiveCadCanvas"
        style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
        role="img"
        aria-label={`${getAppBrand().id === "yinman" ? "音曼" : "音翼"}接线与拓扑合并图`}
      >
        <rect x="18" y="18" width={canvasWidth - 36} height={canvasHeight - 40} fill="#ffffff" stroke="#111827" strokeWidth="1" />
        <text x={canvasWidth / 2} y={titleY} textAnchor="middle" className="cadTitle">
          接线与拓扑合并图
        </text>

        <rect x={padding} y={topologyY} width={innerWidth} height={topologyHeight} fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
        <text x={canvasWidth / 2} y={topologyY + 26} textAnchor="middle" className="cadLabel">
          系统拓扑
        </text>
        {topology.edges.map((edge) => {
          const from = positions.get(edge.from)!;
          const to = positions.get(edge.to)!;
          const fromNode = topologyNodeMap.get(edge.from)!;
          const toNode = topologyNodeMap.get(edge.to)!;
          return (
            <TopologyEdgeLine
              key={`topology-${edge.id}`}
              edge={edge}
              from={from}
              to={to}
              fromNode={fromNode}
              toNode={toNode}
              blockWidth={blockWidth}
            />
          );
        })}
        {topology.nodes.map((node) => {
          const p = positions.get(node.key)!;
          return <TopologyDeviceBlock key={node.key} node={node} x={p.x} y={p.y} w={blockWidth} h={blockHeight} />;
        })}

        <rect x={detailLeft} y={detailY} width={detailWidth} height={detailHeight} fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
        <text x={canvasWidth / 2} y={detailY + 28} textAnchor="middle" className="cadLabel">
          接口接线明细
        </text>
        {connections.map((connection, index) => {
          const y = detailY + 56 + index * rowHeight;
          return (
            <g key={`wiring-${connection.id}`}>
              <text x={fromDeviceX} y={y} className="cadSmall">
                {formatBrandText(connection.fromDevice)}
              </text>
              <text x={fromPortX} y={y} className="cadSmall">
                {formatBrandText(connection.fromPort)}
              </text>
              <line x1={lineStartX} y1={y - 5} x2={lineEndX} y2={y - 5} stroke="#111827" strokeWidth="1.5" />
              <text x={cableX} y={y - 10} textAnchor="middle" className="cadSmall">
                {connection.cableType}
              </text>
              <text x={toDeviceX} y={y} className="cadSmall">
                {formatBrandText(connection.toDevice)}
              </text>
              <text x={toPortX} y={y} className="cadSmall">
                {formatBrandText(connection.toPort)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type TopologyNodeKind =
  | "mainMic"
  | "slaveMic"
  | "speaker"
  | "amplifier"
  | "processor"
  | "mixer"
  | "wireless"
  | "wirelessReceiver"
  | "computer"
  | "legacy"
  | "device";
type TopologyNode = { key: string; label: string; kind: TopologyNodeKind; quantity?: number; isLegacy?: boolean; isLineArray?: boolean };
type TopologyEdge = { id: string; from: string; to: string; label: string; laneOffset?: number };
const LEGACY_AUDIO_ROOT_LABELS = ["原有音频系统", "原有扩声系统"];
const LEGACY_AUDIO_CENTER_PRIORITY = ["legacy-mixer", "legacy-processor", "legacy-amplifier"];

function getTopologyModel(profile: ClassroomProfile, connections: ConnectionLine[], generatedPoints: GeneratedPoint[]) {
  const arrayMicCount = generatedPoints.filter((point) => point.type === "arrayMic").length;
  const speakerCount = generatedPoints.filter((point) => point.type === "speaker").length;
  const topologySpeakerType = getTopologySpeakerTypeFromPoints(generatedPoints);
  const nodes = new Map<string, TopologyNode>();
  const edges: TopologyEdge[] = [];

  const ensureNode = (node: TopologyNode) => {
    if (!nodes.has(node.key)) nodes.set(node.key, node);
  };

  const isLineArray = generatedPoints.some((point) => point.pickupKind === "lineArray");
  const processorDirect = getAppBrand().id === "yinman" || isLineArray;
  const topologyRootKey = processorDirect ? "processorHost" : "mainMic";
  if (processorDirect) {
    const processorLabel = connections.flatMap((line) => [line.fromDevice, line.toDevice]).find((device) => device.includes("处理器")) ?? "智能音频处理主机";
    ensureNode({ key: topologyRootKey, label: processorLabel, kind: "processor" });
    Array.from({ length: arrayMicCount }, (_, index) => index + 1).forEach((index) => {
      const key = `arrayMic-${index}`;
      ensureNode({
        key,
        label: isLineArray ? (arrayMicCount > 1 ? `智能线阵麦克风 ${index}` : "智能线阵麦克风") : arrayMicCount > 1 ? `阵麦 ${index}` : "阵麦",
        kind: "mainMic",
        isLineArray
      });
      edges.push({ id: `array-mic-processor-${index}`, from: key, to: topologyRootKey, label: formatTopologyCableLabel("网线", 1) });
    });
  } else {
    ensureNode({ key: "mainMic", label: arrayMicCount > 1 ? "主麦" : "阵麦", kind: "mainMic" });
    if (arrayMicCount > 1) {
      ensureNode({ key: "slaveMic", label: "从麦", kind: "slaveMic", quantity: arrayMicCount - 1 });
      edges.push({ id: "main-slave-mic", from: "mainMic", to: "slaveMic", label: formatTopologyCableLabel("网线", arrayMicCount - 1) });
    }
  }

  connections.forEach((connection) => {
    const fromKey = getTopologyNodeKey(connection.fromDevice, connection.fromPort);
    const toKey = getTopologyNodeKey(connection.toDevice, connection.toPort);
    if (isUnknownTopologyNodeKey(fromKey) || isUnknownTopologyNodeKey(toKey)) return;
    if (shouldSkipTopologyConnection(connection, fromKey, toKey)) return;
    ensureNode(getTopologyNode(connection.fromDevice, connection.fromPort, fromKey, speakerCount, topologySpeakerType));
    ensureNode(getTopologyNode(connection.toDevice, connection.toPort, toKey, speakerCount, topologySpeakerType));
    if (fromKey === toKey) return;
    if (isTwoInTwoOutAudioConnection(connection)) {
      const edgeLabel = formatTopologyCableLabel("音频线", 2);
      const outboundEdge = { id: `${connection.id}-out`, from: fromKey, to: toKey, label: edgeLabel, laneOffset: 7 };
      const inboundEdge = { id: `${connection.id}-in`, from: toKey, to: fromKey, label: edgeLabel, laneOffset: 7 };
      if (!edges.some((edge) => edge.from === outboundEdge.from && edge.to === outboundEdge.to && edge.label === outboundEdge.label)) edges.push(outboundEdge);
      if (!edges.some((edge) => edge.from === inboundEdge.from && edge.to === inboundEdge.to && edge.label === inboundEdge.label)) edges.push(inboundEdge);
      return;
    }
    const edgeLabel = getTopologyCableLabel(connection, fromKey, toKey, speakerCount);
    if (edges.some((edge) => edge.from === fromKey && edge.to === toKey && edge.label === edgeLabel)) return;
    edges.push({ id: connection.id, from: fromKey, to: toKey, label: edgeLabel });
  });

  getSelectedTopologyDevices(profile).forEach((device, index) => {
    const key = getTopologyNodeKey(device);
    if (isUnknownTopologyNodeKey(key) || key === topologyRootKey || key.startsWith("arrayMic-")) return;
    ensureNode(getTopologyNode(device, "", key, speakerCount, topologySpeakerType));
    if (edges.some((edge) => edge.from === key || edge.to === key)) return;
    if (isLegacyFeedbackSuppressorWithoutChain(device)) return;
    edges.push({ id: `pending-external-${index + 1}-${key}`, from: topologyRootKey, to: key, label: getPendingTopologyCableLabel(device) });
  });

  return { nodes: Array.from(nodes.values()), edges };
}

function getVisibleTopologyConnections(profile: ClassroomProfile, connections: ConnectionLine[]) {
  if (shouldShowLegacySoundInTopology(profile)) {
    return connections.filter((connection) => {
      const fromKey = getTopologyNodeKey(connection.fromDevice, connection.fromPort);
      const toKey = getTopologyNodeKey(connection.toDevice, connection.toPort);
      return !shouldHideLegacySpeakerChainKeyInTopology(profile, fromKey) && !shouldHideLegacySpeakerChainKeyInTopology(profile, toKey);
    });
  }
  return connections.filter((connection) => {
    const fromKey = getTopologyNodeKey(connection.fromDevice, connection.fromPort);
    const toKey = getTopologyNodeKey(connection.toDevice, connection.toPort);
    return !isLegacyTopologyNodeKey(fromKey) && !isLegacyTopologyNodeKey(toKey);
  });
}

function shouldShowLegacySoundInTopology(profile: ClassroomProfile) {
  return profile.scenario === "auditorium" || (profile.existingDevices.legacySpeakerPoints ?? []).length > 0 || hasLegacyAudioExternalRouting(profile);
}

function getSelectedTopologyDevices(profile: ClassroomProfile) {
  const legacySoundDevices = shouldShowLegacySoundInTopology(profile)
    ? splitTopologyDeviceText(profile.existingDevices.legacySoundSystem).filter(
      (item) => !LEGACY_AUDIO_ROOT_LABELS.includes(item) && !shouldHideLegacySpeakerChainDeviceInTopology(profile, item)
    )
    : [];
  return uniqueTopologyDeviceList([
    ...splitTopologyDeviceText(profile.existingDevices.recordingHost),
    ...splitTopologyDeviceText(profile.existingDevices.computer),
    ...splitTopologyDeviceText(profile.existingDevices.legacyWirelessMic).map(getLegacyTopologyMicrophoneDevice),
    ...legacySoundDevices
  ]);
}

function shouldHideLegacySpeakerChainDeviceInTopology(profile: ClassroomProfile, device: string) {
  if ((profile.existingDevices.legacySpeakerPoints ?? []).length > 0) return false;
  const legacyItems = splitTopologyDeviceText(profile.existingDevices.legacySoundSystem);
  if (device === "有源音箱" || device === "无源音箱") return true;
  return device === "功放" && legacyItems.includes("无源音箱");
}

function shouldHideLegacySpeakerChainKeyInTopology(profile: ClassroomProfile, key: string) {
  if ((profile.existingDevices.legacySpeakerPoints ?? []).length > 0) return false;
  const legacyItems = splitTopologyDeviceText(profile.existingDevices.legacySoundSystem);
  if (key === "legacy-active-speaker" || key === "legacy-passive-speaker") return true;
  return key === "legacy-amplifier" && legacyItems.includes("无源音箱");
}

function hasLegacyAudioExternalRouting(profile: ClassroomProfile) {
  const legacyItems = splitTopologyDeviceText(profile.existingDevices.legacySoundSystem);
  const hasLegacyCenter = legacyItems.some((item) => item === "调音台" || item === "音频处理器" || item === "功放");
  if (!hasLegacyCenter) return false;
  return [
    ...splitTopologyDeviceText(profile.existingDevices.recordingHost),
    ...splitTopologyDeviceText(profile.existingDevices.computer).filter((device) => !isTopologyAllInOneDevice(device)),
    ...splitTopologyDeviceText(profile.existingDevices.legacyWirelessMic)
  ].length > 0;
}

function splitTopologyDeviceText(value: string) {
  return value
    .split(/[、,，;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueTopologyDeviceList(devices: string[]) {
  return Array.from(new Set(devices));
}

function getLegacyTopologyMicrophoneDevice(device: string) {
  if (!device.includes("无线手持") && !device.includes("手持麦")) return device;
  return device.startsWith("利旧") ? device : `利旧${device}`;
}

function getPendingTopologyCableLabel(device: string) {
  if (device.includes("中控")) return formatTopologyCableLabel("网线", 1);
  if (device.includes("无源音箱")) return formatTopologyCableLabel("音箱线", 1);
  return formatTopologyCableLabel("音频线", 1);
}

function isLegacyFeedbackSuppressorWithoutChain(device: string) {
  return device.includes("反馈抑制");
}

function shouldSkipTopologyConnection(connection: ConnectionLine, fromKey: string, toKey: string) {
  const isArrayMicToSpeaker = fromKey === "mainMic" && isTopologySpeakerKey(toKey);
  if (!isArrayMicToSpeaker) return false;
  if (!connection.cableType.includes("音频")) return false;
  return !connection.toDevice.includes("有源音箱");
}

function getTopologyCableLabel(connection: ConnectionLine, fromKey: string, toKey: string, speakerCount: number) {
  if (connection.cableType.includes("无线信号")) return "无线信号";
  const quantity = getTopologyCableQuantity(connection, fromKey, toKey, speakerCount);
  return formatTopologyCableLabel(connection.cableType, quantity);
}

function isTwoInTwoOutAudioConnection(connection: ConnectionLine) {
  return connection.cableType.includes("两进两出");
}

function getTopologyCableQuantity(connection: ConnectionLine, fromKey: string, toKey: string, speakerCount: number) {
  if (connection.cableType.includes("无线信号")) return getTopologyQuantityFromText(connection.fromDevice) ?? 1;
  if (isTopologySpeakerKey(fromKey) || isTopologySpeakerKey(toKey)) {
    if (fromKey === "speaker-amplifier" || toKey === "speaker-amplifier") return Math.max(1, getExternalSpeakerCount(speakerCount));
    if (fromKey === "mainMic" || toKey === "mainMic" || fromKey === "processorHost" || toKey === "processorHost") {
      return Math.max(1, Math.min(speakerCount, MAX_SPEAKERS_PER_DT));
    }
    return Math.max(1, speakerCount);
  }
  if (connection.id === "dt-lineout-amplifier") return Math.max(1, getExternalAmplifierLineOutCountForSpeakers(speakerCount));
  if (fromKey === "amplifier" || toKey === "amplifier") {
    return getTopologyQuantityFromText(connection.fromDevice) ?? getTopologyQuantityFromText(connection.toDevice) ?? 1;
  }
  if (fromKey === "wireless" || toKey === "wireless") {
    return getTopologyQuantityFromText(connection.fromDevice) ?? getTopologyQuantityFromText(connection.toDevice) ?? 1;
  }
  if (fromKey === "wirelessReceiver" || toKey === "wirelessReceiver") {
    return getTopologyQuantityFromText(connection.fromDevice) ?? getTopologyQuantityFromText(connection.toDevice) ?? 1;
  }
  return 1;
}

function getTopologyBottomLeftNotes(connections: ConnectionLine[]) {
  const inputCount = connections
    .filter((connection) => getTopologyNodeKey(connection.toDevice, connection.toPort) === "mainMic" && isTopologyAudioInputCable(connection.cableType))
    .reduce((sum, connection) => sum + getTopologyAudioConnectionCount(connection), 0);
  const outputCount = connections
    .filter((connection) => getTopologyNodeKey(connection.fromDevice, connection.fromPort) === "mainMic" && isTopologyAudioOutputCable(connection.cableType))
    .reduce((sum, connection) => sum + getTopologyAudioConnectionCount(connection), 0);
  const notes: string[] = [];
  if (hasDirectWiredMicToSystemAudioInput(connections)) notes.push("备注：有线麦直连系统音频输入时，需自供电或前级供电，仅提供音频信号。");
  if (inputCount > DT_AUDIO_LINE_IN_LIMIT) notes.push(`备注：Line In ${inputCount}路，超过${DT_AUDIO_LINE_IN_LIMIT}路无法接入。`);
  if (outputCount > DT_AUDIO_LINE_OUT_LIMIT) notes.push(`备注：Line Out ${outputCount}路，超过${DT_AUDIO_LINE_OUT_LIMIT}路可并联相同信号。`);
  return notes;
}

function hasDirectWiredMicToSystemAudioInput(connections: ConnectionLine[]) {
  return connections.some(
    (connection) => {
      const targetKey = getTopologyNodeKey(connection.toDevice, connection.toPort);
      return (
        connection.fromDevice.includes("有线") &&
        connection.fromDevice.includes("麦") &&
        (targetKey === "mainMic" || targetKey === "processorHost") &&
        connection.cableType.includes("音频")
      );
    }
  );
}

function isTopologyAudioInputCable(cableType: string) {
  return cableType.includes("音频") || cableType.includes("无法接入");
}

function isTopologyAudioOutputCable(cableType: string) {
  return cableType.includes("音频");
}

function getTopologyAudioConnectionCount(connection: ConnectionLine) {
  const lineOutPortMatch = connection.fromPort.match(/Line Out\s*(\d+)\s*-\s*(\d+)/i);
  if (lineOutPortMatch) return Math.abs(Number(lineOutPortMatch[2]) - Number(lineOutPortMatch[1])) + 1;
  return getTopologyQuantityFromText(connection.fromDevice) ?? getTopologyQuantityFromText(connection.toDevice) ?? 1;
}

function formatTopologyCableLabel(label: string, quantity: number) {
  return `${label} ×${Math.max(1, Math.round(quantity))}`;
}

function getTopologyNodeKey(device: string, port = "") {
  if (device.includes("智能音频处理主机") || device.includes("两麦处理器") || device.includes("六麦处理器") || device.includes("高性能处理器")) return "processorHost";
  if (device.includes("智能线阵麦克风")) {
    const match = device.match(/(\d+)\s*$/);
    return `arrayMic-${match?.[1] ?? "1"}`;
  }
  if (getAppBrand().id === "yinman" && device.includes("智能语音阵列麦克风")) {
    const match = device.match(/(\d+)\s*$/);
    return `arrayMic-${match?.[1] ?? "1"}`;
  }
  if (device.includes("DT2") || device.includes("阵列麦")) return "mainMic";
  if (device.includes("原有音频") || device.includes("原有扩声") || device.includes("原系统")) return "legacySound";
  if (device === "调音台") return "legacy-mixer";
  if (device === "音频处理器") return "legacy-processor";
  if (device === "反馈抑制器") return "legacy-feedback";
  if (device === "功放") return "legacy-amplifier";
  if (device === "有源音箱") return "legacy-active-speaker";
  if (device === "无源音箱") return "legacy-passive-speaker";
  if (isTopologySpeaker(device, port)) return device.includes("扩展分组") ? "speaker-amplifier" : "speaker-dt";
  if (device.includes("功放主机")) return "amplifier";
  if (device.includes("调音台")) return "mixer";
  if (device.includes("处理器") || device.includes("DSP") || device.includes("反馈抑制")) return "processor";
  if (device.includes("利旧") && device.includes("接收机")) return "legacyWirelessReceiver";
  if (device.includes("利旧") && (device.includes("无线手持") || device.includes("手持麦"))) {
    return getStableTopologyDeviceKey("legacyWirelessMic", device);
  }
  if (device.includes("接收机")) return "wirelessReceiver";
  if (device.includes("有线麦")) return getStableTopologyDeviceKey("wiredMic", device);
  if (device.includes("无线手持") || device.includes("手持麦")) return getStableTopologyDeviceKey("wirelessMic", device);
  if (device.includes("电脑") || device.includes("录播") || device.includes("一体机") || device.includes("平台") || device.includes("会议") || device.includes("中控")) return getStableTopologyDeviceKey("media", device);
  return getStableTopologyDeviceKey("device", device);
}

function getTopologyNode(device: string, port: string, key: string, speakerCount: number, speakerType: "吸顶" | "壁挂"): TopologyNode {
  if (key === "mainMic") return { key, label: "阵麦", kind: "mainMic" };
  if (key.startsWith("arrayMic-")) {
    const index = Number(key.slice("arrayMic-".length));
    return { key, label: Number.isFinite(index) ? `阵麦 ${index}` : "阵麦", kind: "mainMic" };
  }
  if (key === "processorHost") return { key, label: "智能音频处理主机", kind: "processor" };
  if (isTopologySpeakerKey(key)) return { key, label: getTopologySpeakerLabel(speakerType), kind: "speaker", quantity: getTopologySpeakerQuantity(key, speakerCount) };
  if (key === "amplifier") return { key, label: "功放", kind: "amplifier", quantity: getTopologyQuantityFromText(device) };
  if (key === "mixer") return { key, label: "调音台", kind: "mixer", quantity: getTopologyQuantityFromText(device) };
  if (key === "processor") return { key, label: device.includes("反馈抑制") ? "反馈抑制器" : "处理器", kind: "processor", quantity: getTopologyQuantityFromText(device) };
  if (key === "legacySound") return { key, label: "原音频系统", kind: "legacy" };
  if (key === "legacy-mixer") return { key, label: "利旧调音台", kind: "mixer", quantity: getTopologyQuantityFromText(device) };
  if (key === "legacy-processor") return { key, label: "利旧处理器", kind: "processor", quantity: getTopologyQuantityFromText(device) };
  if (key === "legacy-feedback") return { key, label: "利旧反馈抑制器", kind: "processor", quantity: getTopologyQuantityFromText(device) };
  if (key === "legacy-amplifier") return { key, label: "利旧功放", kind: "amplifier", quantity: getTopologyQuantityFromText(device) };
  if (key === "legacy-active-speaker") return { key, label: "利旧有源音箱", kind: "legacy", quantity: getTopologyQuantityFromText(device) };
  if (key === "legacy-passive-speaker") return { key, label: "利旧无源音箱", kind: "legacy", quantity: getTopologyQuantityFromText(device) };
  if (key === "legacyWirelessReceiver") {
    return { key, label: "利旧无线接收机", kind: "wirelessReceiver", quantity: getTopologyQuantityFromText(device), isLegacy: true };
  }
  if (key.startsWith("legacyWirelessMic")) {
    return { key, label: "利旧手持麦", kind: "wireless", quantity: getTopologyQuantityFromText(device), isLegacy: true };
  }
  if (key === "wirelessReceiver") return { key, label: "无线接收机", kind: "wirelessReceiver", quantity: getTopologyQuantityFromText(device) };
  if (key === "wireless") return { key, label: getTopologyWirelessLabel(device), kind: "wireless", quantity: getTopologyQuantityFromText(device) };
  if (key.startsWith("wiredMic")) return { key, label: "有线麦", kind: "wireless", quantity: getTopologyQuantityFromText(device) };
  if (key.startsWith("wirelessMic")) return { key, label: getTopologyWirelessLabel(device), kind: "wireless", quantity: getTopologyQuantityFromText(device) };
  return { key, label: getTopologyShortDeviceLabel(device, port), kind: "computer", quantity: getTopologyQuantityFromText(device) };
}

function getStableTopologyDeviceKey(prefix: string, value: string) {
  return `${prefix}-${value.replace(/\s+/g, "").slice(0, 24)}`;
}

function isTopologySpeaker(device: string, port: string) {
  return device.includes("音箱") || device.includes("音柱") || device.includes("SPK") || port.includes("音箱");
}

function isTopologySpeakerKey(key: string) {
  return key === "speaker-dt" || key === "speaker-amplifier" || key === "speaker";
}

function getTopologySpeakerTypeFromPoints(points: GeneratedPoint[]) {
  const speakers = points.filter((point) => point.type === "speaker");
  if (speakers.length && speakers.every((speaker) => speaker.horizontalAngle === undefined && speaker.downTiltAngle === undefined)) return "吸顶";
  return "壁挂";
}

function getTopologySpeakerLabel(type: "吸顶" | "壁挂") {
  return `${type}音箱`;
}

function getTopologySpeakerQuantity(key: string, speakerCount: number) {
  if (key === "speaker-amplifier") return Math.max(1, getExternalSpeakerCount(speakerCount));
  return Math.max(1, Math.min(speakerCount, MAX_SPEAKERS_PER_DT));
}

function getTopologyWirelessLabel(device: string) {
  if (device.includes("有线")) return "有线麦";
  if (device.includes("手持")) return "手持麦";
  return "手持麦";
}

function getTopologyShortDeviceLabel(device: string, port: string) {
  if (device.includes("ClassIn")) return "ClassIn";
  if (device.includes("中控")) return "中控主机";
  if (device.includes("录播摄像机")) return "录播摄像机";
  if (device.includes("视频会议终端")) return "会议终端";
  if (device.includes("会议一体机")) return "会议屏";
  if (device.includes("一体机")) return "一体机";
  if (device.includes("录播")) return "录播主机";
  if (device.includes("讲台电脑")) return "讲台电脑";
  if (device.includes("笔记本")) return "笔记本";
  if (port.includes("USB")) return "外接设备";
  return device.length > 8 ? `${device.slice(0, 8)}…` : device;
}

function isUnknownTopologyNodeKey(key: string) {
  return key.startsWith("device-");
}

function isLegacyTopologyNodeKey(key: string) {
  return key === "legacySound" || key.startsWith("legacy-");
}

function isLegacyAudioCenterKey(key: string) {
  return LEGACY_AUDIO_CENTER_PRIORITY.includes(key);
}

function isTopologyAllInOneDevice(device: string) {
  return device.includes("一体机") || device.includes("会议屏") || device.includes("ClassIn");
}

function getTopologyQuantityFromText(value: string) {
  const match = value.match(/[×xX]\s*(\d+)/);
  return match ? Number(match[1]) : undefined;
}

const TOPOLOGY_PRIMARY_CABLE_LENGTH = 200;
const TOPOLOGY_SECONDARY_CABLE_LENGTH = 170;
const TOPOLOGY_TERTIARY_CABLE_LENGTH = 120;
const TOPOLOGY_EDGE_GAP = 8;

function getTopologyLayout(devices: string[], blockWidth: number, blockHeight: number, minWidth: number, minHeight: number) {
  const edgePadding = 48;
  const titleBandHeight = 70;
  const bottomPadding = 48;
  const maxCenterDistance = getTopologyMaxCenterDistanceForVisibleCable(blockWidth, blockHeight, TOPOLOGY_PRIMARY_CABLE_LENGTH);
  const expansionMargin = devices.some(isPotentialTopologySatelliteNode) ? maxCenterDistance : 0;
  const radiusX = maxCenterDistance + expansionMargin;
  const radiusY = maxCenterDistance + expansionMargin;
  const width = Math.max(minWidth, edgePadding * 2 + blockWidth + radiusX * 2);
  const height = Math.max(minHeight, titleBandHeight + bottomPadding + blockHeight + radiusY * 2);
  const centerX = width / 2;
  const centerY = titleBandHeight + radiusY + blockHeight / 2;
  const preferredMinX = Math.max(edgePadding, centerX - maxCenterDistance - blockWidth / 2);
  const preferredMaxX = Math.min(width - edgePadding - blockWidth, centerX + maxCenterDistance - blockWidth / 2);
  const preferredMinY = Math.max(titleBandHeight, centerY - maxCenterDistance - blockHeight / 2);
  const preferredMaxY = Math.min(height - bottomPadding - blockHeight, centerY + maxCenterDistance - blockHeight / 2);

  return {
    width,
    height,
    centerX,
    centerY,
    radiusX: maxCenterDistance,
    radiusY: maxCenterDistance,
    minX: edgePadding,
    maxX: width - edgePadding - blockWidth,
    minY: titleBandHeight,
    maxY: height - bottomPadding - blockHeight,
    preferredMinX,
    preferredMaxX,
    preferredMinY,
    preferredMaxY,
    expansionMargin
  };
}

function getTopologyMaxCenterDistanceForVisibleCable(blockWidth: number, blockHeight: number, visibleCableLength: number) {
  return Math.max(
    getTopologyCenterDistanceForVisibleCable(-Math.PI, blockWidth, blockHeight, visibleCableLength),
    getTopologyCenterDistanceForVisibleCable(-Math.PI / 2, blockWidth, blockHeight, visibleCableLength),
    getTopologyCenterDistanceForVisibleCable(-Math.PI / 4, blockWidth, blockHeight, visibleCableLength)
  );
}

function getTopologyCenterDistanceForVisibleCable(angle: number, blockWidth: number, blockHeight: number, visibleCableLength: number) {
  const edgeDistance = getTopologyRectEdgeDistance(angle, blockWidth, blockHeight);
  return visibleCableLength + (edgeDistance + TOPOLOGY_EDGE_GAP) * 2;
}

function getTopologyCenterDistanceForNodes(
  angle: number,
  fromNode: TopologyNode | undefined,
  toNode: TopologyNode | undefined,
  visibleCableLength: number,
  fallbackWidth: number,
  fallbackHeight: number
) {
  const fromSize = fromNode ? getTopologyImageSize(fromNode) : { width: fallbackWidth, height: fallbackHeight };
  const toSize = toNode ? getTopologyImageSize(toNode) : { width: fallbackWidth, height: fallbackHeight };
  return (
    visibleCableLength +
    getTopologyRectEdgeDistance(angle, fromSize.width, fromSize.height) +
    getTopologyRectEdgeDistance(angle + Math.PI, toSize.width, toSize.height) +
    TOPOLOGY_EDGE_GAP * 2
  );
}

function getTopologyImageCenterOffset(blockWidth: number, node: TopologyNode | undefined, fallbackHeight: number) {
  const imageSize = node ? getTopologyImageSize(node) : { width: blockWidth, height: fallbackHeight };
  return {
    x: blockWidth / 2,
    y: 28 + imageSize.height / 2
  };
}

function getTopologyImageCenter(position: { x: number; y: number }, blockWidth: number, node: TopologyNode | undefined, fallbackHeight: number) {
  const offset = getTopologyImageCenterOffset(blockWidth, node, fallbackHeight);
  return {
    x: position.x + offset.x,
    y: position.y + offset.y
  };
}

function getTopologyPositionFromVisibleCable(
  anchorPosition: { x: number; y: number },
  anchorNode: TopologyNode | undefined,
  targetNode: TopologyNode | undefined,
  angle: number,
  visibleCableLength: number,
  blockWidth: number,
  blockHeight: number
) {
  const centerDistance = getTopologyCenterDistanceForNodes(angle, anchorNode, targetNode, visibleCableLength, blockWidth, blockHeight);
  const anchorCenter = getTopologyImageCenter(anchorPosition, blockWidth, anchorNode, blockHeight);
  const targetCenterOffset = getTopologyImageCenterOffset(blockWidth, targetNode, blockHeight);
  return {
    x: anchorCenter.x + Math.cos(angle) * centerDistance - targetCenterOffset.x,
    y: anchorCenter.y + Math.sin(angle) * centerDistance - targetCenterOffset.y
  };
}

function getTopologyRectEdgeDistance(angle: number, blockWidth: number, blockHeight: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const halfWidth = blockWidth / 2;
  const halfHeight = blockHeight / 2;
  const scaleX = Math.abs(cos) > 0.001 ? halfWidth / Math.abs(cos) : Number.POSITIVE_INFINITY;
  const scaleY = Math.abs(sin) > 0.001 ? halfHeight / Math.abs(sin) : Number.POSITIVE_INFINITY;
  return Math.min(scaleX, scaleY);
}

function getRadialTopologyPositions(
  devices: string[],
  edges: TopologyEdge[],
  nodes: TopologyNode[],
  options: {
    centerX: number;
    centerY: number;
    blockWidth: number;
    blockHeight: number;
    radiusX: number;
    radiusY: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    preferredMinX: number;
    preferredMaxX: number;
    preferredMinY: number;
    preferredMaxY: number;
  }
) {
  const mainDevice = getTopologyMainDevice(devices);
  const positions = new Map<string, { x: number; y: number }>();
  const mainX = clampNumber(options.centerX - options.blockWidth / 2, options.minX, options.maxX);
  const mainY = clampNumber(options.centerY - options.blockHeight / 2, options.minY, options.maxY);
  positions.set(mainDevice, { x: mainX, y: mainY });
  const nodeMap = new Map(nodes.map((node) => [node.key, node]));
  const legacySideDevices = getLegacySideTopologyDevices(devices, edges, mainDevice);
  const legacyCenterDevices = getLegacyAudioCenterKeys(devices);
  const firstLevelDevices = new Set([mainDevice, ...legacyCenterDevices]);
  const satelliteAnchors = getTopologySatelliteAnchorMap(edges, mainDevice, new Set(legacyCenterDevices));
  placeLegacyAudioCenters(legacyCenterDevices, positions, mainDevice, nodeMap, firstLevelDevices, options);

  const externalDevices = devices.filter(
    (device) => device !== mainDevice && !legacyCenterDevices.includes(device) && !isTopologySatelliteNode(device) && !satelliteAnchors.has(device)
  );
  if (firstLevelDevices.size === 1) {
    placeSinglePrimaryExternalDevices(externalDevices, positions, mainDevice, nodeMap, firstLevelDevices, options);
  } else {
    externalDevices.forEach((device, index) => {
      const side = legacySideDevices.size ? (legacySideDevices.has(device) ? "left" : "right") : "all";
      const position = getTopologyExternalDevicePosition(device, index, externalDevices.length, positions, mainDevice, nodeMap, firstLevelDevices, side, options);
      positions.set(device, position);
    });
  }
  placeTopologySatelliteDevices(
    devices.filter((device) => isTopologySatelliteNode(device) || satelliteAnchors.has(device)),
    positions,
    satelliteAnchors,
    legacySideDevices,
    nodeMap,
    firstLevelDevices,
    mainDevice,
    options
  );
  return positions;
}

function getCompactTopologyFrame(
  positions: Map<string, { x: number; y: number }>,
  topologyNodes: TopologyNode[],
  edges: TopologyEdge[],
  blockWidth: number,
  warningCount = 0,
  centeredDeviceKey?: string
) {
  const positionEntries = Array.from(positions.entries());
  if (!positionEntries.length) return { width: 720, height: 480, positions, noteBand: 0 };
  const contentPaddingX = 56;
  const titleBottom = 92;
  const contentBottomPadding = 56;
  const noteBand = warningCount ? warningCount * 18 + 64 : 0;
  const contentBounds = getTopologyContentBounds(positions, topologyNodes, edges, blockWidth);
  const centeredDevice = centeredDeviceKey ? positions.get(centeredDeviceKey) : undefined;
  const anchorCenterX = centeredDevice ? centeredDevice.x + blockWidth / 2 : undefined;
  const contentWidth = contentBounds.maxX - contentBounds.minX;
  const contentHeight = contentBounds.maxY - contentBounds.minY;
  const width = centeredDevice
    ? Math.max(720, Math.max(anchorCenterX! - contentBounds.minX, contentBounds.maxX - anchorCenterX!) * 2 + contentPaddingX * 2)
    : Math.max(720, contentWidth + contentPaddingX * 2);
  const height = Math.max(480, contentHeight + titleBottom + contentBottomPadding + noteBand);
  const dx = centeredDevice ? width / 2 - anchorCenterX! : (width - contentWidth) / 2 - contentBounds.minX;
  const dy = titleBottom - contentBounds.minY;
  const shiftedPositions = new Map(positionEntries.map(([key, position]) => [key, { x: position.x + dx, y: position.y + dy }]));
  return { width, height, positions: shiftedPositions, noteBand };
}

function getTopologyContentBounds(
  positions: Map<string, { x: number; y: number }>,
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  blockWidth: number
) {
  const nodeMap = new Map(nodes.map((node) => [node.key, node]));
  const rects: TopologyRouteRect[] = [];

  nodes.forEach((node) => {
    const position = positions.get(node.key);
    if (!position) return;
    const imageRect = getTopologyNodeImageRect(position, blockWidth, node);
    const label = `${node.label}${node.quantity && node.quantity > 1 ? ` ×${node.quantity}` : ""}`;
    const labelWidth = Math.max(42, label.length * 9.5);
    rects.push(imageRect, {
      x: position.x + blockWidth / 2 - labelWidth / 2,
      y: position.y + 4,
      width: labelWidth,
      height: 20
    });
  });

  edges.forEach((edge) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!from || !to || !fromNode || !toNode) return;
    const route = offsetTopologyRoute(getStraightTopologyRoute(from, to, blockWidth, fromNode, toNode), edge.laneOffset ?? 0);
    const [start, end] = route;
    if (!start || !end) return;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const labelOffset = 12;
    const labelX = (start.x + end.x) / 2 + (-dy / length) * labelOffset;
    const labelY = (start.y + end.y) / 2 + (dx / length) * labelOffset;
    const minX = Math.min(...route.map((point) => point.x));
    const maxX = Math.max(...route.map((point) => point.x));
    const minY = Math.min(...route.map((point) => point.y));
    const maxY = Math.max(...route.map((point) => point.y));
    const labelWidth = Math.max(44, edge.label.length * 9);
    rects.push(
      {
        x: minX - 10,
        y: minY - 10,
        width: maxX - minX + 20,
        height: maxY - minY + 20
      },
      {
        x: labelX - labelWidth / 2 - 8,
        y: labelY - 17,
        width: labelWidth + 16,
        height: 34
      }
    );
  });

  if (!rects.length) return { minX: 0, minY: 0, maxX: 720, maxY: 360 };
  return {
    minX: Math.min(...rects.map((rect) => rect.x)),
    minY: Math.min(...rects.map((rect) => rect.y)),
    maxX: Math.max(...rects.map((rect) => rect.x + rect.width)),
    maxY: Math.max(...rects.map((rect) => rect.y + rect.height))
  };
}

function getTopologyMainDevice(devices: string[]) {
  if (devices.includes("processorHost")) return "processorHost";
  return devices.includes("mainMic") ? "mainMic" : devices[0] ?? "mainMic";
}

function getLegacyAudioCenterKeys(devices: string[]) {
  const center = LEGACY_AUDIO_CENTER_PRIORITY.find((key) => devices.includes(key));
  return center ? [center] : [];
}

function getLegacySideTopologyDevices(devices: string[], edges: TopologyEdge[], mainDevice: string) {
  const result = new Set(devices.filter((device) => device === "legacySound" || device.startsWith("legacy-")));
  let changed = true;
  while (changed) {
    changed = false;
    edges.forEach((edge) => {
      if (edge.from === mainDevice || edge.to === mainDevice) return;
      if (result.has(edge.from) && !result.has(edge.to)) {
        result.add(edge.to);
        changed = true;
      }
      if (result.has(edge.to) && !result.has(edge.from)) {
        result.add(edge.from);
        changed = true;
      }
    });
  }
  return result;
}

function placeLegacyAudioCenters(
  devices: string[],
  positions: Map<string, { x: number; y: number }>,
  mainDevice: string,
  nodeMap: Map<string, TopologyNode>,
  firstLevelDevices: Set<string>,
  options: {
    centerX: number;
    centerY: number;
    blockWidth: number;
    blockHeight: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }
) {
  if (!devices.length) return;
  const mainPosition =
    positions.get(mainDevice) ?? {
      x: options.centerX - options.blockWidth / 2,
      y: options.centerY - options.blockHeight / 2
    };
  const mainNode = nodeMap.get(mainDevice);
  const slots = devices.length === 1 ? [-1] : [-1, 1];
  devices.forEach((device, index) => {
    const side = slots[index] ?? 1;
    const angle = side < 0 ? Math.PI : 0;
    const rawPosition = getTopologyPositionFromVisibleCable(
      mainPosition,
      mainNode,
      nodeMap.get(device),
      angle,
      getTopologyVisibleCableLengthForLink(mainDevice, device, firstLevelDevices),
      options.blockWidth,
      options.blockHeight
    );
    positions.set(device, {
      x: rawPosition.x,
      y: rawPosition.y
    });
  });
}

function getTopologyExternalDevicePosition(
  device: string,
  index: number,
  total: number,
  positions: Map<string, { x: number; y: number }>,
  mainDevice: string,
  nodeMap: Map<string, TopologyNode>,
  firstLevelDevices: Set<string>,
  side: "left" | "right" | "all",
  options: {
    centerX: number;
    centerY: number;
    blockWidth: number;
    blockHeight: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    preferredMinX: number;
    preferredMaxX: number;
    preferredMinY: number;
    preferredMaxY: number;
  }
) {
  const candidateCount = Math.max(24, total * 3);
  const preferredAngle = getTopologyPreferredAngle(index, total, side);
  const mainPosition =
    positions.get(mainDevice) ?? {
      x: options.centerX - options.blockWidth / 2,
      y: options.centerY - options.blockHeight / 2
    };
  const mainNode = nodeMap.get(mainDevice);
  const candidates = getTopologyCandidateAngles(candidateCount).map((angle, candidateIndex) => {
    const rawPosition = getTopologyPositionFromVisibleCable(
      mainPosition,
      mainNode,
      nodeMap.get(device),
      angle,
      getTopologyVisibleCableLengthForLink(mainDevice, device, firstLevelDevices),
      options.blockWidth,
      options.blockHeight
    );
    return {
      ...rawPosition,
      score: scoreTopologyExternalCandidate(device, rawPosition, rawPosition, positions, mainDevice, side, options, getTopologyAngleDistance(angle, preferredAngle), candidateIndex)
    };
  });
  return candidates.sort((a, b) => a.score - b.score)[0] ?? {
    x: options.centerX - options.blockWidth / 2,
    y: options.centerY - options.blockHeight / 2
  };
}

function placeSinglePrimaryExternalDevices(
  devices: string[],
  positions: Map<string, { x: number; y: number }>,
  mainDevice: string,
  nodeMap: Map<string, TopologyNode>,
  firstLevelDevices: Set<string>,
  options: {
    centerX: number;
    centerY: number;
    blockWidth: number;
    blockHeight: number;
  }
) {
  const mainPosition =
    positions.get(mainDevice) ?? {
      x: options.centerX - options.blockWidth / 2,
      y: options.centerY - options.blockHeight / 2
    };
  const mainNode = nodeMap.get(mainDevice);
  const orderedDevices = [...devices].sort((a, b) => getTopologySinglePrimaryAnglePriority(a, nodeMap) - getTopologySinglePrimaryAnglePriority(b, nodeMap));
  orderedDevices.forEach((device, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(1, orderedDevices.length);
    const position = getTopologyPositionFromVisibleCable(
      mainPosition,
      mainNode,
      nodeMap.get(device),
      angle,
      getTopologyVisibleCableLengthForLink(mainDevice, device, firstLevelDevices),
      options.blockWidth,
      options.blockHeight
    );
    positions.set(device, position);
  });
}

function getTopologySinglePrimaryAnglePriority(device: string, nodeMap: Map<string, TopologyNode>) {
  const label = nodeMap.get(device)?.label ?? device;
  if (device === "slaveMic") return 0;
  if (label.includes("ClassIn") || label.includes("一体机") || label.includes("会议屏")) return 1;
  if (label.includes("中控")) return 2;
  if (label.includes("录播主机")) return 3;
  if (label.includes("录播摄像机")) return 4;
  if (label.includes("有线麦")) return 5;
  if (label.includes("无线接收机")) return 6;
  if (label.includes("功放")) return 7;
  if (label.includes("音箱")) return 8;
  return 20;
}

function getTopologyCandidateAngles(candidateCount: number) {
  return Array.from({ length: candidateCount }, (_, index) => -Math.PI / 2 + (index * Math.PI * 2) / candidateCount);
}

function getTopologyPreferredAngle(index: number, total: number, side: "left" | "right" | "all") {
  if (side === "left") return Math.PI / 2 + ((index + 0.5) * Math.PI) / Math.max(1, total);
  if (side === "right") return -Math.PI / 2 + ((index + 0.5) * Math.PI) / Math.max(1, total);
  return -Math.PI / 2 + (index * Math.PI * 2) / Math.max(1, total);
}

function scoreTopologyExternalCandidate(
  device: string,
  position: { x: number; y: number },
  rawPosition: { x: number; y: number },
  positions: Map<string, { x: number; y: number }>,
  mainDevice: string,
  side: "left" | "right" | "all",
  options: {
    centerX: number;
    blockWidth: number;
    blockHeight: number;
    preferredMinX: number;
    preferredMaxX: number;
    preferredMinY: number;
    preferredMaxY: number;
  },
  preferredAngleDistance: number,
  priority: number
) {
  const rect = getTopologyNodeRect(position, options.blockWidth, options.blockHeight, 10);
  const preferredRect = {
    x: options.preferredMinX,
    y: options.preferredMinY,
    width: options.preferredMaxX - options.preferredMinX,
    height: options.preferredMaxY - options.preferredMinY
  };
  const mainPosition = positions.get(mainDevice);
  const mainRect = mainPosition ? getTopologyNodeRect(mainPosition, options.blockWidth, options.blockHeight, 24) : undefined;
  const occupiedOverlapCount = Array.from(positions.entries())
    .filter(([key]) => key !== device && key !== mainDevice)
    .map(([, item]) => getTopologyNodeRect(item, options.blockWidth, options.blockHeight, 12))
    .filter((item) => doTopologyRectsOverlap(rect, item)).length;
  const clampDistance = Math.abs(rawPosition.x - position.x) + Math.abs(rawPosition.y - position.y);
  const softExpansionDistance = getTopologyDistanceOutsideRect(position, preferredRect);
  const sidePenalty = getTopologySidePenalty(position, side, options.centerX, options.blockWidth);
  return (
    clampDistance * 2000 +
    (mainRect && doTopologyRectsOverlap(rect, mainRect) ? 500000 : 0) +
    occupiedOverlapCount * 900000 +
    sidePenalty * 900 +
    softExpansionDistance * 180 +
    preferredAngleDistance * 1200 +
    priority
  );
}

function getTopologyAngleDistance(angle: number, target: number) {
  const diff = Math.abs(Math.atan2(Math.sin(angle - target), Math.cos(angle - target)));
  return diff;
}

function getTopologySidePenalty(position: { x: number; y: number }, side: "left" | "right" | "all", centerX: number, blockWidth: number) {
  const nodeCenterX = position.x + blockWidth / 2;
  if (side === "left") return Math.max(0, nodeCenterX - centerX);
  if (side === "right") return Math.max(0, centerX - nodeCenterX);
  return 0;
}

function isTopologySatelliteNode(key: string) {
  return key === "speaker-amplifier" || key.startsWith("arrayMic-") || isTopologyWirelessMicKey(key);
}

function isPotentialTopologySatelliteNode(key: string) {
  return isTopologySatelliteNode(key) || key.startsWith("legacy-");
}

function getTopologySatelliteAnchorMap(edges: TopologyEdge[], mainDevice: string, legacyCenterDevices: Set<string>) {
  const anchors = new Map<string, string>();
  edges.forEach((edge) => {
    if (isTopologyWirelessMicKey(edge.from) && isTopologyWirelessReceiverKey(edge.to)) {
      anchors.set(edge.from, edge.to);
      return;
    }
    if (isLegacyAudioCenterKey(edge.to) && !isLegacyTopologyNodeKey(edge.from) && edge.from !== mainDevice) {
      anchors.set(edge.from, edge.to);
      return;
    }
    if (isLegacyAudioCenterKey(edge.from) && isLegacyAudioCenterKey(edge.to)) {
      if (!legacyCenterDevices.has(edge.to)) anchors.set(edge.to, edge.from);
      return;
    }
    if (edge.from !== mainDevice && edge.to !== mainDevice) anchors.set(edge.to, edge.from);
  });
  return anchors;
}

function getTopologySatelliteAnchorKey(key: string, positions: Map<string, { x: number; y: number }>, satelliteAnchors: Map<string, string>) {
  const anchorKey = satelliteAnchors.get(key);
  if (anchorKey && positions.has(anchorKey)) return anchorKey;
  if (key === "speaker-amplifier" && positions.has("amplifier")) return "amplifier";
  const receiverKey = getTopologyWirelessReceiverKey(key);
  if (receiverKey && positions.has(receiverKey)) return receiverKey;
  return positions.has("processorHost") ? "processorHost" : "mainMic";
}

function getTopologyRequiredSatelliteAnchorKey(key: string, satelliteAnchors: Map<string, string>) {
  return satelliteAnchors.get(key) ?? (key === "speaker-amplifier" ? "amplifier" : getTopologyWirelessReceiverKey(key));
}

function isTopologyWirelessMicKey(key: string) {
  return key.startsWith("wirelessMic") || key.startsWith("legacyWirelessMic");
}

function isTopologyWirelessReceiverKey(key: string) {
  return key === "wirelessReceiver" || key === "legacyWirelessReceiver";
}

function getTopologyWirelessReceiverKey(key: string) {
  if (key.startsWith("legacyWirelessMic")) return "legacyWirelessReceiver";
  if (key.startsWith("wirelessMic")) return "wirelessReceiver";
  return "";
}

function placeTopologySatelliteDevices(
  devices: string[],
  positions: Map<string, { x: number; y: number }>,
  satelliteAnchors: Map<string, string>,
  legacySideDevices: Set<string>,
  nodeMap: Map<string, TopologyNode>,
  firstLevelDevices: Set<string>,
  mainDevice: string,
  options: {
    centerX: number;
    blockWidth: number;
    blockHeight: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    radiusX: number;
    radiusY: number;
    preferredMinX: number;
    preferredMaxX: number;
    preferredMinY: number;
    preferredMaxY: number;
  }
) {
  const pending = new Set(devices);
  while (pending.size) {
    let placedThisPass = false;
    Array.from(pending).forEach((device) => {
      const requiredAnchorKey = getTopologyRequiredSatelliteAnchorKey(device, satelliteAnchors);
      if (requiredAnchorKey && !positions.has(requiredAnchorKey)) return;
      const anchorKey = getTopologySatelliteAnchorKey(device, positions, satelliteAnchors);
      const anchor = positions.get(anchorKey) ?? positions.get(mainDevice);
      if (!anchor) return;
      const offset = getTopologySatelliteOffset(device, anchor, anchorKey, positions, nodeMap, firstLevelDevices, mainDevice, legacySideDevices.has(device) ? "left" : "right", options);
      const rawPosition = { x: anchor.x + offset.x, y: anchor.y + offset.y };
      positions.set(device, {
        x: rawPosition.x,
        y: rawPosition.y
      });
      pending.delete(device);
      placedThisPass = true;
    });
    if (placedThisPass) continue;
    Array.from(pending).forEach((device) => {
      const anchorKey = getTopologySatelliteAnchorKey(device, positions, satelliteAnchors);
      const anchor = positions.get(anchorKey) ?? positions.get(mainDevice);
      if (!anchor) return;
      const offset = getTopologySatelliteOffset(device, anchor, anchorKey, positions, nodeMap, firstLevelDevices, mainDevice, legacySideDevices.has(device) ? "left" : "right", options);
      const rawPosition = { x: anchor.x + offset.x, y: anchor.y + offset.y };
      positions.set(device, {
        x: rawPosition.x,
        y: rawPosition.y
      });
      pending.delete(device);
    });
  }
}

function getTopologySatelliteOffset(
  device: string,
  anchor: { x: number; y: number },
  anchorKey: string,
  positions: Map<string, { x: number; y: number }>,
  nodeMap: Map<string, TopologyNode>,
  firstLevelDevices: Set<string>,
  mainDevice: string,
  side: "left" | "right" | "all",
  options: {
    centerX: number;
    blockWidth: number;
    blockHeight: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    radiusX: number;
    radiusY: number;
    preferredMinX: number;
    preferredMaxX: number;
    preferredMinY: number;
    preferredMaxY: number;
  }
) {
  const visibleCableLength = getTopologyVisibleCableLengthForLink(anchorKey, device, firstLevelDevices);
  const candidates = getTopologyCandidateAngles(12).map((angle, angleIndex) => {
    const rawPosition = getTopologyPositionFromVisibleCable(
      anchor,
      nodeMap.get(anchorKey),
      nodeMap.get(device),
      angle,
      visibleCableLength,
      options.blockWidth,
      options.blockHeight
    );
    return {
      x: rawPosition.x - anchor.x,
      y: rawPosition.y - anchor.y,
      visibleCableLength,
      priority: angleIndex
    };
  });
  const fallbackPosition = getTopologyPositionFromVisibleCable(anchor, nodeMap.get(anchorKey), nodeMap.get(device), 0, visibleCableLength, options.blockWidth, options.blockHeight);
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreTopologySatelliteCandidate(device, anchor, candidate, positions, mainDevice, side, options)
    }))
    .sort((a, b) => a.score - b.score)[0] ?? {
      x: fallbackPosition.x - anchor.x,
      y: fallbackPosition.y - anchor.y
    };
}

function isTopologyThirdLevelDevice(device: string) {
  if (isTopologyWirelessMicKey(device)) return true;
  return device === "speaker-amplifier" || device === "legacy-passive-speaker" || device === "legacy-active-speaker";
}

function isTopologyFirstLevelDevice(device: string, firstLevelDevices?: Set<string>) {
  if (firstLevelDevices) return firstLevelDevices.has(device);
  return device === "mainMic" || device === "mixer" || device === "processor" || device === "legacy-mixer" || device === "legacy-processor";
}

function isTopologySecondLevelDevice(device: string) {
  return (
    device === "slaveMic" ||
    device.startsWith("arrayMic-") ||
    device === "amplifier" ||
    device === "legacy-amplifier" ||
    device === "legacy-feedback" ||
    isTopologyWirelessReceiverKey(device) ||
    device === "speaker-dt" ||
    device.startsWith("wiredMic")
  );
}

function getTopologyVisibleCableLengthForLink(fromDevice: string, toDevice: string, firstLevelDevices?: Set<string>) {
  if (isTopologyFirstLevelDevice(fromDevice, firstLevelDevices) && isTopologyFirstLevelDevice(toDevice, firstLevelDevices)) return TOPOLOGY_PRIMARY_CABLE_LENGTH;
  if (
    (isTopologySecondLevelDevice(fromDevice) && isTopologyThirdLevelDevice(toDevice)) ||
    (isTopologyThirdLevelDevice(fromDevice) && isTopologySecondLevelDevice(toDevice))
  ) {
    return TOPOLOGY_TERTIARY_CABLE_LENGTH;
  }
  return TOPOLOGY_SECONDARY_CABLE_LENGTH;
}

function scoreTopologySatelliteCandidate(
  device: string,
  anchor: { x: number; y: number },
  offset: { x: number; y: number; visibleCableLength: number; priority: number },
  positions: Map<string, { x: number; y: number }>,
  mainDevice: string,
  side: "left" | "right" | "all",
  options: {
    centerX: number;
    blockWidth: number;
    blockHeight: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    preferredMinX: number;
    preferredMaxX: number;
    preferredMinY: number;
    preferredMaxY: number;
  }
) {
  const rawPosition = { x: anchor.x + offset.x, y: anchor.y + offset.y };
  const position = {
    x: clampNumber(rawPosition.x, options.minX, options.maxX),
    y: clampNumber(rawPosition.y, options.minY, options.maxY)
  };
  const rect = getTopologyNodeRect(position, options.blockWidth, options.blockHeight, 8);
  const preferredRect = {
    x: options.preferredMinX,
    y: options.preferredMinY,
    width: options.preferredMaxX - options.preferredMinX,
    height: options.preferredMaxY - options.preferredMinY
  };
  const softExpansionDistance = getTopologyDistanceOutsideRect(position, preferredRect);
  const mainPosition = positions.get(mainDevice);
  const mainRect = mainPosition ? getTopologyNodeRect(mainPosition, options.blockWidth, options.blockHeight, 24) : undefined;
  const occupiedRects = Array.from(positions.entries())
    .filter(([key]) => key !== device && key !== mainDevice)
    .map(([, item]) => getTopologyNodeRect(item, options.blockWidth, options.blockHeight, 10));
  const clampDistance = Math.abs(rawPosition.x - position.x) + Math.abs(rawPosition.y - position.y);
  const sidePenalty = getTopologySidePenalty(position, side, options.centerX, options.blockWidth);
  const mainOverlap = mainRect && doTopologyRectsOverlap(rect, mainRect);
  const occupiedOverlapCount = occupiedRects.filter((item) => doTopologyRectsOverlap(rect, item)).length;
  const mainDistance = mainPosition
    ? Math.abs(position.x - mainPosition.x) + Math.abs(position.y - mainPosition.y)
    : options.blockWidth + options.blockHeight;
  const anchorMainDistance = mainPosition
    ? Math.abs(anchor.x - mainPosition.x) + Math.abs(anchor.y - mainPosition.y)
    : options.blockWidth + options.blockHeight;
  const movesTowardMain = mainPosition ? mainDistance < anchorMainDistance : false;
  const blocksMainCorridor =
    mainPosition &&
    doTopologyRectsOverlap(
      rect,
      getTopologyNodeRect(
        {
          x: Math.min(anchor.x, mainPosition.x),
          y: Math.min(anchor.y, mainPosition.y) - options.blockHeight * 0.16
        },
        Math.abs(anchor.x - mainPosition.x) + options.blockWidth,
        Math.abs(anchor.y - mainPosition.y) + options.blockHeight * 0.32,
        0
      )
    );
  return (
    clampDistance * 2000 +
    (mainOverlap ? 500000 : 0) +
    sidePenalty * 900 +
    (blocksMainCorridor ? 260000 : 0) +
    (movesTowardMain ? 180000 : 0) +
    occupiedOverlapCount * 900000 +
    softExpansionDistance * 220 +
    Math.max(0, options.blockWidth * 1.1 - mainDistance) * 900 +
    offset.priority * 60
  );
}

function getTopologyDistanceOutsideRect(position: { x: number; y: number }, rect: TopologyRouteRect) {
  const dx = position.x < rect.x ? rect.x - position.x : position.x > rect.x + rect.width ? position.x - (rect.x + rect.width) : 0;
  const dy = position.y < rect.y ? rect.y - position.y : position.y > rect.y + rect.height ? position.y - (rect.y + rect.height) : 0;
  return dx + dy;
}

function getTopologyNodeRect(position: { x: number; y: number }, width: number, height: number, padding = 0) {
  return {
    x: position.x - padding,
    y: position.y - padding,
    width: width + padding * 2,
    height: height + padding * 2
  };
}

function doTopologyRectsOverlap(a: TopologyRouteRect, b: TopologyRouteRect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

type TopologyRoutePoint = { x: number; y: number };
type TopologyRouteRect = { x: number; y: number; width: number; height: number };

function TopologyEdgeLine({
  edge,
  from,
  to,
  fromNode,
  toNode,
  blockWidth
}: {
  edge: TopologyEdge;
  from: { x: number; y: number };
  to: { x: number; y: number };
  fromNode: TopologyNode;
  toNode: TopologyNode;
  blockWidth: number;
}) {
  const route = offsetTopologyRoute(getStraightTopologyRoute(from, to, blockWidth, fromNode, toNode), edge.laneOffset ?? 0);
  const [start, end] = route;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const labelOffset = 12;
  const labelX = (start.x + end.x) / 2 + (-dy / length) * labelOffset;
  const labelY = (start.y + end.y) / 2 + (dx / length) * labelOffset;
  const labelAngle = normalizeTopologyLabelAngle((Math.atan2(dy, dx) * 180) / Math.PI);
  const lineClass = getTopologyEdgeLineClass(edge.label);
  const lineColor = getTopologyEdgeLineColor(edge.label);
  const markerId = getTopologyArrowMarkerId(edge, route);
  const isBidirectional = isBidirectionalTopologyEdge(edge.label);

  return (
    <g>
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="strokeWidth">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={lineColor} />
        </marker>
      </defs>
      <polyline
        points={route.map((point) => `${roundTopologyRouteValue(point.x)},${roundTopologyRouteValue(point.y)}`).join(" ")}
        className={`cadLine ${lineClass}`}
        markerStart={isBidirectional ? `url(#${markerId})` : undefined}
        markerEnd={`url(#${markerId})`}
      />
      {renderTopologyCableLabel(edge.label, labelX, labelY, labelAngle, lineColor)}
    </g>
  );
}

function offsetTopologyRoute(route: TopologyRoutePoint[], offset: number) {
  if (!offset || route.length < 2) return route;
  const start = route[0];
  const end = route[route.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const offsetX = (-dy / length) * offset;
  const offsetY = (dx / length) * offset;
  return route.map((point) => ({ x: point.x + offsetX, y: point.y + offsetY }));
}

function renderTopologyCableLabel(label: string, x: number, y: number, angle: number, color: string) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      className="cadSmall"
      transform={`rotate(${roundTopologyRouteValue(angle)} ${roundTopologyRouteValue(x)} ${roundTopologyRouteValue(y)})`}
      style={{ fill: color, paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 4, strokeLinejoin: "round" }}
    >
      {label}
    </text>
  );
}

function getTopologyArrowMarkerId(edge: TopologyEdge, route: TopologyRoutePoint[]) {
  const first = route[0] ?? { x: 0, y: 0 };
  const last = route[route.length - 1] ?? { x: 0, y: 0 };
  return `topology-arrow-${edge.id}-${Math.round(first.x)}-${Math.round(first.y)}-${Math.round(last.x)}-${Math.round(last.y)}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function isBidirectionalTopologyEdge(label: string) {
  return label.includes("USB");
}

function getStraightTopologyRoute(
  from: { x: number; y: number },
  to: { x: number; y: number },
  blockWidth: number,
  fromNode: TopologyNode,
  toNode: TopologyNode
) {
  const fromRect = getTopologyNodeImageRect(from, blockWidth, fromNode);
  const toRect = getTopologyNodeImageRect(to, blockWidth, toNode);
  const startCenter = getTopologyRectCenter(fromRect);
  const endCenter = getTopologyRectCenter(toRect);
  return [
    getTopologyRectEdgePoint(startCenter, endCenter, fromRect.width, fromRect.height),
    getTopologyRectEdgePoint(endCenter, startCenter, toRect.width, toRect.height)
  ];
}

function getTopologyNodeImageRect(position: { x: number; y: number }, blockWidth: number, node: TopologyNode) {
  const imageSize = getTopologyImageSize(node);
  return {
    x: position.x + (blockWidth - imageSize.width) / 2,
    y: position.y + 28,
    width: imageSize.width,
    height: imageSize.height
  };
}

function getTopologyRectCenter(rect: TopologyRouteRect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

function roundTopologyRouteValue(value: number) {
  return Math.round(value * 10) / 10;
}

function getTopologyRectEdgePoint(fromCenter: TopologyRoutePoint, towardCenter: TopologyRoutePoint, blockWidth: number, blockHeight: number) {
  const dx = towardCenter.x - fromCenter.x;
  const dy = towardCenter.y - fromCenter.y;
  const length = Math.hypot(dx, dy) || 1;
  const halfWidth = blockWidth / 2;
  const halfHeight = blockHeight / 2;
  const scaleX = Math.abs(dx) > 0.001 ? halfWidth / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const scaleY = Math.abs(dy) > 0.001 ? halfHeight / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const edgeScale = Math.min(scaleX, scaleY);
  return {
    x: fromCenter.x + dx * edgeScale + (dx / length) * TOPOLOGY_EDGE_GAP,
    y: fromCenter.y + dy * edgeScale + (dy / length) * TOPOLOGY_EDGE_GAP
  };
}

function normalizeTopologyLabelAngle(angle: number) {
  if (angle > 90) return angle - 180;
  if (angle < -90) return angle + 180;
  return angle;
}

function getTopologyEdgeLineClass(label: string) {
  if (label.includes("无法") || label.includes("待确认")) return "black";
  if (label.includes("USB")) return "usb";
  if (label.includes("网线")) return "ethernet";
  if (label.includes("无线信号")) return "wireless";
  if (label.includes("音频")) return "audio";
  if (label.includes("音箱")) return "speaker";
  return "black";
}

function getTopologyEdgeLineColor(label: string) {
  if (label.includes("无法")) return "#dc2626";
  if (label.includes("待确认")) return "#b45309";
  if (label.includes("USB")) return "#2563eb";
  if (label.includes("网线")) return "#7c3aed";
  if (label.includes("无线信号")) return "#16a34a";
  if (label.includes("音频")) return "#0f766e";
  if (label.includes("音箱")) return "#b45309";
  return "#111827";
}

function TopologyDeviceBlock({ x, y, w, node }: { x: number; y: number; w: number; h: number; node: TopologyNode }) {
  const image = getTopologyDeviceImage(node);
  const imageSize = getTopologyImageSize(node);
  const imageX = x + (w - imageSize.width) / 2;
  const imageY = y + 28;
  const label = formatBrandText(`${node.label}${node.quantity && node.quantity > 1 ? ` ×${node.quantity}` : ""}`);

  return (
    <g>
      <text x={x + w / 2} y={y + 18} textAnchor="middle" className="cadLabel">
        {label}
      </text>
      {image ? (
        <image href={image} x={imageX} y={imageY} width={imageSize.width} height={imageSize.height} preserveAspectRatio="xMidYMid meet" />
      ) : (
        <text x={x + w / 2} y={imageY + imageSize.height / 2 + 4} textAnchor="middle" className="cadSmall" fill="#64748b">
          待确认
        </text>
      )}
    </g>
  );
}

function getTopologyImageSize(node: TopologyNode) {
  if (node.isLineArray) return { width: 116, height: 32 };
  if (node.kind === "mainMic") return { width: 88, height: 66 };
  if (node.kind === "slaveMic") return { width: 66, height: 50 };
  if (node.kind === "speaker" && node.label.includes("吸顶")) return { width: 42, height: 42 };
  if (node.kind === "speaker" && node.label.includes("壁挂")) return { width: 42, height: 82 };
  if (node.kind === "legacy") return { width: 42, height: 82 };
  if (node.kind === "speaker") return { width: 76, height: 70 };
  if (node.kind === "amplifier") return { width: 136, height: 24 };
  if (node.kind === "processor" && node.label.includes("反馈抑制")) return { width: 136, height: 22 };
  if (node.kind === "processor") return { width: 136, height: 26 };
  if (node.kind === "mixer") return { width: 72, height: 78 };
  if (node.kind === "wirelessReceiver") return { width: 116, height: 66 };
  if (node.kind === "wireless" && node.label.includes("手持麦")) return { width: 26, height: 88 };
  if (node.kind === "wireless" && node.label === "有线麦") return { width: 70, height: 88 };
  if (node.kind === "wireless") return { width: 42, height: 70 };
  if (node.kind === "computer" && node.label === "笔记本") return { width: 96, height: 54 };
  if (node.kind === "computer" && node.label === "讲台电脑") return { width: 86, height: 78 };
  if (node.kind === "computer" && node.label === "录播主机") return { width: 132, height: 42 };
  if (node.kind === "computer" && node.label === "录播摄像机") return { width: 92, height: 46 };
  if (node.kind === "computer" && node.label === "中控主机") return { width: 126, height: 30 };
  if (node.kind === "computer" && node.label === "会议终端") return { width: 92, height: 70 };
  if (node.kind === "computer" && isAllInOneTopologyLabel(node.label)) return { width: 88, height: 50 };
  return { width: 82, height: 58 };
}

function getTopologyDeviceImage(node: TopologyNode) {
  if (node.isLineArray) return lineArrayMicImage;
  if (node.kind === "mainMic" || node.kind === "slaveMic") return getAppBrand().id === "yinman" ? yinmanArrayMicTopologyImage : topologyArrayMicImage;
  if (node.kind === "speaker" && node.label.includes("吸顶")) return topologyCeilingSpeakerImage;
  if (node.kind === "speaker" && node.label.includes("壁挂")) return topologyWallSpeakerImage;
  if (node.kind === "legacy") return topologyWallSpeakerImage;
  if (node.kind === "processor" && node.label.includes("反馈抑制")) return topologyFeedbackSuppressorImage;
  if (node.kind === "processor" && getAppBrand().id === "yinman" && node.label.includes("智能音频处理主机")) return yinmanAudioProcessorImage;
  if (node.kind === "processor") return topologyAudioProcessorImage;
  if (node.kind === "mixer") return topologyMixerImage;
  if (node.kind === "wirelessReceiver") return node.isLegacy ? topologyLegacyWirelessReceiverImage : topologyWirelessReceiverImage;
  if (node.kind === "wireless" && node.label.includes("手持麦")) return node.isLegacy ? topologyLegacyHandheldMicImage : topologyHandheldMicImage;
  if (node.kind === "wireless" && node.label === "有线麦") return topologyWiredMicImage;
  if (node.kind === "computer" && node.label === "笔记本") return topologyLaptopImage;
  if (node.kind === "computer" && node.label === "讲台电脑") return topologyPodiumComputerImage;
  if (node.kind === "computer" && node.label === "录播主机") return topologyRecordingHostImage;
  if (node.kind === "computer" && node.label === "录播摄像机") return topologyRecordingCameraImage;
  if (node.kind === "computer" && node.label === "中控主机") return topologyControlHostImage;
  if (node.kind === "computer" && node.label === "会议终端") return topologyVideoConferenceTerminalImage;
  if (node.kind === "computer" && isAllInOneTopologyLabel(node.label)) return topologyAllInOneImage;
  if (node.kind === "amplifier") return topologyAmplifierImage;
  return undefined;
}

function isAllInOneTopologyLabel(label: string) {
  return label.includes("一体机") || label.includes("会议屏") || label.includes("ClassIn");
}

function wrapTopologyLabel(value: string, width: number) {
  const maxChars = Math.max(5, Math.floor(width / 9));
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return [cleaned];
  const first = cleaned.slice(0, maxChars);
  const second = cleaned.slice(maxChars, maxChars * 2 - 1);
  return [first, second.length < cleaned.length - maxChars ? `${second}…` : second].filter(Boolean);
}

function WiringDeviceBlock({ x, y, w, h, title, port }: { x: number; y: number; w: number; h: number; title: string; port: string }) {
  const titleLines = wrapTopologyLabel(title, w - 24);
  const portLines = wrapTopologyLabel(port, w - 24);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="5" fill="#ffffff" stroke="#111827" strokeWidth="1" />
      <text x={x + w / 2} y={y + 19} textAnchor="middle" className="cadLabel">
        {titleLines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={x + w / 2} dy={index === 0 ? 0 : 14}>
            {line}
          </tspan>
        ))}
      </text>
      <text x={x + w / 2} y={y + h - 27} textAnchor="middle" className="cadSmall" fill="#475569">
        {portLines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={x + w / 2} dy={index === 0 ? 0 : 13}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function DistanceAnnotations({
  profile,
  generatedPoints,
  width,
  height
}: {
  profile: ClassroomProfile;
  generatedPoints: GeneratedPoint[];
  width: number;
  height: number;
}) {
  const mics = generatedPoints.filter((point) => point.type === "arrayMic");
  const sortedMics = [...mics].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  const speakers = generatedPoints.filter((point) => point.type === "speaker");
  const rows = getSpeakerRows(speakers);

  return (
    <g>
      <ArrayMicDistanceRail profile={profile} mics={sortedMics} width={width} height={height} />
      <SpeakerDistanceRail profile={profile} rows={rows} width={width} height={height} />
      <HorizontalCoordinateRail profile={profile} points={getSpeakerHorizontalCoordinatePoints(speakers, profile)} width={width} height={height} side="top" deviceLabel="音箱" laneBase={1} />
      <HorizontalCoordinateRail profile={profile} points={sortedMics} width={width} height={height} side="top" deviceLabel="阵麦" laneBase={0} />
    </g>
  );
}

function ArrayMicDistanceRail({
  profile,
  mics,
  width,
  height
}: {
  profile: ClassroomProfile;
  mics: GeneratedPoint[];
  width: number;
  height: number;
}) {
  if (mics.length === 0) return null;
  const room = getCanvasRoomLayout(profile, width, height);
  const railX = room.x - 28;
  const micCanvasPoints = mics.map((mic) => ({ mic, canvas: toCanvasPoint(mic.position, profile, width, height) }));
  const segments = [
    {
      id: "front-to-mic",
      y1: room.y,
      y2: micCanvasPoints[0].canvas.y,
      label: `前墙-阵麦 ${micCanvasPoints[0].mic.position.y.toFixed(1)}m`
    },
    ...micCanvasPoints.slice(1).map(({ mic, canvas }, index) => {
      const previous = micCanvasPoints[index];
      return {
        id: `mic-to-mic-${mic.id}`,
        y1: previous.canvas.y,
        y2: canvas.y,
        label: `阵麦间距 ${getPointDistance(previous.mic, mic).toFixed(1)}m`
      };
    }),
    {
      id: "last-mic-to-back-wall",
      y1: micCanvasPoints[micCanvasPoints.length - 1].canvas.y,
      y2: room.y + room.height,
      label: `阵麦-后墙 ${(profile.roomGeometry.length - micCanvasPoints[micCanvasPoints.length - 1].mic.position.y).toFixed(1)}m`
    }
  ].filter((segment) => Math.abs(segment.y2 - segment.y1) > 6);

  return (
    <g>
      <line x1={railX} y1={room.y} x2={railX} y2={room.y + room.height} stroke="#64748b" strokeWidth="0.65" strokeDasharray="3 3" />
      <circle cx={railX} cy={room.y} r="1.7" fill="#64748b" />
      <circle cx={railX} cy={room.y + room.height} r="1.7" fill="#64748b" />
      {micCanvasPoints.map(({ mic, canvas }, index) => (
        <g key={`mic-rail-dot-${mic.id}`}>
          <circle cx={railX} cy={canvas.y} r="2.2" fill="#64748b" />
          <text x={railX - 6} y={canvas.y - 4} textAnchor="end" className="cadTiny" fill="#475569">
            {index + 1}
          </text>
        </g>
      ))}
      <RailSegmentLabels segments={segments} x={railX - 16} side="left" />
    </g>
  );
}

function SpeakerDistanceRail({
  profile,
  rows,
  width,
  height
}: {
  profile: ClassroomProfile;
  rows: GeneratedPoint[][];
  width: number;
  height: number;
}) {
  if (rows.length === 0) return null;
  const room = getCanvasRoomLayout(profile, width, height);
  const railX = room.x + room.width + 28;
  const rowCanvasPoints = rows.map((row) => ({ row, canvas: toCanvasPoint(row[0].position, profile, width, height) }));
  const segments = [
    {
      id: "front-to-speaker",
      y1: room.y,
      y2: rowCanvasPoints[0].canvas.y,
      label: `前墙-音箱 ${rowCanvasPoints[0].row[0].position.y.toFixed(1)}m`
    },
    ...rowCanvasPoints.slice(1).map(({ row, canvas }, index) => {
      const previous = rowCanvasPoints[index];
      return {
        id: `speaker-row-${index + 1}`,
        y1: previous.canvas.y,
        y2: canvas.y,
        label: `音箱组间距 ${Math.abs(row[0].position.y - previous.row[0].position.y).toFixed(1)}m`
      };
    }),
    {
      id: "last-speaker-to-back-wall",
      y1: rowCanvasPoints[rowCanvasPoints.length - 1].canvas.y,
      y2: room.y + room.height,
      label: `音箱-后墙 ${(profile.roomGeometry.length - rowCanvasPoints[rowCanvasPoints.length - 1].row[0].position.y).toFixed(1)}m`
    }
  ].filter((segment) => Math.abs(segment.y2 - segment.y1) > 6);

  return (
    <g>
      <line x1={railX} y1={room.y} x2={railX} y2={room.y + room.height} stroke="#64748b" strokeWidth="0.65" strokeDasharray="3 3" />
      <circle cx={railX} cy={room.y} r="1.7" fill="#64748b" />
      <circle cx={railX} cy={room.y + room.height} r="1.7" fill="#64748b" />
      {rowCanvasPoints.map(({ canvas }, index) => (
        <g key={`speaker-rail-dot-${index}`}>
          <circle cx={railX} cy={canvas.y} r="2.2" fill="#64748b" />
          <text x={railX + 6} y={canvas.y - 4} textAnchor="start" className="cadTiny" fill="#475569">
            {index + 1}
          </text>
        </g>
      ))}
      <RailSegmentLabels segments={segments} x={railX + 16} side="right" />
    </g>
  );
}

function HorizontalCoordinateRail({
  profile,
  points,
  width,
  height,
  side,
  deviceLabel,
  laneBase = 0
}: {
  profile: ClassroomProfile;
  points: GeneratedPoint[];
  width: number;
  height: number;
  side: "top" | "bottom";
  deviceLabel: string;
  laneBase?: number;
}) {
  if (points.length === 0) return null;
  const room = getCanvasRoomLayout(profile, width, height);
  const railY = side === "top" ? room.y - 8 : room.y + room.height + 34;
  const sorted = [...points].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
  const coordinateItems = sorted.map((point) => {
    const canvas = toCanvasPoint(point.position, profile, width, height);
    return {
      point,
      canvas,
      label: formatHorizontalCoordinateLabel(profile, point.position.x, deviceLabel)
    };
  });
  const labels = getHorizontalCoordinateLabelLayouts(
    dedupeHorizontalCoordinateLabels(coordinateItems),
    railY,
    side,
    laneBase
  );
  return (
    <g>
      <line x1={room.x} y1={railY} x2={room.x + room.width} y2={railY} stroke="#64748b" strokeWidth="0.65" strokeDasharray="3 3" />
      <circle cx={room.x} cy={railY} r="1.7" fill="#64748b" />
      <circle cx={room.x + room.width} cy={railY} r="1.7" fill="#64748b" />
      {labels.map(({ point, canvas, label, labelY }) => {
        return (
          <g key={`${side}-x-rail-${point.id}`}>
            <circle cx={canvas.x} cy={railY} r="2.1" fill="#64748b" />
            <text x={canvas.x} y={labelY} textAnchor="middle" className="cadTiny" fill="#475569">
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function dedupeHorizontalCoordinateLabels(items: Array<{ point: GeneratedPoint; canvas: Point; label: string }>) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.label}|${item.canvas.x.toFixed(1)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatHorizontalCoordinateLabel(profile: ClassroomProfile, x: number, deviceLabel: string) {
  const roomWidth = profile.roomGeometry.width;
  const centerX = roomWidth / 2;
  if (Math.abs(x - centerX) < 0.05) return `${deviceLabel}居中`;
  const leftDistance = x;
  const rightDistance = roomWidth - x;
  if (rightDistance < leftDistance) return `右侧墙-${deviceLabel} ${Math.max(0, rightDistance).toFixed(1)}m`;
  return `左侧墙-${deviceLabel} ${Math.max(0, leftDistance).toFixed(1)}m`;
}

function getSpeakerHorizontalCoordinatePoints(speakers: GeneratedPoint[], profile: ClassroomProfile) {
  const eligible = speakers.filter((speaker) => {
    const isCeiling = speaker.label.includes("吸顶音箱");
    if (isCeiling) return true;
    const isFrontOrBackWall = speaker.position.y <= 0.05 || profile.roomGeometry.length - speaker.position.y <= 0.05;
    return isFrontOrBackWall;
  });
  const rows = getSpeakerRows(eligible);
  const firstRow = rows.sort((a, b) => a[0].position.y - b[0].position.y)[0] ?? [];
  return firstRow;
}

interface RailSegment {
  id: string;
  y1: number;
  y2: number;
  label: string;
}

function RailSegmentLabels({ segments, x, side }: { segments: RailSegment[]; x: number; side: "left" | "right" }) {
  return (
    <>
      {getRailSegmentLabelLayouts(segments, x, side).map((segment) => (
        <RailSegmentLabel key={segment.id} x={segment.x} y={segment.y} label={segment.label} />
      ))}
    </>
  );
}

function RailSegmentLabel({ x, y, label }: { x: number; y: number; label: string }) {
  const width = Math.max(58, label.length * 7 + 12);
  const height = 20;
  return (
    <g transform={`rotate(90 ${x} ${y})`}>
      <rect x={x - width / 2} y={y - height / 2} width={width} height={height} rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.45" opacity="0.96" />
      <text x={x} y={y + 3} textAnchor="middle" className="cadTiny" fill="#334155">
        {label}
      </text>
    </g>
  );
}

function getSpeakerRows(speakers: GeneratedPoint[]) {
  const sorted = [...speakers].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  return sorted.reduce<GeneratedPoint[][]>((rows, speaker) => {
    const row = rows.find((items) => Math.abs(items[0].position.y - speaker.position.y) < 0.8);
    if (row) {
      row.push(speaker);
    } else {
      rows.push([speaker]);
    }
    return rows;
  }, []);
}

function getPointDistance(a: GeneratedPoint, b: GeneratedPoint) {
  return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
}

function getSpeakerGroups(points: GeneratedPoint[]) {
  return getSpeakerOutputGroups(points);
}

function getMergedSpeakerLabelIds(points: GeneratedPoint[], groups: Map<string, string>) {
  const speakers = points.filter((point) => point.type === "speaker");
  if (speakers.length <= 1) return { primaryId: undefined as string | undefined, hiddenIds: new Set<string>() };
  const hiddenIds = new Set<string>();
  const byGroup = new Map<string, GeneratedPoint[]>();
  speakers.forEach((speaker) => {
    const group = groups.get(speaker.id);
    if (!group) return;
    byGroup.set(group, [...(byGroup.get(group) ?? []), speaker]);
  });
  byGroup.forEach((groupSpeakers) => {
    groupSpeakers
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
      .slice(1)
      .forEach((speaker) => hiddenIds.add(speaker.id));
  });
  if (hiddenIds.size > 0) return { primaryId: undefined as string | undefined, hiddenIds };
  const keys = speakers.map(getSpeakerParameterKey);
  const shouldMerge = keys.every((key) => key === keys[0]);
  if (!shouldMerge) return { primaryId: undefined as string | undefined, hiddenIds: new Set<string>() };
  return {
    primaryId: speakers[0].id,
    hiddenIds: new Set(speakers.slice(1).map((point) => point.id))
  };
}

function getSpeakerParameterKey(point: GeneratedPoint) {
  return [
    getShortPointName(point),
    point.installHeight?.toFixed(1) ?? "",
    point.installHeightBase?.toFixed(1) ?? "",
    point.installHeightOffset?.toFixed(1) ?? "",
    point.horizontalAngle ?? "",
    point.downTiltAngle ?? ""
  ].join("|");
}

type LabelSide = "left" | "right" | "center";
type PointLabelLayout = { x: number; y: number; side: LabelSide; width: number; height: number };
type LabelObstacle = { x: number; y: number; width: number; height: number };
type InstallationViewBox = { x: number; y: number; width: number; height: number };
type InstallationRect = { x: number; y: number; width: number; height: number };

function getInstallationVisibleFrame({
  profile,
  width,
  height,
  room,
  generatedPoints,
  generatedPointLabelLayouts,
  hiddenGeneratedLabelIds,
  arrayMicCanvasPoints,
  centralAirPoints,
  legacySpeakerPoints,
  manualArrayMicPoints,
  manualSpeakerPoints,
  micOnly
}: {
  profile: ClassroomProfile;
  width: number;
  height: number;
  room: ReturnType<typeof getCanvasRoomLayout>;
  generatedPoints: GeneratedPoint[];
  generatedPointLabelLayouts: Map<string, PointLabelLayout>;
  hiddenGeneratedLabelIds: Set<string>;
  arrayMicCanvasPoints: Point[];
  centralAirPoints: ClassroomProfile["engineeringConstraints"]["centralAirConditionerPoints"];
  legacySpeakerPoints: LegacySpeakerPoint[];
  manualArrayMicPoints: Point[];
  manualSpeakerPoints: LegacySpeakerPoint[];
  micOnly: boolean;
}): InstallationViewBox {
  const meterPx = getMeterPixels(profile, width, height);
  const rects: InstallationRect[] = [
    { x: room.x - 8, y: room.y - 8, width: room.width + 16, height: room.height + 16 },
    ...getDistanceRailBounds(profile, generatedPoints, width, height),
    ...getHorizontalRailBounds(profile, generatedPoints, width, height)
  ];
  const coverageBounds = {
    minX: room.x - 100,
    minY: room.y - 92,
    maxX: room.x + room.width + 100,
    maxY: room.y + room.height + 92
  };

  generatedPoints.forEach((point) => {
    rects.push(clampInstallationRectToBounds(getGeneratedPointVisibleRect(point, profile, width, height, arrayMicCanvasPoints, meterPx), coverageBounds));
    if (!hiddenGeneratedLabelIds.has(point.id)) {
      const label = generatedPointLabelLayouts.get(point.id);
      if (label) rects.push({ x: label.x - 8, y: label.y - 8, width: label.width + 16, height: label.height + 16 });
    }
  });

  centralAirPoints.forEach((point) => rects.push(...getCentralAirVisibleRects(point, profile, width, height, meterPx)));
  if (!micOnly) {
    legacySpeakerPoints.forEach((point) =>
      rects.push(...getAuxiliarySpeakerVisibleRects(point, profile, width, height, arrayMicCanvasPoints, meterPx, "legacy", coverageBounds))
    );
  }
  manualArrayMicPoints.forEach((point) => rects.push(getManualArrayMicVisibleRect(point, profile, width, height, meterPx)));
  manualSpeakerPoints.forEach((point) => rects.push(...getAuxiliarySpeakerVisibleRects(point, profile, width, height, arrayMicCanvasPoints, meterPx, "manual", coverageBounds)));

  const bounds = getRectUnion(rects);
  const padded = padAndClampInstallationFrame(bounds, width, height, { x: 56, top: 72, bottom: 56 });
  return ensureMinimumInstallationFrame(padded, width, height, 620, 420);
}

function getGeneratedPointVisibleRect(
  point: GeneratedPoint,
  profile: ClassroomProfile,
  width: number,
  height: number,
  arrayMicCanvasPoints: Point[],
  meterPx: number
): InstallationRect {
  const canvasPoint = toCanvasPoint(point.position, profile, width, height);
  if (point.type === "arrayMic") {
    const radius = (point.coverageRadius ?? getArrayMicEffectiveAmplificationRadius(profile)) * meterPx + 10;
    return rectFromCenter(canvasPoint.x, canvasPoint.y, radius * 2, radius * 2);
  }
  if (point.label.includes("吸顶音箱")) {
    const radius = (point.coverageRadius ?? CEILING_SPEAKER_IDEAL_COVERAGE_RADIUS_M) * meterPx + 10;
    return rectFromCenter(canvasPoint.x, canvasPoint.y, radius * 2, radius * 2);
  }
  const coverageLength = (point.coverageRadius ?? 3.5) * meterPx;
  const target =
    point.horizontalAngle !== undefined
      ? clampWallSpeakerTargetCanvasToMountingAngle(canvasPoint, getGeneratedWallSpeakerTarget(canvasPoint, point, profile, width, height, coverageLength), profile, width, height)
      : getWallSpeakerTarget(canvasPoint, arrayMicCanvasPoints, width, height, coverageLength);
  return rectFromPoints([canvasPoint, target], coverageLength * 0.58 + 18);
}

function getCentralAirVisibleRects(
  point: ClassroomProfile["engineeringConstraints"]["centralAirConditionerPoints"][number],
  profile: ClassroomProfile,
  width: number,
  height: number,
  meterPx: number
) {
  const canvasPoint = toCanvasPoint(point.position, profile, width, height);
  const bodyWidth = Math.max(18, point.size.width * meterPx);
  const bodyHeight = Math.max(12, point.size.depth * meterPx);
  const riskPadding = ARRAY_MIC_CENTRAL_AIR_RISK_CLEARANCE_M * meterPx + 8;
  const labelWidth = 126;
  const labelHeight = 47;
  return [
    { x: canvasPoint.x - bodyWidth / 2 - riskPadding, y: canvasPoint.y - bodyHeight / 2 - riskPadding, width: bodyWidth + riskPadding * 2, height: bodyHeight + riskPadding * 2 },
    { x: canvasPoint.x + 10, y: canvasPoint.y - labelHeight - 20, width: labelWidth + 12, height: labelHeight + 12 },
    { x: canvasPoint.x - labelWidth - 22, y: canvasPoint.y - labelHeight - 20, width: labelWidth + 12, height: labelHeight + 12 },
    { x: canvasPoint.x + 10, y: canvasPoint.y + 10, width: labelWidth + 12, height: labelHeight + 12 },
    { x: canvasPoint.x - labelWidth - 22, y: canvasPoint.y + 10, width: labelWidth + 12, height: labelHeight + 12 }
  ];
}

function getAuxiliarySpeakerVisibleRects(
  point: LegacySpeakerPoint,
  profile: ClassroomProfile,
  width: number,
  height: number,
  arrayMicCanvasPoints: Point[],
  meterPx: number,
  mode: "legacy" | "manual",
  coverageBounds: { minX: number; minY: number; maxX: number; maxY: number }
) {
  const canvasPoint = toCanvasPoint(point.position, profile, width, height);
  const labelWidth = point.type === "wall" ? 104 : 78;
  const labelLines = point.type === "wall" ? 4 : 2;
  const labelHeight = 12 + labelLines * 12;
  const labelX = clampNumber(canvasPoint.x + 14, 34, width - labelWidth - 28);
  const labelY = clampNumber(canvasPoint.y - labelHeight - 12, 58, height - labelHeight - 44);
  if (point.type === "ceiling") {
    const radius = (mode === "legacy" ? LEGACY_CEILING_SPEAKER_COVERAGE_RADIUS_M : CEILING_SPEAKER_IDEAL_COVERAGE_RADIUS_M) * meterPx + 10;
    return [
      clampInstallationRectToBounds(rectFromCenter(canvasPoint.x, canvasPoint.y, radius * 2, radius * 2), coverageBounds),
      { x: labelX - 8, y: labelY - 8, width: labelWidth + 16, height: labelHeight + 16 }
    ];
  }
  const wallCoverageLength = 3.5 * meterPx;
  const manualTarget = point.target ? toCanvasPoint(point.target, profile, width, height) : undefined;
  const wallTarget =
    manualTarget
      ? clampWallSpeakerTargetCanvasToMountingAngle(canvasPoint, manualTarget, profile, width, height)
      : point.wallAdjustability === "universal"
        ? clampWallSpeakerTargetCanvasToMountingAngle(canvasPoint, getWallSpeakerTarget(canvasPoint, arrayMicCanvasPoints, width, height, wallCoverageLength), profile, width, height)
        : clampWallSpeakerTargetCanvasToMountingAngle(canvasPoint, getFixedLegacyWallSpeakerTarget(canvasPoint, profile, width, height), profile, width, height);
  return [
    clampInstallationRectToBounds(rectFromPoints([canvasPoint, wallTarget], wallCoverageLength * 0.58 + 18), coverageBounds),
    { x: labelX - 8, y: labelY - 8, width: labelWidth + 16, height: labelHeight + 16 }
  ];
}

function getManualArrayMicVisibleRect(point: Point, profile: ClassroomProfile, width: number, height: number, meterPx: number) {
  const canvasPoint = toCanvasPoint(point, profile, width, height);
  const radius = visualSize(0.6 * meterPx, 24, 42) / 2 + 44;
  return rectFromCenter(canvasPoint.x, canvasPoint.y, radius * 2, radius * 2);
}

function getDistanceRailBounds(profile: ClassroomProfile, generatedPoints: GeneratedPoint[], width: number, height: number) {
  const room = getCanvasRoomLayout(profile, width, height);
  const rects: InstallationRect[] = [];
  const mics = generatedPoints.filter((point) => point.type === "arrayMic").sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  if (mics.length) {
    const railX = room.x - 28;
    const micCanvasPoints = mics.map((mic) => ({ mic, canvas: toCanvasPoint(mic.position, profile, width, height) }));
    const segments = [
      { id: "front-to-mic", y1: room.y, y2: micCanvasPoints[0].canvas.y, label: `前墙-阵麦 ${micCanvasPoints[0].mic.position.y.toFixed(1)}m` },
      ...micCanvasPoints.slice(1).map(({ mic, canvas }, index) => ({
        id: `mic-to-mic-${mic.id}`,
        y1: micCanvasPoints[index].canvas.y,
        y2: canvas.y,
        label: `阵麦间距 ${getPointDistance(micCanvasPoints[index].mic, mic).toFixed(1)}m`
      })),
      {
        id: "last-mic-to-back-wall",
        y1: micCanvasPoints[micCanvasPoints.length - 1].canvas.y,
        y2: room.y + room.height,
        label: `阵麦-后墙 ${(profile.roomGeometry.length - micCanvasPoints[micCanvasPoints.length - 1].mic.position.y).toFixed(1)}m`
      }
    ].filter((segment) => Math.abs(segment.y2 - segment.y1) > 6);
    rects.push({ x: railX - 8, y: room.y - 8, width: 16, height: room.height + 16 }, ...getRotatedRailLabelRects(getRailSegmentLabelLayouts(segments, railX - 16, "left")));
  }

  const rows = getSpeakerRows(generatedPoints.filter((point) => point.type === "speaker"));
  if (rows.length) {
    const railX = room.x + room.width + 28;
    const rowCanvasPoints = rows.map((row) => ({ row, canvas: toCanvasPoint(row[0].position, profile, width, height) }));
    const segments = [
      { id: "front-to-speaker", y1: room.y, y2: rowCanvasPoints[0].canvas.y, label: `前墙-音箱 ${rowCanvasPoints[0].row[0].position.y.toFixed(1)}m` },
      ...rowCanvasPoints.slice(1).map(({ row, canvas }, index) => ({
        id: `speaker-row-${index + 1}`,
        y1: rowCanvasPoints[index].canvas.y,
        y2: canvas.y,
        label: `音箱组间距 ${Math.abs(row[0].position.y - rowCanvasPoints[index].row[0].position.y).toFixed(1)}m`
      })),
      {
        id: "last-speaker-to-back-wall",
        y1: rowCanvasPoints[rowCanvasPoints.length - 1].canvas.y,
        y2: room.y + room.height,
        label: `音箱-后墙 ${(profile.roomGeometry.length - rowCanvasPoints[rowCanvasPoints.length - 1].row[0].position.y).toFixed(1)}m`
      }
    ].filter((segment) => Math.abs(segment.y2 - segment.y1) > 6);
    rects.push({ x: railX - 8, y: room.y - 8, width: 16, height: room.height + 16 }, ...getRotatedRailLabelRects(getRailSegmentLabelLayouts(segments, railX + 16, "right")));
  }
  return rects;
}

function getHorizontalRailBounds(profile: ClassroomProfile, generatedPoints: GeneratedPoint[], width: number, height: number) {
  const room = getCanvasRoomLayout(profile, width, height);
  const speakers = generatedPoints.filter((point) => point.type === "speaker");
  const mics = generatedPoints.filter((point) => point.type === "arrayMic").sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  const railY = room.y - 8;
  const items = [
    ...getHorizontalRailLabelRects(profile, getSpeakerHorizontalCoordinatePoints(speakers, profile), width, height, railY, "音箱", 1),
    ...getHorizontalRailLabelRects(profile, mics, width, height, railY, "阵麦", 0)
  ];
  return [{ x: room.x - 8, y: railY - 8, width: room.width + 16, height: 16 }, ...items];
}

function getHorizontalRailLabelRects(profile: ClassroomProfile, points: GeneratedPoint[], width: number, height: number, railY: number, deviceLabel: string, laneBase: number) {
  if (!points.length) return [];
  const items = points
    .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
    .map((point) => ({
      point,
      canvas: toCanvasPoint(point.position, profile, width, height),
      label: formatHorizontalCoordinateLabel(profile, point.position.x, deviceLabel)
    }));
  return getHorizontalCoordinateLabelLayouts(dedupeHorizontalCoordinateLabels(items), railY, "top", laneBase).map((item) => {
    const labelWidth = Math.max(62, item.label.length * 7);
    return { x: item.canvas.x - labelWidth / 2 - 6, y: item.labelY - 15, width: labelWidth + 12, height: 22 };
  });
}

function getRotatedRailLabelRects(labels: Array<{ label: string; x: number; y: number }>) {
  return labels.map((label) => {
    const width = Math.max(58, label.label.length * 7 + 12);
    return { x: label.x - 12, y: label.y - width / 2 - 6, width: 24, height: width + 12 };
  });
}

function getRectUnion(rects: InstallationRect[]) {
  const usable = rects.filter((rect) => Number.isFinite(rect.x) && Number.isFinite(rect.y) && rect.width > 0 && rect.height > 0);
  if (!usable.length) return { minX: 0, minY: 0, maxX: 720, maxY: 420 };
  return {
    minX: Math.min(...usable.map((rect) => rect.x)),
    minY: Math.min(...usable.map((rect) => rect.y)),
    maxX: Math.max(...usable.map((rect) => rect.x + rect.width)),
    maxY: Math.max(...usable.map((rect) => rect.y + rect.height))
  };
}

function padAndClampInstallationFrame(bounds: { minX: number; minY: number; maxX: number; maxY: number }, width: number, height: number, padding: { x: number; top: number; bottom: number }) {
  const x = clampNumber(bounds.minX - padding.x, 0, width);
  const y = clampNumber(bounds.minY - padding.top, 0, height);
  const maxX = clampNumber(bounds.maxX + padding.x, x, width);
  const maxY = clampNumber(bounds.maxY + padding.bottom, y, height);
  return { x, y, width: maxX - x, height: maxY - y };
}

function ensureMinimumInstallationFrame(frame: InstallationViewBox, width: number, height: number, minWidth: number, minHeight: number) {
  const centerX = frame.x + frame.width / 2;
  const centerY = frame.y + frame.height / 2;
  const nextWidth = Math.min(width, Math.max(frame.width, minWidth));
  const nextHeight = Math.min(height, Math.max(frame.height, minHeight));
  return {
    x: clampNumber(centerX - nextWidth / 2, 0, width - nextWidth),
    y: clampNumber(centerY - nextHeight / 2, 0, height - nextHeight),
    width: nextWidth,
    height: nextHeight
  };
}

function rectFromCenter(x: number, y: number, width: number, height: number) {
  return { x: x - width / 2, y: y - height / 2, width, height };
}

function rectFromPoints(points: Point[], padding: number) {
  const minX = Math.min(...points.map((point) => point.x)) - padding;
  const minY = Math.min(...points.map((point) => point.y)) - padding;
  const maxX = Math.max(...points.map((point) => point.x)) + padding;
  const maxY = Math.max(...points.map((point) => point.y)) + padding;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function clampInstallationRectToBounds(rect: InstallationRect, bounds: { minX: number; minY: number; maxX: number; maxY: number }) {
  const x = Math.max(rect.x, bounds.minX);
  const y = Math.max(rect.y, bounds.minY);
  const maxX = Math.min(rect.x + rect.width, bounds.maxX);
  const maxY = Math.min(rect.y + rect.height, bounds.maxY);
  return { x, y, width: Math.max(0, maxX - x), height: Math.max(0, maxY - y) };
}

function getGeneratedPointLabelLayouts(
  profile: ClassroomProfile,
  points: GeneratedPoint[],
  groups: Map<string, string>,
  width: number,
  height: number,
  mergedSpeakerLabelIds: { primaryId?: string; hiddenIds: Set<string> },
  pointBodyObstacles = getGeneratedPointBodyObstacles(profile, points, width, height)
) {
  const layouts = new Map<string, PointLabelLayout>();
  const drafts = points.filter((point) => !mergedSpeakerLabelIds.hiddenIds.has(point.id)).map((point) => {
    const anchor = toCanvasPoint(point.position, profile, width, height);
    const size = getPointLabelSize(point, groups.get(point.id), profile, mergedSpeakerLabelIds.primaryId === point.id ? "其他同理" : undefined);
    const placement = getLabelPlacement(point, profile, anchor, width, height, size.width, size.height, pointBodyObstacles);
    return {
      point,
      anchor,
      width: size.width,
      height: size.height,
      x: placement.x,
      y: placement.y,
      side: placement.side
    };
  });

  const placedLabelObstacles: LabelObstacle[] = [];
  [...drafts]
    .sort((a, b) => a.y - b.y || a.x - b.x || a.anchor.y - b.anchor.y)
    .forEach((draft) => {
      const placement = pickBestLabelPlacement(
        getPointLabelPlacementCandidates(draft.point, profile, draft.anchor, width, height, draft.width, draft.height),
        profile,
        draft.anchor,
        width,
        height,
        draft.width,
        draft.height,
        [...pointBodyObstacles, ...placedLabelObstacles]
      );
      draft.x = placement.x;
      draft.y = placement.y;
      draft.side = placement.side;
      placedLabelObstacles.push({
        x: draft.x - 4,
        y: draft.y - 4,
        width: draft.width + 8,
        height: draft.height + 8
      });
    });

  const byLane = new Map<string, typeof drafts>();
  drafts.forEach((draft) => {
    const laneKey = `${draft.side}:${Math.round(draft.x / 42)}`;
    byLane.set(laneKey, [...(byLane.get(laneKey) ?? []), draft]);
  });

  byLane.forEach((lane) => {
    const sorted = lane.sort((a, b) => a.y - b.y || a.anchor.y - b.anchor.y);
    let cursorY = 54;
    sorted.forEach((draft) => {
      const y = Math.max(draft.y, cursorY);
      draft.y = y;
      cursorY = y + draft.height + 8;
    });
    const overflow = cursorY - (height - 34);
    if (overflow > 0) {
      const shift = overflow / sorted.length;
      sorted.forEach((draft, index) => {
        draft.y -= shift * (index + 1);
      });
    }
  });

  avoidPointLabelDraftOverlaps(drafts, height, pointBodyObstacles);
  drafts.forEach((draft) => {
    layouts.set(draft.point.id, {
      x: clampNumber(draft.x, 10, width - draft.width - 10),
      y: clampNumber(draft.y, 54, height - draft.height - 34),
      side: draft.side,
      width: draft.width,
      height: draft.height
    });
  });

  return layouts;
}

function avoidPointLabelDraftOverlaps<T extends { x: number; y: number; width: number; height: number }>(
  drafts: T[],
  canvasHeight: number,
  fixedObstacles: LabelObstacle[] = []
) {
  const gap = 8;
  const top = 54;
  const bottom = canvasHeight - 34;
  const sorted = [...drafts].sort((a, b) => a.y - b.y || a.x - b.x);
  for (let pass = 0; pass < 6; pass += 1) {
    sorted.forEach((draft, index) => {
      for (let otherIndex = 0; otherIndex < index; otherIndex += 1) {
        const other = sorted[otherIndex];
        if (rectsOverlapWithGap(draft, other, gap)) {
          draft.y = Math.max(draft.y, other.y + other.height + gap);
        }
      }
      fixedObstacles.forEach((obstacle) => {
        if (!rectsOverlapWithGap(draft, obstacle, gap)) return;
        const belowY = obstacle.y + obstacle.height + gap;
        const aboveY = obstacle.y - draft.height - gap;
        const canMoveBelow = belowY + draft.height <= bottom;
        const canMoveAbove = aboveY >= top;
        if (canMoveBelow && (!canMoveAbove || Math.abs(belowY - draft.y) <= Math.abs(aboveY - draft.y))) {
          draft.y = belowY;
        } else if (canMoveAbove) {
          draft.y = aboveY;
        } else {
          draft.y = clampNumber(belowY, top, bottom - draft.height);
        }
      });
      draft.y = clampNumber(draft.y, top, bottom - draft.height);
    });
    const overflow = Math.max(0, ...sorted.map((draft) => draft.y + draft.height - bottom));
    if (overflow <= 0) break;
    sorted.forEach((draft, index) => {
      draft.y = clampNumber(draft.y - overflow * ((index + 1) / sorted.length), top, bottom - draft.height);
    });
  }
}

function rectsOverlapWithGap(a: LabelObstacle, b: LabelObstacle, gap: number) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

function getPointLabelLayoutObstacles(layouts: Map<string, PointLabelLayout>): LabelObstacle[] {
  const padding = 4;
  return [...layouts.values()].map((layout) => ({
    x: layout.x - padding,
    y: layout.y - padding,
    width: layout.width + padding * 2,
    height: layout.height + padding * 2
  }));
}

function getGeneratedPointBodyObstacles(profile: ClassroomProfile, points: GeneratedPoint[], width: number, height: number): LabelObstacle[] {
  const meterPx = getMeterPixels(profile, width, height);
  const micSize = visualSize(0.6 * meterPx, 24, 42);
  const ceilingDiameter = visualSize(0.102 * meterPx * 2, 24, 44);
  const wallBodyWidth = 32;
  const wallBodyHeight = 36;
  const padding = 7;
  return points.map((point) => {
    const canvasPoint = toCanvasPoint(point.position, profile, width, height);
    const bodyWidth = point.type === "arrayMic" ? micSize : point.label.includes("吸顶音箱") ? ceilingDiameter : wallBodyWidth;
    const bodyHeight = point.type === "arrayMic" ? micSize : point.label.includes("吸顶音箱") ? ceilingDiameter : wallBodyHeight;
    return {
      x: canvasPoint.x - bodyWidth / 2 - padding,
      y: canvasPoint.y - bodyHeight / 2 - padding,
      width: bodyWidth + padding * 2,
      height: bodyHeight + padding * 2
    };
  });
}

function getPointLabelSize(point: GeneratedPoint, groupLabel?: string, profile?: ClassroomProfile, extraLine?: string) {
  const lineCount = getPointLabelLines(point, groupLabel, profile, extraLine).length;
  return {
    width: point.horizontalAngle !== undefined ? 118 : 108,
    height: 12 + lineCount * 14
  };
}

function getPointLabelLines(
  point: GeneratedPoint,
  groupLabel?: string,
  profile?: ClassroomProfile,
  extraLine?: string,
  wallLabelContext?: { anchor: { x: number; y: number }; width: number; height: number }
) {
  const wallTarget =
    point.type === "speaker" && !point.label.includes("吸顶音箱") && wallLabelContext && profile && point.horizontalAngle !== undefined
      ? clampWallSpeakerTargetCanvasToMountingAngle(
          wallLabelContext.anchor,
          getGeneratedWallSpeakerTarget(wallLabelContext.anchor, point, profile, wallLabelContext.width, wallLabelContext.height, (point.coverageRadius ?? 3.5) * getMeterPixels(profile, wallLabelContext.width, wallLabelContext.height)),
          profile,
          wallLabelContext.width,
          wallLabelContext.height
        )
      : undefined;
  return [
    getShortPointName(point),
    groupLabel ? `${groupLabel} 分组` : "",
    profile && point.type === "arrayMic"
      ? point.pickupKind === "lineArray"
        ? point.installationMode === "podium"
          ? "讲台摆放 约1.1m"
          : point.installationMode === "tabletop"
            ? "会议桌摆放 约0.75m"
            : point.installHeight
              ? `吊挂安装 约${point.installHeight.toFixed(1)}m`
              : "吊挂安装"
        : getArrayMicInstallLabel(profile)
      : "",
    point.horizontalAngle !== undefined && point.downTiltAngle !== undefined
      ? formatWallSpeakerInstallHeight(point)
      : point.installHeight && point.type !== "arrayMic"
        ? `安装高度 ${point.installHeight.toFixed(1)}m`
        : "",
    point.horizontalAngle !== undefined && point.downTiltAngle !== undefined
      ? wallTarget && wallLabelContext && profile
        ? `水平角度 ${getWallSpeakerMountingAngle(wallLabelContext.anchor, wallTarget, profile, wallLabelContext.width, wallLabelContext.height)}°`
        : `水平摆角 ${formatHorizontalAngle(point.horizontalAngle)}`
      : "",
    point.horizontalAngle !== undefined && point.downTiltAngle !== undefined
      ? `向下倾斜 ${point.downTiltAngle}°`
      : point.installHeight
        ? ""
        : "",
    point.type === "speaker" && point.coverageRadius !== undefined && point.label.includes("吸顶音箱")
      ? `覆盖半径 ${point.coverageRadius.toFixed(1)}m`
      : "",
    extraLine ?? ""
  ].filter(Boolean);
}

function formatWallSpeakerInstallHeight(point: GeneratedPoint) {
  const baseHeight = point.installHeightBase ?? point.installHeight;
  const stepHeight = point.installHeightOffset ?? 0;
  if (baseHeight === undefined) return "";
  if (stepHeight > 0.05) return `安装高度 ${baseHeight.toFixed(1)}m + 阶梯 ${stepHeight.toFixed(1)}m`;
  return `安装高度 ${baseHeight.toFixed(1)}m`;
}

function GeneratedPointMarker({
  point,
  profile,
  width,
  height,
  arrayMicCanvasPoints,
  groupLabel,
  extraLabelLine,
  hideLabel,
  labelPlacement,
  muted = false
}: {
  point: GeneratedPoint;
  profile: ClassroomProfile;
  width: number;
  height: number;
  arrayMicCanvasPoints: Array<{ x: number; y: number }>;
  groupLabel?: string;
  extraLabelLine?: string;
  hideLabel?: boolean;
  labelPlacement?: PointLabelLayout;
  muted?: boolean;
}) {
  const canvasPoint = toCanvasPoint(point.position, profile, width, height);
  const meterPx = getMeterPixels(profile, width, height);
  const micSize = visualSize(0.6 * meterPx, 24, 42);
  const ceilingDiameter = visualSize(0.102 * meterPx * 2, 24, 44);
  const ceilingCoverageRadius = (point.coverageRadius ?? CEILING_SPEAKER_IDEAL_COVERAGE_RADIUS_M) * meterPx;
  const wallCoverageLength = (point.coverageRadius ?? 3.5) * meterPx;
  const wallTarget =
    point.type === "speaker" && !point.label.includes("吸顶音箱") && point.horizontalAngle !== undefined
      ? clampWallSpeakerTargetCanvasToMountingAngle(canvasPoint, getGeneratedWallSpeakerTarget(canvasPoint, point, profile, width, height, wallCoverageLength), profile, width, height)
      : getWallSpeakerTarget(canvasPoint, arrayMicCanvasPoints, width, height, wallCoverageLength);
  const arrayMicRadiusM = point.coverageRadius ?? getArrayMicEffectiveAmplificationRadius(profile);
  const arrayMicRadiusPx = arrayMicRadiusM * meterPx;
  const symbolColor = muted ? "#94a3b8" : pointColors[point.type];
  const coverageStroke = muted ? "#94a3b8" : "#f59e0b";
  const coverageOpacity = muted ? 0.2 : 0.88;
  const coverageRingOpacity = muted ? 0.28 : 0.46;
  const useLineArrayMicImage = point.type === "arrayMic" && point.pickupKind === "lineArray";
  const useYinmanArrayMicImage = point.type === "arrayMic" && !useLineArrayMicImage && getAppBrand().id === "yinman";
  return (
    <g opacity={muted ? 0.62 : 1}>
      {point.type === "arrayMic" ? (
        <>
          {point.pickupPattern === "front180" ? (
            <path
              d={`M ${canvasPoint.x - arrayMicRadiusPx} ${canvasPoint.y} A ${arrayMicRadiusPx} ${arrayMicRadiusPx} 0 0 1 ${canvasPoint.x + arrayMicRadiusPx} ${canvasPoint.y} Z`}
              fill="#00a6a6"
              fillOpacity="0.13"
              stroke="#00a6a6"
              strokeWidth="0.8"
              strokeDasharray="4 4"
            />
          ) : (
            <>
              <circle cx={canvasPoint.x} cy={canvasPoint.y} r={arrayMicRadiusPx} fill="url(#arrayMicCoverageGradient)" filter="url(#arrayMicCoverageBlur)" opacity="0.82" />
              <circle cx={canvasPoint.x} cy={canvasPoint.y} r={arrayMicRadiusPx} fill="none" stroke="#00a6a6" strokeWidth="0.7" strokeDasharray="4 4" opacity="0.28" />
            </>
          )}
          {useLineArrayMicImage ? (
            <image href={lineArrayMicImage} x={canvasPoint.x - micSize} y={canvasPoint.y - micSize * 0.2} width={micSize * 2} height={micSize * 0.4} preserveAspectRatio="xMidYMid meet" />
          ) : useYinmanArrayMicImage ? (
            <image
              href={yinmanArrayMicPointMapImage}
              x={canvasPoint.x - micSize / 2}
              y={canvasPoint.y - micSize / 2}
              width={micSize}
              height={micSize}
              preserveAspectRatio="xMidYMid meet"
            />
          ) : (
            <>
              <rect x={canvasPoint.x - micSize / 2} y={canvasPoint.y - micSize / 2} width={micSize} height={micSize} fill="#ffffff" stroke={pointColors[point.type]} strokeWidth="2" />
              <line x1={canvasPoint.x - micSize / 2} y1={canvasPoint.y - micSize / 2} x2={canvasPoint.x + micSize / 2} y2={canvasPoint.y + micSize / 2} stroke={pointColors[point.type]} />
              <line x1={canvasPoint.x + micSize / 2} y1={canvasPoint.y - micSize / 2} x2={canvasPoint.x - micSize / 2} y2={canvasPoint.y + micSize / 2} stroke={pointColors[point.type]} />
              <ArrayMicDirectionDot x={canvasPoint.x} y={canvasPoint.y - micSize / 2 + 4.8} />
            </>
          )}
        </>
      ) : point.label.includes("吸顶音箱") ? (
        <>
          <circle
            cx={canvasPoint.x}
            cy={canvasPoint.y}
            r={ceilingCoverageRadius}
            fill="url(#speakerCoverageGradient)"
            filter="url(#speakerCoverageBlur)"
            opacity={coverageOpacity}
          />
          <circle
            cx={canvasPoint.x}
            cy={canvasPoint.y}
            r={ceilingCoverageRadius}
            fill="none"
            stroke={coverageStroke}
            strokeWidth="0.65"
            strokeDasharray="5 4"
            opacity={coverageRingOpacity}
          />
          <CeilingSpeakerSymbol x={canvasPoint.x} y={canvasPoint.y} diameter={ceilingDiameter} color={symbolColor} />
        </>
      ) : (
        <WallSpeakerSymbol
          x={canvasPoint.x}
          y={canvasPoint.y}
          targetX={wallTarget.x}
          targetY={wallTarget.y}
          coverageLength={wallCoverageLength}
          color={symbolColor}
          muted={muted}
        />
      )}
      {!hideLabel && <PointLabel point={point} profile={profile} anchor={canvasPoint} width={width} height={height} groupLabel={groupLabel} extraLabelLine={extraLabelLine} labelPlacement={labelPlacement} />}
    </g>
  );
}

function getRailSegmentLabelLayouts(segments: RailSegment[], baseX: number, side: "left" | "right") {
  const laneCount = 4;
  const laneGap = 24;
  const direction = side === "left" ? -1 : 1;
  const laneLastBounds = Array.from({ length: laneCount }, () => ({ y: Number.NEGATIVE_INFINITY, height: 0 }));

  return [...segments]
    .map((segment) => ({
      ...segment,
      y: (segment.y1 + segment.y2) / 2,
      height: Math.max(58, segment.label.length * 7 + 12)
    }))
    .sort((a, b) => a.y - b.y)
    .map((segment, index) => {
      const lane =
        laneLastBounds.findIndex((last) => segment.y - last.y >= (segment.height + last.height) / 2 + 5) >= 0
          ? laneLastBounds.findIndex((last) => segment.y - last.y >= (segment.height + last.height) / 2 + 5)
          : index % laneCount;
      laneLastBounds[lane] = { y: segment.y, height: segment.height };
      return {
        id: segment.id,
        label: segment.label,
        x: baseX + direction * lane * laneGap,
        y: segment.y
      };
    });
}

function getHorizontalCoordinateLabelLayouts(
  items: Array<{ point: GeneratedPoint; canvas: Point; label: string }>,
  railY: number,
  side: "top" | "bottom",
  laneBase: number
) {
  const laneCount = 4;
  const laneGap = side === "top" ? 11 : 13;
  const laneLastBounds = Array.from({ length: laneCount + laneBase }, () => ({ x: Number.NEGATIVE_INFINITY, width: 0 }));

  return [...items]
    .map((item) => ({
      ...item,
      width: Math.max(62, item.label.length * 7)
    }))
    .sort((a, b) => a.canvas.x - b.canvas.x || a.canvas.y - b.canvas.y)
    .map((item, index) => {
      const firstLane = laneBase;
      const lane =
        Array.from({ length: laneCount }, (_, offset) => firstLane + offset).find(
          (candidateLane) => item.canvas.x - laneLastBounds[candidateLane].x >= (item.width + laneLastBounds[candidateLane].width) / 2 + 8
        ) ?? firstLane + (index % laneCount);
      laneLastBounds[lane] = { x: item.canvas.x, width: item.width };
      const laneOffset = lane - laneBase;
      return {
        ...item,
        labelY: side === "top" ? railY - 8 - (laneBase + laneOffset) * laneGap : railY + 14 + (laneBase + laneOffset) * laneGap
      };
    });
}

function getGeneratedWallSpeakerTarget(
  speaker: { x: number; y: number },
  point: GeneratedPoint,
  profile: ClassroomProfile,
  width: number,
  height: number,
  coverageLength: number
) {
  if (point.target) {
    return toCanvasPoint(point.target, profile, width, height);
  }
  const angle = Math.abs(point.horizontalAngle ?? 0);
  const directionX = point.horizontalAngle && point.horizontalAngle > 0 ? 1 : -1;
  const rad = (angle * Math.PI) / 180;
  return {
    x: speaker.x + directionX * Math.sin(rad) * coverageLength,
    y: speaker.y + Math.cos(rad) * coverageLength
  };
}

function PointLabel({
  point,
  profile,
  anchor,
  width,
  height,
  groupLabel,
  extraLabelLine,
  labelPlacement
}: {
  point: GeneratedPoint;
  profile: ClassroomProfile;
  anchor: { x: number; y: number };
  width: number;
  height: number;
  groupLabel?: string;
  extraLabelLine?: string;
  labelPlacement?: PointLabelLayout;
}) {
  const lines = getPointLabelLines(point, groupLabel, profile, extraLabelLine, { anchor, width, height });
  const lineHeight = 14;
  const labelWidth = labelPlacement?.width ?? (point.horizontalAngle !== undefined ? 118 : 108);
  const labelHeight = labelPlacement?.height ?? 12 + lines.length * lineHeight;
  const placement = labelPlacement ?? getLabelPlacement(point, profile, anchor, width, height, labelWidth, labelHeight);
  const rawX = placement.x;
  const rawY = placement.y;
  const x = clampNumber(rawX, 10, width - labelWidth - 10);
  const y = clampNumber(rawY, 54, height - labelHeight - 34);
  const lineEnd = {
    x: placement.side === "right" ? x : placement.side === "left" ? x + labelWidth : x + labelWidth / 2,
    y: y + 12
  };
  const color = point.type === "arrayMic" ? "#007d7d" : point.label.includes("壁挂") ? "#a100a1" : "#008f9a";

  return (
    <g>
      <line x1={anchor.x} y1={anchor.y} x2={lineEnd.x} y2={lineEnd.y} stroke="#94a3b8" strokeWidth="0.55" />
      <rect x={x} y={y} width={labelWidth} height={labelHeight} rx="4" fill="#ffffff" fillOpacity="0.58" stroke={color} strokeWidth="0.75" strokeDasharray="4 3" opacity="0.94" />
      {lines.map((line, index) => (
        <text key={`${point.id}-${index}`} x={x + 8} y={y + 17 + index * lineHeight} fill={index === 0 ? color : "#334155"} fontSize={index === 0 ? 9.5 : 8.4} fontWeight={index === 0 ? 850 : 700}>
          {line}
        </text>
      ))}
    </g>
  );
}

function getShortPointName(point: GeneratedPoint) {
  if (point.type === "arrayMic") return point.pickupKind === "lineArray" ? "线阵麦" : "阵列麦";
  if (point.label.includes("吸顶音箱")) return "吸顶音箱";
  if (point.label.includes("壁挂音柱")) return "壁挂音箱";
  return "音箱";
}

function getLabelPlacement(
  point: GeneratedPoint,
  profile: ClassroomProfile,
  anchor: { x: number; y: number },
  width: number,
  height: number,
  labelWidth: number,
  labelHeight: number,
  extraObstacles: LabelObstacle[] = []
) {
  const candidates = getPointLabelPlacementCandidates(point, profile, anchor, width, height, labelWidth, labelHeight);
  if (candidates.length > 0) {
    return pickBestLabelPlacement(candidates, profile, anchor, width, height, labelWidth, labelHeight, extraObstacles);
  }
  return { x: anchor.x + 18, y: anchor.y + 18, side: "right" as const };
}

function getPointLabelPlacementCandidates(
  point: GeneratedPoint,
  profile: ClassroomProfile,
  anchor: { x: number; y: number },
  width: number,
  height: number,
  labelWidth: number,
  labelHeight: number
) {
  const room = getCanvasRoomLayout(profile, width, height);
  if (point.type === "arrayMic" || point.type === "speaker") {
    const isLeftSide = anchor.x < room.x + room.width / 2;
    const nearbyCandidates = [
      { x: anchor.x + 18, y: anchor.y + 18, side: "right" as const },
      { x: anchor.x + 18, y: anchor.y - labelHeight - 18, side: "right" as const },
      { x: anchor.x - labelWidth - 18, y: anchor.y + 18, side: "left" as const },
      { x: anchor.x - labelWidth - 18, y: anchor.y - labelHeight - 18, side: "left" as const }
    ];
    const outerOffset = 112;
    const outerCandidates = [
      { x: isLeftSide ? room.x - labelWidth - outerOffset : room.x + room.width + outerOffset, y: anchor.y - labelHeight / 2, side: isLeftSide ? ("left" as const) : ("right" as const) },
      { x: room.x - labelWidth - outerOffset, y: anchor.y - labelHeight / 2, side: "left" as const },
      { x: room.x + room.width + outerOffset, y: anchor.y - labelHeight / 2, side: "right" as const }
    ];
    const centerCandidates = [
      { x: anchor.x - labelWidth / 2, y: anchor.y + 28, side: "center" as const },
      { x: anchor.x - labelWidth / 2, y: anchor.y - labelHeight - 28, side: "center" as const },
      { x: anchor.x - labelWidth / 2, y: anchor.y + labelHeight + 34, side: "center" as const },
      { x: anchor.x - labelWidth / 2, y: anchor.y - labelHeight * 2 - 34, side: "center" as const }
    ];
    return [...nearbyCandidates, ...centerCandidates, ...outerCandidates];
  }
  if (point.type === "arrayMic") {
    return [
      { x: anchor.x + 22, y: anchor.y + 18, side: "right" as const },
      { x: anchor.x + 22, y: anchor.y - labelHeight - 18, side: "right" as const },
      { x: anchor.x - labelWidth - 22, y: anchor.y + 18, side: "left" as const },
      { x: anchor.x - labelWidth - 22, y: anchor.y - labelHeight - 18, side: "left" as const },
      { x: anchor.x - labelWidth / 2, y: anchor.y + 28, side: "center" as const },
      { x: anchor.x - labelWidth / 2, y: anchor.y - labelHeight - 28, side: "center" as const }
    ];
  }
  if (point.horizontalAngle !== undefined) {
    const room = getCanvasRoomLayout(profile, width, height);
    const isLeftWall = anchor.x < room.x + room.width / 2;
    return [
      {
        x: isLeftWall ? room.x - labelWidth - 10 : room.x + room.width + 10,
        y: anchor.y - labelHeight / 2,
        side: isLeftWall ? ("left" as const) : ("right" as const)
      }
    ];
  }
  if (point.label.includes("吸顶音箱")) {
    return [{ x: anchor.x - labelWidth / 2, y: anchor.y + 24, side: "center" as const }];
  }
  if (anchor.x < width * 0.5) {
    return [{ x: anchor.x + 18, y: anchor.y + 18, side: "right" as const }];
  }
  return [{ x: anchor.x - labelWidth - 18, y: Math.max(anchor.y - labelHeight - 18, 62), side: "left" as const }];
}

function pickBestLabelPlacement(
  candidates: Array<{ x: number; y: number; side: "left" | "right" | "center" }>,
  profile: ClassroomProfile,
  anchor: { x: number; y: number },
  width: number,
  height: number,
  labelWidth: number,
  labelHeight: number,
  extraObstacles: LabelObstacle[] = []
) {
  const obstacles = [...getStaticLabelObstacles(profile, width, height), ...getCentralAirLabelObstacles(profile, width, height), ...extraObstacles];
  return candidates
    .map((candidate) => ({
      ...candidate,
      x: clampNumber(candidate.x, 34, width - labelWidth - 34),
      y: clampNumber(candidate.y, 58, height - labelHeight - 44)
    }))
    .reduce((best, candidate) =>
      scoreLabelPlacement(candidate, obstacles, anchor, labelWidth, labelHeight) > scoreLabelPlacement(best, obstacles, anchor, labelWidth, labelHeight) ? candidate : best
    );
}

function pickBestAuxiliaryLabelPlacement(
  candidates: Array<{ x: number; y: number; side: "left" | "right" | "center" }>,
  profile: ClassroomProfile,
  anchor: { x: number; y: number },
  width: number,
  height: number,
  labelWidth: number,
  labelHeight: number,
  extraObstacles: LabelObstacle[] = []
) {
  const obstacles = [...getStaticLabelObstacles(profile, width, height), ...extraObstacles];
  return candidates
    .map((candidate) => ({
      ...candidate,
      x: clampNumber(candidate.x, 34, width - labelWidth - 34),
      y: clampNumber(candidate.y, 58, height - labelHeight - 44)
    }))
    .reduce((best, candidate) =>
      scoreLabelPlacement(candidate, obstacles, anchor, labelWidth, labelHeight) > scoreLabelPlacement(best, obstacles, anchor, labelWidth, labelHeight) ? candidate : best
    );
}

function getCentralAirLabelObstacles(profile: ClassroomProfile, width: number, height: number): LabelObstacle[] {
  const labelWidth = 126;
  const labelHeight = 47;
  return (profile.engineeringConstraints.centralAirConditionerPoints ?? []).flatMap((point) => {
    const canvasPoint = toCanvasPoint(point.position, profile, width, height);
    const meterPx = getMeterPixels(profile, width, height);
    const bodyWidth = Math.max(18, point.size.width * meterPx);
    const bodyHeight = Math.max(12, point.size.depth * meterPx);
    const labelX = clampNumber(canvasPoint.x + 16, 34, width - labelWidth - 34);
    const labelY = clampNumber(canvasPoint.y - labelHeight - 16, 58, height - labelHeight - 44);
    return [
      { x: labelX - 4, y: labelY - 4, width: labelWidth + 8, height: labelHeight + 8 },
      { x: canvasPoint.x - bodyWidth / 2 - 4, y: canvasPoint.y - bodyHeight / 2 - 4, width: bodyWidth + 8, height: bodyHeight + 8 }
    ];
  });
}

function getStaticLabelObstacles(profile: ClassroomProfile, width: number, height: number): LabelObstacle[] {
  const room = getCanvasRoomLayout(profile, width, height);
  return [
    { x: width / 2 - 150, y: 30, width: 300, height: 30 },
    { x: room.x + room.width / 2 - 160, y: room.y - 26, width: 320, height: 22 },
    { x: room.x - 86, y: room.y - 8, width: 76, height: room.height + 16 },
    { x: room.x + room.width + 10, y: room.y - 8, width: 92, height: room.height + 16 },
    { x: width / 2 - 150, y: height - 36, width: 300, height: 26 }
  ];
}

function scoreLabelPlacement(
  placement: { x: number; y: number },
  obstacles: LabelObstacle[],
  anchor: { x: number; y: number },
  labelWidth: number,
  labelHeight: number
) {
  const rect = { x: placement.x, y: placement.y, width: labelWidth, height: labelHeight };
  const overlapPenalty = obstacles.reduce((sum, obstacle) => sum + getRectOverlapArea(rect, obstacle), 0);
  const distance = Math.hypot(placement.x + labelWidth / 2 - anchor.x, placement.y + labelHeight / 2 - anchor.y);
  return -overlapPenalty * 100 - distance;
}

function getRectOverlapArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) {
  const overlapWidth = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const overlapHeight = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return overlapWidth * overlapHeight;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function oneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function formatHorizontalAngle(angle: number) {
  if (angle > 0) return `左摆${angle}°`;
  if (angle < 0) return `右摆${Math.abs(angle)}°`;
  return "0°";
}

function getWallSpeakerMountingAngle(
  speaker: { x: number; y: number },
  target: { x: number; y: number },
  profile: ClassroomProfile,
  width: number,
  height: number
) {
  const room = getCanvasRoomLayout(profile, width, height);
  const distances = [
    { side: "left" as const, value: Math.abs(speaker.x - room.x) },
    { side: "right" as const, value: Math.abs(speaker.x - (room.x + room.width)) },
    { side: "front" as const, value: Math.abs(speaker.y - room.y) },
    { side: "back" as const, value: Math.abs(speaker.y - (room.y + room.height)) }
  ].sort((a, b) => a.value - b.value);
  const side = distances[0]?.side ?? "left";
  const vector = { x: target.x - speaker.x, y: target.y - speaker.y };
  if (side === "left") return clampNumber(Math.round(90 + (Math.atan2(vector.y, vector.x) * 180) / Math.PI), 0, 180);
  if (side === "right") return clampNumber(Math.round(90 - (Math.atan2(vector.y, -vector.x) * 180) / Math.PI), 0, 180);
  if (side === "front") return clampNumber(Math.round(90 - (Math.atan2(vector.x, vector.y) * 180) / Math.PI), 0, 180);
  return clampNumber(Math.round(90 + (Math.atan2(vector.x, -vector.y) * 180) / Math.PI), 0, 180);
}

function clampWallSpeakerTargetToMountingAngle(speaker: Point, target: Point, profile: ClassroomProfile) {
  const vector = { x: target.x - speaker.x, y: target.y - speaker.y };
  const distance = Math.max(0.8, Math.hypot(vector.x, vector.y));
  const angle = clampNumber(getWallSpeakerMountingAngleFromRoomVector(speaker, vector, profile), WALL_SPEAKER_MIN_MOUNTING_ANGLE, WALL_SPEAKER_MAX_MOUNTING_ANGLE);
  return getWallSpeakerTargetFromMountingAngle(speaker, angle, distance, profile);
}

function clampWallSpeakerTargetCanvasToMountingAngle(
  speaker: { x: number; y: number },
  target: { x: number; y: number },
  profile: ClassroomProfile,
  width: number,
  height: number
) {
  const room = getCanvasRoomLayout(profile, width, height);
  const speakerRoom = getRoomPositionFromCanvas(speaker.x, speaker.y, profile, room);
  const targetRoom = getRoomPositionFromCanvas(target.x, target.y, profile, room);
  return toCanvasPoint(clampWallSpeakerTargetToMountingAngle(speakerRoom, targetRoom, profile), profile, width, height);
}

function getWallSpeakerMountingAngleFromRoomVector(speaker: Point, vector: Point, profile: ClassroomProfile) {
  const side = getWallSpeakerRoomSide(speaker, profile);
  if (side === "left") return Math.round(90 + (Math.atan2(vector.y, vector.x) * 180) / Math.PI);
  if (side === "right") return Math.round(90 - (Math.atan2(vector.y, -vector.x) * 180) / Math.PI);
  if (side === "front") return Math.round(90 - (Math.atan2(vector.x, vector.y) * 180) / Math.PI);
  return Math.round(90 + (Math.atan2(vector.x, -vector.y) * 180) / Math.PI);
}

function getWallSpeakerTargetFromMountingAngle(speaker: Point, angle: number, distance: number, profile: ClassroomProfile) {
  const rad = ((angle - 90) * Math.PI) / 180;
  const side = getWallSpeakerRoomSide(speaker, profile);
  if (side === "left") return { x: speaker.x + Math.cos(rad) * distance, y: speaker.y + Math.sin(rad) * distance };
  if (side === "right") return { x: speaker.x - Math.cos(rad) * distance, y: speaker.y - Math.sin(rad) * distance };
  if (side === "front") return { x: speaker.x - Math.sin(rad) * distance, y: speaker.y + Math.cos(rad) * distance };
  return { x: speaker.x + Math.sin(rad) * distance, y: speaker.y - Math.cos(rad) * distance };
}

function getWallSpeakerRoomSide(speaker: Point, profile: ClassroomProfile) {
  const { width, length } = profile.roomGeometry;
  const distances = [
    { side: "left" as const, value: Math.abs(speaker.x) },
    { side: "right" as const, value: Math.abs(speaker.x - width) },
    { side: "front" as const, value: Math.abs(speaker.y) },
    { side: "back" as const, value: Math.abs(speaker.y - length) }
  ].sort((a, b) => a.value - b.value);
  return distances[0]?.side ?? "left";
}

function getMeterPixels(profile: ClassroomProfile, width: number, height: number) {
  return getCanvasRoomLayout(profile, width, height).meterPx;
}

function visualSize(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getWallSpeakerTarget(
  speaker: { x: number; y: number },
  arrayMics: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  coverageLength: number
) {
  const isFrontSpeaker = speaker.y < height * 0.5;
  const targetFractions = isFrontSpeaker ? [0.72, 0.82, 0.62, 0.9, 0.52] : [0.78, 0.86, 0.7, 0.92, 0.62];
  const candidates = targetFractions.map((fraction) => ({ x: width / 2, y: height * fraction }));

  return candidates.reduce((best, candidate) => {
    const score = getConeMicOverlapScore(speaker, candidate, arrayMics, coverageLength);
    const bestScore = getConeMicOverlapScore(speaker, best, arrayMics, coverageLength);
    return score < bestScore ? candidate : best;
  }, candidates[0]);
}

function getConeMicOverlapScore(
  speaker: { x: number; y: number },
  target: { x: number; y: number },
  arrayMics: Array<{ x: number; y: number }>,
  coverageLength: number
) {
  const halfAngle = 42.5;
  const edgeTolerance = 7;
  const axis = { x: target.x - speaker.x, y: target.y - speaker.y };
  const axisLength = Math.hypot(axis.x, axis.y) || 1;
  const axisUnit = { x: axis.x / axisLength, y: axis.y / axisLength };

  return arrayMics.reduce((score, mic) => {
    const vector = { x: mic.x - speaker.x, y: mic.y - speaker.y };
    const distance = Math.hypot(vector.x, vector.y);
    if (distance <= 0 || distance > coverageLength) return score;
    const dot = (vector.x * axisUnit.x + vector.y * axisUnit.y) / distance;
    const angle = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
    if (angle <= halfAngle - edgeTolerance) return score + (halfAngle - edgeTolerance - angle + 1) * (1 - distance / coverageLength);
    return score;
  }, 0);
}

function WallSpeakerSymbol({
  x,
  y,
  targetX,
  targetY,
  coverageLength,
  color = "#ff00ff",
  muted = false
}: {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  coverageLength: number;
  color?: string;
  muted?: boolean;
}) {
  const rotation = (Math.atan2(targetY - y, targetX - x) * 180) / Math.PI - 90;
  const bodyWidth = 11;
  const bodyHeight = 16;
  const halfAngle = 42.5;
  const halfAngleRad = (halfAngle * Math.PI) / 180;
  const coverageHalfWidth = coverageLength * Math.sin(halfAngleRad);
  const coverageForward = coverageLength * Math.cos(halfAngleRad);
  const halfBody = bodyWidth / 2;
  const coveragePath = `M ${x - coverageHalfWidth} ${y + coverageForward} A ${coverageLength} ${coverageLength} 0 0 0 ${x + coverageHalfWidth} ${y + coverageForward} L ${x} ${y} Z`;
  const innerLength = coverageLength * 0.88;
  const innerHalfWidth = innerLength * Math.sin(halfAngleRad * 0.18);
  const innerForward = innerLength * Math.cos(halfAngleRad * 0.18);
  return (
    <g transform={`rotate(${rotation} ${x} ${y})`}>
      <path d={coveragePath} fill="url(#wallSpeakerCoverageGradient)" filter="url(#speakerCoverageBlur)" opacity={muted ? 0.2 : 1} />
      <path
        d={`M ${x - innerHalfWidth} ${y + innerForward} A ${innerLength} ${innerLength} 0 0 0 ${x + innerHalfWidth} ${y + innerForward} L ${x} ${y} Z`}
        fill="url(#wallSpeakerCoverageGradient)"
        opacity={muted ? 0.16 : 0.62}
      />
      <path d={coveragePath} fill="none" stroke={muted ? "#94a3b8" : "#f59e0b"} strokeWidth="0.7" strokeDasharray="5 4" opacity={muted ? 0.28 : 0.58} />

      <path d={`M ${x - halfBody} ${y - bodyHeight * 0.8} L ${x + halfBody} ${y - bodyHeight * 0.8} L ${x + halfBody * 1.35} ${y + bodyHeight * 0.28} L ${x - halfBody * 1.35} ${y + bodyHeight * 0.28} Z`} fill="#ffffff" stroke={color} strokeWidth="1.2" />
      <rect x={x - halfBody * 1.35} y={y + bodyHeight * 0.28} width={bodyWidth * 1.35} height={bodyHeight * 0.32} fill="#ffffff" stroke={color} strokeWidth="1.2" />
      <path d={`M ${x - halfBody * 0.9} ${y + bodyHeight * 0.58} L ${x - halfBody * 0.3} ${y + bodyHeight * 0.06} L ${x + halfBody * 0.3} ${y + bodyHeight * 0.06} L ${x + halfBody * 0.9} ${y + bodyHeight * 0.58}`} fill="none" stroke={color} strokeWidth="1" />
      <rect x={x - bodyWidth * 0.16} y={y - bodyHeight * 0.28} width={bodyWidth * 0.32} height={bodyHeight * 0.24} fill="#ffffff" stroke={color} strokeWidth="1" />
      <rect x={x - bodyWidth * 0.35} y={y - bodyHeight * 0.46} width={bodyWidth * 0.7} height={bodyHeight * 0.12} fill="#ffffff" stroke={color} strokeWidth="1" />
    </g>
  );
}

function CeilingSpeakerSymbol({ x, y, diameter, color }: { x: number; y: number; diameter: number; color: string }) {
  const r = diameter / 2;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#ffffff" stroke={color} strokeWidth="1.2" />
      <path
        d={`M ${x - r * 0.92} ${y - r * 0.18} L ${x + r * 0.92} ${y - r * 0.18} L ${x + r * 0.44} ${y + r * 0.28} L ${x - r * 0.44} ${y + r * 0.28} Z`}
        fill="#ffffff"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="miter"
      />
      <rect x={x - r * 0.44} y={y + r * 0.28} width={r * 0.88} height={r * 0.56} fill="#ffffff" stroke={color} strokeWidth="2" />
    </g>
  );
}

function Legend({ micOnly = false, hasManualArrayMic = false, hasLineArray = false }: { micOnly?: boolean; hasManualArrayMic?: boolean; hasLineArray?: boolean }) {
  return (
    <div className="canvasLegend">
      <span>
        <i style={{ background: "#00a6a6" }} /> {hasLineArray ? "智能线阵麦克风" : "智能语音阵列麦克风"}
      </span>
      {hasManualArrayMic && (
        <span>
          <i style={{ background: "#7c3aed" }} /> 人工阵麦
        </span>
      )}
      <span>
        <i style={{ background: "rgba(0, 166, 166, 0.28)", border: "1px dashed #00a6a6" }} /> {hasLineArray ? "线阵麦范围" : "阵麦范围"}
      </span>
      {!micOnly && (
        <>
          <span>
            <i style={{ background: "#00dede" }} /> 吸顶音箱 / 音柱
          </span>
          <span>
            <i style={{ background: "rgba(245, 158, 11, 0.3)", border: "1px dashed #f59e0b" }} /> 音箱扩声范围
          </span>
        </>
      )}
    </div>
  );
}


