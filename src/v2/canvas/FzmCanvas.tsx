"use client";

import { Background, BackgroundVariant, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import styles from "./fzm-canvas.module.css";

export function FzmCanvas() {
  return (
    <main className={styles.shell} aria-label="FZM AI Studio 2.0 canvas">
      <ReactFlow nodes={[]} edges={[]} fitView>
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(255, 255, 255, 0.12)"
        />
      </ReactFlow>
    </main>
  );
}
