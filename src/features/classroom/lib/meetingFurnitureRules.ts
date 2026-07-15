import type { ClassroomProfile, Point } from "../types";

export const MEETING_TABLE_HEIGHT_M = 0.75;
export const MEETING_CHAIR_WIDTH_M = 0.52;
export const MEETING_CHAIR_DEPTH_M = 0.48;
export const MEETING_SIDE_AISLE_M = 0.9;
export const MEETING_SEAT_PITCH_M = 0.7;
export const MEETING_MIN_TABLE_WIDTH_M = 0.9;
export const MEETING_MAX_TABLE_WIDTH_M = 2.4;
export const MEETING_MIN_LONG_TABLE_LENGTH_M = 1.4;
export const MEETING_ROUND_TABLE_DIAMETER_M = 1.1;

export type MeetingFurnitureOrientation = "top" | "left";
export type MeetingSeatSide = "top" | "bottom" | "left" | "right";

export interface MeetingFurnitureSeat {
  id: string;
  position: Point;
  side: MeetingSeatSide;
  leader: boolean;
}

export interface MeetingFurnitureLayout {
  orientation: MeetingFurnitureOrientation;
  shape: "round" | "rectangular";
  seatCount: number;
  seatsPerSide: number;
  tableLength: number;
  tableWidth: number;
  tableHeight: number;
  tableCenter: Point;
  frontClearance: number;
  rearClearance: number;
  sideClearance: number;
  seats: MeetingFurnitureSeat[];
  requiresReview: boolean;
  reviewReasons: string[];
}

export function getMeetingFurnitureEndClearance(longAxis: number) {
  return roundTwo(clamp(1.2 + (longAxis - 6) * 0.08, 1.2, 2));
}

export function getMeetingFurnitureLayout(profile: ClassroomProfile): MeetingFurnitureLayout {
  const { width, length } = profile.roomGeometry;
  const orientation: MeetingFurnitureOrientation = width > length ? "left" : "top";
  const longAxis = Math.max(width, length);
  const shortAxis = Math.min(width, length);
  const endClearance = getMeetingFurnitureEndClearance(longAxis);
  const availableTableLength = roundTwo(longAxis - endClearance * 2);
  const availableTableWidth = roundTwo(shortAxis - 2 * (MEETING_CHAIR_DEPTH_M + MEETING_SIDE_AISLE_M));

  if (availableTableLength < MEETING_MIN_LONG_TABLE_LENGTH_M || availableTableWidth < MEETING_MIN_TABLE_WIDTH_M) {
    return getRoundTableLayout(width, length, orientation);
  }

  const tableLength = availableTableLength;
  const tableWidth = roundTwo(clamp(availableTableWidth, MEETING_MIN_TABLE_WIDTH_M, MEETING_MAX_TABLE_WIDTH_M));
  const seatsPerSide = Math.max(2, Math.floor(tableLength / MEETING_SEAT_PITCH_M));
  const tableCenter = orientation === "top"
    ? { x: roundTwo(width / 2), y: roundTwo(endClearance + tableLength / 2) }
    : { x: roundTwo(endClearance + tableLength / 2), y: roundTwo(length / 2) };
  const seats = getRectangularSeatPositions({
    orientation,
    tableCenter,
    tableLength,
    tableWidth,
    seatsPerSide
  });

  return {
    orientation,
    shape: "rectangular",
    seatCount: seats.length,
    seatsPerSide,
    tableLength,
    tableWidth,
    tableHeight: MEETING_TABLE_HEIGHT_M,
    tableCenter,
    frontClearance: endClearance,
    rearClearance: endClearance,
    sideClearance: roundTwo((shortAxis - tableWidth) / 2),
    seats,
    requiresReview: false,
    reviewReasons: []
  };
}

