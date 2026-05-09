const state = {
  data: null,
  filter: "all"
};

const fmt = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });
const pct = value => `${Math.round(value * 100)}%`;
const $ = selector => document.querySelector(selector);
const confidenceZh = { low: "低可信", medium: "中可信", high: "高可信" };

const tooltip = $("#tooltip");

function showTip(event, html) {
  tooltip.innerHTML = html;
  tooltip.style.left = `${Math.min(window.innerWidth - 300, event.clientX + 16)}px`;
  tooltip.style.top = `${event.clientY + 16}px`;
  tooltip.style.opacity = "1";
}

function hideTip() {
  tooltip.style.opacity = "0";
}

function svgEl(tag, attrs = {}, text = "") {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  if (text) el.textContent = text;
  return el;
}

function addGradients(svg) {
  const defs = svgEl("defs");
  const short = svgEl("linearGradient", { id: "shortGrad", x1: "0", x2: "1" });
  short.appendChild(svgEl("stop", { offset: "0%", "stop-color": "#20d6c7" }));
  short.appendChild(svgEl("stop", { offset: "100%", "stop-color": "#65f0a8" }));
  const long = svgEl("linearGradient", { id: "longGrad", x1: "0", x2: "1" });
  long.appendChild(svgEl("stop", { offset: "0%", "stop-color": "#ffb85c" }));
  long.appendChild(svgEl("stop", { offset: "100%", "stop-color": "#ff6e7d" }));
  defs.append(short, long);
  svg.prepend(defs);
}

function renderKpis(data) {
  $("#kpis").innerHTML = data.kpis.map(item => `
    <article class="kpi">
      <span>${item.label}</span>
      <strong>${fmt.format(item.value)}</strong>
      <span>${item.unit}</span>
      <p>${item.note}</p>
    </article>
  `).join("");
}

function renderHero(data) {
  const totalShort = data.pkBars[0].short;
  const totalLong = data.pkBars[0].long;
  const share = totalShort / (totalShort + totalLong);
  $("#shortShare").textContent = pct(share);
  $(".dial").style.setProperty("--dial", `${share * 100}%`);
  $("#heroBars").innerHTML = [
    ["Short-form", totalShort, share, "short"],
    ["Long-form", totalLong, 1 - share, "long"]
  ].map(([label, value, width, kind]) => `
    <div class="mini-row">
      <span>${label}</span>
      <div class="mini-track">
        <div class="mini-fill" style="width:${width * 100}%; background:${kind === "short" ? "linear-gradient(90deg, var(--short), var(--short-2))" : "linear-gradient(90deg, var(--long), var(--long-2))"}"></div>
      </div>
      <strong>${fmt.format(value / 1000)}B</strong>
    </div>
  `).join("");
}

function renderPkBars(data) {
  $("#pkBars").innerHTML = data.pkBars.map(row => {
    const total = row.short + row.long;
    const s = row.short / total;
    const l = row.long / total;
    return `
      <article class="pk-card">
        <div class="pk-meta">
          <strong>${row.label}</strong>
          <span>${row.unit}</span>
        </div>
        <div class="pk-track" aria-label="${row.label}">
          <div class="pk-short" style="width:${s * 100}%"></div>
          <div class="pk-long" style="width:${l * 100}%"></div>
        </div>
        <div class="pk-values">
          <span class="short-text">短视频 ${pct(s)} · ${fmt.format(row.short)}</span>
          <span class="long-text">${fmt.format(row.long)} · ${pct(l)} 长视频</span>
        </div>
      </article>
    `;
  }).join("");
}

function currentPlatforms() {
  if (state.filter === "all") return state.data.platforms;
  return state.data.platforms.filter(item => item.camp === state.filter);
}

