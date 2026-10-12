/* ============================================================
   SMD-коды — логика
   Единый калькулятор с выбором типа: резисторы, конденсаторы,
   индуктивности. Расшифровка маркировки на корпусе.
   ============================================================ */

// ---------- Утилиты ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const SUP = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

function trimNum(v) {
  if (!isFinite(v)) return "—";
  const r = Math.round(v * 1e4) / 1e4;
  return String(r).replace(".", ",");
}

function fmtResistance(ohm) {
  const a = Math.abs(ohm);
  if (a >= 1e6) return trimNum(ohm / 1e6) + " МОм";
  if (a >= 1e3) return trimNum(ohm / 1e3) + " кОм";
  if (a >= 1) return trimNum(ohm) + " Ом";
  if (a >= 1e-3) return trimNum(ohm * 1e3) + " мОм";
  return trimNum(ohm * 1e6) + " мкОм";
}

function fmtCapacitance(pf) {
  const a = Math.abs(pf);
  if (a >= 1e9) return trimNum(pf / 1e9) + " мФ";
  if (a >= 1e6) return trimNum(pf / 1e6) + " мкФ";
  if (a >= 1e3) return trimNum(pf / 1e3) + " нФ";
  return trimNum(pf) + " пФ";
}

function fmtInductance(nH) {
  const a = Math.abs(nH);
  if (a >= 1e9) return trimNum(nH / 1e9) + " Гн";
  if (a >= 1e6) return trimNum(nH / 1e6) + " мГн";
  if (a >= 1e3) return trimNum(nH / 1e3) + " мкГн";
  return trimNum(nH) + " нГн";
}

// ---------- EIA-96 (для 1% резисторов) ----------
const EIA96 = [
  100, 102, 105, 107, 110, 113, 115, 118, 121, 124, 127, 130, 133, 137, 140, 143,
  147, 150, 154, 158, 162, 165, 169, 174, 178, 182, 187, 191, 196, 200, 205, 210,
  215, 221, 226, 232, 237, 243, 249, 255, 261, 267, 274, 280, 287, 294, 301, 309,
  316, 324, 332, 340, 348, 357, 365, 374, 383, 392, 402, 412, 422, 432, 442, 453,
  464, 475, 487, 499, 511, 523, 536, 549, 562, 576, 590, 604, 619, 634, 649, 665,
  681, 698, 715, 732, 750, 768, 787, 806, 825, 845, 866, 887, 909, 931, 953, 976,
];

const EIA96_MULT = {
  Z: 0.001, Y: 0.01, X: 0.1, A: 1, B: 10, C: 100, D: 1000, E: 10000, F: 100000,
};

// Десятичная точка: "4R7" -> 4.7
function decodeDecimal(code, marker) {
  const parts = code.split(marker);
  if (parts.length > 2) return null;
  const intPart = parts[0] === "" ? "0" : parts[0];
  const fracPart = parts[1] || "";
  const v = parseFloat(intPart + "." + fracPart);
  return isFinite(v) ? v : null;
}

