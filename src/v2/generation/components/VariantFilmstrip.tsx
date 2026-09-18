"use client";

import { assetContentUrl } from "@/v2/assets/assetApi";

interface VariantFilmstripProps {
  assetIds: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function VariantFilmstrip({ assetIds, selectedIndex, onSelect }: VariantFilmstripProps) {
  if (assetIds.length <= 1) return null;
  return <div className="fzm-variant-filmstrip" aria-label="Generated variants">{assetIds.map((assetId, index) => <button key={assetId} type="button" aria-label={`Select variant ${index + 1}`} data-active={selectedIndex === index} onClick={() => onSelect(index)}><img src={assetContentUrl(assetId, "thumbnail")} alt="" />{selectedIndex === index ? <span>✓</span> : null}</button>)}</div>;
}
