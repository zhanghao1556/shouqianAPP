import { AlertTriangle, CheckCircle2, CircleAlert, Network } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppBrandId } from "../brand";
import type {
  ClassroomProfile,
  DeviceInterfacePanel,
  GeneratedOutputs,
  InterfaceWiringConductor,
  InterfaceWiringEdge,
  InterfaceWiringFinding,
  InterfaceWiringModel,
  InterfaceWiringNode
} from "../types";
import {
  buildInterfaceWiringModel,
  getInterfacePanelImageRect,
  getInterfacePanelPortAnchor,
  getInterfaceWiringLayout,
  getInterfaceWiringLogicalTerminalOffset,
  getInterfaceWiringLogicalTerminals,
  getInterfaceWiringPortReferenceNumbers,
  getInterfaceWiringTableCableLabel,
  getInterfaceWiringUsageDeviceLabel,
  type RecordingInputMode,
  type RecordingInputSelections
} from "../lib/interfaceWiring";
import { WIRED_MIC_LINE_IN_POWER_NOTE } from "../lib/connectionRules";
import {
  getDevicePortProfile,
  RECORDING_CAMERA_PORT_PROFILE_ID,
  RECORDING_HOST_PORT_PROFILE_ID
} from "../lib/devicePortCatalog";
import aj200InterfacePanel from "../../../assets/yinman-aj200-interface-panel.svg";
import aj350InterfacePanel from "../../../assets/yinman-aj350-interface-panel.svg";
import aj600InterfacePanel from "../../../assets/yinman-aj600-interface-panel.svg";
import ap150RearPanel from "../../../assets/yinman-ap150-rear-panel.svg";
import lineArrayRearPanel from "../../../assets/yinman-sa110-rear-panel.svg";
import lineArrayConverterPanel from "../../../assets/yinman-line-array-converter-interface-panel.svg";
import passiveSpeakerTerminal from "../../../assets/yinman-passive-speaker-terminal.svg";
import podiumComputerRearPanel from "../../../assets/external-podium-computer-panel.svg";
import recordingLineInputPanel from "../../../assets/external-recording-line-input-panel.svg";
import controlHostPanel from "../../../assets/external-control-host-rs232-panel.svg";
import laptopPanel from "../../../assets/external-laptop-panel.svg";
import opsAllInOnePanel from "../../../assets/external-ops-panel.svg";
import conferenceTerminalPanel from "../../../assets/external-conference-terminal-panel.svg";
import headsetSplitterPanel from "../../../assets/external-headset-splitter-panel.svg";
import wiredMicrophonePanel from "../../../assets/external-wired-microphone-panel.svg";
import ring01InterfacePanel from "../../../assets/yinman-ring01-interface-panel.svg";
import ring03InterfacePanel from "../../../assets/yinman-ring03-interface-panel.svg";
import ring08RearPanel from "../../../assets/yinman-ring08-rear-panel.svg";
import hangingMicInterfacePanel from "../../../assets/yinman-hanging-mic-interface-panel.svg";
import ringOfAInterfacePanel from "../../../assets/yinman-ringof-a-interface-panel.svg";
import wirelessReceiverRearPanel from "../../../assets/yinman-wireless-receiver-rear-panel.svg";
import "./InterfaceWiringPreview.css";

const CABLE_LEGEND_BASE_HEIGHT = 52;
const CABLE_LEGEND_ROW_HEIGHT = 28;
const CABLE_LEGEND_TOP_GAP = 24;
const CABLE_LEGEND_BOTTOM_GAP = 28;
const DRAWING_FRAME_LEFT = 18;
const DRAWING_FRAME_TOP = 18;
const DRAWING_FRAME_RIGHT = 18;
const DRAWING_FRAME_BOTTOM = 22;
const CABLE_FRAME_CLEARANCE = 12;
const INTERFACE_WIRING_MIN_LOGICAL_WIDTH = 993;
const CABLE_CORRIDOR_LANE_SPACING = 30;
const CABLE_CORRIDOR_MIN_LANE_SPACING = 12;
const CABLE_CORRIDOR_VERTICAL_CLEARANCE = 18;
const CABLE_CORRIDOR_CURVE_RATIO = 0.5522848;
const CABLE_CORRIDOR_MIN_BEND = 18;
const CABLE_CORRIDOR_MAX_BEND = 72;
const CABLE_DEVICE_BREAKOUT_GAP = 10;
const CABLE_HORIZONTAL_LANE_STEP = 12;
const CABLE_HORIZONTAL_MIN_CLEARANCE = 10;
const CABLE_ROUTE_INTERSECTION_GAP = 5;
const CABLE_INTERNAL_MERGE_DISTANCE = 28;

const interfacePanelImages: Record<string, string> = {
  aj200: aj200InterfacePanel,
  aj350: aj350InterfacePanel,
  aj600: aj600InterfacePanel,
  ap150: ap150RearPanel,
  lineArray: lineArrayRearPanel,
  lineArrayConverter: lineArrayConverterPanel,
  passiveSpeaker: passiveSpeakerTerminal,
  podiumComputer: podiumComputerRearPanel,
  recordingLineInput: recordingLineInputPanel,
  controlHost: controlHostPanel,
  laptop: laptopPanel,
  opsAllInOne: opsAllInOnePanel,
  conferenceTerminal: conferenceTerminalPanel,
  headsetSplitter: headsetSplitterPanel,
  wiredMicrophone: wiredMicrophonePanel,
  ring01: ring01InterfacePanel,
  ring03: ring03InterfacePanel,
  ring08: ring08RearPanel,
  hangingMic: hangingMicInterfacePanel,
  ringOfA: ringOfAInterfacePanel,
  wirelessReceiver: wirelessReceiverRearPanel
};

interface InterfaceWiringPreviewProps {
  profile: ClassroomProfile;
  outputs: GeneratedOutputs;
  brandId: AppBrandId;
}

export function InterfaceWiringPreview({ profile, outputs, brandId }: InterfaceWiringPreviewProps) {
  const [recordingInputSelections, setRecordingInputSelections] = useState<RecordingInputSelections>({});
  const model = useMemo(
    () => buildInterfaceWiringModel({ profile, outputs, brandId, recordingInputSelections }),
    [profile, outputs, brandId, recordingInputSelections]
  );
  const hardCount = model.findings.filter((item) => item.severity === "hard").length;
  const reviewCount = model.findings.filter((item) => item.severity === "review").length;
  const portReferenceNumbers = useMemo(() => getInterfaceWiringPortReferenceNumbers(model), [model]);
  return (
    <section className="interfaceWiringPreview" aria-label="接口接线图拟调整预览">
      <header className="interfaceWiringPreviewHeader">
        <div>
          <span className="interfaceWiringEyebrow"><Network size={15} /> 内部校准</span>
          <h3>接口接线图</h3>
          <p>拟调整预览 / 尚未写入正式规则</p>
        </div>
        <div className="interfaceWiringSummary" aria-label="接口接线校核摘要">
          <span>{model.nodes.length} 组设备</span>
          <span>{model.edges.length} 条接口连线</span>
          {model.candidateProcessor && <span>候选主机 {model.candidateProcessor}</span>}
          <span className={hardCount ? "hard" : reviewCount ? "review" : "ready"}>
            {hardCount ? `硬风险 ${hardCount}` : reviewCount ? `待复核 ${reviewCount}` : "接口校核通过"}
          </span>
        </div>
      </header>

      <InterfaceWiringDiagram
        model={model}
        portReferenceNumbers={portReferenceNumbers}
        selections={recordingInputSelections}
        onChange={(nodeId, mode) => setRecordingInputSelections((current) => ({ ...current, [nodeId]: mode }))}
      />

      <div className="interfaceWiringDataGrid">
        <InterfacePortUsageTable model={model} portReferenceNumbers={portReferenceNumbers} />
        <InterfaceWiringFindings findings={model.findings} />
      </div>
    </section>
  );
}

const recordingInputOptions: Array<{
  mode: RecordingInputMode;
  label: string;
  region: { x: number; y: number; width: number; height: number };
}> = [
  { mode: "trs35", label: "3.5mm", region: { x: 38, y: 54, width: 260, height: 150 } },
  { mode: "balanced", label: "凤凰 +/-/G", region: { x: 350, y: 54, width: 260, height: 150 } },
  { mode: "lrg", label: "凤凰 L/R/G", region: { x: 662, y: 54, width: 260, height: 150 } }
];

function isRecordingInputNode(node: InterfaceWiringNode) {
  return node.productId === RECORDING_HOST_PORT_PROFILE_ID || node.productId === RECORDING_CAMERA_PORT_PROFILE_ID;
}

