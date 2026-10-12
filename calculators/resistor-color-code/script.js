/* ============================================================
   Цветовая маркировка резисторов — логика
   4 / 5 / 6 полос: сопротивление, допуск, ТКС
   ============================================================ */

// ---------- Данные цветового кода (IEC 60062) ----------
// digit — цифра, mult — множитель, tol — допуск (%), tcr — ТКС (ppm/°C)
const COLORS = [
  { id: "black",  name: "Чёрный",      hex: "#1b1b1f", text: "#fff", digit: 0, mult: 1e0,  tol: null, tcr: null },
  { id: "brown",  name: "Коричневый",  hex: "#8a4b2a", text: "#fff", digit: 1, mult: 1e1,  tol: 1,    tcr: 100 },
  { id: "red",    name: "Красный",     hex: "#e53935", text: "#fff", digit: 2, mult: 1e2,  tol: 2,    tcr: 50  },
  { id: "orange", name: "Оранжевый",   hex: "#fb8c00", text: "#fff", digit: 3, mult: 1e3,  tol: null, tcr: 15  },
  { id: "yellow", name: "Жёлтый",      hex: "#fbc02d", text: "#111", digit: 4, mult: 1e4,  tol: null, tcr: 25  },
  { id: "green",  name: "Зелёный",     hex: "#43a047", text: "#fff", digit: 5, mult: 1e5,  tol: 0.5,  tcr: null },
  { id: "blue",   name: "Синий",       hex: "#1e88e5", text: "#fff", digit: 6, mult: 1e6,  tol: 0.25, tcr: 10  },
  { id: "violet", name: "Фиолетовый",  hex: "#8e24aa", text: "#fff", digit: 7, mult: 1e7,  tol: 0.1,  tcr: 5   },
  { id: "gray",   name: "Серый",       hex: "#757575", text: "#fff", digit: 8, mult: 1e8,  tol: 0.05, tcr: null },
  { id: "white",  name: "Белый",       hex: "#f0f0f0", text: "#111", digit: 9, mult: 1e9,  tol: null, tcr: null },
  { id: "gold",   name: "Золотой",     hex: "#e0b64f", text: "#111", digit: null, mult: 1e-1, tol: 5,   tcr: null },
  { id: "silver", name: "Серебряный",  hex: "#b8bfc6", text: "#111", digit: null, mult: 1e-2, tol: 10,  tcr: null },
];

const colorById = (id) => COLORS.find((c) => c.id === id);

// ---------- Роли полос в зависимости от их количества ----------
function rolesFor(bands) {
  if (bands === 4) return ["digit", "digit", "mult", "tol"];
  if (bands === 5) return ["digit", "digit", "digit", "mult", "tol"];
  return ["digit", "digit", "digit", "mult", "tol", "tcr"]; // 6
}

const ROLE_LABEL = {
  digit: "цифра",
  mult: "множитель",
  tol: "допуск",
  tcr: "ТКС",
};

const BAND_NAMES = {
  4: ["1-я полоса", "2-я полоса", "Множитель", "Допуск"],
  5: ["1-я полоса", "2-я полоса", "3-я полоса", "Множитель", "Допуск"],
  6: ["1-я полоса", "2-я полоса", "3-я полоса", "Множитель", "Допуск", "ТКС"],
};

// Какие цвета доступны для каждой роли
function allowedFor(role) {
  return COLORS.filter((c) => c[role] !== null);
}

// Значения по умолчанию: коричневый(1), затем чёрные(0), ×100, ±5%, 100 ppm
function defaultSelection(bands) {
  const roles = rolesFor(bands);
  const sel = [];
  let digitIndex = 0;
  roles.forEach((role) => {
    if (role === "digit") sel.push(digitIndex++ === 0 ? "brown" : "black");
    else if (role === "mult") sel.push("red");
    else if (role === "tol") sel.push("gold");
    else if (role === "tcr") sel.push("brown");
  });
  return sel;
}

// ---------- Состояние ----------
const state = { bands: 4, selection: defaultSelection(4) };

// ---------- Утилиты форматирования ----------
function fmt(n) {
  if (!isFinite(n)) return "—";
  if (Number.isInteger(n)) return n.toLocaleString("ru-RU");
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });
}

