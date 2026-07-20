import { AlertTriangle, CheckCircle2, CircleAlert, Network } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { AppBrandId } from "../brand";
import type {
  ClassroomProfile,
  DeviceInterfacePanel,
  GeneratedOutputs,
  InterfaceWiringConductor,
  InterfaceWiringEdge,
  InterfaceWiringFinding,
  InterfaceWiringModel,
  InterfaceWiringNode,
  InterfaceWiringPort
} from "../types";
import {
  buildInterfaceWiringModel,
  getInterfacePanelImageRect,
  getInterfacePanelPortAnchor,
  getInterfaceWiringFallbackPortLabelTop,
  getInterfaceWiringFallbackPortMarker,
  getInterfaceWiringLayout,
  getInterfaceWiringLogicalTerminalOffset,
  getInterfaceWiringLogicalTerminals,
  getInterfaceWiringPortDrawingAnchor,
  getInterfaceWiringPortReferenceNumbers,
  getInterfaceWiringUsageRows,
  getInterfaceWiringUsageDeviceLabel,
  LEGACY_AUDIO_SYSTEM_WIRING_FINDING_CODE,
  type InterfacePanelImageRect,
  type RecordingInputMode,
  type RecordingInputSelections
} from "../lib/interfaceWiring";
import { WIRED_MIC_LINE_IN_POWER_NOTE } from "../lib/connectionRules";
import {
  CABLE_MATERIAL_COLORS,
  CABLE_MATERIAL_LABELS,
  getCableMaterialKind,
  type CableMaterialKind
} from "../lib/cablePresentation";
import {
  getDevicePortProfile,
  RECORDING_CAMERA_PORT_PROFILE_ID,
  RECORDING_HOST_PORT_PROFILE_ID
} from "../lib/devicePortCatalog";
import "./InterfaceWiringPreview.css";

const CABLE_LEGEND_BASE_HEIGHT = 52;
const CABLE_LEGEND_ROW_HEIGHT = 28;
const CABLE_LEGEND_TOP_GAP = 24;
const CABLE_LEGEND_BOTTOM_GAP = 28;
const DRAWING_FRAME_LEFT = 18;
const DRAWING_FRAME_TOP = 18;
const DRAWING_FRAME_RIGHT = 18;
const DRAWING_FRAME_BOTTOM = 22;
const INTERFACE_WIRING_MIN_LOGICAL_WIDTH = 993;
const CABLE_INTERNAL_MERGE_DISTANCE = 28;

type CablePoint = { x: number; y: number };
type CableExitSide = "left" | "right" | "top" | "bottom";
type CableConnectorKind = "jack35-ts" | "jack35-trs" | "jack35-trrs" | "jack635-ts" | "xlr-male" | "xlr-female";
type CableConnectorHead = {
  endpoint: "from" | "to";
  kind: CableConnectorKind;
  port: CablePoint;
  cable: CablePoint;
  angle: number;
  length: number;
};

export type InterfacePanelImageMap = Record<string, string>;

export interface InterfaceWiringPreviewProps {
  profile: ClassroomProfile;
  outputs: GeneratedOutputs;
  brandId: AppBrandId;
  recordingInputSelections: RecordingInputSelections;
  onRecordingInputSelectionChange: (nodeId: string, mode: RecordingInputMode) => void;
}

interface InterfaceWiringPreviewRendererProps extends InterfaceWiringPreviewProps {
  interfacePanelImages: InterfacePanelImageMap;
}