function renderPlatformBars() {
  const data = currentPlatforms().slice().sort((a, b) => b.audienceMillions - a.audienceMillions);
  const width = 920;
  const rowH = 33;
  const left = 172;
  const right = 28;
  const top = 22;
  const height = top * 2 + data.length * rowH;
  const max = Math.max(...data.map(d => d.audienceMillions));
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Platform audience bar chart" });

  data.forEach((d, i) => {
    const y = top + i * rowH;
    const w = (width - left - right) * (d.audienceMillions / max);
    const color = d.camp === "short" ? "url(#shortGrad)" : "url(#longGrad)";
    svg.appendChild(svgEl("text", { x: 0, y: y + 18, class: "bar-label" }, d.name));
    svg.appendChild(svgEl("rect", { x: left, y: y + 4, width: width - left - right, height: 18, rx: 5, fill: "rgba(255,255,255,0.06)" }));
    const bar = svgEl("rect", { x: left, y: y + 4, width: Math.max(2, w), height: 18, rx: 5, fill: color, class: "data-mark" });
    bar.addEventListener("mousemove", e => showTip(e, `<strong>${d.name}</strong><br>${fmt.format(d.audienceMillions)}M · ${d.audienceMetric}<br>可信度：${confidenceZh[d.confidence] || d.confidence}`));
    bar.addEventListener("mouseleave", hideTip);
    svg.appendChild(bar);
    svg.appendChild(svgEl("text", { x: left + w + 8, y: y + 18, class: "chart-label" }, `${fmt.format(d.audienceMillions)}M`));
  });

  addGradients(svg);
  $("#platformBarChart").replaceChildren(svg);
}

function renderScatter() {
  const data = currentPlatforms();
  const width = 480;
  const height = 340;
  const pad = 54;
  const maxX = Math.max(...data.map(d => d.audienceMillions));
  const maxY = Math.max(...data.map(d => d.dailyMinutes || 0));
  const plotW = width - pad - 26;
  const plotH = height - pad - 24;
  const x = v => pad + plotW * v / maxX;
  const y = v => height - pad - plotH * v / maxY;
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Audience versus time spent scatter chart" });
  svg.appendChild(svgEl("line", { x1: pad, y1: height - pad, x2: width - 20, y2: height - pad, stroke: "rgba(255,255,255,0.22)" }));
  svg.appendChild(svgEl("line", { x1: pad, y1: 24, x2: pad, y2: height - pad, stroke: "rgba(255,255,255,0.22)" }));
  [0, 0.25, 0.5, 0.75, 1].forEach(step => {
    const xv = step * maxX;
    const xp = x(xv);
    svg.appendChild(svgEl("line", { x1: xp, y1: height - pad, x2: xp, y2: height - pad + 5, stroke: "rgba(255,255,255,0.28)" }));
    svg.appendChild(svgEl("text", { x: xp, y: height - pad + 20, "text-anchor": "middle", class: "axis" }, `${Math.round(xv)}M`));
    const yv = step * maxY;
    const yp = y(yv);
    svg.appendChild(svgEl("line", { x1: pad - 5, y1: yp, x2: pad, y2: yp, stroke: "rgba(255,255,255,0.28)" }));
    svg.appendChild(svgEl("text", { x: pad - 9, y: yp + 4, "text-anchor": "end", class: "axis" }, Math.round(yv)));
    if (step > 0) svg.appendChild(svgEl("line", { x1: pad, y1: yp, x2: width - 20, y2: yp, stroke: "rgba(255,255,255,0.07)" }));
  });
  svg.appendChild(svgEl("text", { x: pad, y: 18, class: "axis" }, "日均分钟"));
  svg.appendChild(svgEl("text", { x: width - 116, y: height - 8, class: "axis" }, "受众规模 M"));
  data.forEach(d => {
    const circle = svgEl("circle", {
      cx: x(d.audienceMillions),
      cy: y(d.dailyMinutes || 0),
      r: d.camp === "short" ? 7 : 8,
      fill: d.camp === "short" ? "#20d6c7" : "#ffb85c",
      opacity: "0.9"
    });
    circle.addEventListener("mousemove", e => showTip(e, `<strong>${d.name}</strong><br>${fmt.format(d.audienceMillions)}M audience<br>${d.dailyMinutes || "n/a"} min/day`));
    circle.addEventListener("mouseleave", hideTip);
    svg.appendChild(circle);
  });
  $("#scatterChart").replaceChildren(svg);
}

