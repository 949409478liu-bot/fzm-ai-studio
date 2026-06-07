"use client";

import {
  CubicBezier2d,
  SVGContainer,
  ShapeUtil,
  T,
  Vec,
  shapeIdValidator,
  type RecordProps,
  type TLShape,
  type TLShapeId,
} from "@tldraw/tldraw";

export const AI_CONNECTION_TYPE = "ai-connection" as const;

declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    [AI_CONNECTION_TYPE]: {
      sourceId: TLShapeId;
      targetId: TLShapeId;
      sourcePort: "output";
      targetPort: "input";
      connectionType: "manual" | "auto";
      label: string;
      createdAt: number;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
    };
  }
}

export type AiConnectionShape = TLShape<typeof AI_CONNECTION_TYPE>;

function getCurvePoints({
  startX,
  startY,
  endX,
  endY,
}: {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}) {
  const dx = Math.abs(endX - startX);
  // Flatter curve: less dramatic bezier, more direct connection
  const cpOffset = Math.min(dx * 0.3, 120);

  return {
    start: { x: startX, y: startY },
    cp1: { x: startX + cpOffset, y: startY },
    cp2: { x: endX - cpOffset, y: endY },
    end: { x: endX, y: endY },
  };
}

export function getAiConnectionPath(
  points: Parameters<typeof getCurvePoints>[0]
) {
  const { start, cp1, cp2, end } = getCurvePoints(points);
  return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
}

export class AiConnectionShapeUtil extends ShapeUtil<AiConnectionShape> {
  static override type = AI_CONNECTION_TYPE;
  static override props: RecordProps<AiConnectionShape> = {
    sourceId: shapeIdValidator,
    targetId: shapeIdValidator,
    sourcePort: T.literal("output"),
    targetPort: T.literal("input"),
    connectionType: T.literalEnum("manual", "auto"),
    label: T.string,
    createdAt: T.number,
    startX: T.number,
    startY: T.number,
    endX: T.number,
    endY: T.number,
  };

  override getDefaultProps(): AiConnectionShape["props"] {
    return {
      sourceId: "shape:source" as TLShapeId,
      targetId: "shape:target" as TLShapeId,
      sourcePort: "output",
      targetPort: "input",
      connectionType: "auto",
      label: "",
      createdAt: 0,
      startX: 0,
      startY: 0,
      endX: 120,
      endY: 0,
    };
  }

  override getGeometry(shape: AiConnectionShape) {
    const { start, cp1, cp2, end } = getCurvePoints(shape.props);
    return new CubicBezier2d({
      start: new Vec(start.x, start.y),
      cp1: new Vec(cp1.x, cp1.y),
      cp2: new Vec(cp2.x, cp2.y),
      end: new Vec(end.x, end.y),
    });
  }

  override component(shape: AiConnectionShape) {
    const isActive =
      this.editor.getHoveredShapeId() === shape.id ||
      this.editor.getSelectedShapeIds().includes(shape.id);

    const path = getAiConnectionPath(shape.props);

    // Subtle, professional line styling
    const strokeColor = isActive
      ? "rgba(165,180,252,0.65)"
      : "rgba(150,160,180,0.28)";
    const strokeW = isActive ? 1.5 : 1;

    return (
      <SVGContainer style={{ overflow: "visible" }}>
        {/* Invisible wider hit area */}
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={12}
          pointerEvents="stroke"
        />
        {/* Visible subtle line */}
        <path
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeW}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
          style={{
            transition: "stroke 180ms ease, stroke-width 180ms ease",
          }}
        />
        {/* Small arrow at end */}
        {isActive && (
          <circle
            cx={shape.props.endX}
            cy={shape.props.endY}
            r={3}
            fill="rgba(165,180,252,0.5)"
            pointerEvents="none"
            style={{ transition: "opacity 180ms ease" }}
          />
        )}
      </SVGContainer>
    );
  }

  override getIndicatorPath(shape: AiConnectionShape) {
    return new Path2D(getAiConnectionPath(shape.props));
  }

  override canResize() {
    return false;
  }

  override hideResizeHandles() {
    return true;
  }

  override hideRotateHandle() {
    return true;
  }

  override hideSelectionBoundsBg() {
    return true;
  }

  override hideSelectionBoundsFg() {
    return true;
  }
}
