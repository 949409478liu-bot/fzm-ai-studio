# FZM AI Studio 2.0 Architecture Contract

Status: Phase 0 frozen contract  
Date: 2026-09-18

This document defines module boundaries and invariants. Phase 0 implements only the empty `/v2` canvas and compile-time/schema drafts.

## Frontend

- React 19 + TypeScript remain the application runtime.
- Tailwind/Radix/Lucide may be reused without importing V1 canvas behavior.
- `/` remains V1. `/v2` is the isolated V2 entry until final acceptance.
- Zustand owns immediate UI/canvas state. Durable server data is not sourced from Zustand.
- Server data may use TanStack Query in a later approved phase.
- Panels are contextual; no persistent provider/debug panel is part of the canvas contract.

## Canvas

- Engine: `@xyflow/react`.
- Canonical nodes: `TextNode`, `ImageNode`, `VideoNode`, `AudioNode`, `WorkflowNode`, `GroupNode` only.
- Actions and providers never become node types.
- Canonical edges are persisted once. XYFlow state is a projection of domain nodes/edges.
- Connecting rejects self edges, duplicate edges and graph cycles before persistence.
- Edge states are `ready`, `running`, `missing-input`, `failed`, `disabled`.
- Images render thumbnails by default, lazy/async, and originals load only in viewport or above a high-resolution zoom threshold.
- Large lists use cursor pagination; large canvases use viewport-aware rendering.

## Provider

One server-side `ProviderRegistry` owns all adapters. Canvas code submits an action/capability request and does not inspect endpoint paths, protocol names or provider polling details.

```ts
interface ProviderAdapter {
  test(config: ProviderConfig): Promise<void>;
  listModels(config: ProviderConfig): Promise<ProviderModel[]>;
  submit(request: ProviderRequest): Promise<ProviderTicket>;
  poll(ticket: ProviderTicket): Promise<ProviderTicket>;
  cancel?(ticket: ProviderTicket): Promise<void>;
  fetchResult(ticket: ProviderTicket): Promise<ProviderResult>;
}
```

Provider identity is explicit through `providerKind`: `gptsapi`, `moyu`, `openai-compatible`, `gemini-native`, `runninghub`, `daxiong-bridge`, `z-api`, `anyu`, or `custom`. Keyword inference is prohibited.

Existing GPTsAPI, Moyu/OpenAI-compatible and Gemini implementations are wrapped in Phase 3 before any rewrite. Every wrapper requires regression parity with the V1 route.

## Job

Every long image/video operation creates a persistent Job. Normal states are `queued → preparing → submitting → polling → downloading → finalizing → succeeded`. Terminal/error states include `failed`, `canceled`, `rate_limited`, `provider_busy`, and `interrupted`.

Every run has `{ canvasId, nodeId, executionToken }`. A completion may mutate the node only when its token matches the node's current execution token. A late token can finalize its immutable Generation/Assets but cannot overwrite a newer node selection.

Adapters normalize remote statuses. Ambiguous tasks are never resubmitted automatically. On restart, a resumable task continues polling by `remoteTaskId`; a non-resumable active task becomes `interrupted` or `failed`, never `succeeded`.

Timeout policy: LLM operations are bounded near three minutes. Media operations are at least fifteen minutes. Video/long-job adapters may extend their own timeout. No universal 90-second timeout is allowed.

## Asset

Asset is a first-class immutable entity. Nodes reference `assetId`; generations reference ordered output asset IDs. Provider URLs and base64 are transport formats, not persistence.

Ingestion order is mandatory:

`download/decode → MIME verify → filesystem write → SHA-256 → metadata → thumbnail → Asset row`

The filesystem root is `data/assets` with `images`, `videos`, `audio`, and `documents`; derived previews use `data/thumbnails`. SQLite stores paths and metadata, never large media BLOBs. A failure before database commit must clean only files created by that failed transaction.

Best-of-N produces one Generation, N immutable output Assets and one node with `selectedVariantIndex`. Downstream execution resolves the selected asset at execution time.

## Persistence

