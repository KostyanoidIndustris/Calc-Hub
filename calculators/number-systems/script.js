/* ============================================================
   Системы счисления — логика
   Перевод между основаниями 2–36 с пошаговым выводом расчёта.
   Внутри — BigInt, поэтому длинные числа считаются точно.
   ============================================================ */

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MIN_BASE = 2, MAX_BASE = 36, MAX_LEN = 32;
const SUB = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
const SUP = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

const BASE_NAMES = {
  2: "Двоичная", 3: "Троичная", 4: "Четверичная", 5: "Пятеричная",
  6: "Шестиричная", 7: "Семеричная", 8: "Восьмеричная", 9: "Девятеричная",
  10: "Десятичная", 11: "Одиннадцатеричная", 12: "Двенадцатеричная",
  13: "Тринадцатеричная", 14: "Четырнадцатеричная", 15: "Пятнадцатеричная",
  16: "Шестнадцатеричная", 17: "Семнадцатеричная", 18: "Восемнадцатеричная",
  19: "Девятнадцатеричная", 20: "Двадцатеричная",
};
const COMMON = { 2: "BIN", 8: "OCT", 10: "DEC", 16: "HEX" };

const baseName = (b) => BASE_NAMES[b] || `${b}-ричная`;
const sub = (n) => String(n).split("").map((d) => SUB[+d]).join("");

// ---------- Утилиты ----------
const $ = (sel, root = document) => root.querySelector(sel);

function digitValue(ch) {
  const i = DIGITS.indexOf(String(ch).toUpperCase());
  return i === -1 ? null : i;
}

// Разбор числа в заданном основании → BigInt
function parseInBase(str, base) {
  const raw = String(str).trim().replace(/\s+/g, "");
  if (!raw) return { error: "Введи число" };
  let s = raw.toUpperCase();
  let neg = false;
  if (s[0] === "-" || s[0] === "−") { neg = true; s = s.slice(1); }
  if (!s) return { error: "Введи число" };
  if (s.length > MAX_LEN) return { error: `Слишком длинное число (максимум ${MAX_LEN} знаков)` };

  for (const ch of s) {
    const d = digitValue(ch);
    if (d === null) return { error: `Символ «${ch}» недопустим` };
    if (d >= base) return { error: `Символ «${ch}» недопустим для основания ${base}` };
  }

  const b = BigInt(base);
  let value = 0n;
  for (const ch of s) value = value * b + BigInt(digitValue(ch));
  return { value: neg ? -value : value, digits: s, neg };
}

// BigInt → строка в нужном основании
function toBase(value, base) {
  if (value === 0n) return "0";
  const neg = value < 0n;
  let v = neg ? -value : value;
  const b = BigInt(base);
  let out = "";
  while (v > 0n) {
    out = DIGITS[Number(v % b)] + out;
    v = v / b;
  }
  return (neg ? "-" : "") + out;
}

// Пошаговое разложение по степеням основания (исходное → десятичное)
function expansion(digits, base) {
  const chars = digits.split("");
  const n = chars.length;
  const terms = chars.map((ch, i) => {
    const power = n - 1 - i;
    const d = digitValue(ch);
    const termValue = BigInt(d) * BigInt(base) ** BigInt(power);
    return { d, power, termValue };
  });
  const sum = terms.reduce((acc, t) => acc + t.termValue, 0n);
  return { terms, sum };
}

// Пошаговое деление (десятичное → нужное основание)
function divisionSteps(value, base) {
  const steps = [];
  const b = BigInt(base);
  let v = value < 0n ? -value : value;
  if (v === 0n) return steps;
  while (v > 0n) {
    const q = v / b;
    const r = Number(v % b);
    steps.push({ dividend: v, quotient: q, remainder: r, digit: DIGITS[r] });
    v = q;
  }
  return steps;
}

// ---------- Состояние ----------
let lastValue = null;
let lastBase = 10;
let lastDigits = "";
let targetTouched = false;

// ---------- Рендер ----------
function setStatus(msg, kind) {
  const el = $("#nsStatus");
  el.textContent = msg || "";
  el.className = "status" + (kind ? " " + kind : "");
}

