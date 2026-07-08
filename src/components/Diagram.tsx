import type { DiagramSpec } from "../types";

const colors = {
  processor: "#2364aa",
  pickup: "#2a9d8f",
  speaker: "#e76f51",
  amplifier: "#8a5cf6",
  wireless: "#f4a261",
  accessory: "#64748b",
  room: "#475569",
  device: "#0f766e",
  cable: "#64748b"
};

interface DiagramProps {
  spec: DiagramSpec;
}

export function Diagram({ spec }: DiagramProps) {
  return (
    <div className="diagramWrap">
      <svg className="diagram" viewBox="0 0 100 100" role="img" aria-label={spec.title}>
        <rect x="4" y="6" width="92" height="82" rx="3" className="roomShell" />
        {spec.edges.map((edge) => {
          const from = spec.nodes.find((node) => node.id === edge.from);
          const to = spec.nodes.find((node) => node.id === edge.to);
          if (!from || !to) return null;
          return (
            <g key={`${edge.from}-${edge.to}`}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="diagramEdge" />
              <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 2} className="edgeLabel">
                {edge.label}
              </text>
            </g>
          );
        })}
        {spec.nodes.map((node) => (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r="5.5" fill={colors[node.kind]} />
            <text x={node.x} y={node.y + 11} textAnchor="middle" className="nodeLabel">
              {node.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="diagramNote">{spec.note}</p>
    </div>
  );
}
