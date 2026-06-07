const DATABASE_NAME = "fzm-ai-studio";
const DATABASE_VERSION = 1;
const ASSET_STORE = "assets";
const THUMBNAIL_STORE = "thumbnails";

type StoredMedia = {
  key: string;
  value: Blob | string;
  updatedAt: number;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ASSET_STORE)) {
        database.createObjectStore(ASSET_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(THUMBNAIL_STORE)) {
        database.createObjectStore(THUMBNAIL_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("IndexedDB 数据库被其他页面占用"));
  });
}

async function normalizeMedia(source: string) {
  if (source.startsWith("data:") || source.startsWith("blob:")) {
    const response = await fetch(source);
    if (!response.ok) throw new Error("无法读取图片数据");
    return response.blob();
  }
  return source;
}

async function createThumbnailMedia(source: string) {
  const media = await normalizeMedia(source);
  if (!(media instanceof Blob) || !media.type.startsWith("image/")) {
    return media;
  }

  const bitmap = await createImageBitmap(media);
  const scale = Math.min(1, 320 / bitmap.width, 240 / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return media;
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return (
    (await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.78)
    )) ?? media
  );
}

async function putMedia(
  storeName: typeof ASSET_STORE | typeof THUMBNAIL_STORE,
  key: string,
  source: string,
  createThumbnail = false
) {
  const database = await openDatabase();
  const value = createThumbnail
    ? await createThumbnailMedia(source)
    : await normalizeMedia(source);

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put({
      key,
      value,
      updatedAt: Date.now(),
    } satisfies StoredMedia);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

async function getMedia(
  storeName: typeof ASSET_STORE | typeof THUMBNAIL_STORE,
  key: string
) {
  const database = await openDatabase();

  return new Promise<string | null>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => {
      const record = request.result as StoredMedia | undefined;
      database.close();
      if (!record) {
        resolve(null);
      } else if (record.value instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(record.value);
      } else {
        resolve(record.value);
      }
    };
    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  });
}

export function saveAssetMedia(key: string, source: string) {
  return putMedia(ASSET_STORE, key, source);
}

export function loadAssetMedia(key: string) {
  return getMedia(ASSET_STORE, key);
}

export function saveThumbnail(key: string, source: string) {
  return putMedia(THUMBNAIL_STORE, key, source, true);
}

export function loadThumbnail(key: string) {
  return getMedia(THUMBNAIL_STORE, key);
}

async function pruneStore(storeName: string, activeKeys: Set<string>) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      for (const key of request.result) {
        if (typeof key === "string" && !activeKeys.has(key)) {
          store.delete(key);
        }
      }
    };
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export function pruneStoredMedia(
  assetKeys: Iterable<string>,
  thumbnailKeys: Iterable<string>
) {
  return Promise.all([
    pruneStore(ASSET_STORE, new Set(assetKeys)),
    pruneStore(THUMBNAIL_STORE, new Set(thumbnailKeys)),
  ]);
}
