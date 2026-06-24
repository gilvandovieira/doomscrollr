// Mobile browser smoke for the v1 validation loop. It drives the React app
// against the real API harness using the gated test-auth seam.

import { type Browser, type BrowserContextOptions, chromium, type Page } from "npm:playwright";
import {
  assert,
  assertEquals,
  e2eTest,
  getHarness,
  POSTS,
  TEST_AUTH_STORAGE_KEY,
  USERS,
} from "./harness.ts";

const E2E_IMAGE_URL = "https://e2e.invalid/doomscrollr.png";
const BROWSER_CLERK_ID = "clerk_e2e_browser_user";
const BROWSER_USERNAME = "browser_newbie";

e2eTest(
  "mobile authenticated UI smoke covers create, discuss, react, report, and block",
  async () => {
    const chromePath = findChrome();
    if (!chromePath) {
      console.warn("Skipping browser smoke: Chrome/Chromium executable was not found.");
      return;
    }

    const webPort = await getFreePort();
    const webOrigin = `http://127.0.0.1:${webPort}`;
    Deno.env.set("WEB_ORIGIN", webOrigin);
    const { baseUrl } = await getHarness();
    const vite = startVite(webPort, baseUrl);

    try {
      await waitForHttp(webOrigin);

      const browser = await chromium.launch({ headless: true, executablePath: chromePath });
      try {
        await assertPostRoute(browser, webOrigin, `/p/${POSTS.fridayText.code}`, {
          viewport: { width: 1280, height: 800 },
        });
        await assertPostRoute(
          browser,
          webOrigin,
          `/p/${POSTS.fridayText.code}/${POSTS.fridayText.slug}`,
          {
            viewport: { width: 390, height: 844 },
            deviceScaleFactor: 2,
            isMobile: true,
          },
        );

        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
          isMobile: true,
        });
        await context.addInitScript(
          ({ storageKey, clerkId }) => localStorage.setItem(storageKey, clerkId),
          { storageKey: TEST_AUTH_STORAGE_KEY, clerkId: BROWSER_CLERK_ID },
        );
        const page = await context.newPage();

        await page.goto(`${webOrigin}/create`, { waitUntil: "networkidle" });
        await page.getByRole("heading", { name: "Pick your @handle" }).waitFor();
        await page.getByPlaceholder("lucas").fill(BROWSER_USERNAME);
        await page.getByRole("button", { name: "Claim" }).click();
        await page.getByRole("heading", { name: "Pick your @handle" }).waitFor({
          state: "detached",
        });

        await createTextPost(page);
        await page.getByRole("button", { name: "Copy link" }).click();
        await page.getByPlaceholder("Add a comment").fill("Browser smoke comment.");
        await page.getByRole("button", { name: "Comment" }).click();
        await page.getByText("Browser smoke comment.").waitFor();
        await page.getByRole("button", { name: "Upvote" }).click();
        await page.getByRole("button", { name: "Report" }).first().click();
        await page.getByRole("button", { name: "spam" }).click();
        await page.getByText("Reported").waitFor();

        await page.goto(`${webOrigin}/create`, { waitUntil: "networkidle" });
        await createImagePost(page);

        await page.goto(`${webOrigin}/create`, { waitUntil: "networkidle" });
        await createYouTubePost(page);

        await page.goto(`${webOrigin}/@${USERS.ren.username}`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Block" }).click();
        await page.getByRole("button", { name: "Unblock" }).waitFor();

        const overflow = await page.evaluate(
          "document.documentElement.scrollWidth > window.innerWidth",
        );
        assertEquals(overflow, false, "mobile viewport should not horizontally overflow");
        await context.close();
      } finally {
        await browser.close();
      }
    } finally {
      vite.kill("SIGTERM");
      await vite.status.catch(() => undefined);
    }
  },
);

async function createTextPost(page: Page) {
  await page.getByLabel("Title").fill("Browser text smoke");
  await page.getByLabel("Body").fill("Created from the mobile smoke test.");
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("heading", { name: "Browser text smoke" }).waitFor();
  assert(page.url().includes("/p/"), `expected post detail URL after publish, got ${page.url()}`);
}

async function createImagePost(page: Page) {
  await page.getByRole("button", { name: "Image link" }).click();
  await page.getByLabel("Title").fill("Browser image smoke");
  await page.getByLabel("Image URL").fill(E2E_IMAGE_URL);
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("heading", { name: "Browser image smoke" }).waitFor();
}

async function createYouTubePost(page: Page) {
  await page.getByRole("button", { name: "YouTube" }).click();
  await page.getByLabel("Title").fill("Browser YouTube smoke");
  await page.getByLabel("YouTube URL").fill("https://www.youtube.com/shorts/jNQXAC9IVRw");
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("heading", { name: "Browser YouTube smoke" }).waitFor();
}

async function getFreePort(): Promise<number> {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}

function startVite(port: number, apiBaseUrl: string): Deno.ChildProcess {
  const root = new URL("../../..", import.meta.url).pathname;
  const command = new Deno.Command("deno", {
    args: [
      "task",
      "--cwd",
      "apps/web",
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    cwd: root,
    env: {
      VITE_API_URL: apiBaseUrl,
      VITE_E2E_AUTH: "1",
    },
    stdout: "null",
    stderr: "null",
  });

  return command.spawn();
}

async function assertPostRoute(
  browser: Browser,
  webOrigin: string,
  path: string,
  options: BrowserContextOptions,
) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  try {
    await page.goto(`${webOrigin}${path}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "When prod breaks on Friday" }).waitFor();
    const overflow = await page.evaluate(
      "document.documentElement.scrollWidth > window.innerWidth",
    );
    assertEquals(overflow, false, `${path} should not horizontally overflow`);
  } finally {
    await context.close();
  }
}

async function waitForHttp(origin: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // Server not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${origin}`);
}

function findChrome(): string | null {
  const candidates = [
    Deno.env.get("CHROME_PATH"),
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      if (Deno.statSync(candidate).isFile) return candidate;
    } catch {
      // Keep looking.
    }
  }
  return null;
}
