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
  getInterfaceWiringPortReferenceNumbers,
  getInterfaceWiringUsageDeviceLabel
} from "../lib/interfaceWiring";
import { getDevicePortProfile } from "../lib/devicePortCatalog";
import aj200InterfacePanel from "../../../assets/yinman-aj200-interface-panel.png";
import aj350InterfacePanel from "../../../assets/yinman-aj350-interface-panel.png";
import aj600InterfacePanel from "../../../assets/yinman-aj600-interface-panel.png";
import ap150RearPanel from "../../../assets/yinman-ap150-rear-panel.png";
import lineArrayRearPanel from "../../../assets/yinman-sa110-rear-panel.png";
import lineArrayConverterPanel from "../../../assets/yinman-line-array-converter.png";
import passiveSpeakerTerminal from "../../../assets/yinman-passive-speaker-terminal.png";
import ring01InterfacePanel from "../../../assets/yinman-ring01-interface-panel.png";
import ring03InterfacePanel from "../../../assets/yinman-ring03-interface-panel.png";
import ring08RearPanel from "../../../assets/yinman-ring08-rear-panel.png";
import ringOfAInterfacePanel from "../../../assets/yinman-ringof-a-interface-panel.png";
import wirelessReceiverRearPanel from "../../../assets/yinman-wireless-receiver-rear-panel.png";
import "./InterfaceWiringPreview.css";

const CABLE_LEGEND_BASE_HEIGHT = 52;
const CABLE_LEGEND_ROW_HEIGHT = 28;
const CABLE_LEGEND_TOP_GAP = 24;
const CABLE_LEGEND_BOTTOM_GAP = 28;

const interfacePanelImages: Record<string, string> = {
  aj200: aj200InterfacePanel,
  aj350: aj350InterfacePanel,
  aj600: aj600InterfacePanel,
  ap150: ap150RearPanel,
  lineArray: lineArrayRearPanel,
  lineArrayConverter: lineArrayConverterPanel,
  passiveSpeaker: passiveSpeakerTerminal,
  ring01: ring01InterfacePanel,
  ring03: ring03InterfacePanel,
  ring08: ring08RearPanel,
  ringOfA: ringOfAInterfacePanel,
  wirelessReceiver: wirelessReceiverRearPanel
};

interface InterfaceWiringPreviewProps {
  profile: ClassroomProfile;
  outputs: GeneratedOutputs;
  brandId: AppBrandId;
}

export function InterfaceWiringPreview({ profile, outputs, brandId }: InterfaceWiringPreviewProps) {
  const model = useMemo(
    () => buildInterfaceWiringModel({ profile, outputs, brandId }),
    [profile, outputs, brandId]
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

      <InterfaceWiringDiagram model={model} portReferenceNumbers={portReferenceNumbers} />

      <div className="interfaceWiringDataGrid">
        <InterfacePortUsageTable model={model} portReferenceNumbers={portReferenceNumbers} />
        <InterfaceWiringFindings findings={model.findings} />
      </div>
    </section>
  );
}

