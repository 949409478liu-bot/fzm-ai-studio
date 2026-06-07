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
  const cpOffset = Math.min(dx * 0.38, 130);

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

// ─── Visual presets ──────────────────────────────────────────────────

const STYLES = {
  default: {
    glow: { color: "rgba(80,160,255,0.22)", width: 2.8 },
    main: { color: "rgba(235,245,255,0.92)", width: 1.8 },
    dot: { r: 3.5, fill: "rgba(180,210,255,0.55)" },
  },
  hover: {
    glow: { color: "rgba(90,170,255,0.38)", width: 3.0 },
    main: { color: "rgba(255,255,255,0.98)", width: 2.2 },
    dot: { r: 4.5, fill: "rgba(200,225,255,0.8)" },
  },
  selected: {
    glow: { color: "rgba(80,140,255,0.48)", width: 3.2 },
    main: { color: "rgba(255,255,255,1)", width: 2.4 },
    dot: { r: 5, fill: "rgba(255,255,255,0.9)" },
  },
} as const;

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
    const hovered = this.editor.getHoveredShapeId() === shape.id;
    const selected = this.editor.getSelectedShapeIds().includes(shape.id);
    const s = selected ? STYLES.selected : hovered ? STYLES.hover : STYLES.default;

    const path = getAiConnectionPath(shape.props);

    return (
      <SVGContainer style={{ overflow: "visible" }}>
        {/* Hit area */}
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={16}
          pointerEvents="stroke"
        />
        {/* Glow layer */}
        <path
          d={path}
          fill="none"
          stroke={s.glow.color}
          strokeWidth={s.glow.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
          style={{ transition: "stroke 180ms ease, stroke-width 180ms ease" }}
        />
        {/* Main bright line */}
        <path
          d={path}
          fill="none"
          stroke={s.main.color}
          strokeWidth={s.main.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
          style={{ transition: "stroke 180ms ease, stroke-width 180ms ease" }}
        />
        {/* Flow animation layer — visible on hover/select, suggests direction */}
        {(hovered || selected) && (
          <path
            d={path}
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth={1.8}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            className="connection-flow-animate"
          />
        )}
        {/* Endpoint dots */}
        <circle
          cx={shape.props.startX}
          cy={shape.props.startY}
          r={s.dot.r}
          fill={s.dot.fill}
          pointerEvents="none"
          style={{ transition: "r 180ms ease, fill 180ms ease" }}
        />
        <circle
          cx={shape.props.endX}
          cy={shape.props.endY}
          r={s.dot.r}
          fill={s.dot.fill}
          pointerEvents="none"
          style={{ transition: "r 180ms ease, fill 180ms ease" }}
        />
      </SVGContainer>
    );
  }

  override getIndicatorPath(shape: AiConnectionShape) {
    return new Path2D(getAiConnectionPath(shape.props));
  }

  override canResize() { return false; }
  override hideResizeHandles() { return true; }
  override hideRotateHandle() { return true; }
  override hideSelectionBoundsBg() { return true; }
  override hideSelectionBoundsFg() { return true; }
}