export function InterfaceWiringPreview({
  profile,
  outputs,
  brandId,
  recordingInputSelections,
  onRecordingInputSelectionChange,
  interfacePanelImages
}: InterfaceWiringPreviewRendererProps) {
  const model = useMemo(
    () => buildInterfaceWiringModel({ profile, outputs, brandId, recordingInputSelections }),
    [profile, outputs, brandId, recordingInputSelections]
  );
  const hardCount = model.findings.filter((item) => item.severity === "hard").length;
  const reviewCount = model.findings.filter((item) => item.severity === "review").length;
  const portReferenceNumbers = useMemo(() => getInterfaceWiringPortReferenceNumbers(model), [model]);
  return (
    <section className="interfaceWiringPreview" aria-label="接口接线图与接口占用表">
      <header className="interfaceWiringPreviewHeader">
        <div>
          <span className="interfaceWiringEyebrow"><Network size={15} /> 接口校核</span>
          <h3>接口接线图</h3>
        </div>
        <div className="interfaceWiringSummary" aria-label="接口接线校核摘要">
          <span>{model.nodes.length} 组设备</span>
          <span>{model.edges.length} 条接口连线</span>
          <span className={hardCount ? "hard" : reviewCount ? "review" : "ready"}>
            {hardCount ? `硬风险 ${hardCount}` : reviewCount ? `待复核 ${reviewCount}` : "接口校核通过"}
          </span>
        </div>
      </header>

      <InterfaceWiringDiagram
        model={model}
        portReferenceNumbers={portReferenceNumbers}
        selections={recordingInputSelections}
        onChange={onRecordingInputSelectionChange}
        brandId={brandId}
        interfacePanelImages={interfacePanelImages}
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
  onChange,
  brandId,
  interfacePanelImages
}: {
  model: InterfaceWiringModel;
  portReferenceNumbers: Record<string, number>;
  selections: RecordingInputSelections;
  onChange: (nodeId: string, mode: RecordingInputMode) => void;
  brandId: AppBrandId;
  interfacePanelImages: InterfacePanelImageMap;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const portFocusIdPrefix = useId().replaceAll(":", "");
  const [availableWidth, setAvailableWidth] = useState(1120);
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
  const cableLegendRows = useMemo(() => getCableLegendRows(model.edges), [model.edges]);
  const cableLegendHeight = CABLE_LEGEND_BASE_HEIGHT + cableLegendRows.length * CABLE_LEGEND_ROW_HEIGHT;
  const bottomPadding = cableLegendRows.length
    ? cableLegendHeight + CABLE_LEGEND_TOP_GAP + CABLE_LEGEND_BOTTOM_GAP
    : 44;
  const logicalCanvasWidth = Math.max(INTERFACE_WIRING_MIN_LOGICAL_WIDTH, availableWidth);
  const { layout, edgeDrawings, routingClearance, failedEdgeIds } = useMemo(
    () => buildRoutedInterfaceWiringDiagram(model, logicalCanvasWidth, bottomPadding, portReferenceNumbers),
    [model, logicalCanvasWidth, bottomPadding, portReferenceNumbers]
  );
  const legacyAudioSystemNotice = model.findings.find(
    (finding) => finding.code === LEGACY_AUDIO_SYSTEM_WIRING_FINDING_CODE
  );
  const legacyAudioSystemNoticeWidth = Math.min(720, layout.width - 96);
  const highlightedEdgeId = activeEdgeId && edgeDrawings.has(activeEdgeId) ? activeEdgeId : null;
  const portInteractionMarkers = useMemo(
    () => getInterfaceWiringPortInteractionMarkers(model, layout.positions, interfacePanelImages),
    [model, layout.positions, interfacePanelImages]
  );
  const stopHighlightingEdge = (edgeId: string) => {
    setActiveEdgeId((current) => current === edgeId ? null : current);
  };
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
        aria-label={`${brandId === "yinman" ? "音曼" : "音翼"}接口接线图`}
        data-routing-clearance={routingClearance}
        data-routing-failed={failedEdgeIds.join(",")}
        data-active-edge-id={highlightedEdgeId ?? undefined}
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
        {legacyAudioSystemNotice ? (
          <g
            className="interfaceWiringLegacyAudioNotice"
            data-notice-kind="legacy-audio-system"
            transform={`translate(${layout.width / 2} 76)`}
          >
            <rect x={-legacyAudioSystemNoticeWidth / 2} y="-14" width={legacyAudioSystemNoticeWidth} height="24" rx="4" />
            <text textAnchor="middle" y="3">{legacyAudioSystemNotice.message}</text>
          </g>
        ) : null}
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
                interfacePanelImages={interfacePanelImages}
              />
            </foreignObject>
          );
        })}

        <defs>
          {portInteractionMarkers.flatMap((marker, index) => marker.panelImage ? [
            <clipPath
              id={getInterfaceWiringPortFocusClipId(portFocusIdPrefix, index)}
              clipPathUnits="userSpaceOnUse"
              key={`${marker.id}-focus-clip`}
            >
              <rect
                x={marker.focusBounds.x}
                y={marker.focusBounds.y}
                width={marker.focusBounds.width}
                height={marker.focusBounds.height}
                rx={Math.min(5, marker.focusBounds.height / 2)}
              />
            </clipPath>
          ] : [])}
        </defs>

        <g className="interfaceWiringPortFocusVisuals" aria-hidden="true">
          {portInteractionMarkers.map((marker, index) => {
            if (!marker.panelImage) return null;
            return (
              <g
                key={`${marker.id}-focus`}
                className={`interfaceWiringPortImageFocus${marker.edgeId === highlightedEdgeId ? " is-active" : ""}`}
                clipPath={`url(#${getInterfaceWiringPortFocusClipId(portFocusIdPrefix, index)})`}
                data-edge-id={marker.edgeId}
                data-port-id={marker.portId}
              >
                {marker.panelImageRects.map((imageRect, imageIndex) => (
                  <image
                    href={marker.panelImage}
                    x={imageRect.x}
                    y={imageRect.y}
                    width={imageRect.width}
                    height={imageRect.height}
                    preserveAspectRatio="none"
                    className="interfaceWiringPortImageFocusLayer"
                    key={`${marker.id}-focus-image-${imageIndex + 1}`}
                  />
                ))}
                <rect
                  x={marker.focusBounds.x}
                  y={marker.focusBounds.y}
                  width={marker.focusBounds.width}
                  height={marker.focusBounds.height}
                  rx={Math.min(5, marker.focusBounds.height / 2)}
                  className="interfaceWiringPortImageFocusTint"
                />
              </g>
            );
          })}
        </g>

        {model.edges.map((edge) => {
          const drawing = edgeDrawings.get(edge.id);
          if (!drawing) return null;
          return (
            <g
              key={`${edge.id}-trunks`}
              className={`interfaceWiringEdgeTrunks${getEdgeInteractionStateClass(edge.id, highlightedEdgeId)}`}
              data-edge-id={edge.id}
              data-route-kind={drawing.route.kind}
              data-route-points={drawing.route.points.map((point) => `${point.x},${point.y}`).join(" ")}
              onPointerEnter={() => setActiveEdgeId(edge.id)}
              onPointerLeave={() => stopHighlightingEdge(edge.id)}
            >
              {drawing.trunkRoutes.flatMap(({ id, path, color, strokeWidth, confirmed, needsOutline }) => ([
                <path
                  key={`${edge.id}-${id}-trunk-hit`}
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(18, strokeWidth + 12)}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  data-conductor-id={id}
                  data-segment="trunk-hit"
                  className="interfaceWiringEdgeHitTarget"
                />,
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
                    "interfaceWiringEdgeVisual",
                    confirmed ? "" : "unconfirmedConductor",
                    needsOutline ? "lightConductor" : ""
                  ].filter(Boolean).join(" ")}
                />
              ]))}
            </g>
          );
        })}

        {model.edges.map((edge) => {
          const drawing = edgeDrawings.get(edge.id);
          if (!drawing) return null;
          return (
            <g
              key={`${edge.id}-leads`}
              className={`interfaceWiringEdgeLeads${getEdgeInteractionStateClass(edge.id, highlightedEdgeId)}`}
              data-edge-id={edge.id}
              onPointerEnter={() => setActiveEdgeId(edge.id)}
              onPointerLeave={() => stopHighlightingEdge(edge.id)}
            >
              {drawing.conductorRoutes.flatMap(({ conductor, fromLeadPath, toLeadPath, strokeWidth, needsOutline }) => (
                [
                  <path
                    key={`${edge.id}-${conductor.id}-from-lead-hit`}
                    d={fromLeadPath}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="14"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    data-conductor-id={conductor.id}
                    data-terminal-id={conductor.fromTerminalId}
                    data-segment="from-lead-hit"
                    className="interfaceWiringEdgeHitTarget"
                  />,
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
                      "interfaceWiringEdgeVisual",
                      conductor.confirmed ? "" : "unconfirmedConductor",
                      needsOutline ? "lightConductor" : ""
                    ].filter(Boolean).join(" ")}
                  />,
                  <path
                    key={`${edge.id}-${conductor.id}-to-lead-hit`}
                    d={toLeadPath}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="14"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    data-conductor-id={conductor.id}
                    data-terminal-id={conductor.toTerminalId}
                    data-segment="to-lead-hit"
                    className="interfaceWiringEdgeHitTarget"
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
                      "interfaceWiringEdgeVisual",
                      conductor.confirmed ? "" : "unconfirmedConductor",
                      needsOutline ? "lightConductor" : ""
                    ].filter(Boolean).join(" ")}
                  />
                ]
              ))}
              {drawing.connectorHeads.map((connectorHead) => (
                <InterfaceWiringCableConnectorHead
                  head={connectorHead}
                  key={`${edge.id}-${connectorHead.endpoint}-${connectorHead.kind}`}
                />
              ))}
            </g>
          );
        })}

        {model.edges.map((edge) => {
          const drawing = edgeDrawings.get(edge.id);
          if (!drawing) return null;
          const unconfirmed = edge.conductors.some((conductor) => !conductor.confirmed);
          return (
            <g
              key={`${edge.id}-references`}
              className={`interfaceWiringEdgeReferences${getEdgeInteractionStateClass(edge.id, highlightedEdgeId)}`}
              data-edge-id={edge.id}
              onPointerEnter={() => setActiveEdgeId(edge.id)}
              onPointerLeave={() => stopHighlightingEdge(edge.id)}
            >
              {drawing.referenceBadges.map((badge) => (
                <g
                  key={`${edge.id}-reference`}
                  className={`interfaceWiringEdgeReference ${unconfirmed ? "unconfirmed" : ""}`}
                  transform={`translate(${badge.x} ${badge.y})`}
                  data-reference-number={badge.referenceNumber}
                >
                  <circle r="16" className="interfaceWiringEdgeReferenceHitTarget" />
                  <circle r="9" className="interfaceWiringEdgeReferenceBadge" />
                  <text textAnchor="middle" dy="0.34em">{badge.referenceNumber}</text>
                </g>
              ))}
            </g>
          );
        })}

        <g className="interfaceWiringPortInteractions" aria-hidden="true">
          {portInteractionMarkers.map((marker) => (
            <g
              key={marker.id}
              className={`interfaceWiringPortInteraction${marker.edgeId === highlightedEdgeId ? " is-active" : ""}`}
              data-edge-id={marker.edgeId}
              data-node-id={marker.nodeId}
              data-port-id={marker.portId}
              data-terminal-selective={marker.terminalSelective ? "true" : "false"}
              data-terminal-ids={marker.points.map((point) => point.terminalId).filter(Boolean).join(",")}
              onPointerEnter={() => setActiveEdgeId(marker.edgeId)}
              onPointerLeave={() => stopHighlightingEdge(marker.edgeId)}
            >
              <rect
                className="interfaceWiringPortHitTarget"
                x={marker.hitBounds.x}
                y={marker.hitBounds.y}
                width={marker.hitBounds.width}
                height={marker.hitBounds.height}
                rx={Math.min(7, marker.hitBounds.height / 2)}
              />
            </g>
          ))}
        </g>

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

