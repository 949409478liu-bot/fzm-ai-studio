import { expect, test, type Page } from "@playwright/test";

const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

async function createProject(page: Page) {
  await page.goto("/v2");
  await expect(page.getByLabel("FZM AI Studio projects")).toBeVisible();
  await page.getByRole("button", { name: /新建画布/ }).click();
  await expect(page.getByLabel("FZM AI Studio 2.0 canvas")).toBeVisible();
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
