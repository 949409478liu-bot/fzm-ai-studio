# FZM AI Studio 2.0 Migration Map

Phase 0 baseline date: 2026-09-18  
Baseline commit: `d36e9928b5289720750f15787a618e2262172aab`  
V2 branch: `v2/canvas-rebuild`

This map freezes the working V1 implementation while V2 is built under an independent route and module boundary. `DELETE LATER` never authorizes deletion before V2 final acceptance and a separately approved migration.

## 1 Current System

### Runtime and entry points

| Current file | Role | Decision | V2 replacement | Delete after |
| --- | --- | --- | --- | --- |
| `src/app/page.tsx` | V1 application entry | FREEZE | `src/app/v2/page.tsx` is parallel only | NO |
| `src/app/layout.tsx` | Shared Next root layout | KEEP | Shared | NO |
| `src/app/globals.css` | V1 theme and tldraw overrides | FREEZE | V2 uses scoped styles | NO |
| `src/components/shell/AppShell.tsx` | V1 shell composition | FREEZE | Future `src/v2` shell | V2 final acceptance |
| `src/components/shell/TopBar.tsx` | V1 project/API top bar | FREEZE | Phase 1 V2 top bar | V2 final acceptance |
| `src/components/shell/LeftToolbar.tsx` | V1 persistent tool rail | FREEZE | Phase 1 bottom toolbar | V2 final acceptance |
| `src/components/shell/RightInspector.tsx` | V1 inspector/action launcher | FREEZE | Context panels in later phases | V2 final acceptance |
| `src/components/shell/BottomGallery.tsx` | V1 generation gallery | FREEZE | Asset/history UI in Phase 2+ | V2 final acceptance |
| `src/components/ui/Dialog.tsx` | Shared Radix dialog wrapper | KEEP | Reuse only where compatible | NO |

### Canvas engine and overlays

Current engine is tldraw `5.1.0`. The tldraw store is authoritative for shapes, while connections and generation metadata are also mirrored in Zustand.

| Current file | Role | Decision | V2 replacement | Delete after |
| --- | --- | --- | --- | --- |
| `src/components/canvas/TldrawCanvas.tsx` | Creates tldraw store, restores workspace, mounts overlays, syncs selection/connections | FREEZE | `src/v2/canvas/FzmCanvas.tsx` using XYFlow | V2 final acceptance |
| `src/components/canvas/AiConnectionShape.tsx` | Custom Bezier connection tldraw shape | FREEZE | V2 XYFlow edge components | V2 final acceptance |
| `src/components/canvas/CanvasInteractionOverlay.tsx` | Ports, node actions, context menus and status overlays | FREEZE | Phase 1-4 contextual V2 overlays | V2 final acceptance |
| `src/components/canvas/ConnectionPorts.tsx` | Viewport ports and drag-to-connect behavior | FREEZE | XYFlow handles and validated connect contract | V2 final acceptance |
| `src/components/canvas/BottomPromptBar.tsx` | Active V1 provider/model/prompt UI | FREEZE | Phase 4 contextual PromptBar | V2 final acceptance |
| `src/components/canvas/PromptComposerOverlay.tsx` | Older parallel prompt UI | DELETE LATER | One Phase 4 PromptBar | V2 final acceptance |
| `src/components/canvas/StatusSynchronizer.tsx` | Rewrites tldraw SVG status assets | FREEZE | Persistent Job state rendered by V2 nodes | V2 final acceptance |
| `src/lib/connection-system.ts` | Creates connection shapes plus mirrored records | FREEZE | V2 graph store plus edge validator | V2 final acceptance |
| `src/lib/canvas-actions.ts` | Creates prompt/result shapes and orchestrates generation | FREEZE | V2 Action/Generation services | V2 final acceptance |
| `src/lib/shape-helpers.ts` | Heuristic image and group reference resolution | FREEZE | Typed Asset + Reference Protocol | V2 final acceptance |
| `src/lib/store.ts` | V1 Zustand canvas/UI/provider cache | FREEZE | Scoped stores under `src/v2/stores` | V2 final acceptance |
| `src/types/index.ts` | V1 action, result, connection and selection types | FREEZE | `src/v2/types/domain.ts` | V2 final acceptance |

