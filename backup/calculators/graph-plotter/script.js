/* ============================================================
   Построитель графиков — логика
   Ввод точек (x, y), несколько зависимостей, авто-масштаб
   с «красивыми» делениями + ручная настройка. Темы оформления
   и экспорт в PNG/JPEG. Отрисовка на Canvas.
   ============================================================ */

// ---------- Темы оформления ----------
const PALETTE = ["#22d3ee", "#e879f9", "#fbbf24", "#34d399", "#f472b6", "#818cf8", "#fb923c", "#a3e635"];

// Формы точек (маркеров)
const SHAPES = [
  { id: "circle", name: "Круг", glyph: "●" },
  { id: "square", name: "Квадрат", glyph: "■" },
  { id: "triangle", name: "Треугольник", glyph: "▲" },
  { id: "diamond", name: "Ромб", glyph: "◆" },
  { id: "cross", name: "Крест", glyph: "✕" },
  { id: "plus", name: "Плюс", glyph: "＋" },
];

const THEMES = {
  dark: {
    name: "CalcHub",
    bg: "#0b0e17",
    plotBg: "rgba(255,255,255,0.03)",
    grid: "rgba(255,255,255,0.07)",
    axis: "rgba(255,255,255,0.3)",
    label: "rgba(154,161,181,0.9)",
    labelAxis: "rgba(154,161,181,0.7)",
    legendBg: "rgba(11,14,23,0.8)",
    legendBorder: "rgba(255,255,255,0.14)",
    palette: PALETTE,
  },
  excel: {
    name: "Excel",
    bg: "#ffffff",
    plotBg: "#ffffff",
    grid: "#e4e7eb",
    axis: "#c4c9d1",
    label: "#5b6470",
    labelAxis: "#5b6470",
    legendBg: "rgba(255,255,255,0.92)",
    legendBorder: "#d0d5db",
    palette: ["#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47"],
  },
};

// ---------- Состояние ----------
const state = {
  series: [],
  activeId: null,
  scale: { xAuto: true, xMin: -10, xMax: 10, yAuto: true, yMin: -10, yMax: 10 },
  theme: "dark",
  showPoints: true,
  showGrid: true,
  showLegend: true,
  axisNames: { x: "x", y: "y" },
};
let seriesCounter = 0;

function newSeries(name) {
  const pal = THEMES[state.theme].palette;
  const color = pal[state.series.length % pal.length];
  const shape = SHAPES[state.series.length % SHAPES.length].id;
  const s = { id: "s" + ++seriesCounter, name, color, shape, points: [], hidden: false };
  state.series.push(s);
  return s;
}
const activeSeries = () => state.series.find((s) => s.id === state.activeId) || null;

// ---------- Утилиты ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function parseNum(str) {
  if (str === null || str === undefined) return NaN;
  const s = String(str).trim();
  if (s === "") return NaN;
  return parseFloat(s.replace(",", "."));
}
const isNum = (v) => isFinite(v);
const fmtInput = (v) => (isNum(v) ? v : "");

function fmtTick(v) {
  const abs = Math.abs(v);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-4)) {
    return v.toExponential(1).replace(".", ",");
  }
  return v.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
}

// ---------- «Красивый» шаг и шкала ----------
function niceStep(range, targetTicks = 6) {
  const rough = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let step;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  return step * mag;
}

function ticksIn(min, max, step) {
  const ticks = [];
  const start = Math.floor(min / step) * step;
  for (let t = start; t <= max + step * 1e-6; t += step) {
    ticks.push(parseFloat(t.toPrecision(12)));
  }
  return ticks;
}

function niceScale(min, max, targetTicks = 6) {
  if (!isNum(min) || !isNum(max) || min === max) {
    if (min === 0 || !isNum(min)) { min = -1; max = 1; }
    else { const pad = Math.abs(min) * 0.1 || 1; min -= pad; max += pad; }
  }
  const step = niceStep(max - min, targetTicks);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  return { min: niceMin, max: niceMax, step, ticks: ticksIn(niceMin, niceMax, step) };
}

// ---------- Границы данных ----------
function dataBounds() {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  state.series.forEach((s) => {
    s.points.forEach((p) => {
      if (isNum(p.x) && isNum(p.y)) {
        if (p.x < xMin) xMin = p.x;
        if (p.x > xMax) xMax = p.x;
        if (p.y < yMin) yMin = p.y;
        if (p.y > yMax) yMax = p.y;
      }
    });
  });
  if (!isFinite(xMin)) return { empty: true };
  return { empty: false, xMin, xMax, yMin, yMax };
}