function formatResistance(ohms) {
  const abs = Math.abs(ohms);
  if (abs >= 1e9) return fmt(ohms / 1e9) + " ГΩ";
  if (abs >= 1e6) return fmt(ohms / 1e6) + " МΩ";
  if (abs >= 1e3) return fmt(ohms / 1e3) + " кΩ";
  return fmt(ohms) + " Ω";
}

function multLabel(mult) {
  const map = {
    1e0: "×1", 1e1: "×10", 1e2: "×100", 1e3: "×1 k", 1e4: "×10 k",
    1e5: "×100 k", 1e6: "×1 M", 1e7: "×10 M", 1e8: "×100 M", 1e9: "×1 G",
    1e-1: "×0.1", 1e-2: "×0.01",
  };
  return map[mult] ?? `×${mult}`;
}

function fmtTolerance(tol) {
  return "±" + fmt(tol) + " %";
}

// ---------- Рендер переключателя полос ----------
function renderToggle() {
  $$("#bandToggle .seg").forEach((btn) => {
    btn.classList.toggle("active", +btn.dataset.bands === state.bands);
  });
}

// ---------- Рендер селекторов полос ----------
function renderBands() {
  const container = $("#bands");
  const roles = rolesFor(state.bands);
  const names = BAND_NAMES[state.bands];

  container.innerHTML = state.selection
    .map((colorId, i) => {
      const role = roles[i];
      const options = allowedFor(role)
        .map((c) => {
          const active = c.id === colorId ? " active" : "";
          return `<button type="button" class="swatch${active}" data-color="${c.id}"
                    title="${c.name}" aria-label="${c.name}" style="--c:${c.hex};--check:${c.text}"></button>`;
        })
        .join("");
      const current = colorById(colorId);
      const meaning = roleMeaning(role, current);

      return `
        <div class="band" data-role="${role}">
          <div class="band-head">
            <span class="band-label">${names[i]}</span>
            <span class="band-role">${ROLE_LABEL[role]}</span>
            <span class="band-current">${current.name}${meaning ? " · " + meaning : ""}</span>
          </div>
          <div class="swatches">${options}</div>
        </div>`;
    })
    .join("");

  // Обработчики
  $$(".swatch", container).forEach((sw) => {
    sw.addEventListener("click", () => {
      const band = sw.closest(".band");
      const idx = $$(".band", container).indexOf(band);
      state.selection[idx] = sw.dataset.color;
      renderBands();
      renderResult();
    });
  });
}

function roleMeaning(role, color) {
  if (role === "digit") return String(color.digit);
  if (role === "mult") return multLabel(color.mult);
  if (role === "tol") return fmtTolerance(color.tol);
  if (role === "tcr") return `±${color.tcr} ppm/°C`;
  return "";
}

// ---------- Расчёт ----------
function compute() {
  const roles = rolesFor(state.bands);
  let digits = "";
  let mult = 1, tol = null, tcr = null;

  state.selection.forEach((colorId, i) => {
    const c = colorById(colorId);
    const role = roles[i];
    if (role === "digit") digits += c.digit;
    else if (role === "mult") mult = c.mult;
    else if (role === "tol") tol = c.tol;
    else if (role === "tcr") tcr = c.tcr;
  });

  const value = parseInt(digits, 10) * mult;
  return { value, tol, tcr };
}

// ---------- Рендер результата ----------
function renderResult() {
  const { value, tol, tcr } = compute();

  $("#resultValue").textContent = formatResistance(value);

  const parts = [`= ${fmt(value)} Ω`];
  if (tol !== null) parts.push(`точность ${fmtTolerance(tol)}`);
  $("#resultMeta").textContent = parts.join(" · ");

  // Диапазон значений с учётом допуска
  if (tol !== null) {
    const lo = value * (1 - tol / 100);
    const hi = value * (1 + tol / 100);
    $("#resultRange").textContent = `Диапазон: ${formatResistance(lo)} — ${formatResistance(hi)}`;
  } else {
    $("#resultRange").textContent = "";
  }

  // Бейджи
  const badges = [];
  if (tol !== null) badges.push(`<span class="badge-chip">Допуск ${fmtTolerance(tol)}</span>`);
  if (tcr !== null) badges.push(`<span class="badge-chip tcr">ТКС ±${tcr} ppm/°C</span>`);
  $("#resultBadges").innerHTML = badges.join("");

  renderSvg();
}