// ---------- Резисторы ----------
function decodeResistor(input) {
  const raw = input.trim();
  if (!raw) return null;
  const code = raw.toUpperCase();

  // EIA-96: 2 цифры + буква-множитель (например, 01C, 68X)
  if (/^\d{2}[A-Z]$/.test(code) && code[2] in EIA96_MULT) {
    const mant = EIA96[parseInt(code.slice(0, 2), 10) - 1];
    const mult = EIA96_MULT[code[2]];
    const value = mant * mult;
    return {
      main: fmtResistance(value),
      breakdown: `EIA-96: мантисса ${mant} × ${mult} = ${trimNum(value)} Ом`,
      type: "EIA-96 (1%)",
    };
  }

  // R — десятичная точка (Ом)
  if (code.includes("R")) {
    const v = decodeDecimal(code, "R");
    if (v === null) return { error: "Не удалось распознать код" };
    return {
      main: fmtResistance(v),
      breakdown: `R — десятичная точка: ${trimNum(v)} Ом`,
      type: "Код с «R»",
    };
  }

  // Миллиомы: нижняя «m» или «L» (например, 2m2, 5L6)
  if (raw.includes("m") || code.includes("L")) {
    const v = decodeDecimal(code.replace(/M|L/g, "M"), "M");
    if (v !== null && isFinite(v)) {
      return {
        main: fmtResistance(v / 1000),
        breakdown: `Миллиомы: ${trimNum(v)} мОм`,
        type: "мОм (токочувствительные)",
      };
    }
  }

  // 4-значный код (Ом)
  if (/^\d{4}$/.test(code)) {
    const digits = code.slice(0, 3);
    const mult = parseInt(code[3], 10);
    const value = parseInt(digits, 10) * Math.pow(10, mult);
    return {
      main: fmtResistance(value),
      breakdown: `${digits} × 10${SUP[mult]} = ${trimNum(value)} Ом`,
      type: "4-значный код",
    };
  }

  // 3-значный код (Ом)
  if (/^\d{3}$/.test(code)) {
    const digits = code.slice(0, 2);
    const mult = parseInt(code[2], 10);
    const value = parseInt(digits, 10) * Math.pow(10, mult);
    return {
      main: fmtResistance(value),
      breakdown: `${digits} × 10${SUP[mult]} = ${trimNum(value)} Ом`,
      type: "3-значный код",
    };
  }

  return { error: "Не удалось распознать код" };
}

// ---------- Конденсаторы ----------
function decodeCapacitor(input) {
  const raw = input.trim();
  if (!raw) return null;
  const code = raw.toUpperCase();

  // R — десятичная точка (пФ)
  if (code.includes("R")) {
    const v = decodeDecimal(code, "R");
    if (v === null) return { error: "Не удалось распознать код" };
    return {
      main: fmtCapacitance(v),
      breakdown: `R — десятичная точка: ${trimNum(v)} пФ`,
      type: "Код с «R»",
    };
  }

  // Цифровой код (1–3 знака): результат в пФ
  if (/^\d{1,3}$/.test(code)) {
    let pf;
    let breakdown;
    if (code.length === 3) {
      const digits = code.slice(0, 2);
      const mult = parseInt(code[2], 10);
      pf = parseInt(digits, 10) * Math.pow(10, mult);
      breakdown = `${digits} × 10${SUP[mult]} = ${trimNum(pf)} пФ`;
    } else {
      pf = parseInt(code, 10);
      breakdown = `${trimNum(pf)} пФ`;
    }
    return {
      main: fmtCapacitance(pf),
      breakdown: breakdown,
      type: "3-значный код (пФ)",
    };
  }

  return { error: "Не удалось распознать код" };
}

// ---------- Индуктивности ----------
function decodeInductor(input) {
  const raw = input.trim();
  if (!raw) return null;
  const code = raw.toUpperCase();

  // N — десятичная точка (нГн)
  if (code.includes("N")) {
    const v = decodeDecimal(code, "N");
    if (v === null) return { error: "Не удалось распознать код" };
    return {
      main: fmtInductance(v),
      breakdown: `N — десятичная точка: ${trimNum(v)} нГн`,
      type: "Код с «N» (нГн)",
    };
  }

  // R — десятичная точка (мкГн)
  if (code.includes("R")) {
    const v = decodeDecimal(code, "R");
    if (v === null) return { error: "Не удалось распознать код" };
    return {
      main: fmtInductance(v * 1000),
      breakdown: `R — десятичная точка: ${trimNum(v)} мкГн`,
      type: "Код с «R» (мкГн)",
    };
  }

  // 3-значный код (мкГн)
  if (/^\d{3}$/.test(code)) {
    const digits = code.slice(0, 2);
    const mult = parseInt(code[2], 10);
    const uh = parseInt(digits, 10) * Math.pow(10, mult);
    return {
      main: fmtInductance(uh * 1000),
      breakdown: `${digits} × 10${SUP[mult]} = ${trimNum(uh)} мкГн`,
      type: "3-значный код (мкГн)",
    };
  }

  // 1–2 знака — прямое значение в мкГн
  if (/^\d{1,2}$/.test(code)) {
    const uh = parseInt(code, 10);
    return {
      main: fmtInductance(uh * 1000),
      breakdown: `${trimNum(uh)} мкГн`,
      type: "мкГн",
    };
  }

  return { error: "Не удалось распознать код" };
}