type InterfaceWiringPortInteractionMarker = {
  id: string;
  edgeId: string;
  nodeId: string;
  portId: string;
  terminalSelective: boolean;
  panelImage?: string;
  panelImageRects: Array<{ x: number; y: number; width: number; height: number }>;
  points: Array<{
    id: string;
    terminalId?: string;
    x: number;
    y: number;
    radius: number;
  }>;
  hitBounds: { x: number; y: number; width: number; height: number };
  focusBounds: { x: number; y: number; width: number; height: number };
};

function getEdgeInteractionStateClass(edgeId: string, activeEdgeId: string | null) {
  if (!activeEdgeId) return "";
  return activeEdgeId === edgeId ? " is-active" : " is-dimmed";
}

function getInterfaceWiringPortFocusClipId(prefix: string, markerIndex: number) {
  return `${prefix}-interface-port-focus-${markerIndex + 1}`;
}

function getInterfaceWiringPortInteractionMarkers(
  model: InterfaceWiringModel,
  positions: WiringNodePositions,
  interfacePanelImages: InterfacePanelImageMap
): InterfaceWiringPortInteractionMarker[] {
  const nodeMap = new Map(model.nodes.map((node) => [node.id, node]));
  return model.edges.flatMap((edge) => (["from", "to"] as const).flatMap((endpoint) => {
    const fromEndpoint = endpoint === "from";
    const nodeId = fromEndpoint ? edge.fromNodeId : edge.toNodeId;
    const portId = fromEndpoint ? edge.fromPortId : edge.toPortId;
    const peerNodeId = fromEndpoint ? edge.toNodeId : edge.fromNodeId;
    const node = nodeMap.get(nodeId);
    const position = positions[nodeId];
    const peerPosition = positions[peerNodeId];
    const port = node?.ports.find((item) => item.id === portId);
    if (!node || !position || !port) return [];
    const portIndex = node.ports.indexOf(port);
    const panelProfile = getDevicePortProfile(node.productId)?.interfacePanel;
    const panelImage = panelProfile ? interfacePanelImages[panelProfile.assetKey] : undefined;
    const panelImageRect = panelProfile && panelImage ? getInterfacePanelImageRect(node, position) : undefined;
    const panelAnchor = panelProfile
      ? getInterfacePanelPortAnchor(panelProfile, port.capabilityId, portIndex, node.ports.length)
      : undefined;
    const locatedPanelPort = Boolean(panelImage && panelImageRect && panelAnchor);
    const terminalSelective = isTerminalChannelPort(port);
    const connectedTerminalIds = Array.from(new Set(edge.conductors.map((conductor) => (
      fromEndpoint ? conductor.fromTerminalId : conductor.toTerminalId
    )))).filter((terminalId) => port.terminals.some((terminal) => terminal.id === terminalId));
    const fallbackTerminalIds = port.terminals.map((terminal) => terminal.id);
    const terminalIds: Array<string | undefined> = terminalSelective
      ? (connectedTerminalIds.length
          ? connectedTerminalIds
          : fallbackTerminalIds.length ? fallbackTerminalIds : [undefined])
      : [undefined];
    const points = terminalIds.map((terminalId, index) => {
      const point = getInterfaceWiringPortDrawingAnchor(
        node,
        port.id,
        position,
        terminalId,
        peerPosition
      );
      return {
        id: terminalId ?? `connector-${index + 1}`,
        terminalId,
        ...point,
        radius: terminalSelective ? 3.5 : getConnectorHighlightRadius(port)
      };
    });
    const hitBounds = getPortInteractionHitBounds(points, terminalSelective ? 2.5 : 5);
    const terminalFocusBounds = terminalSelective && panelAnchor?.focusBounds && panelImageRect
      ? {
          x: panelImageRect.x + panelAnchor.focusBounds.x * panelImageRect.width,
          y: panelImageRect.y + panelAnchor.focusBounds.y * panelImageRect.height,
          width: panelAnchor.focusBounds.width * panelImageRect.width,
          height: panelAnchor.focusBounds.height * panelImageRect.height
        }
      : undefined;
    const terminalBlockPoints = terminalSelective && !terminalFocusBounds && panelProfile && panelImageRect
      ? getTerminalBlockFocusPoints(node, port, panelProfile, panelImageRect)
      : [];
    return [{
      id: `${edge.id}-${endpoint}-port`,
      edgeId: edge.id,
      nodeId,
      portId,
      terminalSelective,
      panelImage: locatedPanelPort ? panelImage : undefined,
      panelImageRects: locatedPanelPort && panelImageRect
        ? (panelImageRect.unitRects ?? [panelImageRect])
        : [],
      points,
      hitBounds,
      focusBounds: terminalFocusBounds ?? (terminalBlockPoints.length
        ? getPortInteractionHitBounds(terminalBlockPoints, 7)
        : hitBounds)
    }];
  }));
}

