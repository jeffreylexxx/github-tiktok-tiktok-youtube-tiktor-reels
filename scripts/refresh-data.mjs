import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataPath = path.join(root, "data", "metrics.json");

const data = JSON.parse(await fs.readFile(dataPath, "utf8"));
const sourceById = new Map(data.sources.map(source => [source.id, source]));
const platformById = new Map(data.platforms.map(platform => [platform.id, platform]));

async function fetchText(sourceId) {
  const source = sourceById.get(sourceId);
  if (!source) return "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 dashboard-refresh/1.0" }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } catch (error) {
    console.warn(`Could not refresh ${sourceId}: ${error.message}`);
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function firstNumber(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1].replace(/,/g, ""));
  }
  return null;
}

function updatePlatform(id, field, value) {
  const platform = platformById.get(id);
  if (platform && Number.isFinite(value) && value > 0) {
    platform[field] = Math.round(value);
  }
}

function refreshDedupProxy() {
  const global = data.pkBars[0];
  if (global) {
    global.label = "\u5168\u7403\u89c2\u770b\u4eba\u7fa4\u4f30\u7b97\uff08\u53bb\u91cd\u4ee3\u7406\uff09";
    global.short = 5790;
    global.long = 5612;
    global.unit = "\u767e\u4e07\uff0c\u57fa\u4e8e DataReportal/GWI \u8986\u76d6\u7387";
  }

  const shortKpi = data.kpis.find(kpi => kpi.label.includes("\u77ed\u89c6\u9891"));
  const longKpi = data.kpis.find(kpi => kpi.label.includes("\u957f\u89c6\u9891"));
  if (shortKpi) shortKpi.value = 11536;
  if (longKpi) longKpi.value = 4660;
}

async function refreshKnownSources() {
  const [snap, bili, instagram, threads, prime] = await Promise.all([
    fetchText("snapQ42025"),
    fetchText("bilibiliQ42025"),
    fetchText("instagram3b"),
    fetchText("threads400m"),
    fetchText("primeVideo315m")
  ]);

  updatePlatform("snapchat", "audienceMillions", firstNumber(snap, [
    /reaching\s+([\d,.]+)\s+million\s+global monthly active users/i
  ]));
  updatePlatform("bilibili", "audienceMillions", firstNumber(bili, [
    /monthly active users reached\s+([\d,.]+)\s+million/i,
    /MAUs?\)\s*were\s*([\d,.]+)\s+million/i
  ]));
  updatePlatform("bilibili", "dailyMinutes", firstNumber(bili, [
    /Average daily time spent per active user were\s+([\d,.]+)\s+minutes/i
  ]));
  updatePlatform("instagram", "audienceMillions", firstNumber(instagram, [
    /Instagram now has\s+([\d,.]+)\s+billion monthly active users/i,
    /Instagram has grown to\s+([\d,.]+)\s+billion monthly active users/i
  ]) * 1000);
  updatePlatform("threads", "audienceMillions", firstNumber(threads, [
    /more than\s+([\d,.]+)\s+million monthly active users/i
  ]));
  updatePlatform("x", "audienceMillions", firstNumber(threads, [
    /north of\s+([\d,.]+)\s+million monthly active users/i
  ]));
  updatePlatform("prime-video", "audienceMillions", firstNumber(prime, [
    /more than\s+([\d,.]+)\s+million viewers globally/i,
    /more than\s+([\d,.]+)\s+million average monthly ad-supported viewers/i
  ]));

  refreshDedupProxy();
}

await refreshKnownSources();
data.generatedAt = new Date().toISOString();
data.version = `public-snapshot-${data.generatedAt.slice(0, 10)}`;

await fs.writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Refreshed ${path.relative(root, dataPath)} at ${data.generatedAt}`);