function renderDuration(data) {
  const items = data.tiktokDurationBuckets;
  const width = 480;
  const height = 320;
  const pad = 36;
  const max = Math.max(...items.map(d => d.viewerEquivalentMillions));
  const barW = (width - pad * 2) / items.length - 12;
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "TikTok duration buckets" });
  addGradients(svg);
  items.forEach((d, i) => {
    const h = (height - pad * 2) * d.viewerEquivalentMillions / max;
    const x = pad + i * (barW + 12);
    const y = height - pad - h;
    const bar = svgEl("rect", { x, y, width: barW, height: h, rx: 6, fill: "url(#shortGrad)" });
    bar.addEventListener("mousemove", e => showTip(e, `<strong>${d.label}</strong><br>${fmt.format(d.viewerEquivalentMillions)}M viewer-equivalent<br>模型份额：${pct(d.share)}<br>完成率：${pct(d.completionRate)}`));
    bar.addEventListener("mouseleave", hideTip);
    svg.appendChild(bar);
    svg.appendChild(svgEl("text", { x: x + barW / 2, y: height - 12, "text-anchor": "middle", class: "axis" }, d.label));
    svg.appendChild(svgEl("text", { x: x + barW / 2, y: y - 8, "text-anchor": "middle", class: "bar-label" }, `${fmt.format(d.viewerEquivalentMillions)}M`));
  });
  $("#durationChart").replaceChildren(svg);

  $("#durationHeatmap").innerHTML = items.map(d => `
    <div class="heat-wrap">
      <div class="heat-cell" style="--heat:${Math.round(d.completionRate * 100)}%; --cell-height:${Math.round(210 + d.completionRate * 205)}px">
        <strong>${pct(d.completionRate)}</strong>
        <small>完成率<br>${confidenceZh[d.confidence] || d.confidence}</small>
      </div>
      <span class="heat-label">${d.label}</span>
    </div>
  `).join("");
}

function renderCreatorCharts(data) {
  renderHorizontal("#creatorChart", data.creatorSupply, "creatorsMillions", "platform", "creatorMetric", "百万");
  renderHorizontal("#uploadChart", data.creatorSupply, "dailyUploadsMillions", "platform", "typicalLength", "M/day");
}

function renderHorizontal(target, rows, valueKey, labelKey, detailKey, unit) {
  const data = rows.slice().sort((a, b) => b[valueKey] - a[valueKey]);
  const width = target === "#creatorChart" ? 800 : 440;
  const rowH = 42;
  const left = target === "#creatorChart" ? 170 : 136;
  const height = 34 + data.length * rowH;
  const max = Math.max(...data.map(d => d[valueKey]));
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
  addGradients(svg);
  data.forEach((d, i) => {
    const y = 24 + i * rowH;
    const w = (width - left - 42) * d[valueKey] / max;
    svg.appendChild(svgEl("text", { x: 0, y: y + 17, class: "bar-label" }, d[labelKey]));
    svg.appendChild(svgEl("rect", { x: left, y: y + 2, width: width - left - 42, height: 20, rx: 5, fill: "rgba(255,255,255,0.06)" }));
    const bar = svgEl("rect", { x: left, y: y + 2, width: Math.max(2, w), height: 20, rx: 5, fill: d.camp === "short" ? "url(#shortGrad)" : "url(#longGrad)" });
    bar.addEventListener("mousemove", e => showTip(e, `<strong>${d.platform}</strong><br>${fmt.format(d[valueKey])} ${unit}<br>${d[detailKey]}<br>${d.reported ? "披露值" : "模型/第三方估算"}`));
    bar.addEventListener("mouseleave", hideTip);
    svg.appendChild(bar);
    svg.appendChild(svgEl("text", { x: left + w + 8, y: y + 17, class: "chart-label" }, fmt.format(d[valueKey])));
  });
  $(target).replaceChildren(svg);
}