// ---------- Конфигурация вкладок ----------
const TABS = {
  resistor: {
    label: "Резисторы",
    hint: "Введи 3-значный, 4-значный код, «R» или EIA-96.",
    decode: decodeResistor,
    examples: ["103", "1001", "4R7", "01C", "R47"],
    tips: [
      "<b>103</b> → 10 × 10³ = 10 кОм",
      "<b>1001</b> → 100 × 10¹ = 1 кОм",
      "<b>4R7</b> → 4,7 Ом (R — точка)",
      "<b>01C</b> → EIA-96: 10 кОм (1%)",
    ],
  },
  capacitor: {
    label: "Конденсаторы",
    hint: "Введи 3-значный код (результат в пФ).",
    decode: decodeCapacitor,
    examples: ["104", "470", "100", "4R7"],
    tips: [
      "<b>104</b> → 10 × 10⁴ = 100 нФ",
      "<b>470</b> → 47 × 10⁰ = 47 пФ",
      "<b>100</b> → 10 пФ",
    ],
  },
  inductor: {
    label: "Индуктивности",
    hint: "Введи 3-значный код (мкГн) или «N»/«R».",
    decode: decodeInductor,
    examples: ["471", "102", "4R7", "4N7"],
    tips: [
      "<b>471</b> → 47 × 10¹ = 470 мкГн",
      "<b>102</b> → 10 × 10² = 1000 мкГн (1 мГн)",
      "<b>4R7</b> → 4,7 мкГн",
      "<b>4N7</b> → 4,7 нГн",
    ],
  },
};

let activeTab = "resistor";

// ---------- Рендер ----------
function renderTabs() {
  $$("#smdTabs .seg").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === activeTab);
  });
}

function renderTabContent() {
  const t = TABS[activeTab];
  $("#smdTitle").textContent = t.label;
  $("#smdHint").textContent = t.hint;
  $("#smdExamples").innerHTML = t.examples
    .map((e) => `<button class="chip" type="button">${e}</button>`)
    .join("");
  $$("#smdExamples .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $("#smdInput").value = chip.textContent;
      decodeAndRender();
    });
  });
  $("#smdTipList").innerHTML = t.tips.map((tip) => `<li>${tip}</li>`).join("");
}

function decodeAndRender() {
  const resultEl = $("#smdResult");
  const code = $("#smdInput").value;
  if (!code.trim()) {
    resultEl.innerHTML = '<span class="smd-empty">Введи код — значение появится здесь</span>';
    return;
  }
  const res = TABS[activeTab].decode(code);
  if (!res || res.error) {
    resultEl.innerHTML = `<span class="smd-error">${res ? res.error : "Не удалось распознать код"}</span>`;
    return;
  }
  resultEl.innerHTML = `
    <span class="smd-value">${res.main}</span>
    <span class="smd-breakdown">${res.breakdown}</span>
    <span class="smd-type">${res.type}</span>`;
}

// ---------- Инициализация ----------
function init() {
  if (window.self !== window.top) document.body.classList.add("embedded");

  $$("#smdTabs .seg").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      renderTabs();
      renderTabContent();
      decodeAndRender();
    });
  });

  $("#smdInput").addEventListener("input", decodeAndRender);

  renderTabs();
  renderTabContent();
  decodeAndRender();
}

document.addEventListener("DOMContentLoaded", init);