function isTerminalChannelPort(port: Pick<InterfaceWiringPort, "interfaceType">) {
  return /凤凰|接线端子|接线柱|多针|平衡输入/i.test(port.interfaceType) &&
    !/3\.5|TRS|TRRS|XLR|卡侬|RJ45|USB/i.test(port.interfaceType);
}

function getConnectorHighlightRadius(port: InterfaceWiringPort) {
  if (/XLR|卡侬/i.test(port.interfaceType)) return 15;
  if (/RJ45|USB/i.test(port.interfaceType)) return 12;
  if (/6\.35/i.test(port.interfaceType)) return 13;
  if (/3\.5|TRS|TRRS/i.test(port.interfaceType)) return 10;
  return 11;
}

function getTerminalBlockFocusPoints(
  node: InterfaceWiringNode,
  port: InterfaceWiringPort,
  panelProfile: DeviceInterfacePanel,
  imageRect: InterfacePanelImageRect
): InterfaceWiringPortInteractionMarker["points"] {
  const deviceProfile = getDevicePortProfile(node.productId);
  const exactCapability = deviceProfile?.ports.find((capability) => capability.id === port.capabilityId);
  const indexedCapability = deviceProfile?.ports
    .filter((capability) => port.capabilityId.startsWith(`${capability.id}-`))
    .sort((left, right) => right.id.length - left.id.length)[0];
  const activeCapability = exactCapability ?? indexedCapability;
  if (!deviceProfile || !activeCapability) return [];
  const unitSuffix = port.capabilityId.slice(activeCapability.id.length);
  const capabilityId = `${activeCapability.id}${unitSuffix}`;
  const anchor = getInterfacePanelPortAnchor(
    panelProfile,
    capabilityId,
    deviceProfile.ports.indexOf(activeCapability),
    node.ports.length
  );
  if (!anchor) return [];
  const terminalAnchors = Object.entries(anchor.terminalAnchors ?? {});
  if (!terminalAnchors.length) {
    return [{
      id: capabilityId,
      x: imageRect.x + anchor.x * imageRect.width,
      y: imageRect.y + anchor.y * imageRect.height,
      radius: 3.5
    }];
  }
  return terminalAnchors.map(([terminalId, terminalAnchor]) => ({
    id: `${capabilityId}-${terminalId}`,
    terminalId,
    x: imageRect.x + terminalAnchor.x * imageRect.width,
    y: imageRect.y + terminalAnchor.y * imageRect.height,
    radius: 3.5
  }));
}

