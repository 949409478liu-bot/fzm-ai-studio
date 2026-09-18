"use client";

import type { PromptDraft } from "../generationStore";

const qualities: Array<{ value: PromptDraft["quality"]; label: string }> = [{ value: "auto", label: "Auto" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }];

export function QualityPicker({ value, onChange }: { value: PromptDraft["quality"]; onChange: (value: PromptDraft["quality"]) => void }) {
  return <div className="fzm-segment" aria-label="Quality">{qualities.map((quality) => <button key={quality.value} type="button" data-active={value === quality.value} onClick={() => onChange(quality.value)}>{quality.label}</button>)}</div>;
}