function getRange(axis) {
  const d = dataBounds();
  if (d.empty) return { min: 0, max: 10, step: 2, ticks: [0, 2, 4, 6, 8, 10] };

  const auto = axis === "x" ? state.scale.xAuto : state.scale.yAuto;
  const dataMin = axis === "x" ? d.xMin : d.yMin;
  const dataMax = axis === "x" ? d.xMax : d.yMax;

  if (auto) {
    const span = dataMax - dataMin;
    const pad = (span || Math.abs(dataMax) || 1) * 0.08;
    return niceScale(dataMin - pad, dataMax + pad);
  }

  const uMin = axis === "x" ? state.scale.xMin : state.scale.yMin;
  const uMax = axis === "x" ? state.scale.xMax : state.scale.yMax;
  if (!isNum(uMin) || !isNum(uMax) || uMin >= uMax) {
    return niceScale(dataMin, dataMax); // защита от неверного ручного ввода
  }
  const step = niceStep(uMax - uMin);
  const ticks = ticksIn(uMin, uMax, step).filter((t) => t >= uMin - step * 1e-6 && t <= uMax + step * 1e-6);
  return { min: uMin, max: uMax, step, ticks };
}

// ---------- Canvas ----------
const canvasEl = () => $("#plot");
const ctx2d = () => canvasEl().getContext("2d");
let W = 0, H = 0;
let lastSize = null;
let legendHitAreas = [];
const PAD = { left: 60, right: 18, top: 18, bottom: 40 };

function resizeCanvas() {
  const wrap = $("#plotWrap");
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  if (w <= 0 || h <= 0) return;
  // Защита от повторных/осциллирующих перерисовок
  if (lastSize && lastSize.w === w && lastSize.h === h) return;
  lastSize = { w, h };

  const dpr = window.devicePixelRatio || 1;
  const c = canvasEl();
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  W = w;
  H = h;
  draw();
}

function draw() {
  if (W <= 0 || H <= 0) return;
  const ctx = ctx2d();
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const T = THEMES[state.theme];

  // Раскладка легенды под графиком (занимает нижнюю полосу canvas)
  let legend = null;
  if (state.showLegend && state.series.length > 0) legend = layoutLegendItems();
  const legendStripH = legend ? legend.stripH : 0;

  const pl = PAD.left, pr = PAD.right, pt = PAD.top;
  const pb = PAD.bottom + legendStripH;
  const pw = W - pl - pr, ph = H - pt - pb;
  if (pw <= 0 || ph <= 0) return;

  const xr = getRange("x");
  const yr = getRange("y");
  const sx = (x) => pl + ((x - xr.min) / (xr.max - xr.min)) * pw;
  const sy = (y) => pt + (1 - (y - yr.min) / (yr.max - yr.min)) * ph;

  // Фон и область построения
  ctx.fillStyle = T.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = T.plotBg;
  ctx.fillRect(pl, pt, pw, ph);

  ctx.font = '12px "Cascadia Code", Consolas, monospace';
  ctx.lineWidth = 1;

  // Сетка и подписи
  ctx.textBaseline = "middle";
  yr.ticks.forEach((t) => {
    const y = sy(t);
    if (state.showGrid) {
      ctx.strokeStyle = T.grid;
      line(ctx, pl, y, W - pr, y);
    }
    ctx.fillStyle = T.label;
    ctx.textAlign = "right";
    ctx.fillText(fmtTick(t), pl - 8, y);
  });
  ctx.textBaseline = "top";
  xr.ticks.forEach((t) => {
    const x = sx(t);
    if (state.showGrid) {
      ctx.strokeStyle = T.grid;
      line(ctx, x, pt, x, H - pb);
    }
    ctx.fillStyle = T.label;
    ctx.textAlign = "center";
    ctx.fillText(fmtTick(t), x, H - pb + 8);
  });

  // Оси
  ctx.strokeStyle = T.axis;
  line(ctx, pl, pt, pl, H - pb);
  line(ctx, pl, H - pb, W - pr, H - pb);

  // Подписи осей
  ctx.fillStyle = T.labelAxis;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(state.axisNames.x || "x", pl + pw / 2, H - legendStripH - 8);
  ctx.save();
  ctx.translate(16, pt + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText(state.axisNames.y || "y", 0, 0);
  ctx.restore();

  // Зависимости (клип по области построения)
  ctx.save();
  ctx.beginPath();
  ctx.rect(pl, pt, pw, ph);
  ctx.clip();

  state.series.forEach((s) => {
    if (s.hidden) return;
    const pts = s.points
      .filter((p) => isNum(p.x) && isNum(p.y))
      .slice()
      .sort((a, b) => a.x - b.x);
    if (pts.length === 0) return;

    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    pts.forEach((p, i) => {
      const X = sx(p.x), Y = sy(p.y);
      i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
    });
    ctx.stroke();

    if (state.showPoints) {
      pts.forEach((p) => {
        drawMarker(ctx, sx(p.x), sy(p.y), s.shape, s.color, 4, T.bg);
      });
    }
  });
  ctx.restore();

  // Легенда под графиком — рисуется на canvas, попадает в экспорт PNG/JPEG
  if (legend) drawLegendItems(ctx, T, legend, H);
}

function drawMarker(ctx, x, y, shape, color, r, outline) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  switch (shape) {
    case "square":
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.3;
      ctx.strokeRect(x - r, y - r, r * 2, r * 2);
      break;
    case "triangle":
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.25);
      ctx.lineTo(x + r * 1.15, y + r * 0.95);
      ctx.lineTo(x - r * 1.15, y + r * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      break;
    case "diamond":
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.25);
      ctx.lineTo(x + r * 1.15, y);
      ctx.lineTo(x, y + r * 1.25);
      ctx.lineTo(x - r * 1.15, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      break;
    case "cross":
      ctx.beginPath();
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r);
      ctx.lineTo(x - r, y + r);
      ctx.stroke();
      break;
    case "plus":
      ctx.beginPath();
      ctx.moveTo(x - r, y);
      ctx.lineTo(x + r, y);
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y + r);
      ctx.stroke();
      break;
    default: // circle
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.3;
      ctx.stroke();
  }
}

