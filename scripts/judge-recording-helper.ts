import { Page, BrowserContext } from "playwright";
import fs from "fs";
import path from "path";

export interface InteractionEntry {
  timestamp: string;
  step: number;
  route: string;
  action: string;
  target: string;
  expected: string;
  actual: string;
  status: "PASS" | "WARN" | "FAIL";
  notes?: string;
}

export interface NetworkEntry {
  timestamp: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
}

export async function injectVisualCursor(page: Page) {
  await page.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      if (document.getElementById("playwright-visual-cursor")) return;
      const cursor = document.createElement("div");
      cursor.id = "playwright-visual-cursor";
      cursor.style.position = "fixed";
      cursor.style.top = "0";
      cursor.style.left = "0";
      cursor.style.width = "20px";
      cursor.style.height = "20px";
      cursor.style.borderRadius = "50%";
      cursor.style.backgroundColor = "rgba(45, 212, 191, 0.85)";
      cursor.style.border = "2px solid #ffffff";
      cursor.style.boxShadow = "0 0 10px rgba(45, 212, 191, 0.9)";
      cursor.style.pointerEvents = "none";
      cursor.style.zIndex = "999999";
      cursor.style.transform = "translate(-50%, -50%)";
      cursor.style.transition = "transform 0.05s ease, background-color 0.15s ease, width 0.15s ease, height 0.15s ease";
      document.body.appendChild(cursor);

      window.addEventListener("mousemove", (e) => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
      });

      window.addEventListener("mousedown", () => {
        cursor.style.backgroundColor = "rgba(251, 191, 84, 0.95)";
        cursor.style.width = "28px";
        cursor.style.height = "28px";
      });

      window.addEventListener("mouseup", () => {
        cursor.style.backgroundColor = "rgba(45, 212, 191, 0.85)";
        cursor.style.width = "20px";
        cursor.style.height = "20px";
      });
    });
  });
}

export function attachLoggers(
  page: Page,
  consoleLogs: string[],
  networkLogs: NetworkEntry[]
) {
  page.on("console", (msg) => {
    const text = `[${new Date().toISOString()}] [${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleLogs.push(text);
  });

  page.on("pageerror", (err) => {
    consoleLogs.push(`[${new Date().toISOString()}] [PAGE_ERROR] ${err.message}\n${err.stack}`);
  });

  const requestStartTimes = new Map<string, number>();

  page.on("request", (req) => {
    requestStartTimes.set(req.url(), Date.now());
  });

  page.on("response", (res) => {
    const start = requestStartTimes.get(res.url()) || Date.now();
    networkLogs.push({
      timestamp: new Date().toISOString(),
      method: res.request().method(),
      url: res.url(),
      status: res.status(),
      durationMs: Date.now() - start,
    });
  });
}

export async function smoothMove(page: Page, x: number, y: number, steps = 15) {
  await page.mouse.move(x, y, { steps });
}

export async function smoothClick(page: Page, selector: string, timeout = 5000) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible", timeout });
  const box = await el.boundingBox();
  if (box) {
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;
    await page.mouse.move(targetX, targetY, { steps: 12 });
    await page.waitForTimeout(100);
    await page.mouse.down();
    await page.waitForTimeout(120);
    await page.mouse.up();
    await page.waitForTimeout(200);
  } else {
    await el.click();
  }
}

export async function smoothScroll(page: Page, deltaY: number, steps = 10) {
  const stepDelta = deltaY / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepDelta);
    await page.waitForTimeout(50);
  }
}

export function saveLogs(
  baseName: string,
  dir: string,
  interactionLogs: InteractionEntry[],
  consoleLogs: string[],
  networkLogs: NetworkEntry[]
) {
  const intDir = path.join(dir, "interaction-logs");
  const conDir = path.join(dir, "console-logs");
  const netDir = path.join(dir, "network-logs");

  fs.mkdirSync(intDir, { recursive: true });
  fs.mkdirSync(conDir, { recursive: true });
  fs.mkdirSync(netDir, { recursive: true });

  fs.writeFileSync(
    path.join(intDir, `${baseName}_interactions.json`),
    JSON.stringify(interactionLogs, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(conDir, `${baseName}_console.log`),
    consoleLogs.join("\n"),
    "utf8"
  );
  fs.writeFileSync(
    path.join(netDir, `${baseName}_network.json`),
    JSON.stringify(networkLogs, null, 2),
    "utf8"
  );
}

