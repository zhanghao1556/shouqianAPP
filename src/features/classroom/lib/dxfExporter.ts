import type { ClassroomProfile, ConnectionLine, DrawingType, GeneratedPoint } from "../types";

const esc = (value: string) => value.replace(/[^\x20-\x7e\u4e00-\u9fa5]/g, " ");

const line = (x1: number, y1: number, x2: number, y2: number, layer = "0") =>
  `0\nLINE\n8\n${layer}\n10\n${x1}\n20\n${y1}\n30\n0\n11\n${x2}\n21\n${y2}\n31\n0\n`;

const circle = (x: number, y: number, r: number, layer = "0") =>
  `0\nCIRCLE\n8\n${layer}\n10\n${x}\n20\n${y}\n30\n0\n40\n${r}\n`;

const text = (x: number, y: number, value: string, size = 3, layer = "TEXT") =>
  `0\nTEXT\n8\n${layer}\n10\n${x}\n20\n${y}\n30\n0\n40\n${size}\n1\n${esc(value)}\n`;

const rect = (x: number, y: number, w: number, h: number, layer = "0") =>
  [line(x, y, x + w, y, layer), line(x + w, y, x + w, y + h, layer), line(x + w, y + h, x, y + h, layer), line(x, y + h, x, y, layer)].join("");

const header = () => "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";
const footer = () => "0\nENDSEC\n0\nEOF\n";

export const buildDxf = (
  type: DrawingType,
  profile: ClassroomProfile,
  points: GeneratedPoint[],
  connections: ConnectionLine[]
) => {
  if (type === "system") return header() + systemDxf(connections) + footer();
  if (type === "wiring") return header() + wiringDxf(connections) + footer();
  if (type === "topology") return header() + topologyDxf(connections) + footer();
  return header() + installationDxf(profile, points) + footer();
};

export const downloadDxf = (
  type: DrawingType,
  profile: ClassroomProfile,
  points: GeneratedPoint[],
  connections: ConnectionLine[],
  filename: string
) => {
  const blob = new Blob([buildDxf(type, profile, points, connections)], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".dxf") ? filename : `${filename}.dxf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const installationDxf = (profile: ClassroomProfile, points: GeneratedPoint[]) => {
  const scale = 10;
  const roomW = profile.roomGeometry.width * scale;
  const roomH = profile.roomGeometry.length * scale;
  let body = text(0, roomH + 12, `音翼阵列麦与音箱点位图 宽${profile.roomGeometry.width}m x 长${profile.roomGeometry.length}m`, 3.5);
  body += rect(0, 0, roomW, roomH, "ROOM");
  body += text(roomW / 2 - 18, roomH + 4, "前墙：黑板 / 一体机侧", 3, "TEXT");
  body += text(roomW + 4, roomH / 2, "学生区纵深", 3, "TEXT");
  points.forEach((point) => {
    const x = point.position.x * scale;
    const y = roomH - point.position.y * scale;
    body += circle(x, y, point.type === "arrayMic" ? 2.2 : 2.6, point.type === "arrayMic" ? "DT_MIC" : "SPEAKER");
    body += text(x + 3, y + 2, point.label, 2.4);
    body += text(x + 3, y - 2, `距前墙${point.position.y.toFixed(1)}m`, 1.8);
  });
  return body;
};

const wiringDxf = (connections: ConnectionLine[]) => {
  let body = text(0, 80, "音翼接口接线图", 4);
  connections.forEach((connection, index) => {
    const y = 65 - index * 18;
    body += rect(0, y, 42, 10, "DEVICE");
    body += rect(92, y, 42, 10, "DEVICE");
    body += text(2, y + 6, connection.fromDevice, 2.2);
    body += text(2, y + 2, connection.fromPort, 1.8);
    body += text(94, y + 6, connection.toDevice, 2.2);
    body += text(94, y + 2, connection.toPort, 1.8);
    body += line(42, y + 5, 92, y + 5, "CONNECTION");
    body += text(53, y + 8, connection.cableType, 1.8);
  });
  return body;
};

const topologyDxf = (connections: ConnectionLine[]) => {
  const devices = Array.from(new Set(connections.flatMap((lineItem) => [lineItem.fromDevice, lineItem.toDevice])));
  const positions = new Map<string, { x: number; y: number }>();
  devices.forEach((device, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    positions.set(device, { x: col * 55, y: 60 - row * 28 });
  });
  let body = text(0, 82, "音翼系统拓扑图", 4);
  devices.forEach((device) => {
    const p = positions.get(device)!;
    body += rect(p.x, p.y, 36, 12, "DEVICE");
    body += text(p.x + 2, p.y + 7, device, 2.2);
  });
  connections.forEach((connection) => {
    const from = positions.get(connection.fromDevice)!;
    const to = positions.get(connection.toDevice)!;
    body += line(from.x + 36, from.y + 6, to.x, to.y + 6, "CONNECTION");
    body += text((from.x + to.x) / 2 + 14, (from.y + to.y) / 2 + 8, connection.cableType, 1.8);
  });
  return body;
};

const systemDxf = (connections: ConnectionLine[]) => {
  let body = text(0, 118, "音翼接线与拓扑合并图", 4);
  body += text(0, 104, "系统拓扑", 3);
  body += topologyDxf(connections).replace("音翼系统拓扑图", "");
  body += text(0, 12, "接口接线明细", 3);
  connections.forEach((connection, index) => {
    const y = -2 - index * 14;
    body += rect(0, y, 38, 8, "DEVICE");
    body += rect(96, y, 38, 8, "DEVICE");
    body += text(2, y + 5, connection.fromDevice, 1.8);
    body += text(2, y + 1.8, connection.fromPort, 1.5);
    body += text(98, y + 5, connection.toDevice, 1.8);
    body += text(98, y + 1.8, connection.toPort, 1.5);
    body += line(38, y + 4, 96, y + 4, "CONNECTION");
    body += text(50, y + 6, connection.cableType, 1.5);
  });
  return body;
};
