"use client";

import { X } from "lucide-react";
import { assetContentUrl } from "@/v2/assets/assetApi";
import type { PromptReference } from "../types";

interface ReferenceStripProps {
  references: PromptReference[];
  onRemove: (reference: PromptReference) => void;
}

export function ReferenceStrip({ references, onRemove }: ReferenceStripProps) {
  if (references.length === 0) return null;
  return (
    <div className="fzm-reference-strip" aria-label="Reference images">
      {references.map((reference) => (
        <div className="fzm-reference-chip" key={`${reference.source}-${reference.edgeId ?? reference.assetId}-${reference.order}`}>
          <img src={assetContentUrl(reference.assetId, "thumbnail")} alt="Reference" />
          <button type="button" aria-label="Remove reference" onClick={() => onRemove(reference)}><X size={12} /></button>
        </div>
      ))}
    </div>
  );
}