function renderSteps() {
  const wrap = $("#nsSteps");
  if (lastValue === null) {
    wrap.innerHTML = '<p class="ns-placeholder">Введи число, выбери систему и нажми «Рассчитать».</p>';
    return;
  }

  const target = +$("#nsTargetBase").value;
  const sign = lastValue < 0n ? "-" : "";
  const abs = lastValue < 0n ? -lastValue : lastValue;

  // 1) разложение по степеням
  const { terms, sum } = expansion(lastDigits, lastBase);
  const termText = terms
    .map((t) => `${t.d} × ${lastBase}${SUP[t.power] !== undefined ? SUP[t.power] : "^" + t.power}`)
    .join(" + ");
  const valueText = terms.map((t) => t.termValue.toString()).join(" + ");

  // 2) деление в целевую систему
  const steps = divisionSteps(abs, target);
  const divLines = steps
    .map((s) => `${s.dividend} ÷ ${target} = ${s.quotient} <span class="rem">ост. ${s.remainder}</span>`)
    .join("<br>");
  const readBack = steps.map((s) => s.digit).reverse().join("");

  const resultStr = toBase(lastValue, target);

  wrap.innerHTML = `
    <div class="ns-big">
      ${sign}${lastDigits}${sub(lastBase)} = <span class="accent">${resultStr}${sub(target)}</span>
    </div>

    <div class="ns-block">
      <div class="ns-step-title">1 · Разложение по степеням (→ десятичная)</div>
      <div class="ns-formula">
        ${termText}<br>
        = ${valueText}<br>
        = <b>${sign}${sum}</b>
      </div>
    </div>

    <div class="ns-block">
      <div class="ns-step-title">2 · Деление на ${target} (→ ${baseName(target)})</div>
      ${steps.length
        ? `<div class="ns-div">${divLines}</div>
           <div class="ns-result-line">Остатки снизу вверх: ${steps.map((s) => s.digit).reverse().join(" ")} → <b>${sign}${readBack}</b></div>`
        : `<div class="ns-formula">Число равно нулю: <b>0</b></div>`}
    </div>`;
}

function renderTable() {
  const body = $("#nsTableBody");
  if (lastValue === null) {
    body.innerHTML = '<tr><td colspan="3" class="ns-placeholder">—</td></tr>';
    return;
  }
  const rows = [];
  for (let b = MIN_BASE; b <= MAX_BASE; b++) {
    const val = toBase(lastValue, b);
    const badge = COMMON[b] ? `<span class="ns-badge">${COMMON[b]}</span>` : "";
    rows.push(`
      <tr class="${COMMON[b] ? "common" : ""}">
        <td class="b-num">${b}</td>
        <td class="b-name">${baseName(b)}${badge}</td>
        <td class="b-val">${val}</td>
      </tr>`);
  }
  body.innerHTML = rows.join("");
}

function calculate() {
  const base = +$("#nsBase").value;
  const res = parseInBase($("#nsValue").value, base);
  if (res.error) {
    lastValue = null;
    setStatus(res.error, "err");
    renderSteps();
    renderTable();
    return;
  }
  lastValue = res.value;
  lastBase = base;
  lastDigits = res.digits;

  // Разумный целевой раздел по умолчанию (пока пользователь его не менял)
  if (!targetTouched) {
    $("#nsTargetBase").value = lastBase === 2 ? "10" : "2";
  }

  setStatus(`Готово: ${res.digits}${sub(base)} = ${res.value} в десятичной`, "ok");
  renderSteps();
  renderTable();
}

function clearAll() {
  $("#nsValue").value = "";
  lastValue = null;
  setStatus("");
  renderSteps();
  renderTable();
}

// ---------- Инициализация ----------
function fillSelect(sel, selected) {
  const el = $(sel);
  el.innerHTML = "";
  for (let b = MIN_BASE; b <= MAX_BASE; b++) {
    const o = document.createElement("option");
    o.value = String(b);
    o.textContent = `${b} · ${baseName(b)}`;
    el.appendChild(o);
  }
  el.value = String(selected);
}

function initExamples() {
  const examples = [
    { v: "1011", b: 2, label: "1011₂" },
    { v: "777", b: 8, label: "777₈" },
    { v: "FF", b: 16, label: "FF₁₆" },
    { v: "255", b: 10, label: "255₁₀" },
    { v: "Z", b: 36, label: "Z₃₆" },
    { v: "102", b: 3, label: "102₃" },
  ];
  $("#nsExamples").innerHTML = examples
    .map((e) => `<button class="chip" type="button" data-v="${e.v}" data-b="${e.b}">${e.label}</button>`)
    .join("");
  document.querySelectorAll("#nsExamples .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $("#nsValue").value = chip.dataset.v;
      $("#nsBase").value = chip.dataset.b;
      calculate();
    });
  });
}

function init() {
  if (window.self !== window.top) document.body.classList.add("embedded");

  fillSelect("#nsBase", 10);
  fillSelect("#nsTargetBase", 2);
  initExamples();

  $("#nsCalc").addEventListener("click", calculate);
  $("#nsClear").addEventListener("click", clearAll);
  $("#nsTargetBase").addEventListener("change", () => {
    targetTouched = true;
    if (lastValue !== null) renderSteps();
  });
  $("#nsValue").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); calculate(); }
  });
}

document.addEventListener("DOMContentLoaded", init);