Connection creation currently accepts every top-level image/group port and stores each edge twice. It does not enforce self-edge, duplicate-edge or cycle rejection. V2 must use one canonical `CanvasEdge` representation and reject all three before mutation.

Reference resolution currently uses `sourceAssetId`/`sourceShapeId`, image size, filenames and shallow group traversal. This is frozen compatibility behavior, not the V2 domain model.

### Provider and generation path

| Current file | Role | Decision | V2 replacement | Delete after |
| --- | --- | --- | --- | --- |
| `src/lib/providers/types.ts` | V1 provider/model/request types | KEEP/FREEZE | V2 contracts wrap these in Phase 3 | After adapter migration and regression acceptance |
| `src/lib/providers/dispatcher.ts` | Client registry with only mock registered | FREEZE | One server-side `ProviderRegistry` | After Phase 3 acceptance |
| `src/lib/providers/mock.ts` | Local delayed SVG adapter | KEEP | Optional development adapter | NO decision in Phase 0 |
| `src/lib/providers/gptsapi-v3.ts` | Proven GPTsAPI async text-to-image path | KEEP UNCHANGED | Phase 3 `gptsapi` adapter wrapper | NO until regression parity |
| `src/lib/providers/gemini-native.ts` | Proven Gemini native generate/edit path | KEEP UNCHANGED | Phase 3 `gemini-native` wrapper | NO until regression parity |
| `src/lib/providers/openai-compatible.ts` | Proven OpenAI images generate/edit path, used by Moyu presets | KEEP UNCHANGED | Phase 3 `openai-compatible`/`moyu` wrappers | NO until regression parity |
| `src/lib/providers/model-presets.ts` | Moyu/GPTsAPI model and protocol presets | KEEP UNCHANGED | Phase 3 explicit `providerKind` catalog | NO until migration is validated |
| `src/lib/api-scheduler.ts` | In-memory two-worker queue and API dispatch | FREEZE | Persistent Job Engine | After Phase 3 acceptance |
| `src/app/api/providers/run/route.ts` | V1 generation routing by `endpointMode` | KEEP UNCHANGED | V2 registry route in Phase 3 | NO until regression parity |
| `src/app/api/providers/edit/route.ts` | V1 multipart edit routing | KEEP UNCHANGED | V2 registry route in Phase 3 | NO until regression parity |
| `src/app/api/settings/providers/route.ts` | Provider list/upsert | KEEP UNCHANGED | Phase 3 registry-backed settings | NO until settings migration |
| `src/app/api/settings/providers/[id]/route.ts` | Provider delete | KEEP UNCHANGED | Phase 3 registry-backed settings | NO until settings migration |
| `src/app/api/settings/test-provider/route.ts` | Provider connection test | KEEP UNCHANGED | `ProviderAdapter.test` | NO until regression parity |
| `src/lib/server/provider-config-store.ts` | JSON provider config persistence/test logic | KEEP UNCHANGED | SQLite `provider_configs` in Phase 3 | After secure migration/rollback path |
| `src/components/settings/ApiSettingsDialog.tsx` | V1 provider/API key UI | KEEP UNCHANGED | V2 settings surface after Phase 3 | NO until settings migration |

Real execution bypasses `dispatcher.ts`: the run/edit routes select implementations using model `endpointMode`. Model presets identify Moyu/GPTsAPI by `baseUrl + name` substring. V2 replaces both mechanisms with explicit `providerKind`, but Phase 0 does not touch them.

### Persistence and data

| Current file/path | Role | Decision | V2 replacement | Delete after |
| --- | --- | --- | --- | --- |
| `src/lib/workspace-persistence.ts` | Whole tldraw snapshot in localStorage, debounced 350 ms | FREEZE | Revision-checked SQLite project saves | After V2 import/rollback acceptance |
| `src/lib/indexed-db.ts` | Browser `assets` and `thumbnails` object stores | FREEZE | Filesystem Asset Store plus SQLite metadata | After asset migration acceptance |
| `data/provider-configs.json` | Ignored, potentially secret-bearing V1 config | PRESERVE/DO NOT READ OR COMMIT | `provider_configs` migration in Phase 3 | Only by approved migration/backup |
| `package.json` | V1 dependencies/scripts | KEEP; add XYFlow only | Shared manifest | NO |
| `package-lock.json` | Locked dependency graph | KEEP; generated XYFlow change only | Shared lockfile | NO |

