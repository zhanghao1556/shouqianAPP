import { AlertTriangle, CheckCircle2, CircleAlert, Network } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppBrandId } from "../brand";
import type {
  ClassroomProfile,
  GeneratedOutputs,
  InterfaceWiringEdge,
  InterfaceWiringFinding,
  InterfaceWiringModel,
  InterfaceWiringNode
} from "../types";
import { buildInterfaceWiringModel, getInterfaceWiringLayout } from "../lib/interfaceWiring";
import "./InterfaceWiringPreview.css";

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

      <InterfaceWiringDiagram model={model} />

      <div className="interfaceWiringDataGrid">
        <InterfacePortUsageTable model={model} />
        <InterfaceWiringFindings findings={model.findings} />
      </div>
    </section>
  );
}

function InterfaceWiringDiagram({ model }: { model: InterfaceWiringModel }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(1120);
  const layout = useMemo(() => getInterfaceWiringLayout(model, availableWidth), [model, availableWidth]);
  const nodeMap = new Map(model.nodes.map((node) => [node.id, node]));
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
          <marker id="interface-wiring-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#0b5cad" />
          </marker>
          <marker id="interface-wiring-arrow-reverse" markerWidth="10" markerHeight="10" refX="1" refY="3" orient="auto-start-reverse" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#0b5cad" />
          </marker>
        </defs>
        <rect x="18" y="18" width={layout.width - 36} height={layout.height - 40} fill="#ffffff" stroke="#111827" strokeWidth="1" />
        <text x={layout.width / 2} y="48" textAnchor="middle" className="cadTitle">接口接线图</text>
        <text x={layout.width / 2} y="72" textAnchor="middle" className="cadSmall" fill="#9a6700">
          拟调整预览 / 尚未写入正式规则
        </text>

        {model.edges.map((edge) => {
          const drawing = edgeDrawings.get(edge.id);
          if (!drawing) return null;
          return (
            <g key={edge.id} className="interfaceWiringEdge">
              <path
                d={drawing.route.path}
                fill="none"
                stroke="#0b5cad"
                strokeWidth="1.8"
                markerEnd="url(#interface-wiring-arrow)"
                markerStart={edge.signalDirection === "bidirectional" ? "url(#interface-wiring-arrow-reverse)" : undefined}
              />
              <rect
                x={drawing.route.labelX - drawing.labelWidth / 2}
                y={drawing.route.labelY - 12}
                width={drawing.labelWidth}
                height="24"
                rx="3"
                fill="#ffffff"
                stroke="#b8c7d9"
                strokeWidth="0.7"
              />
              <text x={drawing.route.labelX} y={drawing.route.labelY + 4} textAnchor="middle" className="cadSmall" fill="#123c66">
                {drawing.label}
              </text>
            </g>
          );
        })}

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
              <div className={`interfaceWiringNode level${node.level} ${node.id === model.rootNodeId ? "root" : ""}`}>
                <div className="interfaceWiringNodeHeader">
                  <div>
                    <strong>{node.label}{node.quantity > 1 ? ` ×${node.quantity}` : ""}</strong>
                    {node.internalModel && <small>内部校准：{node.internalModel}</small>}
                  </div>
                  <span>L{node.level}</span>
                </div>
                <div className="interfaceWiringPortList">
                  {node.ports.length ? node.ports.map((port) => (
                    <div className={`interfaceWiringPortRow ${port.confirmed ? "" : "unconfirmed"}`} key={port.id}>
                      <div>
                        <b>{port.label}</b>
                        <small>{port.interfaceType}</small>
                      </div>
                      <div>
                        <span>{nodeMap.get(port.peerNodeId)?.label ?? "外接设备"}</span>
                        <small>{port.peerPortLabel}</small>
                      </div>
                    </div>
                  )) : (
                    <div className="interfaceWiringPortEmpty">当前无可生成的接口连线</div>
                  )}
                </div>
                {node.cascade && (
                  <div className="interfaceWiringCascade">
                    <b>{node.cascade.label}</b>
                    <span>{node.cascade.fromPortLabel} → {node.cascade.toPortLabel} · {node.cascade.cableType}</span>
                  </div>
                )}
              </div>
            </foreignObject>
          );
        })}
      </svg>
    </div>
  );
}