function getRoundTableLayout(
  width: number,
  length: number,
  orientation: MeetingFurnitureOrientation
): MeetingFurnitureLayout {
  const tableCenter = { x: roundTwo(width / 2), y: roundTwo(length / 2) };
  const chairOffset = MEETING_ROUND_TABLE_DIAMETER_M / 2 + MEETING_CHAIR_DEPTH_M / 2;
  const seats: MeetingFurnitureSeat[] = [
    { id: "meeting-seat-top", side: "top", position: { x: tableCenter.x, y: roundTwo(tableCenter.y - chairOffset) }, leader: false },
    { id: "meeting-seat-right", side: "right", position: { x: roundTwo(tableCenter.x + chairOffset), y: tableCenter.y }, leader: false },
    { id: "meeting-seat-bottom", side: "bottom", position: { x: tableCenter.x, y: roundTwo(tableCenter.y + chairOffset) }, leader: false },
    { id: "meeting-seat-left", side: "left", position: { x: roundTwo(tableCenter.x - chairOffset), y: tableCenter.y }, leader: false }
  ];
  const outerDiameter = MEETING_ROUND_TABLE_DIAMETER_M + MEETING_CHAIR_DEPTH_M * 2;
  const horizontalPassage = roundTwo((width - outerDiameter) / 2);
  const verticalPassage = roundTwo((length - outerDiameter) / 2);
  const requiresReview = Math.min(horizontalPassage, verticalPassage) < MEETING_SIDE_AISLE_M;

  return {
    orientation,
    shape: "round",
    seatCount: seats.length,
    seatsPerSide: 0,
    tableLength: MEETING_ROUND_TABLE_DIAMETER_M,
    tableWidth: MEETING_ROUND_TABLE_DIAMETER_M,
    tableHeight: MEETING_TABLE_HEIGHT_M,
    tableCenter,
    frontClearance: verticalPassage,
    rearClearance: verticalPassage,
    sideClearance: horizontalPassage,
    seats,
    requiresReview,
    reviewReasons: requiresReview ? ["桌椅通道需现场复核"] : []
  };
}

function getRectangularSeatPositions({
  orientation,
  tableCenter,
  tableLength,
  tableWidth,
  seatsPerSide
}: {
  orientation: MeetingFurnitureOrientation;
  tableCenter: Point;
  tableLength: number;
  tableWidth: number;
  seatsPerSide: number;
}) {
  const seats: MeetingFurnitureSeat[] = [];
  const tableStart = orientation === "top" ? tableCenter.y - tableLength / 2 : tableCenter.x - tableLength / 2;

  for (let index = 0; index < seatsPerSide; index += 1) {
    const axisPosition = roundTwo(tableStart + tableLength * ((index + 0.5) / seatsPerSide));
    if (orientation === "top") {
      seats.push(
        {
          id: `meeting-seat-left-${index + 1}`,
          side: "left",
          position: { x: roundTwo(tableCenter.x - tableWidth / 2 - MEETING_CHAIR_DEPTH_M / 2), y: axisPosition },
          leader: false
        },
        {
          id: `meeting-seat-right-${index + 1}`,
          side: "right",
          position: { x: roundTwo(tableCenter.x + tableWidth / 2 + MEETING_CHAIR_DEPTH_M / 2), y: axisPosition },
          leader: false
        }
      );
    } else {
      seats.push(
        {
          id: `meeting-seat-top-${index + 1}`,
          side: "top",
          position: { x: axisPosition, y: roundTwo(tableCenter.y - tableWidth / 2 - MEETING_CHAIR_DEPTH_M / 2) },
          leader: false
        },
        {
          id: `meeting-seat-bottom-${index + 1}`,
          side: "bottom",
          position: { x: axisPosition, y: roundTwo(tableCenter.y + tableWidth / 2 + MEETING_CHAIR_DEPTH_M / 2) },
          leader: false
        }
      );
    }
  }

  seats.push(orientation === "top"
    ? {
        id: "meeting-seat-leader",
        side: "bottom",
        position: { x: tableCenter.x, y: roundTwo(tableCenter.y + tableLength / 2 + MEETING_CHAIR_DEPTH_M / 2) },
        leader: true
      }
    : {
        id: "meeting-seat-leader",
        side: "right",
        position: { x: roundTwo(tableCenter.x + tableLength / 2 + MEETING_CHAIR_DEPTH_M / 2), y: tableCenter.y },
        leader: true
      });

  return seats;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundTwo(value: number) {
  return Math.round(value * 100) / 100;
}