V1 uses localStorage key `fzm-ai-studio:v0.4:workspace`, schema version 2, and IndexedDB database `fzm-ai-studio`, version 1. Pending V1 work is currently restored as completed; V2 must instead resume polling only when supported or mark it `interrupted`/`failed`.

## 2 Keep

- All proven GPTsAPI, Moyu/OpenAI-compatible and Gemini native implementations and their API routes.
- Provider API key data and ignored `data/provider-configs.json`.
- Model presets until Phase 3 adapters have regression parity.
- V1 `/` route and all V1 components until V2 final acceptance.
- Existing image generation, image edit, source image resolution and result insertion behavior as the regression baseline.
- Radix/Tailwind/Lucide utilities where they do not couple V2 to tldraw.

## 3 Freeze

- Entire `src/components/canvas/` directory.
- V1 shell and settings components.
- `src/lib/canvas-actions.ts`, `api-scheduler.ts`, `connection-system.ts`, `shape-helpers.ts`, `store.ts`, `workspace-persistence.ts`, and `indexed-db.ts`.
- All current provider implementations, routes, presets and config storage.
- V1 browser storage keys and schemas.

## 4 Replace

| Concern | Current | Replacement |
| --- | --- | --- |
| Canvas engine | tldraw custom shapes/overlays | `@xyflow/react` under `src/v2` |
| Node taxonomy | Shape/action-specific canvas artifacts | Six frozen V2 node types |
| References | `sourceAssetId` and heuristics | Ordered typed `Reference[]` |
| Graph | tldraw shape + Zustand duplicate | One persisted graph model |
| Prompt UI | Two divergent prompt components | One contextual PromptBar |
| Provider routing | `endpointMode` and keyword inference | `ProviderRegistry` + explicit `providerKind` |
| Jobs | In-memory scheduler | Persistent Job Engine with execution token |
| Results | Data URLs/provider URLs in shapes | Filesystem assets referenced by `assetId` |
| Persistence | localStorage + IndexedDB snapshot | SQLite metadata + filesystem assets + revisions |

## 5 Delete Later

No file is deleted in Phase 0. Candidates after final V2 acceptance are the V1 tldraw canvas/overlays, duplicated prompt composer, in-memory scheduler, heuristic shape helpers and browser workspace persistence. Deletion requires proven import, rollback and provider regressions first.

## 6 New V2 Modules

| New path | Phase 0 purpose |
| --- | --- |
| `src/app/v2/page.tsx` | Parallel V2 route; does not replace `/` |
| `src/v2/canvas/FzmCanvas.tsx` | Empty XYFlow canvas only |
| `src/v2/types/domain.ts` | Frozen domain interfaces and enums |
| `src/v2/db/schema.ts` | SQLite schema draft; not applied |
| `src/v2/providers/contracts.ts` | ProviderAdapter contract only |
| `src/v2/jobs/contracts.ts` | Execution identity/status/timeout contract |
| `src/v2/assets/contracts.ts` | Provider-output ingestion boundary |
| `src/v2/generation/reference.ts` | Ordered reference helper |
| `src/v2/edges/validation.ts` | Edge validation contract placeholder |
| `src/v2/nodes/contracts.ts` | Frozen six-node taxonomy |
| `src/v2/projects/contracts.ts` | Revision-aware save contract |
| `src/v2/workflows/contracts.ts` | Future importer contract only |
| `src/v2/stores/contracts.ts` | Immediate canvas UI state boundary |

## 7 Provider Migration

1. Preserve V1 routes and adapter files byte-for-byte through Phase 0-2.
2. Add explicit `providerKind`; never infer identity from provider name/base URL.
3. Wrap existing proven calls behind `ProviderAdapter` in Phase 3 without rewriting their protocols first.
4. Add adapter contract/regression tests for GPTsAPI generate, Moyu generate/edit, Gemini native generate/edit and OpenAI Images.
5. Move all provider status values into the unified Job states.
6. Keep endpoints, provider paths, polling URLs and protocol versions out of Canvas UI.
7. Migrate API keys server-side without returning raw keys or committing credential data.

## 8 Asset Migration