function InterfaceWiringDiagram({
  model,
  portReferenceNumbers,
  selections,
  onChange
}: {
  model: InterfaceWiringModel;
  portReferenceNumbers: Record<string, number>;
  selections: RecordingInputSelections;
  onChange: (nodeId: string, mode: RecordingInputMode) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(1120);
  const cableLegendRows = useMemo(() => getCableLegendRows(model.edges), [model.edges]);
  const cableLegendHeight = CABLE_LEGEND_BASE_HEIGHT + cableLegendRows.length * CABLE_LEGEND_ROW_HEIGHT;
  const bottomPadding = cableLegendRows.length
    ? cableLegendHeight + CABLE_LEGEND_TOP_GAP + CABLE_LEGEND_BOTTOM_GAP
    : 44;
  const logicalCanvasWidth = Math.max(INTERFACE_WIRING_MIN_LOGICAL_WIDTH, availableWidth);
  const layout = useMemo(
    () => getInterfaceWiringLayout(model, logicalCanvasWidth, bottomPadding),
    [model, logicalCanvasWidth, bottomPadding]
  );
  const edgeDrawings = useMemo(
    () => buildEdgeDrawings(model, layout, portReferenceNumbers),
    [model, layout, portReferenceNumbers]
  );
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const updateWidth = () => setAvailableWidth((current) => {
      const next = Math.max(320, Math.floor(frame.clientWidth));
      return current === next ? current : next;
    });
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="canvasFrame interfaceWiringCanvasFrame">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="engineeringCanvas cadCanvas adaptiveCadCanvas interfaceWiringCanvas"
        style={{
          aspectRatio: `${layout.width} / ${layout.height}`,
          width: "100%"
        }}
        role="img"
        aria-label="音曼接口接线图拟调整预览"
      >
        <rect
          x={DRAWING_FRAME_LEFT}
          y={DRAWING_FRAME_TOP}
          width={layout.width - DRAWING_FRAME_LEFT - DRAWING_FRAME_RIGHT}
          height={layout.height - DRAWING_FRAME_TOP - DRAWING_FRAME_BOTTOM}
          fill="#ffffff"
          stroke="#111827"
          strokeWidth="1"
        />
        <text x={layout.width / 2} y="48" textAnchor="middle" className="cadTitle">接口接线图</text>
        <text x={layout.width / 2} y="72" textAnchor="middle" className="cadSmall" fill="#9a6700">
          拟调整预览 / 尚未写入正式规则
        </text>

        {model.nodes.map((node) => {
          const position = layout.positions[node.id];
          if (!position) return null;
          return (
            <foreignObject
              key={node.id}
              x={position.x}
              y={position.y}
              width={position.width}
              height={position.height}
              className="interfaceWiringNodeObject"
            >
              <InterfaceWiringNodeCard
                node={node}
                position={position}
                positions={layout.positions}
                recordingInputMode={selections[node.id] ?? "balanced"}
                onRecordingInputChange={onChange}
              />
            </foreignObject>
          );
        })}

        {model.edges.map((edge) => {
          const drawing = edgeDrawings.get(edge.id);
          if (!drawing) return null;
          return (
            <g
              key={`${edge.id}-trunks`}
              className="interfaceWiringEdgeTrunks"
              data-edge-id={edge.id}
              data-route-kind={drawing.route.horizontalCorridor ? "horizontal-corridor" : drawing.route.corridor ? "vertical-corridor" : "curve"}
              data-corridor-x={drawing.route.corridor?.x}
              data-corridor-y={drawing.route.horizontalCorridor?.y}
              data-corridor-from-y={drawing.route.corridor?.fromY}
              data-corridor-to-y={drawing.route.corridor?.toY}
            >
              {drawing.trunkRoutes.map(({ id, path, color, strokeWidth, confirmed, needsOutline }) => (
                <path
                  key={`${edge.id}-${id}-trunk`}
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  data-conductor-id={id}
                  data-segment="trunk"
                  className={[
                    confirmed ? "" : "unconfirmedConductor",
                    needsOutline ? "lightConductor" : ""
                  ].filter(Boolean).join(" ")}
                />
              ))}
            </g>
          );
        })}

        {model.edges.map((edge) => {
          const drawing = edgeDrawings.get(edge.id);
          if (!drawing) return null;
          return (
            <g key={`${edge.id}-leads`} className="interfaceWiringEdgeLeads" data-edge-id={edge.id}>
              {drawing.conductorRoutes.flatMap(({ conductor, fromLeadPath, toLeadPath, strokeWidth, needsOutline }) => (
                [
                  <path
                    key={`${edge.id}-${conductor.id}-from-lead`}
                    d={fromLeadPath}
                    fill="none"
                    stroke={conductor.color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    data-conductor-id={conductor.id}
                    data-terminal-id={conductor.fromTerminalId}
                    data-segment="from-lead"
                    className={[
                      conductor.confirmed ? "" : "unconfirmedConductor",
                      needsOutline ? "lightConductor" : ""
                    ].filter(Boolean).join(" ")}
                  />,
                  <path
                    key={`${edge.id}-${conductor.id}-to-lead`}
                    d={toLeadPath}
                    fill="none"
                    stroke={conductor.color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    data-conductor-id={conductor.id}
                    data-terminal-id={conductor.toTerminalId}
                    data-segment="to-lead"
                    className={[
                      conductor.confirmed ? "" : "unconfirmedConductor",
                      needsOutline ? "lightConductor" : ""
                    ].filter(Boolean).join(" ")}
                  />
                ]
              ))}
            </g>
          );
        })}

        {model.edges.map((edge) => {
          const drawing = edgeDrawings.get(edge.id);
          if (!drawing) return null;
          const unconfirmed = edge.conductors.some((conductor) => !conductor.confirmed);
          return (
            <g key={`${edge.id}-references`} className="interfaceWiringEdgeReferences" data-edge-id={edge.id}>
              {drawing.referenceBadges.map((badge) => (
                <g
                  key={`${edge.id}-reference`}
                  className={`interfaceWiringEdgeReference ${unconfirmed ? "unconfirmed" : ""}`}
                  transform={`translate(${badge.x} ${badge.y})`}
                  data-reference-number={badge.referenceNumber}
                >
                  <circle r="9" />
                  <text textAnchor="middle" dy="0.34em">{badge.referenceNumber}</text>
                </g>
              ))}
            </g>
          );
        })}

        {cableLegendRows.length > 0 && (
          <foreignObject
            x="34"
            y={layout.height - cableLegendHeight - CABLE_LEGEND_BOTTOM_GAP}
            width={Math.min(500, layout.width - 68)}
            height={cableLegendHeight}
            className="interfaceWiringLegendObject"
          >
            <CableLegendTable rows={cableLegendRows} />
          </foreignObject>
        )}
      </svg>
    </div>
  );
}

type WiringNodePosition = ReturnType<typeof getInterfaceWiringLayout>["positions"][string];
type WiringNodePositions = ReturnType<typeof getInterfaceWiringLayout>["positions"];

function InterfaceWiringNodeCard({
  node,
  position,
  positions,
  recordingInputMode,
  onRecordingInputChange
}: {
  node: InterfaceWiringNode;
  position: WiringNodePosition;
  positions: WiringNodePositions;
  recordingInputMode: RecordingInputMode;
  onRecordingInputChange: (nodeId: string, mode: RecordingInputMode) => void;
}) {
  const panelProfile = getDevicePortProfile(node.productId)?.interfacePanel;
  const panelImage = panelProfile ? interfacePanelImages[panelProfile.assetKey] : undefined;
  const imageRect = panelProfile && panelImage ? getInterfacePanelImageRect(node, position) : undefined;
  const recordingInputNode = isRecordingInputNode(node);
  const markers = node.ports.map((port, index) => {
    const panelAnchor = panelProfile
      ? getInterfacePanelPortAnchor(panelProfile, port.capabilityId, index, node.ports.length)
      : undefined;
    const located = Boolean(imageRect && panelAnchor);
    const fallback = located
      ? undefined
      : getFallbackPortMarker(node, index, position, imageRect, panelProfile);
    const anchorLeft = imageRect && panelAnchor
      ? imageRect.x - position.x + panelAnchor.x * imageRect.width
      : fallback!.left;
    const anchorTop = imageRect && panelAnchor
      ? imageRect.y - position.y + panelAnchor.y * imageRect.height
      : fallback!.top;
    const peer = positions[port.peerNodeId];
    const peerDelta = peer
      ? { x: peer.centerX - (position.x + anchorLeft), y: peer.centerY - (position.y + anchorTop) }
      : { x: 0, y: -1 };
    const terminalHeads = getInterfaceWiringLogicalTerminals(port.terminals)
      .filter((terminal) => !(imageRect && panelAnchor?.terminalAnchors?.[terminal.id]))
      .map((terminal) => {
        const offset = getInterfaceWiringLogicalTerminalOffset(port.terminals, terminal.id, peerDelta);
        return {
          ...terminal,
          left: anchorLeft + offset.x,
          top: anchorTop + offset.y
        };
      });
    return {
      port,
      anchorLeft,
      anchorTop,
      located,
      terminalHeads
    };
  });
  const hasUnlocatedPorts = markers.some((marker) => !marker.located);
  return (
    <div
      className={`interfaceWiringNode ${imageRect ? "hasInterfacePanel" : "missingInterfacePanel"}`}
      data-level={node.level}
      data-category={node.category}
    >
      <strong className="interfaceWiringNodeName">
        {node.ports[0]
          ? getInterfaceWiringUsageDeviceLabel(node, node.ports[0])
          : `${node.label}${node.quantity > 1 ? ` ×${node.quantity}` : ""}`}
      </strong>
      {imageRect && panelProfile && panelImage && (imageRect.unitRects ?? [imageRect]).map((unitRect, index) => (
        <img
          className={`interfaceWiringPanelImage ${panelProfile.confirmed ? "" : "unconfirmed"}`}
          src={panelImage}
          alt={index === 0 ? `${node.label}接口面板` : ""}
          title={panelProfile.source}
          key={`${panelProfile.assetKey}-${index + 1}`}
          style={{
            left: unitRect.x - position.x,
            top: unitRect.y - position.y,
            width: unitRect.width,
            height: unitRect.height
          }}
        />
      ))}
      {recordingInputNode && imageRect && recordingInputOptions.map((option) => (
        <button
          type="button"
          key={option.mode}
          className={`interfaceWiringPanelOptionButton ${recordingInputMode === option.mode ? "active" : ""}`}
          aria-label={`${node.label}选择${option.label} LINE IN`}
          aria-pressed={recordingInputMode === option.mode}
          title={`选择${option.label} LINE IN`}
          data-recording-input-option={option.mode}
          onClick={() => onRecordingInputChange(node.id, option.mode)}
          style={{
            left: imageRect.x - position.x + option.region.x / 960 * imageRect.width,
            top: imageRect.y - position.y + option.region.y / 260 * imageRect.height,
            width: option.region.width / 960 * imageRect.width,
            height: option.region.height / 260 * imageRect.height
          }}
        >
          {recordingInputMode === option.mode && <CheckCircle2 aria-hidden="true" />}
        </button>
      ))}
      {recordingInputNode && imageRect && (
        <span
          className="interfaceWiringNodeInterfaceNote"
          style={{ top: imageRect.y - position.y + imageRect.height + 4 }}
        >
          LINE OUT 接 LINE IN；禁止接 MIC IN
        </span>
      )}
      {(!imageRect || hasUnlocatedPorts) && (
        <span
          className="interfaceWiringMissingPanelLabel"
          style={{ top: getFallbackPortLabelTop(position, imageRect) }}
        >
          {imageRect ? "接口位置待补充" : "接口图待补充"}
        </span>
      )}
      {markers.map(({ port, anchorLeft, anchorTop, located, terminalHeads }) => (
        <span className="interfaceWiringPortMarker" key={`${port.id}-pin`}>
          {!located && terminalHeads.length === 0 && (
            <i
              className="interfaceWiringUnlocatedAnchor"
              aria-hidden="true"
              style={{ left: anchorLeft, top: anchorTop }}
            />
          )}
          {terminalHeads.map((terminal) => (
            <i
              key={`${port.id}-${terminal.id}`}
              className={`interfaceWiringLogicalTerminal ${terminal.role} ${terminal.color === "#ffffff" ? "light" : ""}`}
              data-port-id={port.id}
              data-terminal-id={terminal.id}
              title={`${port.label} ${terminal.label}`}
              style={{ left: terminal.left, top: terminal.top, backgroundColor: terminal.color }}
            >
              {terminal.label}
            </i>
          ))}
        </span>
      ))}
    </div>
  );
}

function getFallbackPortMarker(
  node: InterfaceWiringNode,
  portIndex: number,
  position: WiringNodePosition,
  imageRect: ReturnType<typeof getInterfacePanelImageRect>,
  panelProfile: DeviceInterfacePanel | undefined
) {
  const unlocatedIndexes = node.ports.flatMap((port, index) => {
    const anchor = panelProfile
      ? getInterfacePanelPortAnchor(panelProfile, port.capabilityId, index, node.ports.length)
      : undefined;
    return anchor ? [] : [index];
  });
  const fallbackIndex = Math.max(0, unlocatedIndexes.indexOf(portIndex));
  const row = Math.floor(fallbackIndex / 4);
  const rowStart = row * 4;
  const columnsInRow = Math.min(4, unlocatedIndexes.length - rowStart);
  const column = fallbackIndex - rowStart;
  return {
    left: ((column + 1) / (columnsInRow + 1)) * position.width,
    top: getFallbackPortLabelTop(position, imageRect) + 24 + row * 22
  };
}

function getFallbackPortLabelTop(
  position: WiringNodePosition,
  imageRect: ReturnType<typeof getInterfacePanelImageRect>
) {
  return imageRect ? imageRect.y - position.y + imageRect.height + 5 : 28;
}

function InterfacePortUsageTable({
  model,
  portReferenceNumbers
}: {
  model: InterfaceWiringModel;
  portReferenceNumbers: Record<string, number>;
}) {
  const nodeMap = new Map(model.nodes.map((node) => [node.id, node]));
  const rows = model.edges.flatMap((edge) => {
    const fromNode = nodeMap.get(edge.fromNodeId);
    const toNode = nodeMap.get(edge.toNodeId);
    const fromPort = fromNode?.ports.find((port) => port.id === edge.fromPortId);
    const toPort = toNode?.ports.find((port) => port.id === edge.toPortId);
    return fromNode && toNode && fromPort && toPort
      ? [{ edge, fromNode, toNode, fromPort, toPort }]
      : [];
  });
  return (
    <section className="interfaceWiringTableSection">
      <div className="interfaceWiringSubHeader">
        <h4>接口占用表</h4>
        <span>每根线一行，只列当前方案已用接口</span>
      </div>
      <div className="tableBox interfaceWiringPortTable">
        {rows.length ? (
          <table>
            <thead>
              <tr>
                <th>图中编号</th>
                <th>设备（从 / 到）</th>
                <th>接口（从 / 到）</th>
                <th>接口形式（从 / 到）</th>
                <th>线材</th>
                <th>接线方式</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ edge, fromNode, toNode, fromPort, toPort }) => (
                <tr key={edge.id} className={fromPort.confirmed && toPort.confirmed ? "" : "unconfirmed"}>
                  <td><span className="interfaceWiringTablePortPin">{portReferenceNumbers[edge.fromPortId]}</span></td>
                  <td><FromToCell from={getInterfaceWiringUsageDeviceLabel(fromNode, fromPort)} to={getInterfaceWiringUsageDeviceLabel(toNode, toPort)} /></td>
                  <td><FromToCell from={fromPort.label} to={toPort.label} /></td>
                  <td><FromToCell from={fromPort.interfaceType} to={toPort.interfaceType} /></td>
                  <td>{getInterfaceWiringTableCableLabel(edge.cableType)}</td>
                  <td><ConnectionMethodCell value={edge.connectionMethod} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="emptyState">当前方案没有可生成的接口接线。</div>}
      </div>
    </section>
  );
}

function FromToCell({ from, to }: { from: string; to: string }) {
  return (
    <span className="interfaceWiringFromToCell">
      <span><b>从</b>{from}</span>
      <span><b>到</b>{to}</span>
    </span>
  );
}

function ConnectionMethodCell({ value }: { value: string }) {
  const warningIndex = value.indexOf(WIRED_MIC_LINE_IN_POWER_NOTE);
  if (warningIndex < 0) return <>{value}</>;
  const before = value.slice(0, warningIndex).trim();
  const after = value.slice(warningIndex + WIRED_MIC_LINE_IN_POWER_NOTE.length).trim();
  return (
    <span className="interfaceWiringConnectionMethod">
      {before && <span>{before}</span>}
      <strong className="interfaceWiringInlineWarning">{WIRED_MIC_LINE_IN_POWER_NOTE}</strong>
      {after && <span>{after}</span>}
    </span>
  );
}

type CableLegendKind = "speaker" | "audio" | "serial" | "network" | "usb" | "other";

const CABLE_SHEATH_COLORS: Record<CableLegendKind, string> = {
  speaker: "#b45309",
  audio: "#0f766e",
  serial: "#7c3aed",
  network: "#2563eb",
  usb: "#eab308",
  other: "#475569"
};

interface CableLegendRow {
  kind: CableLegendKind;
  label: string;
  quantity: number;
  description: string;
}

function CableLegendTable({ rows }: { rows: CableLegendRow[] }) {
  return (
    <div className="interfaceWiringLegend">
      <strong>线材图例</strong>
      <table>
        <thead>
          <tr><th>胶套颜色</th><th>线材</th><th>接线关系</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.kind}>
              <td><CableLegendSwatch kind={row.kind} /></td>
              <td>{row.label}{row.quantity > 1 ? ` ×${row.quantity}` : ""}</td>
              <td>{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CableLegendSwatch({ kind }: { kind: CableLegendKind }) {
  return (
    <span className="interfaceWiringLegendSwatch" aria-label={`${kind}线材胶套颜色`}>
      <i style={{ backgroundColor: CABLE_SHEATH_COLORS[kind] }} />
    </span>
  );
}

function getCableLegendRows(edges: InterfaceWiringEdge[]): CableLegendRow[] {
  const rows = new Map<CableLegendKind, CableLegendRow>();
  edges.forEach((edge) => {
    const kind = getCableLegendKind(edge);
    const definition = getCableLegendDefinition(kind, edge.cableType);
    const existing = rows.get(kind);
    if (existing) existing.quantity += edge.quantity;
    else rows.set(kind, { kind, quantity: edge.quantity, ...definition });
  });
  const order: CableLegendKind[] = ["speaker", "audio", "serial", "network", "usb", "other"];
  return order.flatMap((kind) => rows.get(kind) ?? []);
}

function getCableLegendKind(edge: InterfaceWiringEdge): CableLegendKind {
  if (isNetworkEdge(edge)) return "network";
  if (isUsbEdge(edge)) return "usb";
  if (/232/i.test(edge.cableType)) return "serial";
  if (edge.cableType.includes("音箱线")) return "speaker";
  if (/音频(?:跳)?线|话筒线/i.test(edge.cableType)) return "audio";
  return "other";
}

function getCableSheathColor(edge: InterfaceWiringEdge) {
  return CABLE_SHEATH_COLORS[getCableLegendKind(edge)];
}

function getCableLegendDefinition(kind: CableLegendKind, fallbackLabel: string) {
  if (kind === "speaker") return { label: "音箱线", description: "红线接 +；白线接 -" };
  if (kind === "audio") return { label: "音频线", description: "红线接 +；白线接 -；屏蔽线接 G" };
  if (kind === "serial") return { label: "232线", description: "黄线 TX；绿线 RX；黑线 GND，TX/RX交叉" };
  if (kind === "network") return { label: "网线", description: "T568B 1-8芯直通" };
  if (kind === "usb") return { label: "USB线", description: "音频双向；内置232串口信号，可用于连接调试软件" };
  return { label: fallbackLabel, description: "按图中接口方向直连" };
}

function InterfaceWiringFindings({ findings }: { findings: InterfaceWiringFinding[] }) {
  return (
    <section className="interfaceWiringFindingSection">
      <div className="interfaceWiringSubHeader">
        <h4>专项复核</h4>
        <span>{findings.length ? `${findings.length} 项` : "无"}</span>
      </div>
      <div className="interfaceWiringFindingList">
        {findings.length ? findings.map((finding) => (
          <article className={`interfaceWiringFinding ${finding.severity}`} key={`${finding.code}-${finding.nodeId ?? "global"}`}>
            {finding.severity === "hard"
              ? <CircleAlert size={18} />
              : finding.severity === "review"
                ? <AlertTriangle size={18} />
                : <CheckCircle2 size={18} />}
            <div>
              <strong>{finding.title}</strong>
              <p>{finding.message}</p>
            </div>
          </article>
        )) : (
          <div className="interfaceWiringFinding ready">
            <CheckCircle2 size={18} />
            <div><strong>接口校核通过</strong><p>当前候选未发现接口容量或资料缺口。</p></div>
          </div>
        )}
      </div>
    </section>
  );
}

function getPortAnchor(
  node: InterfaceWiringNode,
  portId: string,
  position: WiringNodePosition,
  terminalId?: string,
  peer?: WiringNodePosition
) {
  const index = Math.max(0, node.ports.findIndex((port) => port.id === portId));
  const port = node.ports[index];
  const panelProfile = getDevicePortProfile(node.productId)?.interfacePanel;
  const imageRect = panelProfile ? getInterfacePanelImageRect(node, position) : undefined;
  const visualAnchor = panelProfile && port
    ? getInterfacePanelPortAnchor(panelProfile, port.capabilityId, index, node.ports.length)
    : undefined;
  if (imageRect && visualAnchor) {
    const terminalAnchor = terminalId ? visualAnchor.terminalAnchors?.[terminalId] : undefined;
    if (terminalAnchor) {
      return {
        x: imageRect.x + terminalAnchor.x * imageRect.width,
        y: imageRect.y + terminalAnchor.y * imageRect.height
      };
    }
    const basePoint = {
      x: imageRect.x + visualAnchor.x * imageRect.width,
      y: imageRect.y + visualAnchor.y * imageRect.height
    };
    const offset = terminalId && port
      ? getInterfaceWiringLogicalTerminalOffset(port.terminals, terminalId, getPeerDelta(basePoint, peer))
      : { x: 0, y: 0 };
    return {
      x: basePoint.x + offset.x,
      y: basePoint.y + offset.y
    };
  }
  const fallback = getFallbackPortMarker(node, index, position, imageRect, panelProfile);
  const basePoint = {
    x: position.x + fallback.left,
    y: position.y + fallback.top
  };
  const offset = terminalId && port
    ? getInterfaceWiringLogicalTerminalOffset(port.terminals, terminalId, getPeerDelta(basePoint, peer))
    : { x: 0, y: 0 };
  return {
    x: basePoint.x + offset.x,
    y: basePoint.y + offset.y
  };
}

function getPeerDelta(point: { x: number; y: number }, peer?: WiringNodePosition) {
  return peer
    ? { x: peer.centerX - point.x, y: peer.centerY - point.y }
    : { x: 0, y: -1 };
}

function buildEdgeDrawings(
  model: InterfaceWiringModel,
  layout: ReturnType<typeof getInterfaceWiringLayout>,
  portReferenceNumbers: Record<string, number>
) {
  const nodeMap = new Map(model.nodes.map((node) => [node.id, node]));
  const pairCounts = new Map<string, number>();
  model.edges.forEach((edge) => {
    const key = getPairKey(edge);
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  });
  const pairIndexes = new Map<string, number>();
  const nodeRects = Object.entries(layout.positions).map(([id, position]) => ({
    id,
    x: position.x,
    y: position.y,
    width: position.width,
    height: position.height
  }));
  const usedReferencePoints: Array<{ x: number; y: number }> = [];
  const routedCableRoutes: CableRoute[] = [];
  const drawings = new Map<string, {
    route: CableRoute;
    trunkRoutes: Array<{
      id: string;
      path: string;
      color: string;
      strokeWidth: number;
      confirmed: boolean;
      needsOutline: boolean;
    }>;
    conductorRoutes: Array<{
      conductor: InterfaceWiringConductor;
      fromLeadPath: string;
      toLeadPath: string;
      strokeWidth: number;
      needsOutline: boolean;
    }>;
    referenceBadges: Array<{
      x: number;
      y: number;
      referenceNumber: number;
    }>;
  }>();

  model.edges.forEach((edge) => {
    const fromNode = nodeMap.get(edge.fromNodeId);
    const toNode = nodeMap.get(edge.toNodeId);
    const fromPosition = layout.positions[edge.fromNodeId];
    const toPosition = layout.positions[edge.toNodeId];
    if (!fromNode || !toNode || !fromPosition || !toPosition) return;
    const from = getPortAnchor(fromNode, edge.fromPortId, fromPosition, undefined, toPosition);
    const to = getPortAnchor(toNode, edge.toPortId, toPosition, undefined, fromPosition);
    const fromRoutingRect = fromPosition;
    const toRoutingRect = toPosition;
    const pairKey = getPairKey(edge);
    const pairIndex = pairIndexes.get(pairKey) ?? 0;
    pairIndexes.set(pairKey, pairIndex + 1);
    const pairCount = pairCounts.get(pairKey) ?? 1;
    const laneOffset = (pairIndex - (pairCount - 1) / 2) * 34;
    const displayConductors = getDisplayConductors(edge);
    const fromVerticalExit = getVerticalExitFan(edge, edge.fromNodeId, model.edges, layout.positions);
    const toVerticalExit = getVerticalExitFan(edge, edge.toNodeId, model.edges, layout.positions);
    const horizontalLaneBias = fromVerticalExit.count >= toVerticalExit.count
      ? fromVerticalExit.laneBias
      : toVerticalExit.laneBias;
    const route: CableRoute = edge.kind === "jumper"
      ? getInternalJumperRoute(from, to, fromPosition, edge.jumperRoute, laneOffset)
      : findOpenCableRoute({
        from,
        to,
        preferredOffset: laneOffset,
        nodeRects,
        endpointNodeIds: new Set([edge.fromNodeId, edge.toNodeId]),
        canvasWidth: layout.width,
        canvasHeight: layout.height,
        routedCableRoutes,
        fromRoutingRect,
        toRoutingRect,
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        fromVerticalExitOffset: fromVerticalExit.offset,
        toVerticalExitOffset: toVerticalExit.offset,
        horizontalLaneBias
      });
    if (edge.kind !== "jumper") routedCableRoutes.push(route);
    const terminalPairs = displayConductors.map((conductor, conductorIndex) => {
      const fromFanOffset = getSharedTerminalFanOffset(
        displayConductors,
        conductorIndex,
        conductor.fromTerminalId,
        "from"
      );
      const toFanOffset = getSharedTerminalFanOffset(
        displayConductors,
        conductorIndex,
        conductor.toTerminalId,
        "to"
      );
      const conductorFrom = getPortAnchor(
        fromNode,
        edge.fromPortId,
        fromPosition,
        conductor.fromTerminalId,
        toPosition
      );
      const conductorTo = getPortAnchor(
        toNode,
        edge.toPortId,
        toPosition,
        conductor.toTerminalId,
        fromPosition
      );
      return { conductor, fromFanOffset, toFanOffset, conductorFrom, conductorTo };
    });
    const multicore = displayConductors.length > 1 && edge.kind !== "jumper";
    const fromMerge = multicore && route.endpointEscapes
      ? getInternalCableMergePoint(terminalPairs.map((item) => item.conductorFrom), route.endpointEscapes.from, fromRoutingRect)
      : from;
    const toMerge = multicore && route.endpointEscapes
      ? getInternalCableMergePoint(terminalPairs.map((item) => item.conductorTo), route.endpointEscapes.to, toRoutingRect)
      : to;
    const conductorRoutes = terminalPairs.map(({
      conductor,
      fromFanOffset,
      toFanOffset,
      conductorFrom,
      conductorTo
    }) => {
      const paths = multicore
        ? {
            fromLeadPath: getTerminalFanPath(conductorFrom, fromMerge, fromFanOffset, false),
            toLeadPath: getTerminalFanPath(conductorTo, toMerge, toFanOffset, true)
          }
        : { fromLeadPath: "", toLeadPath: "" };
      return {
        conductor,
        ...paths,
        strokeWidth: edge.kind === "jumper" ? 3.2 : isNetworkEdge(edge) || isUsbEdge(edge) ? 4.5 : 2.2,
        needsOutline: conductor.color.toLowerCase() === "#ffffff"
      };
    });
    const referenceNumber = portReferenceNumbers[edge.fromPortId] ?? portReferenceNumbers[edge.toPortId];
    const referencePoint = referenceNumber
      ? findReferenceBadgePoint(route, nodeRects, usedReferencePoints)
      : undefined;
    if (referencePoint) usedReferencePoints.push(referencePoint);
    const referenceBadges = referencePoint ? [{ ...referencePoint, referenceNumber }] : [];
    const trunkRoutes = getCableTrunkRoutes(edge, displayConductors, route, fromMerge, toMerge);
    drawings.set(edge.id, { route, trunkRoutes, conductorRoutes, referenceBadges });
  });
  return drawings;
}

type CableDeviceExitSide = "left" | "right" | "top" | "bottom";

type CableDeviceEscape = {
  side: CableDeviceExitSide;
  edgePoint: { x: number; y: number };
  routePoint: { x: number; y: number };
};

function getSharedTerminalFanOffset(
  conductors: InterfaceWiringConductor[],
  conductorIndex: number,
  terminalId: string,
  endpoint: "from" | "to"
) {
  const sharedIndexes = conductors.flatMap((conductor, index) => {
    const candidate = endpoint === "from" ? conductor.fromTerminalId : conductor.toTerminalId;
    return candidate === terminalId ? [index] : [];
  });
  if (sharedIndexes.length < 2) return 0;
  const sharedIndex = sharedIndexes.indexOf(conductorIndex);
  return (sharedIndex - (sharedIndexes.length - 1) / 2) * 12;
}

function getTerminalFanPath(
  terminal: { x: number; y: number },
  split: { x: number; y: number },
  fanOffset: number,
  reverse: boolean
) {
  if (!fanOffset) {
    return reverse
      ? `M ${split.x} ${split.y} L ${terminal.x} ${terminal.y}`
      : `M ${terminal.x} ${terminal.y} L ${split.x} ${split.y}`;
  }
  const deltaX = split.x - terminal.x;
  const deltaY = split.y - terminal.y;
  const length = Math.hypot(deltaX, deltaY) || 1;
  const stemDistance = Math.min(14, length * 0.45);
  const stemRatio = stemDistance / length;
  const fanPoint = {
    x: terminal.x + deltaX * stemRatio - (deltaY / length) * fanOffset,
    y: terminal.y + deltaY * stemRatio + (deltaX / length) * fanOffset
  };
  return reverse
    ? `M ${split.x} ${split.y} L ${fanPoint.x} ${fanPoint.y} L ${terminal.x} ${terminal.y}`
    : `M ${terminal.x} ${terminal.y} L ${fanPoint.x} ${fanPoint.y} L ${split.x} ${split.y}`;
}

function findReferenceBadgePoint(
  route: CableRoute,
  nodeRects: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  usedReferencePoints: Array<{ x: number; y: number }>
) {
  if (route.horizontalCorridor) {
    const midpoint = (route.horizontalCorridor.fromX + route.horizontalCorridor.toX) / 2;
    const candidates = [0, -28, 28, -56, 56].map((offset) => ({
      x: midpoint + offset,
      y: route.horizontalCorridor!.y
    }));
    const outsideNodes = candidates.filter((point) =>
      !nodeRects.some((rect) => pointInsideRect(point, rect, 11))
    );
    return outsideNodes.find((point) =>
      usedReferencePoints.every((used) => Math.hypot(point.x - used.x, point.y - used.y) >= 22)
    ) ?? outsideNodes[0] ?? candidates[0];
  }
  if (route.corridor) {
    const midpoint = (route.corridor.fromY + route.corridor.toY) / 2;
    const candidates = [0, -28, 28, -56, 56].map((offset) => ({
      x: route.corridor!.x,
      y: midpoint + offset
    }));
    const outsideNodes = candidates.filter((point) =>
      !nodeRects.some((rect) => pointInsideRect(point, rect, 11))
    );
    return outsideNodes.find((point) =>
      usedReferencePoints.every((used) => Math.hypot(point.x - used.x, point.y - used.y) >= 22)
    ) ?? outsideNodes[0] ?? candidates[0];
  }
  const progresses = [0.5, 0.46, 0.54, 0.42, 0.58, 0.38, 0.62, 0.34, 0.66];
  const outsideNodes = progresses.flatMap((progress) => {
    const point = cubicPoint(route.from, route.control1, route.control2, route.to, progress);
    return nodeRects.some((rect) => pointInsideRect(point, rect, 11)) ? [] : [point];
  });
  return outsideNodes.find((point) => usedReferencePoints.every((used) => Math.hypot(point.x - used.x, point.y - used.y) >= 22))
    ?? outsideNodes[0]
    ?? cubicPoint(route.from, route.control1, route.control2, route.to, 0.5);
}

function getDisplayConductors(edge: InterfaceWiringEdge): InterfaceWiringConductor[] {
  if (edge.kind === "jumper") {
    return [getCollapsedCableConductor(edge, "jumper", "音频跳线", CABLE_SHEATH_COLORS.audio, "+/-/G")];
  }
  if (isNetworkEdge(edge)) {
    return [getCollapsedCableConductor(edge, "network", "网线", CABLE_SHEATH_COLORS.network, "RJ45")];
  }
  if (isUsbEdge(edge)) {
    return [getCollapsedCableConductor(edge, "usb", "USB线", CABLE_SHEATH_COLORS.usb, "USB")];
  }
  return edge.conductors;
}

function getCableTrunkRoutes(
  edge: InterfaceWiringEdge,
  conductors: InterfaceWiringConductor[],
  route: CableRoute,
  fromMerge: { x: number; y: number },
  toMerge: { x: number; y: number }
) {
  const multicore = conductors.length > 1 && edge.kind !== "jumper";
  const conductor = conductors[0];
  const color = getCableSheathColor(edge);
  return [{
    id: multicore ? "display-sheath" : conductor.id,
    path: edge.kind === "jumper" ? route.path : getCompleteCableTrunkPath(route, fromMerge, toMerge),
    color,
    strokeWidth: edge.kind === "jumper"
      ? 3.2
      : multicore ? 6 : isNetworkEdge(edge) || isUsbEdge(edge) ? 4.5 : 2.2,
    confirmed: conductors.every((item) => item.confirmed),
    needsOutline: color.toLowerCase() === "#ffffff"
  }];
}

function getCompleteCableTrunkPath(
  route: CableRoute,
  fromMerge: { x: number; y: number },
  toMerge: { x: number; y: number }
) {
  if (!route.endpointEscapes) return route.path;
  const centralPath = route.path.replace(/^M\s+[-+.\deE]+\s+[-+.\deE]+\s*/, "");
  return [
    `M ${fromMerge.x} ${fromMerge.y}`,
    ...getCableEscapeCommands(fromMerge, route.endpointEscapes.from, false),
    centralPath,
    ...getCableEscapeCommands(toMerge, route.endpointEscapes.to, true)
  ].join(" ");
}

function getCableEscapeCommands(
  mergePoint: { x: number; y: number },
  escape: CableDeviceEscape,
  reverse: boolean
) {
  const sideVector = getCableExitVector(escape.side);
  const distanceToEdge = Math.hypot(
    escape.edgePoint.x - mergePoint.x,
    escape.edgePoint.y - mergePoint.y
  );
  const controlDistance = Math.min(24, Math.max(6, distanceToEdge * 0.35));
  const mergeControl = {
    x: mergePoint.x + sideVector.x * controlDistance,
    y: mergePoint.y + sideVector.y * controlDistance
  };
  const edgeControl = {
    x: escape.edgePoint.x - sideVector.x * controlDistance,
    y: escape.edgePoint.y - sideVector.y * controlDistance
  };
  const edgeCurve = `C ${mergeControl.x} ${mergeControl.y}, ${edgeControl.x} ${edgeControl.y}, ${escape.edgePoint.x} ${escape.edgePoint.y}`;
  const returnEdgeCurve = `C ${edgeControl.x} ${edgeControl.y}, ${mergeControl.x} ${mergeControl.y}, ${mergePoint.x} ${mergePoint.y}`;
  const turnDeltaX = escape.routePoint.x - escape.edgePoint.x;
  const turnDeltaY = escape.routePoint.y - escape.edgePoint.y;
  if (Math.hypot(turnDeltaX, turnDeltaY) < 0.5) {
    return reverse ? [returnEdgeCurve] : [edgeCurve];
  }
  const turnControl1 = {
    x: escape.edgePoint.x,
    y: escape.edgePoint.y + turnDeltaY * CABLE_CORRIDOR_CURVE_RATIO
  };
  const turnControl2 = {
    x: escape.routePoint.x - turnDeltaX * CABLE_CORRIDOR_CURVE_RATIO,
    y: escape.routePoint.y
  };
  const turnCurve = `C ${turnControl1.x} ${turnControl1.y}, ${turnControl2.x} ${turnControl2.y}, ${escape.routePoint.x} ${escape.routePoint.y}`;
  const returnTurnCurve = `C ${turnControl2.x} ${turnControl2.y}, ${turnControl1.x} ${turnControl1.y}, ${escape.edgePoint.x} ${escape.edgePoint.y}`;
  return reverse
    ? [returnTurnCurve, returnEdgeCurve]
    : [edgeCurve, turnCurve];
}

function getCableExitVector(side: CableDeviceExitSide) {
  if (side === "left") return { x: -1, y: 0 };
  if (side === "right") return { x: 1, y: 0 };
  if (side === "top") return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function getInternalCableMergePoint(
  terminals: Array<{ x: number; y: number }>,
  escape: CableDeviceEscape,
  deviceRect: { x: number; y: number; width: number; height: number }
) {
  const center = terminals.reduce(
    (sum, terminal) => ({ x: sum.x + terminal.x / terminals.length, y: sum.y + terminal.y / terminals.length }),
    { x: 0, y: 0 }
  );
  const direction = getCableExitVector(escape.side);
  return {
    x: clamp(center.x + direction.x * CABLE_INTERNAL_MERGE_DISTANCE, deviceRect.x + 6, deviceRect.x + deviceRect.width - 6),
    y: clamp(center.y + direction.y * CABLE_INTERNAL_MERGE_DISTANCE, deviceRect.y + 20, deviceRect.y + deviceRect.height - 6)
  };
}

function getCollapsedCableConductor(
  edge: InterfaceWiringEdge,
  id: string,
  label: string,
  color: string,
  terminalLabel: string
): InterfaceWiringConductor {
  return {
    id: `display-${id}`,
    label,
    color,
    fromTerminalId: "connector",
    fromTerminalLabel: terminalLabel,
    toTerminalId: "connector",
    toTerminalLabel: terminalLabel,
    confirmed: edge.conductors.every((conductor) => conductor.confirmed)
  };
}

function isNetworkEdge(edge: InterfaceWiringEdge) {
  return /网线|T568B|超五类|超六类/i.test(edge.cableType);
}

function isUsbEdge(edge: InterfaceWiringEdge) {
  return /USB/i.test(edge.cableType);
}

function findOpenCableRoute(input: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  preferredOffset: number;
  nodeRects: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  endpointNodeIds: Set<string>;
  canvasWidth: number;
  canvasHeight: number;
  routedCableRoutes: CableRoute[];
  fromRoutingRect: { x: number; y: number; width: number; height: number };
  toRoutingRect: { x: number; y: number; width: number; height: number };
  fromNodeId: string;
  toNodeId: string;
  fromVerticalExitOffset: number;
  toVerticalExitOffset: number;
  horizontalLaneBias: number;
}): CableRoute {
  const {
    from,
    to,
    preferredOffset,
    nodeRects,
    endpointNodeIds,
    canvasWidth,
    canvasHeight,
    routedCableRoutes,
    fromRoutingRect,
    toRoutingRect,
    fromNodeId,
    toNodeId,
    fromVerticalExitOffset,
    toVerticalExitOffset,
    horizontalLaneBias
  } = input;
  const offsets = [preferredOffset];
  for (let distance = 44; distance <= 440; distance += 44) {
    offsets.push(preferredOffset - distance, preferredOffset + distance);
  }
  let firstBoundedRoute: CableRoute | undefined;
  for (const offset of offsets) {
    const route = getEdgeRoute(from, to, offset);
    if (!edgeRouteStaysInsideDrawingFrame(route, canvasWidth, canvasHeight)) continue;
    firstBoundedRoute ??= route;
  }
  let firstDistinctHorizontal: CableRoute | undefined;
  let firstCollisionFreeHorizontal: CableRoute | undefined;
  const fromIsAbove = fromRoutingRect.y + fromRoutingRect.height <= toRoutingRect.y;
  const toIsAbove = toRoutingRect.y + toRoutingRect.height <= fromRoutingRect.y;
  if (fromIsAbove || toIsAbove) {
    const fromSide: CableDeviceExitSide = fromIsAbove ? "bottom" : "top";
    const toSide: CableDeviceExitSide = fromIsAbove ? "top" : "bottom";
    const fromEscape = getVerticalDeviceCableEscape(
      from,
      fromRoutingRect,
      fromSide,
      fromVerticalExitOffset,
      nodeRects,
      fromNodeId
    );
    const toEscape = getVerticalDeviceCableEscape(
      to,
      toRoutingRect,
      toSide,
      toVerticalExitOffset,
      nodeRects,
      toNodeId
    );
    const minEndpointY = Math.min(fromEscape.routePoint.y, toEscape.routePoint.y);
    const maxEndpointY = Math.max(fromEscape.routePoint.y, toEscape.routePoint.y);
    const minLaneY = minEndpointY + CABLE_HORIZONTAL_MIN_CLEARANCE;
    const maxLaneY = maxEndpointY - CABLE_HORIZONTAL_MIN_CLEARANCE;
    if (minLaneY <= maxLaneY) {
      const laneCandidates = getHorizontalLaneCandidates(minLaneY, maxLaneY, horizontalLaneBias);
      for (const laneSpacing of [CABLE_CORRIDOR_LANE_SPACING, CABLE_CORRIDOR_MIN_LANE_SPACING]) {
        for (const corridorY of laneCandidates) {
          const corridorRoute = getHorizontalCorridorCableRoute(fromEscape.routePoint, toEscape.routePoint, corridorY);
          corridorRoute.endpointEscapes = { from: fromEscape, to: toEscape };
          if (!edgeRouteStaysInsideDrawingFrame(corridorRoute, canvasWidth, canvasHeight)) continue;
          if (edgeRouteCrossesNodes(corridorRoute, nodeRects, endpointNodeIds)) continue;
          firstCollisionFreeHorizontal ??= corridorRoute;
          if (!cableCorridorLaneConflicts(corridorRoute, routedCableRoutes, laneSpacing)) {
            firstDistinctHorizontal ??= corridorRoute;
          }
          if (!cableRouteConflictsWithReservations(corridorRoute, routedCableRoutes, laneSpacing)) {
            return corridorRoute;
          }
        }
      }
    }
  }
  const obstacles = nodeRects.filter((rect) =>
    !endpointNodeIds.has(rect.id) &&
    rect.y < Math.max(from.y, to.y) &&
    rect.y + rect.height > Math.min(from.y, to.y)
  );
  const routeBandRects = [fromRoutingRect, toRoutingRect, ...obstacles];
  const obstacleLeft = Math.min(...routeBandRects.map((rect) => rect.x));
  const obstacleRight = Math.max(...routeBandRects.map((rect) => rect.x + rect.width));
  const corridorGap = 6;
  const minRouteX = DRAWING_FRAME_LEFT + CABLE_FRAME_CLEARANCE;
  const maxRouteX = canvasWidth - DRAWING_FRAME_RIGHT - CABLE_FRAME_CLEARANCE;
  const corridorCandidates = deduplicateCorridorCandidates([
    ...getLocalCorridorCandidates(
      (from.x + to.x) / 2 + preferredOffset,
      minRouteX,
      maxRouteX
    ),
    ...getCorridorLaneCandidates(
      Math.max(minRouteX, obstacleLeft - corridorGap),
      minRouteX,
      -1
    ),
    ...getCorridorLaneCandidates(
      Math.min(maxRouteX, obstacleRight + corridorGap),
      maxRouteX,
      1
    )
  ]);
  corridorCandidates.sort((left, right) =>
    Math.abs(from.x - left) + Math.abs(to.x - left) -
    (Math.abs(from.x - right) + Math.abs(to.x - right))
  );
  let firstDistinctCorridor: CableRoute | undefined;
  let firstCollisionFreeCorridor: CableRoute | undefined;
  for (const laneSpacing of [CABLE_CORRIDOR_LANE_SPACING, CABLE_CORRIDOR_MIN_LANE_SPACING]) {
    for (const corridorX of corridorCandidates) {
      const fromEscape = getDeviceCableEscape(from, fromRoutingRect, corridorX, 0, nodeRects, fromNodeId);
      const toEscape = getDeviceCableEscape(to, toRoutingRect, corridorX, 0, nodeRects, toNodeId);
      const corridorRoute = getCorridorCableRoute(fromEscape.routePoint, toEscape.routePoint, corridorX);
      corridorRoute.endpointEscapes = { from: fromEscape, to: toEscape };
      if (!edgeRouteStaysInsideDrawingFrame(corridorRoute, canvasWidth, canvasHeight)) continue;
      if (edgeRouteCrossesNodes(corridorRoute, nodeRects, endpointNodeIds)) continue;
      firstCollisionFreeCorridor ??= corridorRoute;
      if (!cableCorridorLaneConflicts(corridorRoute, routedCableRoutes, laneSpacing)) {
        firstDistinctCorridor ??= corridorRoute;
      }
      if (!cableRouteConflictsWithReservations(corridorRoute, routedCableRoutes, laneSpacing)) {
        return corridorRoute;
      }
    }
  }
  const distinctRoutes = [firstDistinctHorizontal, firstDistinctCorridor]
    .filter((route): route is CableRoute => Boolean(route));
  if (distinctRoutes.length) {
    return distinctRoutes.sort((left, right) => getCableRouteLength(left) - getCableRouteLength(right))[0];
  }
  const collisionFreeRoutes = [firstCollisionFreeHorizontal, firstCollisionFreeCorridor]
    .filter((route): route is CableRoute => Boolean(route));
  if (collisionFreeRoutes.length) {
    return collisionFreeRoutes.sort((left, right) => getCableRouteLength(left) - getCableRouteLength(right))[0];
  }
  for (const offset of offsets) {
    const route = getEdgeRoute(from, to, offset);
    if (!edgeRouteStaysInsideDrawingFrame(route, canvasWidth, canvasHeight)) continue;
    if (!edgeRouteCrossesNodes(route, nodeRects, endpointNodeIds)) return route;
  }
  return firstBoundedRoute ?? getEdgeRoute(from, to, 0);
}

type CableRoute = ReturnType<typeof getEdgeRoute> & {
  endpointEscapes?: {
    from: CableDeviceEscape;
    to: CableDeviceEscape;
  };
  corridor?: {
    x: number;
    fromY: number;
    toY: number;
    entryControl1: { x: number; y: number };
    entryControl2: { x: number; y: number };
    exitControl1: { x: number; y: number };
    exitControl2: { x: number; y: number };
  };
  horizontalCorridor?: {
    y: number;
    fromX: number;
    toX: number;
    entryControl1: { x: number; y: number };
    entryControl2: { x: number; y: number };
    exitControl1: { x: number; y: number };
    exitControl2: { x: number; y: number };
  };
};

function getCorridorCableRoute(
  from: { x: number; y: number },
  to: { x: number; y: number },
  corridorX: number,
  fromY?: number,
  toY?: number
): CableRoute {
  const verticalSegment = fromY === undefined || toY === undefined
    ? getCorridorVerticalSegment(from, to, corridorX)
    : { fromY, toY };
  const geometry = getSmoothCorridorGeometry(
    from,
    to,
    corridorX,
    verticalSegment.fromY,
    verticalSegment.toY
  );
  return {
    path: geometry.path,
    labelX: corridorX,
    labelY: (verticalSegment.fromY + verticalSegment.toY) / 2,
    offset: 0,
    labelProgress: 0.5,
    from,
    to,
    control1: geometry.entryControl1,
    control2: geometry.exitControl2,
    corridor: {
      x: corridorX,
      fromY: verticalSegment.fromY,
      toY: verticalSegment.toY,
      entryControl1: geometry.entryControl1,
      entryControl2: geometry.entryControl2,
      exitControl1: geometry.exitControl1,
      exitControl2: geometry.exitControl2
    }
  };
}

function getHorizontalCorridorCableRoute(
  from: { x: number; y: number },
  to: { x: number; y: number },
  corridorY: number
): CableRoute {
  const horizontalSegment = getCorridorHorizontalSegment(from, to, corridorY);
  const geometry = getSmoothHorizontalCorridorGeometry(
    from,
    to,
    corridorY,
    horizontalSegment.fromX,
    horizontalSegment.toX
  );
  return {
    path: geometry.path,
    labelX: (horizontalSegment.fromX + horizontalSegment.toX) / 2,
    labelY: corridorY,
    offset: 0,
    labelProgress: 0.5,
    from,
    to,
    control1: geometry.entryControl1,
    control2: geometry.exitControl2,
    horizontalCorridor: {
      y: corridorY,
      fromX: horizontalSegment.fromX,
      toX: horizontalSegment.toX,
      entryControl1: geometry.entryControl1,
      entryControl2: geometry.entryControl2,
      exitControl1: geometry.exitControl1,
      exitControl2: geometry.exitControl2
    }
  };
}

function getHorizontalLaneCandidates(minY: number, maxY: number, laneBias: number) {
  const centerY = minY + (maxY - minY) * clamp(laneBias, 0, 1);
  const candidates: number[] = [];
  const maxDistance = Math.max(centerY - minY, maxY - centerY);
  for (let distance = 0; distance <= maxDistance + 0.5; distance += CABLE_HORIZONTAL_LANE_STEP) {
    const offsets = distance ? [-distance, distance] : [0];
    offsets.forEach((offset) => {
      const y = centerY + offset;
      if (y >= minY && y <= maxY) candidates.push(y);
    });
  }
  if (!candidates.some((candidate) => Math.abs(candidate - minY) < 0.5)) candidates.push(minY);
  if (!candidates.some((candidate) => Math.abs(candidate - maxY) < 0.5)) candidates.push(maxY);
  return deduplicateCorridorCandidates(candidates);
}

function getVerticalDeviceCableEscape(
  terminal: { x: number; y: number },
  deviceRect: { x: number; y: number; width: number; height: number },
  side: "top" | "bottom",
  exitOffset: number,
  obstacleRects: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  ownNodeId: string
) {
  const edgePoint = {
    x: clamp(terminal.x + exitOffset, deviceRect.x + 8, deviceRect.x + deviceRect.width - 8),
    y: side === "top"
      ? deviceRect.y - CABLE_DEVICE_BREAKOUT_GAP
      : deviceRect.y + deviceRect.height + CABLE_DEVICE_BREAKOUT_GAP
  };
  const escape: CableDeviceEscape = { side, edgePoint, routePoint: edgePoint };
  return deviceEscapeIsOpen(terminal, escape, obstacleRects, ownNodeId)
    ? escape
    : { ...escape, edgePoint: { ...edgePoint, x: terminal.x }, routePoint: { ...edgePoint, x: terminal.x } };
}

function getVerticalExitFan(
  edge: InterfaceWiringEdge,
  nodeId: string,
  edges: InterfaceWiringEdge[],
  positions: WiringNodePositions
) {
  const nodePosition = positions[nodeId];
  if (!nodePosition || edge.kind === "jumper") return { offset: 0, laneBias: 0.5, count: 1 };
  const peerId = edge.fromNodeId === nodeId ? edge.toNodeId : edge.fromNodeId;
  const peerPosition = positions[peerId];
  if (!peerPosition) return { offset: 0, laneBias: 0.5, count: 1 };
  const side = peerPosition.centerY < nodePosition.centerY ? "top" : "bottom";
  const siblings = edges.flatMap((candidate) => {
    if (candidate.kind === "jumper") return [];
    const candidatePeerId = candidate.fromNodeId === nodeId
      ? candidate.toNodeId
      : candidate.toNodeId === nodeId ? candidate.fromNodeId : undefined;
    const candidatePeer = candidatePeerId ? positions[candidatePeerId] : undefined;
    if (!candidatePeer) return [];
    const candidateSide = candidatePeer.centerY < nodePosition.centerY ? "top" : "bottom";
    return candidateSide === side ? [{ edge: candidate, peer: candidatePeer }] : [];
  }).sort((left, right) =>
    left.peer.centerX - right.peer.centerX || left.peer.centerY - right.peer.centerY || left.edge.id.localeCompare(right.edge.id)
  );
  const index = siblings.findIndex((candidate) => candidate.edge.id === edge.id);
  if (index < 0 || siblings.length < 2) return { offset: 0, laneBias: 0.5, count: 1 };
  return {
    offset: clamp((index - (siblings.length - 1) / 2) * 14, -70, 70),
    laneBias: (index + 0.5) / siblings.length,
    count: siblings.length
  };
}

function getCorridorLaneCandidates(startX: number, boundaryX: number, direction: -1 | 1) {
  const candidates: number[] = [];
  const step = CABLE_CORRIDOR_LANE_SPACING / 5;
  for (
    let x = startX;
    direction < 0 ? x >= boundaryX : x <= boundaryX;
    x += direction * step
  ) {
    candidates.push(x);
  }
  if (!candidates.length || Math.abs(candidates[candidates.length - 1] - boundaryX) > 0.5) {
    candidates.push(boundaryX);
  }
  return candidates;
}

function getLocalCorridorCandidates(centerX: number, minX: number, maxX: number) {
  const candidates: number[] = [];
  for (let distance = 0; distance <= 180; distance += CABLE_CORRIDOR_LANE_SPACING) {
    const offsets = distance ? [-distance, distance] : [0];
    offsets.forEach((offset) => {
      const x = centerX + offset;
      if (x >= minX && x <= maxX) candidates.push(x);
    });
  }
  return candidates;
}

function deduplicateCorridorCandidates(candidates: number[]) {
  return candidates.filter((candidate, index) =>
    candidates.findIndex((other) => Math.abs(other - candidate) < 0.5) === index
  );
}

function getDeviceCableEscape(
  terminal: { x: number; y: number },
  deviceRect: { x: number; y: number; width: number; height: number },
  corridorX: number,
  conductorOffset: number,
  obstacleRects: Array<{ id: string; x: number; y: number; width: number; height: number }> = [],
  ownNodeId = ""
): CableDeviceEscape {
  const deviceCenterX = deviceRect.x + deviceRect.width / 2;
  const deviceCenterY = deviceRect.y + deviceRect.height / 2;
  const sideCandidates = ([
    { side: "left" as const, distance: Math.abs(terminal.x - deviceRect.x), preference: corridorX < deviceCenterX ? 0 : 2 },
    { side: "right" as const, distance: Math.abs(deviceRect.x + deviceRect.width - terminal.x), preference: corridorX >= deviceCenterX ? 0 : 2 },
    { side: "top" as const, distance: Math.abs(terminal.y - deviceRect.y), preference: terminal.y <= deviceCenterY ? 1 : 2 },
    { side: "bottom" as const, distance: Math.abs(deviceRect.y + deviceRect.height - terminal.y), preference: terminal.y > deviceCenterY ? 1 : 2 }
  ] satisfies Array<{ side: CableDeviceExitSide; distance: number; preference: number }>)
    .sort((left, right) => left.distance - right.distance || left.preference - right.preference)
    .map(({ side }) => {
      if (side === "left" || side === "right") {
        const edgePoint = {
          x: side === "left"
            ? deviceRect.x - CABLE_DEVICE_BREAKOUT_GAP
            : deviceRect.x + deviceRect.width + CABLE_DEVICE_BREAKOUT_GAP,
          y: terminal.y + conductorOffset
        };
        return { side, edgePoint, routePoint: edgePoint } satisfies CableDeviceEscape;
      }
      const verticalDirection = side === "top" ? -1 : 1;
      const horizontalDirection = Math.sign(corridorX - terminal.x) || (corridorX < deviceCenterX ? -1 : 1);
      const edgePoint = {
        x: terminal.x + conductorOffset,
        y: side === "top"
          ? deviceRect.y - CABLE_DEVICE_BREAKOUT_GAP
          : deviceRect.y + deviceRect.height + CABLE_DEVICE_BREAKOUT_GAP
      };
      return {
        side,
        edgePoint,
        routePoint: {
          x: edgePoint.x + horizontalDirection * CABLE_CORRIDOR_MIN_BEND,
          y: edgePoint.y + verticalDirection * CABLE_CORRIDOR_MIN_BEND
        }
      } satisfies CableDeviceEscape;
    });
  return sideCandidates.find((escape) =>
    deviceEscapeIsOpen(terminal, escape, obstacleRects, ownNodeId)
  ) ?? sideCandidates[0];
}

function deviceEscapeIsOpen(
  terminal: { x: number; y: number },
  escape: CableDeviceEscape,
  obstacleRects: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  ownNodeId: string
) {
  const samplePoints: Array<{ x: number; y: number }> = [];
  for (let index = 1; index <= 12; index += 1) {
    const progress = index / 12;
    samplePoints.push({
      x: terminal.x + (escape.edgePoint.x - terminal.x) * progress,
      y: terminal.y + (escape.edgePoint.y - terminal.y) * progress
    });
    samplePoints.push({
      x: escape.edgePoint.x + (escape.routePoint.x - escape.edgePoint.x) * progress,
      y: escape.edgePoint.y + (escape.routePoint.y - escape.edgePoint.y) * progress
    });
  }
  return obstacleRects
    .filter((rect) => rect.id !== ownNodeId)
    .every((rect) => samplePoints.every((point) => !pointInsideRect(point, rect, 2)));
}

function cableRouteConflictsWithReservations(
  route: CableRoute,
  reservations: CableRoute[],
  laneSpacing: number
) {
  return cableCorridorLaneConflicts(route, reservations, laneSpacing) ||
    reservations.some((reservation) => cableRoutesIntersect(route, reservation, CABLE_ROUTE_INTERSECTION_GAP));
}

function cableCorridorLaneConflicts(
  route: CableRoute,
  reservations: CableRoute[],
  laneSpacing: number
) {
  return reservations.some((reservation) => {
    if (route.corridor && reservation.corridor) {
      const routeMinY = Math.min(route.corridor.fromY, route.corridor.toY);
      const routeMaxY = Math.max(route.corridor.fromY, route.corridor.toY);
      const reservationMinY = Math.min(reservation.corridor.fromY, reservation.corridor.toY);
      const reservationMaxY = Math.max(reservation.corridor.fromY, reservation.corridor.toY);
      const rangesOverlap =
        routeMinY <= reservationMaxY + CABLE_CORRIDOR_VERTICAL_CLEARANCE &&
        routeMaxY >= reservationMinY - CABLE_CORRIDOR_VERTICAL_CLEARANCE;
      if (rangesOverlap && Math.abs(route.corridor.x - reservation.corridor.x) < laneSpacing) return true;
    }
    if (route.horizontalCorridor && reservation.horizontalCorridor) {
      const routeMinX = Math.min(route.horizontalCorridor.fromX, route.horizontalCorridor.toX);
      const routeMaxX = Math.max(route.horizontalCorridor.fromX, route.horizontalCorridor.toX);
      const reservationMinX = Math.min(reservation.horizontalCorridor.fromX, reservation.horizontalCorridor.toX);
      const reservationMaxX = Math.max(reservation.horizontalCorridor.fromX, reservation.horizontalCorridor.toX);
      const rangesOverlap = routeMinX <= reservationMaxX + 12 && routeMaxX >= reservationMinX - 12;
      if (rangesOverlap && Math.abs(route.horizontalCorridor.y - reservation.horizontalCorridor.y) < laneSpacing) return true;
    }
    return false;
  });
}

function cableRoutesIntersect(route: CableRoute, reservation: CableRoute, gap: number) {
  const routePoints = [route.from, ...getCableRouteSamplePoints(route), route.to];
  const reservationPoints = [reservation.from, ...getCableRouteSamplePoints(reservation), reservation.to];
  for (let routeIndex = 1; routeIndex < routePoints.length; routeIndex += 1) {
    for (let reservationIndex = 1; reservationIndex < reservationPoints.length; reservationIndex += 1) {
      if (lineSegmentsAreCloserThan(
        routePoints[routeIndex - 1],
        routePoints[routeIndex],
        reservationPoints[reservationIndex - 1],
        reservationPoints[reservationIndex],
        gap
      )) return true;
    }
  }
  return false;
}

function lineSegmentsAreCloserThan(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
  gap: number
) {
  if (lineSegmentsIntersect(a1, a2, b1, b2)) return true;
  return Math.min(
    pointToSegmentDistance(a1, b1, b2),
    pointToSegmentDistance(a2, b1, b2),
    pointToSegmentDistance(b1, a1, a2),
    pointToSegmentDistance(b2, a1, a2)
  ) < gap;
}

function lineSegmentsIntersect(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number }
) {
  const cross = (
    origin: { x: number; y: number },
    first: { x: number; y: number },
    second: { x: number; y: number }
  ) => (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x);
  const d1 = cross(a1, a2, b1);
  const d2 = cross(a1, a2, b2);
  const d3 = cross(b1, b2, a1);
  const d4 = cross(b1, b2, a2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function pointToSegmentDistance(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number }
) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX ** 2 + deltaY ** 2;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const progress = clamp(
    ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared,
    0,
    1
  );
  return Math.hypot(
    point.x - (start.x + deltaX * progress),
    point.y - (start.y + deltaY * progress)
  );
}

function getCableRouteLength(route: CableRoute) {
  const points = [route.from, ...getCableRouteSamplePoints(route), route.to];
  return points.slice(1).reduce((length, point, index) =>
    length + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0
  );
}

function getCorridorVerticalSegment(
  from: { x: number; y: number },
  to: { x: number; y: number },
  corridorX: number
) {
  const verticalDistance = Math.abs(to.y - from.y);
  const horizontalDistance = Math.min(Math.abs(corridorX - from.x), Math.abs(to.x - corridorX));
  const desiredBend = Math.min(
    CABLE_CORRIDOR_MAX_BEND,
    Math.max(CABLE_CORRIDOR_MIN_BEND, horizontalDistance * 0.34)
  );
  const bend = Math.min(desiredBend, horizontalDistance * 0.45, verticalDistance * 0.28);
  const direction = Math.sign(to.y - from.y) || 1;
  return {
    fromY: from.y + direction * bend,
    toY: to.y - direction * bend
  };
}

function getCorridorHorizontalSegment(
  from: { x: number; y: number },
  to: { x: number; y: number },
  corridorY: number
) {
  const horizontalDistance = Math.abs(to.x - from.x);
  const verticalDistance = Math.min(Math.abs(corridorY - from.y), Math.abs(to.y - corridorY));
  const desiredBend = Math.min(
    CABLE_CORRIDOR_MAX_BEND,
    Math.max(8, verticalDistance * 0.45)
  );
  const bend = Math.min(desiredBend, verticalDistance * 0.45, horizontalDistance * 0.28);
  const direction = Math.sign(to.x - from.x) || 1;
  return {
    fromX: from.x + direction * bend,
    toX: to.x - direction * bend
  };
}

function getSmoothHorizontalCorridorGeometry(
  from: { x: number; y: number },
  to: { x: number; y: number },
  corridorY: number,
  fromX: number,
  toX: number
) {
  const entryControl1 = {
    x: from.x,
    y: from.y + (corridorY - from.y) * CABLE_CORRIDOR_CURVE_RATIO
  };
  const entryControl2 = {
    x: fromX - (fromX - from.x) * CABLE_CORRIDOR_CURVE_RATIO,
    y: corridorY
  };
  const exitControl1 = {
    x: toX + (to.x - toX) * CABLE_CORRIDOR_CURVE_RATIO,
    y: corridorY
  };
  const exitControl2 = {
    x: to.x,
    y: to.y - (to.y - corridorY) * CABLE_CORRIDOR_CURVE_RATIO
  };
  return {
    path: [
      `M ${from.x} ${from.y}`,
      `C ${entryControl1.x} ${entryControl1.y}, ${entryControl2.x} ${entryControl2.y}, ${fromX} ${corridorY}`,
      `L ${toX} ${corridorY}`,
      `C ${exitControl1.x} ${exitControl1.y}, ${exitControl2.x} ${exitControl2.y}, ${to.x} ${to.y}`
    ].join(" "),
    entryControl1,
    entryControl2,
    exitControl1,
    exitControl2
  };
}

function getSmoothCorridorGeometry(
  from: { x: number; y: number },
  to: { x: number; y: number },
  corridorX: number,
  fromY: number,
  toY: number
) {
  const entryControl1 = {
    x: from.x + (corridorX - from.x) * CABLE_CORRIDOR_CURVE_RATIO,
    y: from.y
  };
  const entryControl2 = {
    x: corridorX,
    y: fromY - (fromY - from.y) * CABLE_CORRIDOR_CURVE_RATIO
  };
  const exitControl1 = {
    x: corridorX,
    y: toY + (to.y - toY) * CABLE_CORRIDOR_CURVE_RATIO
  };
  const exitControl2 = {
    x: to.x - (to.x - corridorX) * CABLE_CORRIDOR_CURVE_RATIO,
    y: to.y
  };
  return {
    path: [
      `M ${from.x} ${from.y}`,
      `C ${entryControl1.x} ${entryControl1.y}, ${entryControl2.x} ${entryControl2.y}, ${corridorX} ${fromY}`,
      `L ${corridorX} ${toY}`,
      `C ${exitControl1.x} ${exitControl1.y}, ${exitControl2.x} ${exitControl2.y}, ${to.x} ${to.y}`
    ].join(" "),
    entryControl1,
    entryControl2,
    exitControl1,
    exitControl2
  };
}

function getEdgeRoute(
  from: { x: number; y: number },
  to: { x: number; y: number },
  labelOffset: number,
  labelProgress = 0.5
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const perpendicular = { x: -dy / distance, y: dx / distance };
  const controlOffsetX = perpendicular.x * labelOffset / 0.75;
  const controlOffsetY = perpendicular.y * labelOffset / 0.75;
  const control1 = { x: from.x + dx * 0.34 + controlOffsetX, y: from.y + dy * 0.34 + controlOffsetY };
  const control2 = { x: from.x + dx * 0.66 + controlOffsetX, y: from.y + dy * 0.66 + controlOffsetY };
  return {
    path: `M ${from.x} ${from.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${to.x} ${to.y}`,
    labelX: from.x + dx * labelProgress + perpendicular.x * labelOffset,
    labelY: from.y + dy * labelProgress + perpendicular.y * labelOffset,
    offset: labelOffset,
    labelProgress,
    from,
    to,
    control1,
    control2
  };
}

function getInternalJumperRoute(
  from: { x: number; y: number },
  to: { x: number; y: number },
  node: WiringNodePosition,
  routeSide?: InterfaceWiringEdge["jumperRoute"],
  laneOffset = 0
) {
  const resolvedSide = routeSide ?? ((from.x + to.x) / 2 <= node.centerX ? "left" : "right");
  const bulge = 44 + laneOffset;
  const controlDistance = bulge * 4 / 3;
  const isHorizontalRoute = resolvedSide === "top" || resolvedSide === "bottom";
  const bendX = resolvedSide === "left"
    ? Math.min(from.x, to.x) - controlDistance
    : resolvedSide === "right" ? Math.max(from.x, to.x) + controlDistance : undefined;
  const bendY = resolvedSide === "top"
    ? Math.min(from.y, to.y) - controlDistance
    : resolvedSide === "bottom" ? Math.max(from.y, to.y) + controlDistance : undefined;
  const control1 = isHorizontalRoute
    ? { x: from.x, y: bendY! }
    : { x: bendX!, y: from.y };
  const control2 = isHorizontalRoute
    ? { x: to.x, y: bendY! }
    : { x: bendX!, y: to.y };
  return {
    path: `M ${from.x} ${from.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${to.x} ${to.y}`,
    labelX: isHorizontalRoute
      ? (from.x + to.x) / 2
      : resolvedSide === "left" ? Math.min(from.x, to.x) - bulge : Math.max(from.x, to.x) + bulge,
    labelY: isHorizontalRoute
      ? resolvedSide === "top" ? Math.min(from.y, to.y) - bulge : Math.max(from.y, to.y) + bulge
      : (from.y + to.y) / 2,
    offset: laneOffset,
    labelProgress: 0.5,
    from,
    to,
    control1,
    control2
  };
}

function edgeRouteCrossesNodes(
  route: CableRoute,
  nodeRects: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  endpointNodeIds: Set<string>
) {
  const obstacles = nodeRects.filter((rect) => !endpointNodeIds.has(rect.id));
  return getCableRouteSamplePoints(route).some((point) =>
    obstacles.some((rect) => pointInsideRect(point, rect, 5))
  );
}

function edgeRouteStaysInsideDrawingFrame(route: CableRoute, canvasWidth: number, canvasHeight: number) {
  const minX = DRAWING_FRAME_LEFT + CABLE_FRAME_CLEARANCE;
  const maxX = canvasWidth - DRAWING_FRAME_RIGHT - CABLE_FRAME_CLEARANCE;
  const minY = DRAWING_FRAME_TOP + CABLE_FRAME_CLEARANCE;
  const maxY = canvasHeight - DRAWING_FRAME_BOTTOM - CABLE_FRAME_CLEARANCE;
  const routePoints = route.horizontalCorridor
    ? [
        route.from,
        route.horizontalCorridor.entryControl1,
        route.horizontalCorridor.entryControl2,
        { x: route.horizontalCorridor.fromX, y: route.horizontalCorridor.y },
        { x: route.horizontalCorridor.toX, y: route.horizontalCorridor.y },
        route.horizontalCorridor.exitControl1,
        route.horizontalCorridor.exitControl2,
        route.to,
        { x: route.labelX, y: route.labelY }
      ]
    : route.corridor
    ? [
        route.from,
        route.corridor.entryControl1,
        route.corridor.entryControl2,
        { x: route.corridor.x, y: route.corridor.fromY },
        { x: route.corridor.x, y: route.corridor.toY },
        route.corridor.exitControl1,
        route.corridor.exitControl2,
        route.to,
        { x: route.labelX, y: route.labelY }
      ]
    : [route.from, route.control1, route.control2, route.to, { x: route.labelX, y: route.labelY }];
  return routePoints.every(
    (point) => point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
  );
}

function getCableRouteSamplePoints(route: CableRoute) {
  if (route.horizontalCorridor) {
    const entry = { x: route.horizontalCorridor.fromX, y: route.horizontalCorridor.y };
    const exit = { x: route.horizontalCorridor.toX, y: route.horizontalCorridor.y };
    const points: Array<{ x: number; y: number }> = [];
    for (let index = 1; index < 20; index += 1) {
      const time = index / 20;
      points.push(cubicPoint(
        route.from,
        route.horizontalCorridor.entryControl1,
        route.horizontalCorridor.entryControl2,
        entry,
        time
      ));
      points.push({
        x: entry.x + (exit.x - entry.x) * time,
        y: route.horizontalCorridor.y
      });
      points.push(cubicPoint(
        exit,
        route.horizontalCorridor.exitControl1,
        route.horizontalCorridor.exitControl2,
        route.to,
        time
      ));
    }
    return points;
  }
  if (!route.corridor) {
    return Array.from({ length: 19 }, (_, index) => {
      const time = (index + 1) / 20;
      return cubicPoint(route.from, route.control1, route.control2, route.to, time);
    });
  }
  const entry = { x: route.corridor.x, y: route.corridor.fromY };
  const exit = { x: route.corridor.x, y: route.corridor.toY };
  const points: Array<{ x: number; y: number }> = [];
  for (let index = 1; index < 20; index += 1) {
    const time = index / 20;
    points.push(cubicPoint(
      route.from,
      route.corridor.entryControl1,
      route.corridor.entryControl2,
      entry,
      time
    ));
    points.push({
      x: route.corridor.x,
      y: entry.y + (exit.y - entry.y) * time
    });
    points.push(cubicPoint(
      exit,
      route.corridor.exitControl1,
      route.corridor.exitControl2,
      route.to,
      time
    ));
  }
  return points;
}

function cubicPoint(
  start: { x: number; y: number },
  control1: { x: number; y: number },
  control2: { x: number; y: number },
  end: { x: number; y: number },
  time: number
) {
  const inverse = 1 - time;
  return {
    x: inverse ** 3 * start.x + 3 * inverse ** 2 * time * control1.x + 3 * inverse * time ** 2 * control2.x + time ** 3 * end.x,
    y: inverse ** 3 * start.y + 3 * inverse ** 2 * time * control1.y + 3 * inverse * time ** 2 * control2.y + time ** 3 * end.y
  };
}

function pointInsideRect(
  point: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number },
  gap: number
) {
  return point.x > rect.x - gap && point.x < rect.x + rect.width + gap &&
    point.y > rect.y - gap && point.y < rect.y + rect.height + gap;
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

function getPairKey(edge: InterfaceWiringEdge) {
  if (edge.kind === "jumper") return edge.id;
  return [edge.fromNodeId, edge.toNodeId].sort().join("::");
}
