// Rychlost startu mapy jako v PageSpeed: mobil = pomalé 4G + 4× zpomalený procesor, desktop (--desktop) = okno 1350×940,
// 10 Mbit/s, procesor bez zpomalení. Chromium.
// node nastroje-pavel/mereni_startu.mjs [adresa] [opakování] [--desktop]   (výchozí http://localhost:8000/, 3×)
// Vypíše FCP (první vykreslení), LCP (největší prvek), dobu blokování hlavního vlákna (součet dlouhých úloh nad 50 ms
// do 10 s, jako TBT) a kdy se objeví první auto (animace běží). Mediány z opakování. (2026-11-19, napady/PAGESPEED-2026-11-19.md)
import { chromium } from './prohlizec.mjs';
// --cpu N: zpomalení procesoru (M5 je mnohem rychlejší než stroj PageSpeedu; desktop se mu blíží zhruba při --cpu 4)
const arg = process.argv.slice(2).filter((a) => !a.startsWith('--')), DESKTOP = process.argv.includes('--desktop');
const CPU = +(process.argv.find((a) => a.startsWith('--cpu='))?.slice(6) || (DESKTOP ? 1 : 4));
const adresa = arg[0] || 'http://localhost:8000/', N = +(arg[1] || 3);
const b = await chromium.launch();
const vysl = [];
for (let i = 0; i < N; i++) {
  const ctx = await b.newContext(DESKTOP ? { viewport: { width: 1350, height: 940 } }
    : { viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', DESKTOP ? { offline: false, latency: 40, downloadThroughput: 10e6 / 8, uploadThroughput: 10e6 / 8 }
    : { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await p.addInitScript(() => {
    window.__m = { lcp: 0, tbt: 0 };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.startTime < 10000) window.__m.tbt += Math.max(0, e.duration - 50); }).observe({ type: 'longtask', buffered: true });
  });
  await p.goto(`${adresa}${adresa.includes('?') ? '&' : '?'}mereni=${Date.now()}`, { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(10000);
  const m = await p.evaluate(() => ({ fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0, lcp: window.__m.lcp, tbt: window.__m.tbt,
    load: performance.getEntriesByType('navigation')[0]?.loadEventEnd || 0 }));
  vysl.push(m); await ctx.close();
}
const med = (k) => { const s = vysl.map((v) => v[k]).sort((a, b) => a - b); return Math.round(s[Math.floor(s.length / 2)]); };
console.log(`${DESKTOP ? 'desktop' : 'mobil'} (cpu ${CPU}×) · ${adresa} · ${N}× · FCP ${med('fcp')} ms · LCP ${med('lcp')} ms · blokování ${med('tbt')} ms · load ${med('load')} ms`);
await b.close();