function getPortInteractionHitBounds(
  points: InterfaceWiringPortInteractionMarker["points"],
  padding: number
) {
  const left = Math.min(...points.map((point) => point.x - point.radius)) - padding;
  const top = Math.min(...points.map((point) => point.y - point.radius)) - padding;
  const right = Math.max(...points.map((point) => point.x + point.radius)) + padding;
  const bottom = Math.max(...points.map((point) => point.y + point.radius)) + padding;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function InterfaceWiringCableConnectorHead({ head }: { head: CableConnectorHead }) {
  const transform = `translate(${head.port.x} ${head.port.y}) rotate(${head.angle})`;
  if (head.kind.startsWith("jack35")) {
    const shaftEnd = head.length * 0.62;
    const ringRatios = head.kind === "jack35-trrs"
      ? [0.34, 0.56, 0.76]
      : head.kind === "jack35-trs" ? [0.48, 0.76] : [0.72];
    return (
      <g
        className="interfaceWiringConnectorHead"
        data-connector-kind={head.kind}
        data-endpoint={head.endpoint}
        transform={transform}
      >
        <rect className="interfaceWiringConnectorHeadHitTarget" x="-4" y="-11" width={head.length + 8} height="22" rx="6" />
        <g className="interfaceWiringConnectorHeadBody">
          <path
            className="interfaceWiringConnectorMetal"
            d={`M 0 0 L 3 -2.2 H ${shaftEnd} V 2.2 H 3 Z`}
          />
          {ringRatios.map((ratio) => (
            <line
              className="interfaceWiringConnectorRing"
              x1={shaftEnd * ratio}
              x2={shaftEnd * ratio}
              y1="-3"
              y2="3"
              key={ratio}
            />
          ))}
          <rect
            className="interfaceWiringConnectorGrip"
            x={shaftEnd - 1}
            y="-5.5"
            width={head.length - shaftEnd + 1}
            height="11"
            rx="3"
          />
        </g>
      </g>
    );
  }
  if (head.kind === "jack635-ts") {
    const shaftEnd = head.length * 0.55;
    const insulatorX = shaftEnd * 0.24;
    return (
      <g
        className="interfaceWiringConnectorHead"
        data-connector-kind={head.kind}
        data-endpoint={head.endpoint}
        transform={transform}
      >
        <rect className="interfaceWiringConnectorHeadHitTarget" x="-5" y="-15" width={head.length + 10} height="30" rx="7" />
        <g className="interfaceWiringConnectorHeadBody">
          <path
            className="interfaceWiringConnectorMetal"
            d={`M 0 0 L 5 -4.6 H ${shaftEnd} V 4.6 H 5 Z`}
          />
          <line
            className="interfaceWiringConnectorRing"
            x1={insulatorX}
            x2={insulatorX}
            y1="-5.5"
            y2="5.5"
          />
          <rect
            className="interfaceWiringConnectorGrip"
            x={shaftEnd - 1}
            y="-10"
            width={head.length - shaftEnd + 1}
            height="20"
            rx="4"
          />
          <text className="interfaceWiringConnectorLabel" x={shaftEnd + (head.length - shaftEnd) / 2} y="2.3">6.35 TS</text>
        </g>
      </g>
    );
  }
  const cableConnectorGender = head.kind === "xlr-male" ? "公" : "母";
  const barrelEnd = head.length * 0.76;
  return (
    <g
      className="interfaceWiringConnectorHead"
      data-connector-kind={head.kind}
      data-endpoint={head.endpoint}
      transform={transform}
    >
      <rect className="interfaceWiringConnectorHeadHitTarget" x="-4" y="-13" width={head.length + 8} height="26" rx="7" />
      <g className="interfaceWiringConnectorHeadBody">
        <rect
          className={head.kind === "xlr-male" ? "interfaceWiringConnectorMetal" : "interfaceWiringConnectorSocket"}
          x="0"
          y="-5"
          width="9"
          height="10"
          rx="2"
        />
        <rect
          className="interfaceWiringConnectorXlrBody"
          x="6"
          y="-9"
          width={barrelEnd - 6}
          height="18"
          rx="4"
        />
        <rect
          className="interfaceWiringConnectorGrip"
          x={barrelEnd - 1}
          y="-5.5"
          width={head.length - barrelEnd + 1}
          height="11"
          rx="3"
        />
        <text className="interfaceWiringConnectorLabel" x={(6 + barrelEnd) / 2} y="2.4">{cableConnectorGender}</text>
      </g>
    </g>
  );
}

function InterfaceWiringNodeCard({
  node,
  position,
  positions,
  recordingInputMode,
  onRecordingInputChange,
  interfacePanelImages
}: {
  node: InterfaceWiringNode;
  position: WiringNodePosition;
  positions: WiringNodePositions;
  recordingInputMode: RecordingInputMode;
  onRecordingInputChange: (nodeId: string, mode: RecordingInputMode) => void;
  interfacePanelImages: InterfacePanelImageMap;
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
      : getInterfaceWiringFallbackPortMarker(node, index, position, imageRect, panelProfile);
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
          style={{ top: getInterfaceWiringFallbackPortLabelTop(position, imageRect) }}
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

function InterfacePortUsageTable({
  model,
  portReferenceNumbers
}: {
  model: InterfaceWiringModel;
  portReferenceNumbers: Record<string, number>;
}) {
  const rows = getInterfaceWiringUsageRows(model, portReferenceNumbers);
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
              {rows.map((row) => (
                <tr key={row.edgeId} className={row.confirmed ? "" : "unconfirmed"}>
                  <td><span className="interfaceWiringTablePortPin">{row.referenceNumber}</span></td>
                  <td><FromToCell from={row.fromDevice} to={row.toDevice} /></td>
                  <td><FromToCell from={row.fromPort} to={row.toPort} /></td>
                  <td><FromToCell from={row.fromInterfaceType} to={row.toInterfaceType} /></td>
                  <td>{row.cableType}</td>
                  <td><ConnectionMethodCell value={row.connectionMethod} /></td>
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

type CableLegendKind = CableMaterialKind;

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
      <i style={{ backgroundColor: CABLE_MATERIAL_COLORS[kind] }} />
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
  return getCableMaterialKind(edge.cableType);
}

function getCableSheathColor(edge: InterfaceWiringEdge) {
  return CABLE_MATERIAL_COLORS[getCableLegendKind(edge)];
}

function getCableLegendDefinition(kind: CableLegendKind, fallbackLabel: string) {
  if (kind === "speaker") return { label: CABLE_MATERIAL_LABELS.speaker, description: "红线接 +；白线接 -" };
  if (kind === "audio") return { label: CABLE_MATERIAL_LABELS.audio, description: "红线接 +；白线接 -；屏蔽线接 G" };
  if (kind === "serial") return { label: CABLE_MATERIAL_LABELS.serial, description: "黄线 TX；绿线 RX；黑线 GND，TX/RX交叉" };
  if (kind === "network") return { label: CABLE_MATERIAL_LABELS.network, description: "T568B 1-8芯直通" };
  if (kind === "usb") return { label: CABLE_MATERIAL_LABELS.usb, description: "音频双向；内置232串口信号，可用于连接调试软件" };
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
            <div><strong>接口校核通过</strong><p>当前方案未发现接口容量或资料缺口。</p></div>
          </div>
        )}
      </div>
    </section>
  );
}

function buildRoutedInterfaceWiringDiagram(
  model: InterfaceWiringModel,
  logicalCanvasWidth: number,
  bottomPadding: number,
  portReferenceNumbers: Record<string, number>
) {
  const layout = getInterfaceWiringLayout(model, logicalCanvasWidth, bottomPadding);
  const result = buildEdgeDrawings(model, layout, portReferenceNumbers);
  return {
    layout,
    edgeDrawings: result.drawings,
    routingClearance: 0,
    failedEdgeIds: [] as string[]
  };
}

type CableRoute = {
  kind: "curve" | "jumper";
  path: string;
  points: CablePoint[];
  labelX: number;
  labelY: number;
  from: CablePoint;
  to: CablePoint;
  control1?: CablePoint;
  control2?: CablePoint;
  curveRatio?: number;
};

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
  const contexts = model.edges.flatMap((edge, edgeIndex) => {
    const fromNode = nodeMap.get(edge.fromNodeId);
    const toNode = nodeMap.get(edge.toNodeId);
    const fromPosition = layout.positions[edge.fromNodeId];
    const toPosition = layout.positions[edge.toNodeId];
    const fromPort = fromNode?.ports.find((port) => port.id === edge.fromPortId);
    const toPort = toNode?.ports.find((port) => port.id === edge.toPortId);
    if (!fromNode || !toNode || !fromPort || !toPort || !fromPosition || !toPosition) return [];
    const pairKey = getPairKey(edge);
    const pairIndex = pairIndexes.get(pairKey) ?? 0;
    pairIndexes.set(pairKey, pairIndex + 1);
    const pairCount = pairCounts.get(pairKey) ?? 1;
    return [{
      edge,
      fromNode,
      toNode,
      fromPort,
      toPort,
      fromPosition,
      toPosition,
      from: getInterfaceWiringPortDrawingAnchor(fromNode, edge.fromPortId, fromPosition, undefined, toPosition),
      to: getInterfaceWiringPortDrawingAnchor(toNode, edge.toPortId, toPosition, undefined, fromPosition),
      laneOffset: (pairIndex - (pairCount - 1) / 2) * 34,
      displayConductors: getDisplayConductors(edge),
      curveRatio: getCableCurveRatio(edgeIndex)
    }];
  });
  const cableRoutes = new Map<string, CableRoute>();
  contexts.forEach((context) => {
    if (context.edge.kind === "jumper") {
      cableRoutes.set(
        context.edge.id,
        getInternalJumperRoute(
          context.from,
          context.to,
          context.fromPosition,
          context.edge.jumperRoute,
          context.laneOffset
        )
      );
      return;
    }
    cableRoutes.set(
      context.edge.id,
      getDirectCableCurve(context.from, context.to, context.curveRatio)
    );
  });
  const usedReferencePoints: Array<{ x: number; y: number }> = [];
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
    connectorHeads: CableConnectorHead[];
    referenceBadges: Array<{
      x: number;
      y: number;
      referenceNumber: number;
    }>;
  }>();

  contexts.forEach(({
    edge,
    fromNode,
    toNode,
    fromPort,
    toPort,
    fromPosition,
    toPosition,
    from,
    to,
    displayConductors
  }) => {
    const route = cableRoutes.get(edge.id);
    if (!route) return;
    const fromConnectorKind = edge.kind === "jumper" ? undefined : getCableConnectorKind(fromPort);
    const toConnectorKind = edge.kind === "jumper" ? undefined : getCableConnectorKind(toPort);
    const fromConnector = fromConnectorKind
      ? getCableConnectorPlacement(from, to, fromConnectorKind, "from")
      : undefined;
    const toConnector = toConnectorKind
      ? getCableConnectorPlacement(to, from, toConnectorKind, "to")
      : undefined;
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
      const conductorFrom = getInterfaceWiringPortDrawingAnchor(
        fromNode,
        edge.fromPortId,
        fromPosition,
        conductor.fromTerminalId,
        toPosition
      );
      const conductorTo = getInterfaceWiringPortDrawingAnchor(
        toNode,
        edge.toPortId,
        toPosition,
        conductor.toTerminalId,
        fromPosition
      );
      return { conductor, conductorIndex, fromFanOffset, toFanOffset, conductorFrom, conductorTo };
    });
    const multicore = displayConductors.length > 1 && edge.kind !== "jumper";
    const fromNeedsFanout = multicore && !fromConnector;
    const toNeedsFanout = multicore && !toConnector;
    const fromMerge = fromConnector?.cable ?? (fromNeedsFanout
      ? getTerminalFanMergePoint({
          terminals: terminalPairs.map((item) => item.conductorFrom),
          escapeSide: getNearestExitSide(fromPosition, toPosition),
          deviceRect: fromPosition,
          mergeDistance: CABLE_INTERNAL_MERGE_DISTANCE
        })
      : from);
    const toMerge = toConnector?.cable ?? (toNeedsFanout
      ? getTerminalFanMergePoint({
          terminals: terminalPairs.map((item) => item.conductorTo),
          escapeSide: getNearestExitSide(toPosition, fromPosition),
          deviceRect: toPosition,
          mergeDistance: CABLE_INTERNAL_MERGE_DISTANCE
        })
      : to);
    const renderedRoute = edge.kind === "jumper"
      ? route
      : getDirectCableCurve(fromMerge, toMerge, route.curveRatio ?? 0.04);
    const conductorRoutes = terminalPairs.map(({
      conductor,
      conductorIndex,
      fromFanOffset,
      toFanOffset,
      conductorFrom,
      conductorTo
    }) => {
      const paths = {
        fromLeadPath: fromNeedsFanout
          ? getTerminalFanPath(
              conductorFrom,
              fromMerge,
              fromFanOffset || (conductorIndex + 1) * 2.5,
              false
            )
          : "",
        toLeadPath: toNeedsFanout
          ? getTerminalFanPath(
              conductorTo,
              toMerge,
              toFanOffset || -(conductorIndex + 1) * 2.5,
              true
            )
          : ""
      };
      return {
        conductor,
        ...paths,
        strokeWidth: edge.kind === "jumper" ? 3.2 : isNetworkEdge(edge) || isUsbEdge(edge) ? 4.5 : 2.2,
        needsOutline: conductor.color.toLowerCase() === "#ffffff"
      };
    });
    const referenceNumber = portReferenceNumbers[edge.fromPortId] ?? portReferenceNumbers[edge.toPortId];
    const referencePoint = referenceNumber
      ? findReferenceBadgePoint(renderedRoute, nodeRects, usedReferencePoints, Array.from(cableRoutes.values()))
      : undefined;
    if (referencePoint) usedReferencePoints.push(referencePoint);
    const referenceBadges = referencePoint ? [{ ...referencePoint, referenceNumber }] : [];
    const trunkRoutes = getCableTrunkRoutes(edge, displayConductors, renderedRoute);
    const connectorHeads = [fromConnector, toConnector].filter((item): item is CableConnectorHead => Boolean(item));
    drawings.set(edge.id, { route: renderedRoute, trunkRoutes, conductorRoutes, connectorHeads, referenceBadges });
  });
  return { drawings };
}

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
  const deltaX = split.x - terminal.x;
  const deltaY = split.y - terminal.y;
  const length = Math.hypot(deltaX, deltaY) || 1;
  const control = {
    x: (terminal.x + split.x) / 2 - (deltaY / length) * fanOffset,
    y: (terminal.y + split.y) / 2 + (deltaX / length) * fanOffset
  };
  return reverse
    ? `M ${split.x} ${split.y} Q ${control.x} ${control.y} ${terminal.x} ${terminal.y}`
    : `M ${terminal.x} ${terminal.y} Q ${control.x} ${control.y} ${split.x} ${split.y}`;
}