function renderTrend(data) {
  const rows = data.timeline;
  const width = 1080;
  const height = 420;
  const pad = 62;
  const series = [
    { key: "short", label: "短视频观看入口", color: "#20d6c7" },
    { key: "long", label: "长视频观看入口", color: "#ffb85c" },
    { key: "aiShort", label: "纯AI短视频", color: "#b48cff" },
    { key: "aiHybridLong", label: "AI混合真人视频", color: "#5cc8ff" }
  ];
  const max = Math.max(...rows.flatMap(d => series.map(item => d[item.key] || 0)));
  const yMax = Math.ceil(max / 2000) * 2000;
  const plotW = width - pad - 190;
  const plotH = height - pad - 28;
  const x = i => pad + i * (plotW / (rows.length - 1));
  const y = v => height - pad - plotH * v / yMax;
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Trend line chart" });
  const pathFor = key => rows.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[key] || 0)}`).join(" ");

  svg.appendChild(svgEl("line", { x1: pad, y1: height - pad, x2: pad + plotW, y2: height - pad, stroke: "rgba(255,255,255,0.22)" }));
  svg.appendChild(svgEl("line", { x1: pad, y1: 24, x2: pad, y2: height - pad, stroke: "rgba(255,255,255,0.22)" }));
  for (let tick = 0; tick <= yMax; tick += 2000) {
    const yp = y(tick);
    svg.appendChild(svgEl("line", { x1: pad - 6, y1: yp, x2: pad, y2: yp, stroke: "rgba(255,255,255,0.3)" }));
    svg.appendChild(svgEl("text", { x: pad - 10, y: yp + 4, "text-anchor": "end", class: "axis" }, `${tick / 1000}B`));
    if (tick > 0) svg.appendChild(svgEl("line", { x1: pad, y1: yp, x2: pad + plotW, y2: yp, stroke: "rgba(255,255,255,0.07)" }));
  }

  svg.appendChild(svgEl("text", { x: pad, y: 18, class: "axis" }, "观看入口指数"));
  series.forEach(item => {
    svg.appendChild(svgEl("path", {
      d: pathFor(item.key),
      fill: "none",
      stroke: item.color,
      "stroke-width": item.key.startsWith("ai") ? 3 : 4,
      "stroke-linecap": "round"
    }));
  });

  rows.forEach((d, i) => {
    svg.appendChild(svgEl("text", { x: x(i), y: height - 16, "text-anchor": "middle", class: "axis" }, d.year));
    series.forEach(item => {
      const c = svgEl("circle", {
        cx: x(i),
        cy: y(d[item.key] || 0),
        r: item.key.startsWith("ai") ? 5 : 6,
        fill: item.color
      });
      c.addEventListener("mousemove", e => showTip(e, `<strong>${d.year}</strong><br>${item.label}: ${fmt.format(d[item.key] || 0)}M index`));
      c.addEventListener("mouseleave", hideTip);
      svg.appendChild(c);
    });
  });

  const last = rows[rows.length - 1];
  series.forEach(item => {
    svg.appendChild(svgEl("text", {
      x: x(rows.length - 1) + 14,
      y: y(last[item.key] || 0) + 4,
      class: "bar-label",
      fill: item.color
    }, item.label));
  });
  $("#trendChart").replaceChildren(svg);
}
function renderAiVideo(data) {
  if (!data.aiVideo) return;
  $("#aiVideoNote").textContent = data.aiVideo.methodNote;
  renderAiVolumeChart(data.aiVideo.volumeMetrics);
  renderAiRatioBars(data.aiVideo.ratios);
}

function renderAiVolumeChart(rows) {
  const width = 760;
  const height = 560;
  const pad = 42;
  const bottom = 46;
  const max = Math.max(...rows.map(d => d.value));
  const barW = 92;
  const gap = (width - pad * 2 - barW * rows.length) / (rows.length - 1);
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "AI video volume and daily increment proxies" });
  addGradients(svg);
  svg.appendChild(svgEl("line", { x1: pad, y1: height - bottom, x2: width - 24, y2: height - bottom, stroke: "rgba(255,255,255,0.2)" }));
  svg.appendChild(svgEl("line", { x1: pad, y1: 22, x2: pad, y2: height - bottom, stroke: "rgba(255,255,255,0.2)" }));
  rows.forEach((d, i) => {
    const x = pad + i * (barW + gap);
    const h = (height - bottom - 24) * d.value / max;
    const y = height - bottom - h;
    const fill = i < 2 ? "url(#shortGrad)" : "url(#longGrad)";
    const bar = svgEl("rect", { x, y, width: barW, height: Math.max(3, h), rx: 6, fill });
    bar.addEventListener("mousemove", e => showTip(e, `<strong>${d.label}</strong><br>${fmt.format(d.value)} ${d.unit}<br>${d.note}<br>可信度：${confidenceZh[d.confidence] || d.confidence}`));
    bar.addEventListener("mouseleave", hideTip);
    svg.appendChild(bar);
    svg.appendChild(svgEl("text", { x: x + barW / 2, y: y - 8, "text-anchor": "middle", class: "bar-label" }, fmt.format(d.value)));
    svg.appendChild(svgEl("text", { x: x + barW / 2, y: height - 34, "text-anchor": "middle", class: "axis" }, d.label.replace("AI/真人融合", "AI融合")));
    svg.appendChild(svgEl("text", { x: x + barW / 2, y: height - 17, "text-anchor": "middle", class: "axis" }, d.unit));
  });
  $("#aiVolumeChart").replaceChildren(svg);
}

function renderAiRatioBars(rows) {
  $("#aiRatioBars").innerHTML = rows.map(row => `
    <article class="ai-ratio-card">
      <strong>${row.label}</strong>
      <div class="ai-ratio-track" aria-label="${row.label}">
        <div class="ai-fill" style="width:${row.ai}%"></div>
        <div class="human-fill" style="width:${row.human}%"></div>
      </div>
      <div class="ai-ratio-meta">
        <span>AI ${fmt.format(row.ai)}${row.unit}</span>
        <span>真人/未标注 ${fmt.format(row.human)}${row.unit}</span>
      </div>
      <p>${row.note}</p>
    </article>
  `).join("");
}

function renderSources(data) {
  $("#methodology").innerHTML = Object.values(data.methodology).map(text => `<p>${text}</p>`).join("");
  $("#sourceGrid").innerHTML = data.sources.map(source => `
    <article class="source-card">
      <a href="${source.url}" target="_blank" rel="noreferrer">${source.name}</a>
      <p>${source.summary}</p>
    </article>
  `).join("");
}

function wireInteractions() {
  document.querySelectorAll("[data-scroll]").forEach(button => {
    button.addEventListener("click", () => document.querySelector(button.dataset.scroll).scrollIntoView({ behavior: "smooth" }));
  });
  document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === button));
      renderPlatformBars();
      renderScatter();
    });
  });
}

async function init() {
  const response = await fetch("./data/metrics.json", { cache: "no-store" });
  state.data = await response.json();
  renderKpis(state.data);
  renderHero(state.data);
  renderPkBars(state.data);
  renderPlatformBars();
  renderScatter();
  renderDuration(state.data);
  renderCreatorCharts(state.data);
  renderAiVideo(state.data);
  renderTrend(state.data);
  renderSources(state.data);
  wireInteractions();
}

init().catch(error => {
  document.body.insertAdjacentHTML("afterbegin", `<div style="padding:16px;background:#3b1515;color:#fff">Data failed to load: ${error.message}</div>`);
});
