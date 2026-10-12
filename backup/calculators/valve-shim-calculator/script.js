/* ============================================================
   Калькулятор регулировочных шайб клапанов — логика
   Универсально для 8-клапанных двигателей (толкатель + шайба).
   Формула: Новая = Старая + Измеренный − Номинальный
   ============================================================ */

// ---------- Конфигурация по умолчанию ----------
const DEFAULTS = {
  nominalIn: 0.20, // номинальный зазор впускного клапана, мм
  nominalEx: 0.35, // номинальный зазор выпускного клапана, мм
  shimMin: 2.00,   // минимальная доступная шайба, мм
  shimMax: 4.50,   // максимальная доступная шайба, мм
  shimStep: 0.05,  // шаг ряда шайб, мм
};

let cfg = { ...DEFAULTS };

// Типовая схема 8-клапанного двигателя (счёт от шкива распредвала)
const VALVE_DEFS = [
  { num: 1, type: "ex", name: "Выпуск" },
  { num: 2, type: "in", name: "Впуск" },
  { num: 3, type: "in", name: "Впуск" },
  { num: 4, type: "ex", name: "Выпуск" },
  { num: 5, type: "ex", name: "Выпуск" },
  { num: 6, type: "in", name: "Впуск" },
  { num: 7, type: "in", name: "Впуск" },
  { num: 8, type: "ex", name: "Выпуск" },
];

// ---------- Утилиты ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const round2 = (v) => Math.round(v * 100) / 100;

function parseNum(str) {
  if (!str || str.trim() === "") return NaN;
  return parseFloat(String(str).replace(",", "."));
}

function formatMm(v) {
  if (!isFinite(v)) return "—";
  return (Math.round(v * 100) / 100).toFixed(2).replace(".", ",");
}

function getNominal(type) {
  return type === "in" ? cfg.nominalIn : cfg.nominalEx;
}

// ---------- Ряд шайб ----------
let SHIMS = generateShimRange();

function generateShimRange() {
  const list = [];
  const { shimMin, shimMax, shimStep } = cfg;
  if (shimStep <= 0 || shimStep > 1) return [3.0]; // защита от неверного шага
  for (let t = shimMin; t <= shimMax + shimStep * 0.01; t += shimStep) {
    list.push(round2(t));
  }
  return list;
}

function nearestShim(value) {
  if (!isFinite(value) || SHIMS.length === 0) return null;
  let best = SHIMS[0];
  let bestDiff = Infinity;
  for (const s of SHIMS) {
    const d = Math.abs(value - s);
    if (d < bestDiff) {
      best = s;
      bestDiff = d;
    }
  }
  return best;
}

// ---------- Рендер таблицы клапанов ----------
function createValveRow(v) {
  const nom = getNominal(v.type);
  return `
    <tr data-num="${v.num}">
      <td><span class="v-num ${v.type}">${v.num}</span></td>
      <td>
        <div class="valve-type">
          <span class="t">${v.name}</span>
          <span class="n">ном. ${formatMm(nom)} мм</span>
        </div>
      </td>
      <td>
        <input class="input input-num" type="number" id="gap-${v.num}" step="0.01" min="0" max="2"
               placeholder="0,28" inputmode="decimal">
      </td>
      <td>
        <input class="input input-num" type="number" id="old-${v.num}" step="0.01" min="1.5" max="6"
               placeholder="3,75" inputmode="decimal">
      </td>
      <td>
        <span class="res-val empty" id="res-${v.num}">—</span>
        <span class="res-exact" id="exact-${v.num}"></span>
      </td>
    </tr>`;
}

function rebuildTable() {
  // Сохраняем уже введённые значения при перестройке
  const saved = {};
  VALVE_DEFS.forEach((v) => {
    const g = $(`#gap-${v.num}`);
    const o = $(`#old-${v.num}`);
    if (g && o) saved[v.num] = { gap: g.value, old: o.value };
  });

  $("#valves").innerHTML = VALVE_DEFS.map(createValveRow).join("");

  VALVE_DEFS.forEach((v) => {
    const gap = $(`#gap-${v.num}`);
    const old = $(`#old-${v.num}`);
    if (saved[v.num]) {
      gap.value = saved[v.num].gap;
      old.value = saved[v.num].old;
    }
    [gap, old].forEach((el) => el.addEventListener("input", () => calcOne(v.num)));
  });
}