V1 media remains untouched in IndexedDB. Phase 2 will introduce `data/assets/{images,videos,audio,documents}` and `data/thumbnails`. Import must copy bytes, verify MIME, hash content, create metadata/thumbnail, then commit the Asset row. Third-party URLs are download sources only. Nodes and generations store `assetId`; original assets remain authoritative and thumbnails are derived.

## 9 Persistence Migration

Phase 0 defines but does not apply the SQLite schema. Phase 2 will add `data/fzm.db`, cursor pagination, debounced optimistic saves carrying `revision`, and conflict responses when the expected revision is stale. V1 snapshots remain readable during rollout. Migration must be additive, backed up, idempotent and reversible before V1 storage is retired.

## 10 Daxiong Bridge

Read-only upstream clone: `D:\workspace\daxiong-infinite-canvas-upstream` at `67f49e4b9a0ac090bad1f5bd62ae385f8fb5394e`.

Do not modify upstream or copy its UI. Phase 5 introduces an FZM-owned HTTP bridge boundary for `DaxiongComfyAdapter`, `DaxiongRunningHubAdapter`, `DaxiongWorkflowAdapter` and `DaxiongMediaToolAdapter`. A bridge response is a task/result source only; all completed output must pass through the FZM Asset Pipeline.

## 11 Reference Projects

| Project | Relevant adoption | Constraint |
| --- | --- | --- |
| `hero8152/Infinite-Canvas` | FastAPI capabilities, RunningHub/ComfyUI/workflows, media tools, WebSocket experience | Restrictive/custom license; bridge only; upstream discontinued; never copy giant UI scripts |
| `T8mars/T8-penguin-canvas` | Execution identity, paid-submit recovery, timeout and large-canvas performance | MIT notice required for copied code; adopt invariants, not broad node taxonomy |
| `JH8909/libtV-studio` | Spatial interaction contract, typed references, cycle rejection, dependency execution | License not verified; use behavior as specification, not source copy |
| `BlockRunAI/franklin-canvas` | Contextual PromptBar, action UX, identity-scoped hydration | Apache-2.0 attribution for copied source; avoid timestamp persistence |
| `BeatAPI/BeatDesign` | Asset-first model, revision/CAS writes, command semantics | Apache-2.0 attribution for copied source |
| `ZeroLu/open-canvas` | Minimal provider/storage boundaries, local-first reference | MIT notice for copied code; JSON/cookie persistence is not V2 target |
| `basketikun/infinite-canvas` | Derived thumbnails, original/preview separation, plugin/agent approval patterns | MIT notice for copied code; browser secrets are not V2 target |

No reference source was copied in Phase 0.

## 12 Risks

1. V1 has two provider-routing systems; the nominal registry contains only mock while real routes dispatch by `endpointMode`.
2. V1 graph/action/result identities diverge and connection state has two authorities.
3. V1 async tasks are memory-only and running tasks are falsely restored as completed.
4. Provider output URLs/data can remain non-durable; V2 migration must not lose existing IndexedDB media.
5. Provider configuration writes and API routes lack the security/revision guarantees required by V2.
6. No repository-owned automated tests exist, so Phase 3 must establish provider regression fixtures before migration.
7. Daxiong is discontinued and restrictively licensed; capability use must remain an external bridge.

## 13 Rollback

- `/` remains the V1 entry; `/v2` is additive.
- V1 files, storage keys, API routes and provider config file are untouched.
- To disable Phase 0 V2, remove only `src/app/v2`, `src/v2`, the two V2 docs and `@xyflow/react` dependency changes.
- No SQLite database is opened and no production data is migrated in Phase 0.
- No remote branch, commit, deployment or upstream modification is made.

## 14 Phase Plan

- Phase 0: audit, contracts, empty XYFlow route and schema draft only.
- Phase 1: RunningHub/LibTV canvas shell and core graph interactions.
- Phase 2: Project, Asset, SQLite, thumbnails, ingestion, pagination and revision saves.
- Phase 3: ProviderRegistry, persistent Job Engine, execution tokens and existing provider adapters.
- Phase 4: Contextual PromptBar, Action Picker, typed references, Best-of-N and dependencies.
- Phase 5: Daxiong bridge, ComfyUI, RunningHub and workflow import.
- Phase 6: Mask, outpaint, loop, batch, video and H3.
- Phase 7: Beauty workflows/skills/presets/actions.
- Phase 8: Timeline, Agent and MCP.

Phase 1 does not start without explicit human approval.