function layoutLegendItems() {
  const ctx = ctx2d();
  ctx.font = '12px "Segoe UI", "SF Pro Text", sans-serif';
  const lineH = 24, itemGap = 16, markerW = 20, gap = 7, padTop = 8, padBottom = 10;
  const left = PAD.left;
  const availW = W - PAD.left - PAD.right;
  const items = [];
  let x = left, line = 0, lines = 1;

  state.series.forEach((s) => {
    const tw = ctx.measureText(s.name).width;
    const itemW = markerW + gap + tw;
    const fullW = itemW + itemGap;
    if (x + fullW > left + availW && x > left) {
      x = left;
      line++;
      lines++;
    }
    items.push({ id: s.id, x, line, w: itemW, name: s.name, shape: s.shape, color: s.color, hidden: s.hidden });
    x += fullW;
  });

  return { items, stripH: lines * lineH + padTop + padBottom, lineH, padTop, padBottom, markerW, gap };
}

function drawLegendItems(ctx, T, legend, H) {
  legendHitAreas = [];
  const { items, stripH, lineH, padTop, padBottom, markerW, gap } = legend;
  const yTop = H - stripH + padTop;

  ctx.font = '12px "Segoe UI", "SF Pro Text", sans-serif';
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  items.forEach((it) => {
    const y = yTop + it.line * lineH + lineH / 2;
    ctx.globalAlpha = it.hidden ? 0.35 : 1;
    drawMarker(ctx, it.x + markerW / 2, y, it.shape, it.color, 3.6, T.bg);
    ctx.fillStyle = T.label;
    ctx.fillText(it.name, it.x + markerW + gap, y);
    ctx.globalAlpha = 1;
    legendHitAreas.push({ id: it.id, x: it.x, y: yTop + it.line * lineH, w: it.w + markerW + gap, h: lineH });
  });
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// ---------- Экспорт ----------
function download(type) {
  if (W <= 0 || H <= 0) return;
  const c = canvasEl();
  const isPng = type === "png";
  const url = c.toDataURL(isPng ? "image/png" : "image/jpeg", isPng ? undefined : 0.92);
  const a = document.createElement("a");
  a.href = url;
  a.download = `graph-${Date.now()}.${type}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ---------- Рендер UI ----------
function renderSeriesChips() {
  const wrap = $("#seriesChips");
  wrap.innerHTML = state.series
    .map(
      (s) => `
      <span class="series-chip ${s.id === state.activeId ? "active" : ""}" data-id="${s.id}">
        <span class="dot" style="background:${s.color}"></span>
        ${escapeHtml(s.name)}
        <button class="del" data-del="${s.id}" title="Удалить">✕</button>
      </span>`
    )
    .join("");

  $$(".series-chip", wrap).forEach((chip) => {
    chip.addEventListener("click", (e) => {
      if (e.target.closest(".del")) return;
      state.activeId = chip.dataset.id;
      renderAll();
    });
  });
  $$(".del", wrap).forEach((btn) => {
    btn.addEventListener("click", () => removeSeries(btn.dataset.del));
  });
}

function renderColorSwatches() {
  const s = activeSeries();
  const wrap = $("#colorSwatches");
  if (!s) { wrap.innerHTML = ""; return; }
  const pal = THEMES[state.theme].palette;
  wrap.innerHTML = pal
    .map(
      (c) => `<button class="color-sw ${c === s.color ? "active" : ""}" type="button" data-c="${c}" style="--c:${c}" title="${c}"></button>`
    )
    .join("");
  $$(".color-sw", wrap).forEach((sw) => {
    sw.addEventListener("click", () => {
      s.color = sw.dataset.c;
      renderAll();
    });
  });
}

function renderShapeSwatches() {
  const s = activeSeries();
  const wrap = $("#shapeSwatches");
  if (!s) { wrap.innerHTML = ""; return; }
  wrap.innerHTML = SHAPES.map(
    (sh) => `<button class="shape-sw ${sh.id === s.shape ? "active" : ""}" type="button" data-shape="${sh.id}" title="${sh.name}">${sh.glyph}</button>`
  ).join("");
  $$(".shape-sw", wrap).forEach((sw) => {
    sw.addEventListener("click", () => {
      s.shape = sw.dataset.shape;
      renderShapeSwatches();
      draw();
    });
  });
}

function renderPoints() {
  const s = activeSeries();
  const body = $("#pointsBody");
  if (!s) { body.innerHTML = ""; return; }
  body.innerHTML = s.points
    .map(
      (p, i) => `
      <tr>
        <td><input class="input input-num" type="number" data-idx="${i}" data-axis="x" value="${fmtInput(p.x)}" placeholder="x" inputmode="decimal"></td>
        <td><input class="input input-num" type="number" data-idx="${i}" data-axis="y" value="${fmtInput(p.y)}" placeholder="y" inputmode="decimal"></td>
        <td><button class="icon-btn" data-del="${i}" title="Удалить точку">✕</button></td>
      </tr>`
    )
    .join("");

  $$("input", body).forEach((inp) => {
    inp.addEventListener("input", () => {
      const idx = +inp.dataset.idx;
      const axis = inp.dataset.axis;
      s.points[idx][axis] = parseNum(inp.value);
      draw();
    });
  });
  $$(".icon-btn", body).forEach((btn) => {
    btn.addEventListener("click", () => {
      s.points.splice(+btn.dataset.del, 1);
      renderPoints();
      draw();
    });
  });
}

function renderEditor() {
  const s = activeSeries();
  const fields = $("#editorFields");
  const empty = $("#editorEmpty");
  if (!s) {
    fields.hidden = true;
    empty.hidden = false;
    return;
  }
  fields.hidden = false;
  empty.hidden = true;
  $("#editorName").value = s.name;
  renderColorSwatches();
  renderShapeSwatches();
  renderPoints();
}

function renderScale() {
  const { scale } = state;
  $("#xAuto").checked = scale.xAuto;
  $("#yAuto").checked = scale.yAuto;
  const set = (id, auto, val) => {
    const el = $(id);
    el.disabled = auto;
    el.value = auto ? "" : val;
  };
  set("#xMin", scale.xAuto, scale.xMin);
  set("#xMax", scale.xAuto, scale.xMax);
  set("#yMin", scale.yAuto, scale.yMin);
  set("#yMax", scale.yAuto, scale.yMax);
}

function renderThemeControls() {
  $$("#themeToggle .seg").forEach((b) => b.classList.toggle("active", b.dataset.theme === state.theme));
  $("#showGrid").checked = state.showGrid;
  $("#showPoints").checked = state.showPoints;
  $("#showLegend").checked = state.showLegend;
}

function renderAll() {
  renderSeriesChips();
  renderEditor();
  renderScale();
  renderThemeControls();
  draw();
}

// ---------- Действия ----------
function addSeries() {
  const s = newSeries(`Зависимость ${state.series.length + 1}`);
  // Копируем X из первой серии с точками (удобно для «общий X, разный Y»)
  const src = state.series.find((x) => x.id !== s.id && x.points.some((p) => isNum(p.x)));
  s.points = src ? src.points.map((p) => ({ x: p.x, y: NaN })) : [{ x: NaN, y: NaN }];
  state.activeId = s.id;
  renderAll();
}

function removeSeries(id) {
  const idx = state.series.findIndex((s) => s.id === id);
  if (idx === -1) return;
  state.series.splice(idx, 1);
  if (state.activeId === id) {
    state.activeId = state.series.length ? state.series[Math.max(0, idx - 1)].id : null;
  }
  renderAll();
}

function addPoint() {
  const s = activeSeries();
  if (!s) return;
  s.points.push({ x: NaN, y: NaN });
  renderPoints();
  draw();
}

function loadSample() {
  state.series = [];
  const a = newSeries("Квадрат");
  const b = newSeries("Половина квадрата");
  const xs = [0, 1, 2, 3, 4, 5];
  xs.forEach((x) => {
    a.points.push({ x, y: x * x });
    b.points.push({ x, y: 0.5 * x * x });
  });
  state.activeId = a.id;
  state.scale = { xAuto: true, xMin: -10, xMax: 10, yAuto: true, yMin: -10, yMax: 10 };
  renderAll();
}

function clearAll() {
  state.series = [];
  state.activeId = null;
  renderAll();
}

function setTheme(id) {
  if (!THEMES[id]) return;
  state.theme = id;
  const pal = THEMES[id].palette;
  state.series.forEach((s, i) => { s.color = pal[i % pal.length]; });
  renderThemeControls();
  renderSeriesChips();
  renderColorSwatches();
  draw();
}

// ---------- Масштаб: обработчики ----------
function initScale() {
  const bindAuto = (id, axis) => {
    $(id).addEventListener("change", (e) => {
      state.scale[axis] = e.target.checked;
      renderScale();
      draw();
    });
  };
  bindAuto("#xAuto", "xAuto");
  bindAuto("#yAuto", "yAuto");

  const bindMinMax = (id, key) => {
    $(id).addEventListener("input", (e) => {
      state.scale[key] = parseNum(e.target.value);
      draw();
    });
  };
  bindMinMax("#xMin", "xMin");
  bindMinMax("#xMax", "xMax");
  bindMinMax("#yMin", "yMin");
  bindMinMax("#yMax", "yMax");
}

// ---------- Тема и экспорт: обработчики ----------
function initTheme() {
  $$("#themeToggle .seg").forEach((b) => {
    b.addEventListener("click", () => setTheme(b.dataset.theme));
  });
  $("#showGrid").addEventListener("change", (e) => {
    state.showGrid = e.target.checked;
    draw();
  });
  $("#showPoints").addEventListener("change", (e) => {
    state.showPoints = e.target.checked;
    draw();
  });
  $("#showLegend").addEventListener("change", (e) => {
    state.showLegend = e.target.checked;
    draw();
  });
  $("#dlPng").addEventListener("click", () => download("png"));
  $("#dlJpeg").addEventListener("click", () => download("jpeg"));
}

// ---------- Названия осей ----------
function initAxisNames() {
  $("#axisNameX").value = state.axisNames.x;
  $("#axisNameY").value = state.axisNames.y;
  $("#axisNameX").addEventListener("input", (e) => {
    state.axisNames.x = e.target.value;
    draw();
  });
  $("#axisNameY").addEventListener("input", (e) => {
    state.axisNames.y = e.target.value;
    draw();
  });
}

// ---------- Утилиты ----------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------- Инициализация ----------
function init() {
  if (window.self !== window.top) document.body.classList.add("embedded");

  $("#addSeriesBtn").addEventListener("click", addSeries);
  $("#addPointBtn").addEventListener("click", addPoint);
  $("#sampleBtn").addEventListener("click", loadSample);
  $("#clearBtn").addEventListener("click", clearAll);
  $("#editorName").addEventListener("input", (e) => {
    const s = activeSeries();
    if (s) { s.name = e.target.value; renderSeriesChips(); draw(); }
  });

  initScale();
  initTheme();
  initAxisNames();

  // Клик по легенде (на canvas) — показать/скрыть зависимость
  canvasEl().addEventListener("click", (e) => {
    const c = canvasEl();
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (const a of legendHitAreas) {
      if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) {
        const s = state.series.find((s) => s.id === a.id);
        if (s) { s.hidden = !s.hidden; draw(); }
        return;
      }
    }
  });

  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe($("#plotWrap"));
  }
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("load", resizeCanvas);

  loadSample();
  resizeCanvas();
}

document.addEventListener("DOMContentLoaded", init);