function InterfacePortUsageTable({ model }: { model: InterfaceWiringModel }) {
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
                <th>设备</th>
                <th>已用接口</th>
                <th>接口形式</th>
                <th>连接到</th>
                <th>线材 / 接法</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ node, port }) => (
                <tr key={port.id} className={port.confirmed ? "" : "unconfirmed"}>
                  <td>{node.label}{node.quantity > 1 ? ` ×${node.quantity}` : ""}</td>
                  <td>{port.label}</td>
                  <td>{port.interfaceType}</td>
                  <td>{model.nodes.find((item) => item.id === port.peerNodeId)?.label ?? "外接设备"} [{port.peerPortLabel}]</td>
                  <td>{port.cableType}<small>{port.connectionMethod}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="emptyState">当前方案没有可生成的接口接线。</div>}
      </div>
    </section>
  );
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
  position: { x: number; y: number; width: number; height: number; centerX: number; centerY: number },
  peer: { centerX: number; centerY: number }
) {
  const index = Math.max(0, node.ports.findIndex((port) => port.id === portId));
  const portY = Math.min(position.y + position.height - 24, position.y + 62 + index * 48 + 24);
  const horizontal = Math.abs(peer.centerX - position.centerX) >= Math.abs(peer.centerY - position.centerY);
  if (horizontal) {
    return {
      x: peer.centerX < position.centerX ? position.x : position.x + position.width,
      y: portY
    };
  }
  return {
    x: position.centerX,
    y: peer.centerY < position.centerY ? position.y : position.y + position.height
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
  const occupiedLabels: Array<{ x: number; y: number; width: number; height: number }> = [];
  const nodeRects = Object.entries(layout.positions).map(([id, position]) => ({
    id,
    x: position.x,
    y: position.y,
    width: position.width,
    height: position.height
  }));
  const drawings = new Map<string, {
    label: string;
    labelWidth: number;
    route: { path: string; labelX: number; labelY: number };
  }>();

  model.edges.forEach((edge) => {
    const fromNode = nodeMap.get(edge.fromNodeId);
    const toNode = nodeMap.get(edge.toNodeId);
    const fromPosition = layout.positions[edge.fromNodeId];
    const toPosition = layout.positions[edge.toNodeId];
    if (!fromNode || !toNode || !fromPosition || !toPosition) return;
    const from = getPortAnchor(fromNode, edge.fromPortId, fromPosition, toPosition);
    const to = getPortAnchor(toNode, edge.toPortId, toPosition, fromPosition);
    const pairKey = getPairKey(edge);
    const pairIndex = pairIndexes.get(pairKey) ?? 0;
    pairIndexes.set(pairKey, pairIndex + 1);
    const pairCount = pairCounts.get(pairKey) ?? 1;
    const laneOffset = (pairIndex - (pairCount - 1) / 2) * 34;
    const baseLabel = edge.connectionMethod.startsWith("级联") ? edge.connectionMethod : edge.cableType;
    const label = edge.quantity > 1 && !baseLabel.includes("×") ? `${baseLabel} ×${edge.quantity}` : baseLabel;
    const labelWidth = Math.min(300, Math.max(80, label.length * 12 + 20));
    const route = findOpenEdgeRoute({
      from,
      to,
      preferredOffset: laneOffset,
      labelWidth,
      canvasWidth: layout.width,
      canvasHeight: layout.height,
      nodeRects,
      occupiedLabels,
      endpointNodeIds: new Set([edge.fromNodeId, edge.toNodeId])
    });
    occupiedLabels.push({
      x: route.labelX - labelWidth / 2,
      y: route.labelY - 12,
      width: labelWidth,
      height: 24
    });
    drawings.set(edge.id, { label, labelWidth, route });
  });
  return drawings;
}

function findOpenEdgeRoute(input: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  preferredOffset: number;
  labelWidth: number;
  canvasWidth: number;
  canvasHeight: number;
  nodeRects: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  occupiedLabels: Array<{ x: number; y: number; width: number; height: number }>;
  endpointNodeIds: Set<string>;
}) {
  const {
    from,
    to,
    preferredOffset,
    labelWidth,
    canvasWidth,
    canvasHeight,
    nodeRects,
    occupiedLabels,
    endpointNodeIds
  } = input;
  const offsets = [preferredOffset];
  for (let distance = 44; distance <= 440; distance += 44) {
    offsets.push(preferredOffset - distance, preferredOffset + distance);
  }
  for (const offset of offsets) {
    const route = getEdgeRoute(from, to, offset);
    const labelRect = {
      x: route.labelX - labelWidth / 2,
      y: route.labelY - 12,
      width: labelWidth,
      height: 24
    };
    if (labelRect.x < 24 || labelRect.x + labelRect.width > canvasWidth - 24) continue;
    if (labelRect.y < 82 || labelRect.y + labelRect.height > canvasHeight - 24) continue;
    if (nodeRects.some((rect) => rectanglesOverlap(labelRect, rect, 3))) continue;
    if (occupiedLabels.some((rect) => rectanglesOverlap(labelRect, rect, 4))) continue;
    if (edgeRouteCrossesNodes(route, nodeRects, endpointNodeIds)) continue;
    return route;
  }

  const fallback = getEdgeRoute(from, to, preferredOffset);
  return {
    ...fallback,
    labelX: Math.min(canvasWidth - 24 - labelWidth / 2, Math.max(24 + labelWidth / 2, fallback.labelX)),
    labelY: Math.min(canvasHeight - 36, Math.max(94, fallback.labelY))
  };
}

function getEdgeRoute(from: { x: number; y: number }, to: { x: number; y: number }, labelOffset: number) {
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
    labelX: from.x + dx * 0.5 + perpendicular.x * labelOffset,
    labelY: from.y + dy * 0.5 + perpendicular.y * labelOffset,
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

function rectanglesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
  gap: number
) {
  return !(
    left.x + left.width + gap <= right.x ||
    right.x + right.width + gap <= left.x ||
    left.y + left.height + gap <= right.y ||
    right.y + right.height + gap <= left.y
  );
}

function getPairKey(edge: InterfaceWiringEdge) {
  return [edge.fromNodeId, edge.toNodeId].sort().join("::");
}