// ---------- Расчёт одного клапана ----------
function calcOne(num) {
  const v = VALVE_DEFS.find((x) => x.num === num);
  const gapEl = $(`#gap-${num}`);
  const oldEl = $(`#old-${num}`);
  const resEl = $(`#res-${num}`);
  const exactEl = $(`#exact-${num}`);

  const gap = parseNum(gapEl.value);
  const old = parseNum(oldEl.value);

  if (isNaN(gap) || isNaN(old)) {
    resEl.textContent = "—";
    resEl.className = "res-val empty";
    exactEl.textContent = "";
    return;
  }

  const exact = round2(old + gap - getNominal(v.type));
  const { shimMin, shimMax, shimStep } = cfg;

  // Вне доступного диапазона шайб — честно предупреждаем, а не «подгоняем»
  if (exact < shimMin - 1e-9 || exact > shimMax + 1e-9) {
    resEl.textContent = "вне диапазона";
    resEl.className = "res-val out";
    exactEl.textContent = `нужно ${formatMm(exact)} мм`;
    return;
  }

  const nearest = nearestShim(exact);
  const diff = Math.abs(exact - nearest);
  const state = diff > shimStep * 0.6 + 1e-9 ? "approx" : "ok";

  resEl.textContent = formatMm(nearest) + " мм";
  resEl.className = "res-val " + state;
  exactEl.textContent = `точно ${formatMm(exact)} мм`;
}

// ---------- Действия ----------
function clearAll() {
  VALVE_DEFS.forEach((v) => {
    $(`#gap-${v.num}`).value = "";
    $(`#old-${v.num}`).value = "";
    $(`#res-${v.num}`).textContent = "—";
    $(`#res-${v.num}`).className = "res-val empty";
    $(`#exact-${v.num}`).textContent = "";
  });
}

function fillExample() {
  const example = [
    { num: 1, gap: 0.42, old: 3.55 },
    { num: 2, gap: 0.28, old: 3.70 },
    { num: 3, gap: 0.18, old: 3.65 },
    { num: 4, gap: 0.38, old: 3.60 },
    { num: 5, gap: 0.45, old: 3.50 },
    { num: 6, gap: 0.22, old: 3.75 },
    { num: 7, gap: 0.31, old: 3.55 },
    { num: 8, gap: 0.33, old: 3.80 },
  ];
  example.forEach((e) => {
    $(`#gap-${e.num}`).value = e.gap;
    $(`#old-${e.num}`).value = e.old;
  });
  VALVE_DEFS.forEach((v) => calcOne(v.num));
}

// ---------- Настройки ----------
function updateInfoBox() {
  $("#info-in").textContent = formatMm(cfg.nominalIn) + " мм";
  $("#info-ex").textContent = formatMm(cfg.nominalEx) + " мм";
  $("#info-range").textContent = formatMm(cfg.shimMin) + " – " + formatMm(cfg.shimMax) + " мм";
  $("#info-step").textContent = formatMm(cfg.shimStep) + " мм";
}

function applySettings() {
  const inNom = parseNum($("#cfg-in").value);
  const exNom = parseNum($("#cfg-ex").value);
  const minS = parseNum($("#cfg-min").value);
  const maxS = parseNum($("#cfg-max").value);
  const step = parseNum($("#cfg-step").value);

  if ([inNom, exNom, minS, maxS, step].some(isNaN)) {
    alert("Проверь значения в настройках");
    return;
  }
  if (minS >= maxS) {
    alert("Мин. шайба должна быть меньше макс.");
    return;
  }
  if (step <= 0) {
    alert("Шаг должен быть больше 0");
    return;
  }

  cfg = { nominalIn: inNom, nominalEx: exNom, shimMin: minS, shimMax: maxS, shimStep: step };
  SHIMS = generateShimRange();
  updateInfoBox();
  rebuildTable();
  VALVE_DEFS.forEach((v) => calcOne(v.num));
}

function resetSettings() {
  cfg = { ...DEFAULTS };
  $("#cfg-in").value = cfg.nominalIn;
  $("#cfg-ex").value = cfg.nominalEx;
  $("#cfg-min").value = cfg.shimMin;
  $("#cfg-max").value = cfg.shimMax;
  $("#cfg-step").value = cfg.shimStep;
  SHIMS = generateShimRange();
  updateInfoBox();
  rebuildTable();
  VALVE_DEFS.forEach((v) => calcOne(v.num));
}

// ---------- Сворачивание настроек ----------
function initSettingsToggle() {
  const panel = $(".settings");
  const btn = $("#settingsToggle");
  const arrow = $(".settings-arrow");
  btn.addEventListener("click", () => {
    const open = panel.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
    arrow.textContent = open ? "скрыть ▴" : "показать ▾";
  });
}

// ---------- Инициализация ----------
function init() {
  // Встраивание в CalcHub: прячем внутреннюю кнопку «назад»
  if (window.self !== window.top) document.body.classList.add("embedded");

  $("#applyBtn").addEventListener("click", applySettings);
  $("#resetBtn").addEventListener("click", resetSettings);
  $("#exampleBtn").addEventListener("click", fillExample);
  $("#clearBtn").addEventListener("click", clearAll);

  initSettingsToggle();
  updateInfoBox();
  rebuildTable();
}

document.addEventListener("DOMContentLoaded", init);
