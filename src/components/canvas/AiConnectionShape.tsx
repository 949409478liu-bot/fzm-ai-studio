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
      connectionType: string;
      label: string;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
    };
  }
}

export type AiConnectionShape = TLShape<typeof AI_CONNECTION_TYPE>;

function getCurve(shape: AiConnectionShape) {
  const { startX, startY, endX, endY } = shape.props;
  const isForward = endX >= startX;
  const distance = isForward
    ? Math.max(64, Math.abs(endX - startX) * 0.45)
    : 36;
  const levelOffset = Math.abs(endY - startY) < 4 ? 10 : 0;

  return {
    start: { x: startX, y: startY },
    cp1: { x: startX + distance, y: startY - levelOffset },
    cp2: { x: endX - distance, y: endY + levelOffset },
    end: { x: endX, y: endY },
  };
}

function getCurvePath(shape: AiConnectionShape) {
  const { start, cp1, cp2, end } = getCurve(shape);
  return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
}

export class AiConnectionShapeUtil extends ShapeUtil<AiConnectionShape> {
  static override type = AI_CONNECTION_TYPE;
  static override props: RecordProps<AiConnectionShape> = {
    sourceId: shapeIdValidator,
    targetId: shapeIdValidator,
    connectionType: T.string,
    label: T.string,
    startX: T.number,
    startY: T.number,
    endX: T.number,
    endY: T.number,
  };

  override getDefaultProps(): AiConnectionShape["props"] {
    return {
      sourceId: "shape:source" as TLShapeId,
      targetId: "shape:target" as TLShapeId,
      connectionType: "similar",
      label: "",
      startX: 0,
      startY: 0,
      endX: 120,
      endY: 0,
    };
  }

  override getGeometry(shape: AiConnectionShape) {
    const { start, cp1, cp2, end } = getCurve(shape);
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
    const path = getCurvePath(shape);

    return (
      <SVGContainer style={{ overflow: "visible" }}>
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={14}
          pointerEvents="stroke"
        />
        <path
          d={path}
          fill="none"
          stroke={
            isActive ? "rgba(165,180,252,0.9)" : "rgba(129,140,248,0.45)"
          }
          strokeWidth={isActive ? 2 : 1.5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
          style={{ transition: "stroke 120ms ease, stroke-width 120ms ease" }}
        />
      </SVGContainer>
    );
  }

  override getIndicatorPath(shape: AiConnectionShape) {
    return new Path2D(getCurvePath(shape));
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
