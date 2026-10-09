/* ============================================================
   Закон Ома — логика
   Введи ровно два из: U (напряжение), I (ток), R (сопротивление),
   P (мощность) → нажми «Рассчитать» → остальные вычислятся.
   ============================================================ */

const FIELDS = [
  { key: "v", sym: "U", name: "Напряжение", unit: "В" },
  { key: "i", sym: "I", name: "Ток", unit: "А" },
  { key: "r", sym: "R", name: "Сопротивление", unit: "Ом" },
  { key: "p", sym: "P", name: "Мощность", unit: "Вт" },
];

// ---------- Утилиты ----------
const $ = (sel, root = document) => root.querySelector(sel);

function parseNum(str) {
  if (str === null || str === undefined) return NaN;
  const s = String(str).trim();
  if (s === "") return NaN;
  return parseFloat(s.replace(",", "."));
}
const isNum = (v) => isFinite(v);

function fmt(v) {
  if (!isFinite(v)) return "";
  // Без разделителей тысяч, с запятой — значение можно переиспользовать
  const r = Math.round(v * 1e4) / 1e4;
  return String(r).replace(".", ",");
}

// ---------- Решение: по двум известным — два остальных ----------
function solvePair(k1, v1, k2, v2) {
  const m = { [k1]: v1, [k2]: v2 };
  const V = m.v, I = m.i, R = m.r, P = m.p;
  const out = {};

  if (isNum(V) && isNum(I)) {
    out.r = V / I;
    out.p = V * I;
  } else if (isNum(V) && isNum(R)) {
    out.i = V / R;
    out.p = (V * V) / R;
  } else if (isNum(V) && isNum(P)) {
    out.i = P / V;
    out.r = (V * V) / P;
  } else if (isNum(I) && isNum(R)) {
    out.v = I * R;
    out.p = I * I * R;
  } else if (isNum(I) && isNum(P)) {
    out.v = P / I;
    out.r = P / (I * I);
  } else if (isNum(R) && isNum(P)) {
    out.v = Math.sqrt(P * R);
    out.i = Math.sqrt(P / R);
  }
  return out;
}

// ---------- Статус ----------
function setStatus(msg, kind) {
  const el = $("#status");
  el.textContent = msg || "";
  el.className = "status" + (kind ? " " + kind : "");
}

// ---------- Расчёт ----------
function calculate() {
  // Какие поля заполнены
  const filled = FIELDS.filter((f) => isNum(parseNum($(`#in-${f.key}`).value)));

  if (filled.length !== 2) {
    setStatus(
      filled.length < 2 ? "Введи ровно два значения." : "Заполнено больше двух значений — оставь ровно два.",
      "err"
    );
    return;
  }

  const v1 = parseNum($(`#in-${filled[0].key}`).value);
  const v2 = parseNum($(`#in-${filled[1].key}`).value);
  const out = solvePair(filled[0].key, v1, filled[1].key, v2);

  let ok = true;
  FIELDS.forEach((f) => {
    if (filled.some((x) => x.key === f.key)) return; // введённые не трогаем
    const val = out[f.key];
    if (isNum(val)) {
      $(`#in-${f.key}`).value = fmt(val);
      $(`.field[data-key="${f.key}"]`).classList.add("result");
    } else {
      ok = false;
    }
  });

  setStatus(ok ? "Готово" : "Не удалось вычислить (проверь значения — возможно, деление на ноль).", ok ? "ok" : "err");
}

// ---------- Сброс подсветки результатов ----------
function clearResults(exceptKey) {
  FIELDS.forEach((f) => {
    const card = $(`.field[data-key="${f.key}"]`);
    if (f.key === exceptKey) {
      card.classList.remove("result");
    } else if (card.classList.contains("result")) {
      $(`#in-${f.key}`).value = "";
      card.classList.remove("result");
    }
  });
}

// ---------- Инициализация ----------
function init() {
  if (window.self !== window.top) document.body.classList.add("embedded");

  $("#calcBtn").addEventListener("click", calculate);
  $("#clearBtn").addEventListener("click", () => {
    FIELDS.forEach((f) => {
      $(`#in-${f.key}`).value = "";
      $(`.field[data-key="${f.key}"]`).classList.remove("result");
    });
    setStatus("");
  });

  // При вводе — убираем старые результаты и статус
  FIELDS.forEach((f) => {
    $(`#in-${f.key}`).addEventListener("input", () => {
      clearResults(f.key);
      setStatus("");
    });
  });
}

document.addEventListener("DOMContentLoaded", init);
