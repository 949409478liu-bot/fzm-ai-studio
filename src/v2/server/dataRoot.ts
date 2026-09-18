import path from "node:path";

export function getV2DataRoot(): string {
  return path.resolve(process.env.FZM_V2_DATA_DIR ?? path.join(process.cwd(), "data", "v2"));
}