function InterfaceWiringDiagram({
  model,
  portReferenceNumbers
}: {
  model: InterfaceWiringModel;
  portReferenceNumbers: Record<string, number>;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(1120);
  const cableLegendRows = useMemo(() => getCableLegendRows(model.edges), [model.edges]);
  const cableLegendHeight = CABLE_LEGEND_BASE_HEIGHT + cableLegendRows.length * CABLE_LEGEND_ROW_HEIGHT;
  const bottomPadding = cableLegendRows.length
    ? cableLegendHeight + CABLE_LEGEND_TOP_GAP + CABLE_LEGEND_BOTTOM_GAP
    : 44;
  const layout = useMemo(
    () => getInterfaceWiringLayout(model, availableWidth, bottomPadding),
    [model, availableWidth, bottomPadding]
  );
  const edgeDrawings = useMemo(() => buildEdgeDrawings(model, layout), [model, layout]);
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
        <defs>
          <marker id="interface-wiring-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0 L0,6 L9,3 z" fill="#0b5cad" />
          </marker>
          <marker id="interface-wiring-arrow-reverse" markerWidth="8" markerHeight="8" refX="1" refY="3" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M0,0 L0,6 L9,3 z" fill="#0b5cad" />
          </marker>
        </defs>
        <rect x="18" y="18" width={layout.width - 36} height={layout.height - 40} fill="#ffffff" stroke="#111827" strokeWidth="1" />
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
                portReferenceNumbers={portReferenceNumbers}
              />
            </foreignObject>
          );
        })}

        {model.edges.map((edge) => {
          const drawing = edgeDrawings.get(edge.id);
          if (!drawing) return null;
          return (
            <g key={edge.id} className="interfaceWiringEdge" data-edge-id={edge.id}>
              {drawing.conductorRoutes.map(({ conductor, path, strokeWidth, needsOutline }) => (
                <path
                  key={`${edge.id}-${conductor.id}`}
                  d={path}
                  fill="none"
                  stroke={conductor.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  className={[
                    conductor.confirmed ? "" : "unconfirmedConductor",
                    needsOutline ? "lightConductor" : ""
                  ].filter(Boolean).join(" ")}
                />
              ))}
              <path
                d={drawing.route.path}
                fill="none"
                stroke="transparent"
                strokeWidth="5"
                markerEnd="url(#interface-wiring-arrow)"
                markerStart={edge.signalDirection === "bidirectional" ? "url(#interface-wiring-arrow-reverse)" : undefined}
              />
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
  portReferenceNumbers
}: {
  node: InterfaceWiringNode;
  position: WiringNodePosition;
  positions: WiringNodePositions;
  portReferenceNumbers: Record<string, number>;
}) {
  const panelProfile = getDevicePortProfile(node.productId)?.interfacePanel;
  const panelImage = panelProfile ? interfacePanelImages[panelProfile.assetKey] : undefined;
  const imageRect = panelProfile && panelImage ? getInterfacePanelImageRect(node, position) : undefined;
  const markers = node.ports.map((port, index) => {
    const panelAnchor = panelProfile
      ? getInterfacePanelPortAnchor(panelProfile, port.capabilityId, index, node.ports.length)
      : undefined;
    if (imageRect && panelAnchor) {
      const anchorLeft = imageRect.x - position.x + panelAnchor.x * imageRect.width;
      const anchorTop = imageRect.y - position.y + panelAnchor.y * imageRect.height;
      const badgeOffset = getPortNumberOffset(
        position.x + anchorLeft,
        position.y + anchorTop,
        position,
        positions[port.peerNodeId]
      );
      return {
        port,
        index,
        referenceNumber: portReferenceNumbers[port.id],
        anchorLeft,
        anchorTop,
        left: anchorLeft + badgeOffset.x,
        top: anchorTop + badgeOffset.y,
        located: true
      };
    }
    const fallback = getFallbackPortMarker(node, index, position, imageRect, panelProfile);
    const badgeOffset = getPortNumberOffset(
      position.x + fallback.left,
      position.y + fallback.top,
      position,
      positions[port.peerNodeId]
    );
    return {
      port,
      index,
      referenceNumber: portReferenceNumbers[port.id],
      anchorLeft: fallback.left,
      anchorTop: fallback.top,
      left: fallback.left + badgeOffset.x,
      top: fallback.top + badgeOffset.y,
      located: false
    };
  });
  const hasUnlocatedPorts = markers.some((marker) => !marker.located);
  return (
    <div className={`interfaceWiringNode ${imageRect ? "hasInterfacePanel" : "missingInterfacePanel"}`} data-level={node.level}>
      <strong className="interfaceWiringNodeName">
        {node.label}{node.quantity > 1 ? ` ×${node.quantity}` : ""}
      </strong>
      {imageRect && panelProfile && panelImage && (
        <img
          className={`interfaceWiringPanelImage ${panelProfile.confirmed ? "" : "unconfirmed"}`}
          src={panelImage}
          alt={`${node.label}接口面板`}
          title={panelProfile.source}
          style={{
            left: imageRect.x - position.x,
            top: imageRect.y - position.y,
            width: imageRect.width,
            height: imageRect.height
          }}
        />
      )}
      {(!imageRect || hasUnlocatedPorts) && (
        <span
          className="interfaceWiringMissingPanelLabel"
          style={{ top: getFallbackPortLabelTop(position, imageRect) }}
        >
          {imageRect ? "接口位置待补充" : "接口图待补充"}
        </span>
      )}
      {markers.map(({ port, referenceNumber, anchorLeft, anchorTop, left, top, located }) => (
        <span className="interfaceWiringPortMarker" key={`${port.id}-pin`}>
          {!located && (
            <i
              className="interfaceWiringUnlocatedAnchor"
              aria-hidden="true"
              style={{ left: anchorLeft, top: anchorTop }}
            />
          )}
          <i
            className={`interfaceWiringPortPin ${port.confirmed ? "" : "unconfirmed"} ${located ? "" : "unlocated"}`}
            title={`${port.label} → ${port.peerPortLabel}`}
            style={{ left, top }}
          >
            {referenceNumber}
          </i>
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

function getPortNumberOffset(
  anchorX: number,
  anchorY: number,
  position: WiringNodePosition,
  peer: WiringNodePosition | undefined
) {
  const distance = 18;
  const outwardOffset = 11;
  const outwardX = anchorX < position.centerX ? -outwardOffset : outwardOffset;
  const outwardY = anchorY < position.centerY ? -outwardOffset : outwardOffset;
  if (!peer) return { x: outwardX, y: -distance };
  const deltaX = peer.centerX - anchorX;
  const deltaY = peer.centerY - anchorY;
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return { x: deltaX > 0 ? -distance : distance, y: outwardY };
  }
  return { x: outwardX, y: deltaY > 0 ? -distance : distance };
}

function InterfacePortUsageTable({
  model,
  portReferenceNumbers
}: {
  model: InterfaceWiringModel;
  portReferenceNumbers: Record<string, number>;
}) {
  const rows = model.nodes.flatMap((node) => node.ports.map((port) => ({ node, port })));
  return (
    <section className="interfaceWiringTableSection">
      <div className="interfaceWiringSubHeader">
        <h4>接口占用表</h4>
        <span>只列当前方案已用接口</span>
      </div>
      <div className="tableBox interfaceWiringPortTable">
        {rows.length ? (
          <table>
            <thead>
              <tr>
                <th>图中编号</th>
                <th>设备</th>
                <th>已用接口</th>
                <th>接口形式</th>
                <th>连接到</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ node, port }) => (
                <tr key={port.id} className={port.confirmed ? "" : "unconfirmed"}>
                  <td><span className="interfaceWiringTablePortPin">{portReferenceNumbers[port.id]}</span></td>
                  <td>{getInterfaceWiringUsageDeviceLabel(node, port)}</td>
                  <td>{port.label}</td>
                  <td>{port.interfaceType}</td>
                  <td>{model.nodes.find((item) => item.id === port.peerNodeId)?.label ?? "外接设备"} [{port.peerPortLabel}]</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="emptyState">当前方案没有可生成的接口接线。</div>}
      </div>
    </section>
  );
}

type CableLegendKind = "speaker" | "audio" | "network" | "usb" | "other";

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
          <tr><th>显示</th><th>线材</th><th>接线关系</th></tr>
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
  const lineCount = kind === "speaker" ? 2 : kind === "audio" ? 3 : 1;
  return (
    <span className={`interfaceWiringLegendSwatch ${kind}`} aria-label={`${kind}线材图例`}>
      {Array.from({ length: lineCount }, (_, index) => <i key={index} />)}
    </span>
  );
}

function getCableLegendRows(edges: InterfaceWiringEdge[]): CableLegendRow[] {
  const rows = new Map<CableLegendKind, CableLegendRow>();
  edges.forEach((edge) => {
    const kind: CableLegendKind = isNetworkEdge(edge)
      ? "network"
      : isUsbEdge(edge)
        ? "usb"
        : edge.cableType.includes("音箱线")
          ? "speaker"
          : /音频线|话筒线/i.test(edge.cableType)
            ? "audio"
            : "other";
    const definition = getCableLegendDefinition(kind, edge.cableType);
    const existing = rows.get(kind);
    if (existing) existing.quantity += edge.quantity;
    else rows.set(kind, { kind, quantity: edge.quantity, ...definition });
  });
  const order: CableLegendKind[] = ["speaker", "audio", "network", "usb", "other"];
  return order.flatMap((kind) => rows.get(kind) ?? []);
}

function getCableLegendDefinition(kind: CableLegendKind, fallbackLabel: string) {
  if (kind === "speaker") return { label: "音箱线", description: "红线接 +；白线接 -" };
  if (kind === "audio") return { label: "音频线", description: "红线接 +；白线接 -；屏蔽线接 G" };
  if (kind === "network") return { label: "网线", description: "粗蓝线；T568B 1-8芯直通" };
  if (kind === "usb") return { label: "USB线", description: "粗黄线；USB接口直连" };
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
  terminalId?: string
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
    const anchorPoint = terminalAnchor ?? visualAnchor;
    return {
      x: imageRect.x + anchorPoint.x * imageRect.width,
      y: imageRect.y + anchorPoint.y * imageRect.height
    };
  }
  const fallback = getFallbackPortMarker(node, index, position, imageRect, panelProfile);
  return {
    x: position.x + fallback.left,
    y: position.y + fallback.top
  };
}

function buildEdgeDrawings(model: InterfaceWiringModel, layout: ReturnType<typeof getInterfaceWiringLayout>) {
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
  const drawings = new Map<string, {
    route: ReturnType<typeof getEdgeRoute>;
    conductorRoutes: Array<{
      conductor: InterfaceWiringConductor;
      path: string;
      strokeWidth: number;
      needsOutline: boolean;
    }>;
  }>();

  model.edges.forEach((edge) => {
    const fromNode = nodeMap.get(edge.fromNodeId);
    const toNode = nodeMap.get(edge.toNodeId);
    const fromPosition = layout.positions[edge.fromNodeId];
    const toPosition = layout.positions[edge.toNodeId];
    if (!fromNode || !toNode || !fromPosition || !toPosition) return;
    const from = getPortAnchor(fromNode, edge.fromPortId, fromPosition);
    const to = getPortAnchor(toNode, edge.toPortId, toPosition);
    const pairKey = getPairKey(edge);
    const pairIndex = pairIndexes.get(pairKey) ?? 0;
    pairIndexes.set(pairKey, pairIndex + 1);
    const pairCount = pairCounts.get(pairKey) ?? 1;
    const laneOffset = (pairIndex - (pairCount - 1) / 2) * 34;
    const displayConductors = getDisplayConductors(edge);
    const route = findOpenCableRoute({
      from,
      to,
      preferredOffset: laneOffset,
      nodeRects,
      endpointNodeIds: new Set([edge.fromNodeId, edge.toNodeId])
    });
    const conductorRoutes = displayConductors.map((conductor, conductorIndex) => {
      const conductorOffset = (conductorIndex - (displayConductors.length - 1) / 2) * 3.2;
      const conductorFrom = getPortAnchor(
        fromNode,
        edge.fromPortId,
        fromPosition,
        conductor.fromTerminalId
      );
      const conductorTo = getPortAnchor(
        toNode,
        edge.toPortId,
        toPosition,
        conductor.toTerminalId
      );
      const bundledRoute = getEdgeRoute(from, to, route.offset + conductorOffset);
      return {
        conductor,
        path: getBundledConductorPath(conductorFrom, conductorTo, bundledRoute),
        strokeWidth: isNetworkEdge(edge) || isUsbEdge(edge) ? 4.5 : 2.2,
        needsOutline: conductor.color.toLowerCase() === "#ffffff"
      };
    });
    drawings.set(edge.id, { route, conductorRoutes });
  });
  return drawings;
}

function getBundledConductorPath(
  terminalFrom: { x: number; y: number },
  terminalTo: { x: number; y: number },
  route: ReturnType<typeof getEdgeRoute>
) {
  return [
    `M ${terminalFrom.x} ${terminalFrom.y}`,
    `L ${route.from.x} ${route.from.y}`,
    `C ${route.control1.x} ${route.control1.y}, ${route.control2.x} ${route.control2.y}, ${route.to.x} ${route.to.y}`,
    `L ${terminalTo.x} ${terminalTo.y}`
  ].join(" ");
}

function getDisplayConductors(edge: InterfaceWiringEdge): InterfaceWiringConductor[] {
  if (isNetworkEdge(edge)) {
    return [getCollapsedCableConductor(edge, "network", "网线", "#2563eb", "RJ45")];
  }
  if (isUsbEdge(edge)) {
    return [getCollapsedCableConductor(edge, "usb", "USB线", "#eab308", "USB")];
  }
  return edge.conductors;
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
}) {
  const {
    from,
    to,
    preferredOffset,
    nodeRects,
    endpointNodeIds
  } = input;
  const offsets = [preferredOffset];
  for (let distance = 44; distance <= 440; distance += 44) {
    offsets.push(preferredOffset - distance, preferredOffset + distance);
  }
  for (const offset of offsets) {
    const route = getEdgeRoute(from, to, offset);
    if (!edgeRouteCrossesNodes(route, nodeRects, endpointNodeIds)) return route;
  }
  return getEdgeRoute(from, to, preferredOffset);
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

function edgeRouteCrossesNodes(
  route: ReturnType<typeof getEdgeRoute>,
  nodeRects: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  endpointNodeIds: Set<string>
) {
  const obstacles = nodeRects.filter((rect) => !endpointNodeIds.has(rect.id));
  for (let index = 1; index < 20; index += 1) {
    const time = index / 20;
    const point = cubicPoint(route.from, route.control1, route.control2, route.to, time);
    if (obstacles.some((rect) => pointInsideRect(point, rect, 5))) return true;
  }
  return false;
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

function getPairKey(edge: InterfaceWiringEdge) {
  return [edge.fromNodeId, edge.toNodeId].sort().join("::");
}