// ---------- Рендер схемы резистора ----------
function renderSvg() {
  const svg = $("#resistorSvg");
  const N = state.bands;
  const body = { x: 95, y: 42, w: 270, h: 66, rx: 14 };
  const bandW = 15, gap = 8, lastGap = 20, inset = 18;

  const defs = `
    <defs>
      <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e7c792"/>
        <stop offset="1" stop-color="#c39553"/>
      </linearGradient>
      <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#d6dbe2"/>
        <stop offset="1" stop-color="#9aa2ad"/>
      </linearGradient>
    </defs>`;

  // Выводы (провода)
  const leadY = body.y + body.h / 2;
  const leads = `
    <line x1="8" y1="${leadY}" x2="${body.x}" y2="${leadY}" stroke="url(#leadGrad)" stroke-width="9" stroke-linecap="round"/>
    <line x1="${body.x + body.w}" y1="${leadY}" x2="452" y2="${leadY}" stroke="url(#leadGrad)" stroke-width="9" stroke-linecap="round"/>`;

  // Позиции полос
  let x = body.x + inset;
  const bandRects = [];
  for (let i = 0; i < N; i++) {
    if (i === N - 1) x += lastGap - gap; // увеличенный зазор перед последней полосой
    const c = colorById(state.selection[i]);
    const stroke = c.hex === "#1b1b1f" ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.3)";
    bandRects.push(`<rect x="${x}" y="${body.y}" width="${bandW}" height="${body.h}" fill="${c.hex}" stroke="${stroke}" stroke-width="1"/>`);
    x += bandW + gap;
  }
  const bands = bandRects.join("");

  // Блик (глянец)
  const gloss = `<rect x="${body.x}" y="${body.y}" width="${body.w}" height="${body.h * 0.45}" rx="${body.rx}" fill="rgba(255,255,255,.18)"/>`;

  svg.innerHTML = `
    ${defs}
    ${leads}
    <rect x="${body.x}" y="${body.y}" width="${body.w}" height="${body.h}" rx="${body.rx}" fill="url(#bodyGrad)" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>
    ${bands}
    ${gloss}`;
}

// ---------- Справочная таблица ----------
function renderTable() {
  const head = `
    <thead>
      <tr>
        <th>Цвет</th><th>Цифра</th><th>Множитель</th><th>Допуск</th><th>ТКС (ppm/°C)</th>
      </tr>
    </thead>`;
  const body = `
    <tbody>
      ${COLORS.map((c) => `
        <tr>
          <td><span class="color-cell"><span class="color-dot" style="--c:${c.hex}"></span>${c.name}</span></td>
          <td>${c.digit !== null ? c.digit : '<span class="na">—</span>'}</td>
          <td>${c.mult !== null ? multLabel(c.mult) : '<span class="na">—</span>'}</td>
          <td>${c.tol !== null ? fmtTolerance(c.tol) : '<span class="na">—</span>'}</td>
          <td>${c.tcr !== null ? "±" + c.tcr : '<span class="na">—</span>'}</td>
        </tr>`).join("")}
    </tbody>`;
  $("#colorTable").innerHTML = head + body;
}

// ---------- Копирование значения ----------
function initCopy() {
  const btn = $("#copyBtn");
  btn.addEventListener("click", async () => {
    const { value, tol, tcr } = compute();
    let text = formatResistance(value);
    if (tol !== null) text += ` ${fmtTolerance(tol)}`;
    if (tcr !== null) text += ` ТКС ±${tcr} ppm/°C`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback для старых браузеров / file://
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    btn.textContent = "Скопировано ✓";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = "Копировать значение";
      btn.classList.remove("copied");
    }, 1600);
  });
}

// ---------- Утилиты ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- Инициализация ----------
function init() {
  // Встраивание в CalcHub: прячем внутреннюю кнопку «назад»
  if (window.self !== window.top) document.body.classList.add("embedded");

  renderToggle();
  renderBands();
  renderResult();
  renderTable();
  initCopy();

  $$("#bandToggle .seg").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.bands = +btn.dataset.bands;
      state.selection = defaultSelection(state.bands);
      renderToggle();
      renderBands();
      renderResult();
    });
  });
}

document.addEventListener("DOMContentLoaded", init);
