import type { Reference } from "@/v2/types/domain";

export function orderReferences(references: Reference[]): Reference[] {
  return [...references].sort((left, right) => left.order - right.order);
}
