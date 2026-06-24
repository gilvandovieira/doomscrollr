// Mobile browser smoke for the v1 validation loop. It drives the React app
// against the real API harness using the gated test-auth seam.

import axeCore from "npm:axe-core@^4.10.3";
import {
  type Browser,
  type BrowserContextOptions,
  chromium,
  type Page,
} from "npm:playwright@1.61.0";
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

type AxeResults = {
  violations: AxeViolation[];
};

type AxeViolation = {
  id: string;
  impact: string | null;
  help: string;
  nodes: Array<{ target: string[]; failureSummary?: string }>;
};

type ThemedRouteOptions = {
  clerkId?: string;
  context?: BrowserContextOptions;
};

e2eTest(
  "mobile authenticated UI smoke covers create, discuss, react, report, and block",
  async () => {
    const chromePath = findChrome();
    if (!chromePath) {
      console.warn("Skipping browser smoke: Chrome/Chromium executable was not found.");
      return;
    }

    const webPort = getFreePort();
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
        await assertRouteNoAxeInThemes(browser, webOrigin, "/", "Fresh posts", "feed themes", {
          clerkId: USERS.maya.clerkId,
          context: {
            viewport: { width: 390, height: 844 },
            deviceScaleFactor: 2,
            isMobile: true,
          },
        });
        await assertRouteNoAxeInThemes(
          browser,
          webOrigin,
          "/create",
          "Create a post",
          "create themes",
          {
            clerkId: USERS.maya.clerkId,
            context: {
              viewport: { width: 390, height: 844 },
              deviceScaleFactor: 2,
              isMobile: true,
            },
          },
        );
        await assertRouteNoAxeInThemes(
          browser,
          webOrigin,
          `/p/${POSTS.fridayText.code}`,
          "When prod breaks on Friday",
          "post themes",
          {
            clerkId: USERS.maya.clerkId,
            context: {
              viewport: { width: 390, height: 844 },
              deviceScaleFactor: 2,
              isMobile: true,
            },
          },
        );
        await assertRouteNoAxeInThemes(
          browser,
          webOrigin,
          "/admin/tags",
          "Tag curation",
          "administration themes",
          {
            clerkId: USERS.admin.clerkId,
            context: { viewport: { width: 1280, height: 800 } },
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
        await context.route("https://www.youtube.com/iframe_api", (route) => route.abort());
        const page = await context.newPage();

        await page.goto(`${webOrigin}/create`, { waitUntil: "networkidle" });
        await page.getByRole("heading", { name: "Pick your @handle" }).waitFor();
        await assertLandmarks(page, "username gate");
        await assertNoAxeViolations(page, "username gate");
        await page.getByPlaceholder("lucas").fill(BROWSER_USERNAME);
        await page.getByRole("button", { name: "Claim" }).click();
        await page.getByRole("heading", { name: "Pick your @handle" }).waitFor({
          state: "detached",
        });

        await page.goto(`${webOrigin}/`, { waitUntil: "networkidle" });
        await page.getByRole("heading", { name: "Fresh posts" }).waitFor();
        await assertLandmarks(page, "feed");
        await assertNoAxeViolations(page, "feed");
        await page.getByRole("link", { name: "New post" }).click();
        await page.getByRole("heading", { name: "Create a post" }).waitFor();
        await assertMainHasFocus(page, "create route navigation");
        await assertLandmarks(page, "create form");
        await assertNoAxeViolations(page, "create form");

        await createTextPost(page);
        await assertMainHasFocus(page, "post detail navigation");
        await assertLandmarks(page, "post detail");
        await assertNoAxeViolations(page, "post detail");
        await page.getByRole("button", { name: "Copy link" }).click();
        await page.getByPlaceholder("Add a comment").fill("Browser smoke comment.");
        await page.getByRole("button", { name: "Comment" }).click();
        await page.getByText("Browser smoke comment.").waitFor();
        await page.getByRole("button", { name: "Upvote" }).click();
        await page.getByRole("button", { name: "Report" }).first().click();
        await waitForActiveText(page, "spam", "report menu initial focus");
        await assertNoAxeViolations(page, "report menu");
        await page.keyboard.press("Escape");
        await waitForActiveName(page, "Report", "report menu escape restore");
        await page.getByRole("button", { name: "Report" }).first().click();
        await page.getByRole("button", { name: "spam" }).click();
        await page.getByText("Reported").waitFor();

        await page.goto(`${webOrigin}/create`, { waitUntil: "networkidle" });
        await createImagePost(page);

        await page.goto(`${webOrigin}/create`, { waitUntil: "networkidle" });
        await createYouTubePost(page);
        await page.getByText("Can't play here").waitFor({ timeout: 10_000 });
        await assertNoAxeViolations(page, "blocked YouTube fallback");

        await page.goto(`${webOrigin}/@${USERS.ren.username}`, { waitUntil: "networkidle" });
        await assertLandmarks(page, "profile");
        await assertNoAxeViolations(page, "profile block controls");
        await page.getByRole("button", { name: "Block" }).click();
        await page.getByRole("button", { name: "Unblock" }).waitFor();
        await assertNoAxeViolations(page, "profile blocked state");

        const overflow = await page.evaluate(
          "document.documentElement.scrollWidth > window.innerWidth",
        );
        assertEquals(overflow, false, "mobile viewport should not horizontally overflow");
        await context.close();

        const adminContext = await browser.newContext({
          viewport: { width: 1280, height: 800 },
        });
        await adminContext.addInitScript(
          ({ storageKey, clerkId }) => localStorage.setItem(storageKey, clerkId),
          { storageKey: TEST_AUTH_STORAGE_KEY, clerkId: USERS.admin.clerkId },
        );
        const adminPage = await adminContext.newPage();
        try {
          await adminPage.goto(`${webOrigin}/admin/tags`, { waitUntil: "networkidle" });
          await adminPage.getByRole("heading", { name: "Tag curation" }).waitFor();
          await assertLandmarks(adminPage, "administration console");
          await assertNoAxeViolations(adminPage, "administration console");
          await adminPage.getByLabel("Tag to absorb").selectOption("memes");
          await adminPage.getByLabel("Tag to keep").selectOption("programming");
          await adminPage.getByRole("button", { name: "Review merge" }).click();
          await adminPage.getByRole("alertdialog", { name: "Merge #memes into #programming?" })
            .waitFor();
          await waitForActiveText(adminPage, "Cancel", "merge dialog initial focus");
          await adminPage.getByRole("button", { name: "Cancel" }).press("Tab");
          await waitForActiveText(adminPage, "Merge tags", "merge dialog forward tab");
          await adminPage.getByRole("button", { name: "Merge tags" }).press("Tab");
          await waitForActiveText(adminPage, "Cancel", "merge dialog tab wrap");
          await adminPage.keyboard.press("Escape");
          await adminPage.getByRole("alertdialog").waitFor({ state: "detached" });
        } finally {
          await adminContext.close();
        }
      } finally {
        await browser.close();
      }
    } finally {
      vite.kill("SIGTERM");
      await vite.status.catch(() => undefined);
    }
  },
);

