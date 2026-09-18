"use client";

import type { PromptDraft } from "../generationStore";

const ratios: PromptDraft["aspectRatio"][] = ["1:1", "4:3", "3:4", "16:9", "9:16"];

export function RatioPicker({ value, onChange }: { value: PromptDraft["aspectRatio"]; onChange: (value: PromptDraft["aspectRatio"]) => void }) {
  return <div className="fzm-segment" aria-label="Aspect ratio">{ratios.map((ratio) => <button key={ratio} type="button" data-active={value === ratio} onClick={() => onChange(ratio)}>{ratio}</button>)}</div>;
}