SQLite is authoritative for projects, assets, nodes, edges, generations, jobs, workflows and provider configs. The filesystem is authoritative for media bytes/workflow documents. V1 localStorage/IndexedDB remain isolated until an approved migration.

Canvas edits use optimistic UI, debounced server writes and an expected `revision`. A stale revision returns a conflict; it never overwrites newer state. Incremental stable-ID mutations are preferred over whole-project replacement.

Schema migration rules:

- Version every migration and apply it transactionally.
- Back up user data before destructive conversion.
- Make imports idempotent and retain source V1 storage through acceptance.
- Never store or log raw API keys in client responses.
- Persist provider configs server-side; secrets must remain outside Git.

## Daxiong Bridge

Daxiong remains an independent FastAPI Capability Engine. FZM communicates over a versioned HTTP bridge and does not import Daxiong UI/state or write into its permanent asset namespace.

Initial bridge boundaries for Phase 5 are `DaxiongComfyAdapter`, `DaxiongRunningHubAdapter`, `DaxiongWorkflowAdapter`, and `DaxiongMediaToolAdapter`. Each returns a remote task/result handle. FZM persists the Job, polls through the adapter, ingests output into the FZM Asset Store and records lineage.

Upstream is read-only. Current audit clone: `D:\workspace\daxiong-infinite-canvas-upstream`, commit `67f49e4b9a0ac090bad1f5bd62ae385f8fb5394e`.

## Reference Protocol

```ts
interface Reference {
  assetId: string;
  role:
    | "reference-image"
    | "first-frame"
    | "last-frame"
    | "reference-video"
    | "reference-audio"
    | "person-identity"
    | "product-identity"
    | "composition"
    | "lighting"
    | "texture"
    | "haircolor";
  order: number;
}
```

`sourceAssetId` is V1 compatibility data only. V2 actions, generations, workflow inputs and future Visual Director features consume the same ordered `Reference[]` contract. An edge role maps to a Reference role but does not replace the immutable Generation snapshot.

## Generation Lifecycle

1. Resolve node inputs and the currently selected variant into ordered references.
2. Resolve action capability. An ImageNode with no references requests `image.generate`; one with references requests `image.edit`.
3. Resolve provider/model through the registry and validate capability.
4. Create immutable Generation and queued Job with a new execution token.
5. Submit once; persist the remote task ID before polling.
6. Normalize polling status and progress into the Job.
7. Download/decode every output through the Asset Pipeline.
8. Finalize Generation output asset IDs and selected variant.
9. Update the node only if the execution token remains current.
10. Persist terminal Job status and retain full traceability.

Generation records are historical facts. Re-run creates a new Generation and Job; it does not mutate the previous record.

## Interaction Contract

- Full-screen background is `#0B0B0C` with a subtle dot grid; canvas occupies more than 90% of the viewport.
- Top bar is compact: back, product/project identity, save state, contextual Model/API, Assets, Timeline and Agent entry points. Timeline/Agent implementation is deferred.
- Bottom toolbar is centered and floating with add, hand/select, undo/redo, run all, fit, zoom and help.
- Double-click blank canvas opens Add Node Catalog.
- Right-click blank canvas opens Add Node, Fit, Select, Hand and Assets.
- Mouse wheel zooms around the pointer. Space + drag temporarily pans.
- Node header drag moves the node. Node context menu provides Run/Re-run, Duplicate, Disconnect, Inspect and Delete.
- Node toolbar, handles and highlight appear only on hover/selection.
- Output handle to blank canvas opens an asset-aware Action Picker, then creates a target node and opens the contextual PromptBar.
- PromptBar exposes references, prompt, provider, model, ratio, resolution/quality, count and Generate only. Protocol/endpoints/polling internals are prohibited.
- Best-of-N remains one node with a main preview and filmstrip; keeper selection controls downstream propagation.
- Provider, Job, Workflow, Timeline, Agent and beauty-domain concerns do not leak into Canvas node taxonomy.

## Phase Boundaries

Phase 0 contains contracts and an empty XYFlow canvas only. Phase 1 may implement canvas shell interactions, but not persistence/provider/job/workflow/PromptBar/Timeline/Agent features. Each later phase requires its own acceptance and must leave `/` operational until final V2 approval.