function getCableConnectorKind(port: InterfaceWiringPort): CableConnectorKind | undefined {
  const descriptor = `${port.interfaceType} ${port.label}`;
  if (/6\.35/i.test(descriptor)) return "jack635-ts";
  if (/3\.5/i.test(descriptor)) {
    if (/TRRS/i.test(descriptor)) return "jack35-trrs";
    if (/(?:^|[^A-Z])TS(?:[^A-Z]|$)/i.test(descriptor)) return "jack35-ts";
    return "jack35-trs";
  }
  if (!/XLR|卡侬/i.test(descriptor)) return undefined;
  // The cable head mates with the gender declared by the equipment port.
  if (/母|female/i.test(descriptor)) return "xlr-male";
  if (/公|(?:^|[^a-z])male(?:[^a-z]|$)/i.test(descriptor)) return "xlr-female";
  return port.direction === "input" ? "xlr-male" : "xlr-female";
}

function getCableConnectorPlacement(
  port: CablePoint,
  toward: CablePoint,
  kind: CableConnectorKind,
  endpoint: CableConnectorHead["endpoint"]
): CableConnectorHead {
  const deltaX = toward.x - port.x;
  const deltaY = toward.y - port.y;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const defaultLength = kind.startsWith("jack35") ? 28 : kind === "jack635-ts" ? 76 : 38;
  const minimumLength = kind === "jack635-ts" ? Math.min(58, distance * 0.8) : 8;
  const length = Math.max(minimumLength, Math.min(defaultLength, distance * (kind === "jack635-ts" ? 0.68 : 0.38)));
  const cable = {
    x: port.x + deltaX / distance * length,
    y: port.y + deltaY / distance * length
  };
  return {
    endpoint,
    kind,
    port,
    cable,
    angle: Math.atan2(deltaY, deltaX) * 180 / Math.PI,
    length
  };
}

