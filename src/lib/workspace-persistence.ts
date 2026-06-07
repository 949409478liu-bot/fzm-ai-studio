import type { Editor, TLRecord } from "@tldraw/tldraw";
import type { StoreSnapshot } from "@tldraw/store";
import { useStudioStore } from "./store";
import {
  loadAssetMedia,
  loadThumbnail,
  pruneStoredMedia,
  saveAssetMedia,
  saveThumbnail,
} from "./indexed-db";
import type {
  CanvasAction,
  CanvasConnection,
  GalleryResult,
} from "@/types";

const WORKSPACE_KEY = "fzm-ai-studio:v0.4:workspace";

type PersistedResult = Omit<GalleryResult, "imageUrl"> & {
  thumbnailKey?: string;
};

type WorkspaceSnapshotV1 = {
  version: 1;
  tldraw: StoreSnapshot<TLRecord>;
  results: GalleryResult[];
  connections: CanvasConnection[];
  actions: CanvasAction[];
};

type WorkspaceSnapshotV2 = {
  version: 2;
  tldraw: StoreSnapshot<TLRecord>;
  assetKeys: Record<string, string>;
  results: PersistedResult[];
  connections: CanvasConnection[];
  actions: CanvasAction[];
};

function cloneSnapshot(snapshot: StoreSnapshot<TLRecord>) {
  return structuredClone(snapshot);
}

async function createLightweightSnapshot(editor: Editor) {
  const snapshot = cloneSnapshot(editor.store.getStoreSnapshot("all"));
  const assetKeys: Record<string, string> = {};
  const mediaWrites: Promise<void>[] = [];

  for (const record of Object.values(snapshot.store)) {
    if (
      record.typeName !== "asset" ||
      (record.type !== "image" && record.type !== "video")
    ) {
      continue;
    }

    const source = record.props.src;
    if (!source) continue;
    const key = `asset:${record.id}`;
    assetKeys[record.id] = key;
    mediaWrites.push(saveAssetMedia(key, source));
    record.props.src = null;
  }

  await Promise.all(mediaWrites);
  return { snapshot, assetKeys };
}

async function restoreAssetSources(
  snapshot: StoreSnapshot<TLRecord>,
  assetKeys: Record<string, string>
) {
  const restored = cloneSnapshot(snapshot);

  await Promise.all(
    Object.entries(assetKeys).map(async ([assetId, key]) => {
      const record =
        restored.store[assetId as keyof typeof restored.store];
      if (!record || record.typeName !== "asset") return;
      const source = await loadAssetMedia(key);
      if (!source) throw new Error(`缺少图片资源：${key}`);
      record.props.src = source;
    })
  );

  return restored;
}

function restoreActions(actions: CanvasAction[]) {
  return actions.map((action) =>
    action.status === "queued" || action.status === "running"
      ? { ...action, status: "completed" as const }
      : action
  );
}

export async function restoreWorkspace(editor: Editor) {
  const raw = window.localStorage.getItem(WORKSPACE_KEY);
  if (!raw) return false;

  try {
    const saved = JSON.parse(raw) as WorkspaceSnapshotV1 | WorkspaceSnapshotV2;

    if (saved.version === 1) {
      editor.store.loadStoreSnapshot(saved.tldraw);
      useStudioStore.setState({
        results: saved.results ?? [],
        connections: saved.connections ?? [],
        actions: restoreActions(saved.actions ?? []),
      });
      return true;
    }

    if (saved.version !== 2) return false;

    let restoredSnapshot = saved.tldraw;
    let mediaFailed = false;
    try {
      restoredSnapshot = await restoreAssetSources(
        saved.tldraw,
        saved.assetKeys ?? {}
      );
    } catch (error) {
      mediaFailed = true;
      console.warn("IndexedDB 图片读取失败。", error);
    }

    const results = await Promise.all(
      (saved.results ?? []).map(async (result) => {
        if (!result.thumbnailKey) return { ...result, imageUrl: "" };
        try {
          const imageUrl = await loadThumbnail(result.thumbnailKey);
          if (!imageUrl) {
            mediaFailed = true;
            return { ...result, imageUrl: "" };
          }
          return {
            ...result,
            imageUrl,
          };
        } catch (error) {
          mediaFailed = true;
          console.warn("IndexedDB 缩略图读取失败。", error);
          return { ...result, imageUrl: "" };
        }
      })
    );

    editor.store.loadStoreSnapshot(restoredSnapshot);
    useStudioStore.setState({
      results,
      connections: saved.connections ?? [],
      actions: restoreActions(saved.actions ?? []),
    });

    if (mediaFailed) {
      window.alert("部分本地图片读取失败，画布结构已恢复。请重新导入缺失图片。");
    }
    return true;
  } catch (error) {
    console.warn("无法恢复本地工作区，已使用空白画布。", error);
    window.alert("本地工作区恢复失败，已为你打开空白画布。");
    return false;
  }
}

export function setupWorkspacePersistence(editor: Editor) {
  let timer: number | null = null;
  let saveVersion = 0;

  const save = () => {
    if (timer) window.clearTimeout(timer);
    const version = ++saveVersion;
    timer = window.setTimeout(async () => {
      const { results, connections, actions } = useStudioStore.getState();

      try {
        const { snapshot, assetKeys } = await createLightweightSnapshot(editor);
        if (version !== saveVersion) return;

        const persistedResults: PersistedResult[] = await Promise.all(
          results.map(async ({ imageUrl, ...result }) => {
            if (!imageUrl) return result;
            const thumbnailKey = `thumbnail:${result.id}`;
            await saveThumbnail(thumbnailKey, imageUrl);
            return { ...result, thumbnailKey };
          })
        );
        if (version !== saveVersion) return;
        await pruneStoredMedia(
          Object.values(assetKeys),
          persistedResults.flatMap((result) =>
            result.thumbnailKey ? [result.thumbnailKey] : []
          )
        );
        if (version !== saveVersion) return;

        const workspace: WorkspaceSnapshotV2 = {
          version: 2,
          tldraw: snapshot,
          assetKeys,
          results: persistedResults,
          connections,
          actions,
        };
        window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
      } catch (error) {
        console.warn("本地工作区保存失败。", error);
      }
    }, 350);
  };

  const stopStoreListener = editor.store.listen(save);
  const stopStateListener = useStudioStore.subscribe(save);
  save();

  return () => {
    if (timer) window.clearTimeout(timer);
    stopStoreListener();
    stopStateListener();
  };
}
