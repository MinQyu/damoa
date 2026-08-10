import { spawn } from "child_process";
import { existsSync, mkdirSync } from "fs";
import os from "os";
import path from "path";
import puppeteer, { Browser, Page } from "puppeteer";

const DEBUG_PORT = Number(process.env.DAMOA_CHROME_DEBUG_PORT ?? 9315);
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`;
const PROFILE_DIR = path.join(os.tmpdir(), "damoa-chrome-profile");

const CHROME_CANDIDATES = [
  process.env.DAMOA_CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
].filter((p): p is string => Boolean(p));

async function resolveChromePath(): Promise<string> {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  // 시스템에 설치된 실제 Chrome을 최우선으로 쓴다. puppeteer 번들 Chromium 폴백은
  // 봇 탐지 우회가 검증되지 않았다 (coupang.ts 등 상단 주석 참고).
  return found ?? (await puppeteer.executablePath());
}

async function isDebugPortAlive(): Promise<boolean> {
  try {
    const res = await fetch(`${DEBUG_URL}/json/version`, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function launchBackgroundChrome(): Promise<void> {
  mkdirSync(PROFILE_DIR, { recursive: true });

  const child = spawn(
    await resolveChromePath(),
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-blink-features=AutomationControlled",
      // 헤드리스가 아닌 실제 창을 띄우되 화면 밖으로 배치해 사용자 작업을 방해하지 않는다.
      "--window-position=-32000,-32000",
      "--window-size=1280,800",
      "about:blank",
    ],
    { detached: true, stdio: "ignore" }
  );
  child.unref();
}

async function waitForDebugPort(timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isDebugPortAlive()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("백그라운드 Chrome 디버그 포트가 시간 내에 응답하지 않았습니다.");
}

const globalForBrowser = globalThis as unknown as {
  __damoaBrowserPromise?: Promise<Browser>;
};

async function connectBrowser(): Promise<Browser> {
  if (!(await isDebugPortAlive())) {
    await launchBackgroundChrome();
    await waitForDebugPort();
  }
  const browser = await puppeteer.connect({ browserURL: DEBUG_URL });
  browser.once("disconnected", () => {
    globalForBrowser.__damoaBrowserPromise = undefined;
  });
  return browser;
}

/**
 * 사용자 백그라운드에 떠 있는(없으면 새로 띄우는) 실제 Chrome에 CDP로 연결해 반환한다.
 * puppeteer로 직접 launch한 headless 브라우저 대신 이 방식을 쓰는 이유는 쿠팡/G마켓/옥션의
 * 봇 탐지를 우회하기 위함이다 (2026-08 검증). 프로세스는 Next.js 서버와 분리된 채(detached)
 * 실행되며 서버 재시작 후에도 남아있는다 — 매번 콜드 스타트로 인한 봇 확인 페이지를 줄이기 위함.
 * globalThis 캐시는 Next dev HMR로 모듈이 재평가돼도 중복 연결/실행을 막기 위함이다.
 */
export function getBrowser(): Promise<Browser> {
  if (!globalForBrowser.__damoaBrowserPromise) {
    globalForBrowser.__damoaBrowserPromise = connectBrowser();
  }
  return globalForBrowser.__damoaBrowserPromise;
}

/** 벤더 스크래핑용으로 격리된 탭을 열어주고, 끝나면 탭만 닫는다 (브라우저 자체는 유지). */
export async function withVendorPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 800 });
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
  }
}

const INTERSTITIAL_TITLE_MARKERS = ["기다리십시오", "잠시만"];

/** 지마켓/옥션 등에서 뜨는 "봇 확인 중" 인터스티셜이 사라질 때까지 대기한다. */
export async function waitForRealPage(page: Page, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const title = await page.title();
    if (!INTERSTITIAL_TITLE_MARKERS.some((marker) => title.includes(marker))) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
}