function findReferenceBadgePoint(
  route: CableRoute,
  nodeRects: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  usedReferencePoints: Array<{ x: number; y: number }>,
  allRoutes: CableRoute[]
) {
  const progresses = [0.5, 0.46, 0.54, 0.42, 0.58, 0.38, 0.62, 0.34, 0.66];
  const outsideNodes = progresses.flatMap((progress) => {
    const point = cubicPoint(route.from, route.control1!, route.control2!, route.to, progress);
    return nodeRects.some((rect) => pointInsideRect(point, rect, 11)) ? [] : [point];
  });
  return outsideNodes.find((point) =>
    usedReferencePoints.every((used) => Math.hypot(point.x - used.x, point.y - used.y) >= 22) &&
    allRoutes.every((candidateRoute) =>
      candidateRoute === route || distancePointToRoute(point, candidateRoute) >= 14
    )
  )
    ?? outsideNodes[0]
    ?? cubicPoint(route.from, route.control1!, route.control2!, route.to, 0.5);
}

function getDisplayConductors(edge: InterfaceWiringEdge): InterfaceWiringConductor[] {
  if (edge.kind === "jumper") {
    return [getCollapsedCableConductor(edge, "jumper", "音频跳线", CABLE_MATERIAL_COLORS.audio, "+/-/G")];
  }
  if (isNetworkEdge(edge)) {
    return [getCollapsedCableConductor(edge, "network", "网线", CABLE_MATERIAL_COLORS.network, "RJ45")];
  }
  if (isUsbEdge(edge)) {
    return [getCollapsedCableConductor(edge, "usb", "USB线", CABLE_MATERIAL_COLORS.usb, "USB")];
  }
  return edge.conductors;
}