async function assertNoAxeViolations(page: Page, label: string) {
  try {
    await page.waitForLoadState("load", { timeout: 5_000 }).catch(() => undefined);

    const hasAxe = await page.evaluate(() => "axe" in globalThis);
    if (!hasAxe) await page.addScriptTag({ content: axeCore.source });

    const results = await page.evaluate(`(async () => {
      return await globalThis.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      });
    })()`) as AxeResults;

    const violations = results.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical"
    );
    if (violations.length === 0) return;

    throw new Error(
      `${label} has serious/critical axe violations:\n` +
        violations.map((violation) => {
          const targets = violation.nodes
            .slice(0, 3)
            .map((node) => {
              const summary = node.failureSummary
                ? ` (${node.failureSummary.replace(/\s+/g, " ")})`
                : "";
              return `${node.target.join(" ")}${summary}`;
            })
            .join(", ");
          return `- ${violation.id} (${violation.impact}): ${violation.help} at ${targets}`;
        }).join("\n"),
    );
  } catch (error) {
    throw new Error(`${label}: axe check failed at ${page.url()}`, { cause: error });
  }
}

async function assertRouteNoAxeInThemes(
  browser: Browser,
  webOrigin: string,
  path: string,
  heading: string,
  label: string,
  options: ThemedRouteOptions = {},
) {
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext(options.context);
    await context.addInitScript(
      ({ storageKey, clerkId, theme }) => {
        localStorage.setItem("doomscrollr.theme", theme);
        if (clerkId) localStorage.setItem(storageKey, clerkId);
      },
      { storageKey: TEST_AUTH_STORAGE_KEY, clerkId: options.clerkId ?? null, theme },
    );
    const page = await context.newPage();
    try {
      await page.goto(`${webOrigin}${path}`, { waitUntil: "domcontentloaded" });
      await waitForHeading(page, heading, `${label} (${theme})`);
      await assertLandmarks(page, `${label} (${theme})`);
      await assertNoAxeViolations(page, `${label} (${theme})`);
    } finally {
      await context.close();
    }
  }
}

