import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

async function createProject(page: Page) {
  await page.goto("/v2");
  await expect(page.getByLabel("FZM AI Studio projects")).toBeVisible();
  await page.getByRole("button", { name: /新建画布/ }).click();
  await expect(page.getByLabel("FZM AI Studio 2.0 canvas")).toBeVisible();
}

async function uniquePng(index: number) {
  return sharp({ create: { width: 2, height: 2, channels: 3, background: { r: index % 255, g: (index * 3) % 255, b: (index * 7) % 255 } } }).png().toBuffer();
}

async function createTextNode(page: Page, body: string) {
  await page.locator(".react-flow__pane").dblclick({ position: { x: 520, y: 300 } });
  await page.getByRole("menu").getByRole("button", { name: "Text" }).click();
  await page.locator("textarea").last().fill(body);
}

async function projectIdFromUrl(page: Page) {
  return new URL(page.url()).searchParams.get("project")!;
}

async function fetchCanvas(page: Page, projectId: string) {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/v2/projects/${id}/canvas`, { cache: "no-store" });
    if (!response.ok) throw new Error(`canvas_fetch_failed_${response.status}`);
    return response.json() as Promise<{ revision: number; nodes: Array<{ data: Record<string, unknown> }> }>;
  }, projectId);
}

test("V2 durable project canvas and asset interactions", async ({ page }) => {
  await createProject(page);
  await page.waitForTimeout(500);

  await page.evaluate(() => { (window as typeof window & { __FZM_V2_CATALOG_OPEN_COUNT?: number }).__FZM_V2_CATALOG_OPEN_COUNT = 0; });
  await page.locator(".react-flow__pane").dblclick({ position: { x: 520, y: 300 } });
  await expect(page.getByRole("menu")).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __FZM_V2_CATALOG_OPEN_COUNT?: number }).__FZM_V2_CATALOG_OPEN_COUNT)).toBe(1);
  await page.getByRole("menu").getByRole("button", { name: "Text" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);

  await page.locator("textarea").fill("Phase 2 durable text");
  for (let index = 0; index < 10; index += 1) {
    await page.getByLabel("Add").click();
    await page.getByRole("button", { name: "Image" }).click();
  }
  await expect(page.locator(".react-flow__node")).toHaveCount(11);
  const transforms = await page.locator(".react-flow__node").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).style.transform));
  expect(new Set(transforms).size).toBe(11);

  await page.getByRole("button", { name: /Assets/ }).click();
  await expect(page.getByLabel("Asset drawer")).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({ name: "tiny.png", mimeType: "image/png", buffer: Buffer.from(pngBase64, "base64") });
  await expect(page.locator(".fzm-asset-card img")).toBeVisible();
  await page.locator(".fzm-asset-card").first().dblclick();
  await expect(page.locator(".react-flow__node img.fzm-node-image")).toBeVisible();

  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByLabel("FZM AI Studio 2.0 canvas")).toBeVisible();
  await expect(page.getByText("Phase 2 durable text")).toBeVisible();
  await expect(page.locator(".react-flow__node img.fzm-node-image")).toBeVisible();

  await page.evaluate((base64) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const file = new File([bytes], "paste.png", { type: "image/png" });
      const data = new DataTransfer();
      data.items.add(file);
      document.querySelector("main")?.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    }, pngBase64);
  await expect.poll(() => page.locator(".react-flow__node img.fzm-node-image").count()).toBeGreaterThan(1);
});

test("V2 project navigation and rename persist", async ({ page }) => {
  await createProject(page);
  const projectUrl = page.url();
  await createTextNode(page, "fast back preserved");
  await page.getByLabel("Back").click();
  await expect(page.getByLabel("FZM AI Studio projects")).toBeVisible();
  await page.goto(projectUrl);
  await expect(page.getByText("fast back preserved")).toBeVisible();
  await page.getByLabel("Back").click();
  await expect(page.getByLabel("FZM AI Studio projects")).toBeVisible();
  page.once("dialog", async (dialog) => { await dialog.accept("Renamed Phase 2.1"); });
  await page.getByRole("button", { name: /Rename/ }).first().click();
  await expect(page.getByText("Renamed Phase 2.1")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Renamed Phase 2.1")).toBeVisible();
  await page.goto(projectUrl);
  await expect(page.getByLabel("FZM AI Studio 2.0 canvas")).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("FZM AI Studio projects")).toBeVisible();
  await page.goForward();
  await expect(page.getByLabel("FZM AI Studio 2.0 canvas")).toBeVisible();
});

test("V2 browser conflict lock rejects stale overwrite and reload latest recovers", async ({ page, context }) => {
  await createProject(page);
  const projectUrl = page.url();
  const projectId = await projectIdFromUrl(page);
  const stalePage = await context.newPage();
  await stalePage.goto(projectUrl);
  await expect(stalePage.getByLabel("FZM AI Studio 2.0 canvas")).toBeVisible();

  await createTextNode(page, "authoritative A");
  await expect.poll(async () => (await fetchCanvas(page, projectId)).revision).toBe(1);

  await createTextNode(stalePage, "stale B");
  await expect(stalePage.getByText(/Conflict · rev 0/)).toBeVisible();

  await stalePage.locator("textarea").last().fill("stale B edited again");
  await stalePage.waitForTimeout(900);
  const afterStaleEdit = await fetchCanvas(page, projectId);
  expect(afterStaleEdit.revision).toBe(1);
  expect(JSON.stringify(afterStaleEdit.nodes)).toContain("authoritative A");
  expect(JSON.stringify(afterStaleEdit.nodes)).not.toContain("stale B edited again");

  await stalePage.getByRole("button", { name: "Reload latest" }).click();
  await expect(stalePage.getByText("authoritative A")).toBeVisible();
  await expect(stalePage.getByText(/Saved · rev 1/)).toBeVisible();

  await stalePage.locator("textarea").last().fill("B after reload");
  await expect.poll(async () => (await fetchCanvas(stalePage, projectId)).revision).toBe(2);
  await expect.poll(async () => JSON.stringify((await fetchCanvas(stalePage, projectId)).nodes)).toContain("B after reload");
  await stalePage.close();
});

test("V2 browser popstate flushes fast edits before Back navigation", async ({ page }) => {
  await createProject(page);
  const projectUrl = page.url();
  await createTextNode(page, "browser back durable");
  await page.goBack();
  await expect(page.getByLabel("FZM AI Studio projects")).toBeVisible();
  await page.goto(projectUrl);
  await expect(page.getByText("browser back durable")).toBeVisible();
});

test("V2 canvas move undo edge 100 reload and file drop", async ({ page }) => {
  await createProject(page);
  await createTextNode(page, "move me");
  await page.getByLabel("Add").click();
  await page.getByRole("button", { name: "Image" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);

  const firstHeader = page.locator(".react-flow__node .drag-handle").first();
  const before = await page.locator(".react-flow__node").first().evaluate((node) => (node as HTMLElement).style.transform);
  const headerBox = await firstHeader.boundingBox();
  expect(headerBox).not.toBeNull();
  await page.mouse.move(headerBox!.x + headerBox!.width / 2, headerBox!.y + headerBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(headerBox!.x + 180, headerBox!.y + 120, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => page.locator(".react-flow__node").first().evaluate((node) => (node as HTMLElement).style.transform)).not.toBe(before);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+Z" : "Control+Z");
  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect.poll(() => page.locator(".react-flow__node").first().evaluate((node) => (node as HTMLElement).style.transform)).toBe(before);

  const source = await page.locator(".fzm-handle--output").first().boundingBox();
  const target = await page.locator(".fzm-handle--input").nth(1).boundingBox();
  if (source && target) {
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await page.waitForTimeout(900);
    await page.reload();
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  }

  const buffer = Buffer.from(pngBase64, "base64");
  await page.evaluate((bytes) => {
    const file = new File([Uint8Array.from(bytes)], "drop.png", { type: "image/png" });
    const data = new DataTransfer();
    data.items.add(file);
    const pane = document.querySelector(".react-flow__pane");
    pane?.dispatchEvent(new DragEvent("drop", { dataTransfer: data, bubbles: true, cancelable: true, clientX: 600, clientY: 360 }));
  }, Array.from(buffer));
  await expect(page.locator(".react-flow__node img.fzm-node-image")).toBeVisible();

  await page.getByRole("button", { name: "Seed 100" }).click();
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(100);
});

test("V2 asset drawer load more exposes assets beyond 50", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: /Assets/ }).click();
  await expect(page.getByLabel("Asset drawer")).toBeVisible();
  const input = page.locator("input[type=file]");
  for (let batch = 0; batch < 3; batch += 1) {
    const files = [];
    for (let index = 0; index < 20; index += 1) {
      const id = batch * 20 + index;
      files.push({ name: `asset-${id}.png`, mimeType: "image/png", buffer: await uniquePng(id + 1) });
    }
    await input.setInputFiles(files);
    await page.waitForTimeout(500);
  }
  await expect(page.locator(".fzm-asset-card")).toHaveCount(50);
  await page.getByRole("button", { name: "Load More" }).click();
  await expect.poll(() => page.locator(".fzm-asset-card").count()).toBeGreaterThan(50);
  await expect(page.getByText("asset-59.png")).toBeVisible();
});