function getCableTrunkRoutes(
  edge: InterfaceWiringEdge,
  conductors: InterfaceWiringConductor[],
  route: CableRoute
) {
  const multicore = conductors.length > 1 && edge.kind !== "jumper";
  const conductor = conductors[0];
  const color = getCableSheathColor(edge);
  return [{
    id: multicore ? "display-sheath" : conductor.id,
    path: route.path,
    color,
    strokeWidth: edge.kind === "jumper"
      ? 3.2
      : multicore ? 6 : isNetworkEdge(edge) || isUsbEdge(edge) ? 4.5 : 2.2,
    confirmed: conductors.every((item) => item.confirmed),
    needsOutline: color.toLowerCase() === "#ffffff"
  }];
}

function getCableCurveRatio(index: number) {
  const magnitude = 0.035 + index * 0.005;
  return (index % 2 === 0 ? 1 : -1) * magnitude;
}

function getDirectCableCurve(from: CablePoint, to: CablePoint, curveRatio: number): CableRoute {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const offset = clamp(distance * curveRatio, -72, 72);
  const normal = { x: -deltaY / distance, y: deltaX / distance };
  const control1 = {
    x: from.x + deltaX / 3 + normal.x * offset,
    y: from.y + deltaY / 3 + normal.y * offset
  };
  const control2 = {
    x: from.x + deltaX * 2 / 3 + normal.x * offset,
    y: from.y + deltaY * 2 / 3 + normal.y * offset
  };
  const midpoint = cubicPoint(from, control1, control2, to, 0.5);
  return {
    kind: "curve",
    path: `M ${from.x} ${from.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${to.x} ${to.y}`,
    points: [from, to],
    labelX: midpoint.x,
    labelY: midpoint.y,
    from,
    to,
    control1,
    control2,
    curveRatio
  };
}

function getNearestExitSide(
  from: { centerX: number; centerY: number },
  to: { centerX: number; centerY: number }
): CableExitSide {
  const deltaX = to.centerX - from.centerX;
  const deltaY = to.centerY - from.centerY;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return deltaX < 0 ? "left" : "right";
  return deltaY < 0 ? "top" : "bottom";
}

function getTerminalFanMergePoint(input: {
  terminals: CablePoint[];
  escapeSide: CableExitSide;
  deviceRect: { x: number; y: number; width: number; height: number };
  mergeDistance: number;
}) {
  const { terminals, escapeSide, deviceRect, mergeDistance } = input;
  const center = terminals.reduce((sum, terminal) => ({
    x: sum.x + terminal.x / terminals.length,
    y: sum.y + terminal.y / terminals.length
  }), { x: 0, y: 0 });
  const direction = getCableExitVector(escapeSide);
  const xMin = deviceRect.x + 6;
  const xMax = deviceRect.x + deviceRect.width - 6;
  const yMin = deviceRect.y + 20;
  const yMax = deviceRect.y + deviceRect.height - 6;
  const base = {
    x: clamp(center.x + direction.x * mergeDistance, xMin, xMax),
    y: clamp(center.y + direction.y * mergeDistance, yMin, yMax)
  };
  const horizontalExit = escapeSide === "left" || escapeSide === "right";
  const candidates = horizontalExit
    ? [
        { x: base.x, y: clamp(base.y + 16, yMin, yMax) },
        { x: base.x, y: clamp(base.y - 16, yMin, yMax) }
      ]
    : [
        { x: clamp(base.x + 16, xMin, xMax), y: base.y },
        { x: clamp(base.x - 16, xMin, xMax), y: base.y }
      ];
  candidates.sort((left, right) => {
    const leftOffset = horizontalExit ? Math.abs(left.y - base.y) : Math.abs(left.x - base.x);
    const rightOffset = horizontalExit ? Math.abs(right.y - base.y) : Math.abs(right.x - base.x);
    return rightOffset - leftOffset;
  });
  return candidates[0] ?? base;
}

function getCableExitVector(side: CableExitSide): CablePoint {
  if (side === "left") return { x: -1, y: 0 };
  if (side === "right") return { x: 1, y: 0 };
  if (side === "top") return { x: 0, y: -1 };
  return { x: 0, y: 1 };
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

function distancePointToRoute(point: CablePoint, route: CableRoute) {
  const routePoints = [
    route.from,
    ...Array.from({ length: 19 }, (_, index) => cubicPoint(
      route.from,
      route.control1!,
      route.control2!,
      route.to,
      (index + 1) / 20
    )),
    route.to
  ];
  return routePoints.slice(1).reduce((distance, routePoint, index) => Math.min(
    distance,
    pointToLineSegmentDistance(point, routePoints[index], routePoint)
  ), Number.POSITIVE_INFINITY);
}

function pointToLineSegmentDistance(
  point: CablePoint,
  start: CablePoint,
  end: CablePoint
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
    kind: "jumper" as const,
    path: `M ${from.x} ${from.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${to.x} ${to.y}`,
    points: [from, to],
    labelX: isHorizontalRoute
      ? (from.x + to.x) / 2
      : resolvedSide === "left" ? Math.min(from.x, to.x) - bulge : Math.max(from.x, to.x) + bulge,
    labelY: isHorizontalRoute
      ? resolvedSide === "top" ? Math.min(from.y, to.y) - bulge : Math.max(from.y, to.y) + bulge
      : (from.y + to.y) / 2,
    from,
    to,
    control1,
    control2
  };
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
