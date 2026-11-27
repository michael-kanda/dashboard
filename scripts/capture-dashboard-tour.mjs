// scripts/capture-dashboard-tour.mjs
// Nimmt die Bilder für die Dashboard-Tour auf der Landingpage auf.
// Öffnet die Demo in Chrome (ohne Zusatzpakete, über das DevTools-Protokoll),
// fotografiert jeden Bereich hell und dunkel und speichert WebP-Dateien
// unter public/tour/.
//
// Aufruf: node scripts/capture-dashboard-tour.mjs
// Optional: BASE_URL=http://localhost:3123 node scripts/capture-dashboard-tour.mjs
// Erkunden: node scripts/capture-dashboard-tour.mjs --list  (zeigt nur die Abschnitte)

import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import TOUR_STEPS from '../src/lib/dashboard-tour.json' with { type: 'json' };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'tour');
const BASE_URL = process.env.BASE_URL || 'https://app.datapeak.at';
const DEMO_PATH = '/demo-anwalt';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const WIDTH = 1280;
const SCALE = 2;
const PAD = 16;
// So hoch, dass die ganze Demo ohne Scrollen hineinpasst. Ein Nachvergrößern beim Foto
// würde die Diagramme neu zeichnen lassen, sie wären dann leer.
const VIEWPORT_HEIGHT = 6000;
const LIST_ONLY = process.argv.includes('--list');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForJson(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
    } catch {
      // Chrome startet noch
    }
    await sleep(200);
  }
  throw new Error(`Chrome antwortet nicht unter ${url}`);
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { ready, send, close: () => ws.close() };
}

async function evaluate(send, expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text);
  return result.value;
}

async function waitFor(send, expression, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(send, expression)) return;
    await sleep(300);
  }
  throw new Error(`Zeitüberschreitung beim Warten auf: ${expression}`);
}

// Wartet, bis sich die Seitenhöhe eine Weile nicht mehr ändert (Daten und Diagramme geladen).
async function waitForStableLayout(send) {
  let last = -1;
  let stableFor = 0;
  for (let i = 0; i < 80 && stableFor < 3; i++) {
    const h = await evaluate(send, 'document.documentElement.scrollHeight');
    stableFor = h === last ? stableFor + 1 : 0;
    last = h;
    await sleep(500);
  }
  await sleep(1000);
}

async function openDemo(send, theme) {
  await send('Page.navigate', { url: `${BASE_URL}${DEMO_PATH}` });
  await waitFor(send, "document.readyState === 'complete'");
  await evaluate(send, `localStorage.setItem('datapeak-theme', '${theme}'); true`);
  await send('Page.reload', { ignoreCache: true });
  await waitFor(send, "document.readyState === 'complete'");
  await waitFor(send, `!!document.getElementById('${TOUR_STEPS[0].sectionIds[0]}')`);
  await waitForStableLayout(send);
  // Animationen und Hover-Zustände aus, damit die Bilder ruhig wirken
  await evaluate(
    send,
    `(() => { const s = document.createElement('style');
      s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}';
      document.head.appendChild(s); return true; })()`,
  );
}

// Umschließendes Rechteck aller Abschnitte eines Schritts (z. B. zwei Listen nebeneinander)
async function sectionRect(send, ids) {
  return evaluate(
    send,
    `(() => { const els = ${JSON.stringify(ids)}.map(id => document.getElementById(id)).filter(Boolean);
      if (!els.length) return null;
      const rs = els.map(el => el.getBoundingClientRect());
      const left = Math.min(...rs.map(r => r.left)), top = Math.min(...rs.map(r => r.top));
      const right = Math.max(...rs.map(r => r.right)), bottom = Math.max(...rs.map(r => r.bottom));
      return { x: left + scrollX, y: top + scrollY, width: right - left, height: bottom - top }; })()`,
  );
}

async function main() {
  const profile = await mkdtemp(path.join(tmpdir(), 'dp-tour-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      `--window-size=${WIDTH},900`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  try {
    const targets = await waitForJson(`http://127.0.0.1:${PORT}/json/list`);
    const page = targets.find((t) => t.type === 'page');
    const { ready, send, close } = connect(page.webSocketDebuggerUrl);
    await ready;
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: VIEWPORT_HEIGHT,
      deviceScaleFactor: SCALE,
      mobile: false,
    });

    if (LIST_ONLY) {
      await openDemo(send, 'light');
      const ids = await evaluate(
        send,
        `[...document.querySelectorAll('[id^="section-"]')].map(el => {
          const r = el.getBoundingClientRect();
          return el.id + '  ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' @ y=' + Math.round(r.top + scrollY);
        })`,
      );
      console.log(ids.join('\n'));
      close();
      return;
    }

    await mkdir(OUT_DIR, { recursive: true });
    for (const theme of ['light', 'dark']) {
      await openDemo(send, theme);
      // Vorschaubild für die Landingpage: oberer Teil der Demo mit Seitenleiste
      {
        await sleep(3000);
        const { data } = await send('Page.captureScreenshot', {
          format: 'webp',
          quality: 82,
          clip: { x: 0, y: 0, width: WIDTH, height: 800, scale: 1 },
        });
        const file = path.join(OUT_DIR, `vorschau-${theme}.webp`);
        await writeFile(file, Buffer.from(data, 'base64'));
        console.log(`${path.relative(ROOT, file)}  ${WIDTH}x800`);
      }
      for (const step of TOUR_STEPS) {
        const rect = await sectionRect(send, step.sectionIds);
        if (!rect || rect.height < 10) {
          console.warn(`Übersprungen: ${step.id} fehlt in der Demo`);
          continue;
        }
        const clip = {
          x: Math.max(0, rect.x - PAD),
          y: Math.max(0, rect.y - PAD),
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
          scale: 1,
        };
        const { data } = await send('Page.captureScreenshot', {
          format: 'webp',
          quality: 82,
          clip,
        });
        const file = path.join(OUT_DIR, `${step.id}-${theme}.webp`);
        await writeFile(file, Buffer.from(data, 'base64'));
        console.log(`${path.relative(ROOT, file)}  ${Math.round(clip.width)}x${Math.round(clip.height)}`);
      }
    }
    close();
  } finally {
    chrome.kill();
    await sleep(300);
    await rm(profile, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