async function waitForHeading(page: Page, heading: string, label: string) {
  await page.getByRole("heading", { name: heading }).waitFor({ timeout: 30_000 })
    .catch(async (error) => {
      const body = await page.locator("body").innerText({ timeout: 1_000 }).catch(() => "");
      throw new Error(
        `${label}: expected heading ${JSON.stringify(heading)} at ${page.url()}, body=${
          JSON.stringify(body.slice(0, 500))
        }`,
        { cause: error },
      );
    });
}

async function assertLandmarks(page: Page, label: string) {
  const mainCount = await page.locator("main#main-content").count();
  assertEquals(mainCount, 1, `${label}: expected exactly one main landmark`);

  const headerCount = await page.locator("header.top-chrome").count();
  assertEquals(headerCount, 1, `${label}: expected exactly one app header`);

  const navCount = await page.locator("nav").count();
  assert(navCount > 0, `${label}: expected at least one navigation landmark`);
}

async function assertMainHasFocus(page: Page, label: string) {
  await page.waitForFunction("document.activeElement?.id === 'main-content'", undefined, {
    timeout: 3_000,
  }).catch(async (error) => {
    const active = await page.evaluate(`(() => ({
      id: document.activeElement?.id,
      tagName: document.activeElement?.tagName,
      text: document.activeElement?.textContent?.trim().slice(0, 80),
    }))()`);
    throw new Error(
      `${label}: expected main content to receive focus, active=${JSON.stringify(active)}`,
      {
        cause: error,
      },
    );
  });
}

async function waitForActiveText(page: Page, text: string, label: string) {
  await page.waitForFunction(
    `document.activeElement?.textContent?.includes(${JSON.stringify(text)})`,
    undefined,
    { timeout: 3_000 },
  ).catch(async (error) => {
    const active = await page.evaluate(`(() => ({
      id: document.activeElement?.id,
      tagName: document.activeElement?.tagName,
      text: document.activeElement?.textContent?.trim().slice(0, 120),
    }))()`);
    throw new Error(
      `${label}: expected active element to include ${JSON.stringify(text)}, active=${
        JSON.stringify(active)
      }`,
      { cause: error },
    );
  });
}

async function waitForActiveName(page: Page, name: string, label: string) {
  await page.waitForFunction(
    `(() => {
      const active = document.activeElement;
      const value = active?.getAttribute("aria-label") || active?.textContent || "";
      return value.includes(${JSON.stringify(name)});
    })()`,
    undefined,
    { timeout: 3_000 },
  ).catch(async (error) => {
    const active = await page.evaluate(`(() => ({
      id: document.activeElement?.id,
      label: document.activeElement?.getAttribute("aria-label"),
      tagName: document.activeElement?.tagName,
      text: document.activeElement?.textContent?.trim().slice(0, 120),
    }))()`);
    throw new Error(
      `${label}: expected active element name to include ${JSON.stringify(name)}, active=${
        JSON.stringify(active)
      }`,
      { cause: error },
    );
  });
}

async function createTextPost(page: Page) {
  await page.getByLabel("Title").fill("Browser text smoke");
  await page.getByLabel("Body").fill("Created from the mobile smoke test.");
  await page.getByRole("button", { name: "Publish" }).click();
  await waitForHeading(page, "Browser text smoke", "text post publish");
  assert(page.url().includes("/p/"), `expected post detail URL after publish, got ${page.url()}`);
}

async function createImagePost(page: Page) {
  await page.getByRole("button", { name: "Image link" }).click();
  await page.getByLabel("Title").fill("Browser image smoke");
  await page.getByLabel("Image URL").fill(E2E_IMAGE_URL);
  await page.getByRole("button", { name: "Publish" }).click();
  await waitForHeading(page, "Browser image smoke", "image post publish");
}

async function createYouTubePost(page: Page) {
  await page.getByRole("button", { name: "YouTube" }).click();
  await page.getByLabel("Title").fill("Browser YouTube smoke");
  await page.getByLabel("YouTube URL").fill("https://www.youtube.com/shorts/jNQXAC9IVRw");
  await page.getByRole("button", { name: "Publish" }).click();
  await waitForHeading(page, "Browser YouTube smoke", "YouTube post publish");
}

function getFreePort(): number {
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
