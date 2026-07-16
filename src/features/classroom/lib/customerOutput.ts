import type { ConnectionLine, GeneratedPoint } from "../types";

export function getCustomerVisiblePoints(points: GeneratedPoint[]): GeneratedPoint[] {
  return points.map((point) => {
    const visiblePoint = { ...point };
    delete visiblePoint.speakerSignalMode;
    delete visiblePoint.afcSendLevelOffset;
    return visiblePoint;
  });
}

export function getCustomerVisibleConnectionLines(lines: ConnectionLine[]): ConnectionLine[] {
  const directSpeakerGroups = lines.filter(isDirectSpeakerSignalGroup);
  const firstDirectGroup = directSpeakerGroups[0];
  const directSpeakerCount = directSpeakerGroups.reduce((total, line) => total + getQuantity(line.toDevice), 0);

  return lines.flatMap((line) => {
    if (isDirectSpeakerSignalGroup(line)) {
      if (line !== firstDirectGroup) return [];
      const speakerName = line.toDevice.includes("吸顶") ? "吸顶音箱" : "壁挂音箱";
      return [stripSignalDetails({
        ...line,
        id: "processor-speaker-direct-customer",
        fromPort: "功放输出",
        toDevice: `${speakerName} 主机直驱分组 × ${directSpeakerCount}`,
        note: "无源音箱由智能音频处理主机功放输出连接，现场复核阻抗、线径、极性和通道负载。"
      })];
    }
    return [stripSignalDetails(line)];
  });
}

function isDirectSpeakerSignalGroup(line: ConnectionLine) {
  return line.id.startsWith("processor-speaker-direct-") && Boolean(line.speakerSignalMode);
}

function getQuantity(value: string) {
  return Number(value.match(/×\s*(\d+)/)?.[1] ?? 1);
}

function stripSignalDetails(line: ConnectionLine): ConnectionLine {
  const visibleLine = { ...line };
  delete visibleLine.speakerSignalMode;
  delete visibleLine.afcSendLevelOffset;
  return visibleLine;
}
