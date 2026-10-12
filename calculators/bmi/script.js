/* ============================================================
   Индекс массы тела — логика
   ИМТ + оценка по возрасту и полу, процент жира, обхват талии.
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);

const state = { sex: "male", method: "bmi" };

// ---------- Классификация ИМТ ----------
// Взрослые 18–64 (ВОЗ)
const ADULT_RANGES = [
  { max: 16, name: "Выраженный дефицит", key: "under", color: "#38bdf8", range: "< 16" },
  { max: 18.5, name: "Недостаточный вес", key: "under", color: "#38bdf8", range: "16 – 18,5" },
  { max: 25, name: "Норма", key: "normal", color: "#34d399", range: "18,5 – 25" },
  { max: 30, name: "Избыточный вес", key: "over", color: "#fbbf24", range: "25 – 30" },
  { max: 35, name: "Ожирение I степени", key: "obese", color: "#fb923c", range: "30 – 35" },
  { max: 40, name: "Ожирение II степени", key: "obese", color: "#f43f5e", range: "35 – 40" },
  { max: Infinity, name: "Ожирение III степени", key: "obese", color: "#e11d48", range: "> 40" },
];

// 65+ — рекомендуемый диапазон смещён вверх
const SENIOR_RANGES = [
  { max: 22, name: "Недостаточный вес", key: "under", color: "#38bdf8", range: "< 22" },
  { max: 27, name: "Норма (65+)", key: "normal", color: "#34d399", range: "22 – 27" },
  { max: 30, name: "Избыточный вес", key: "over", color: "#fbbf24", range: "27 – 30" },
  { max: Infinity, name: "Ожирение", key: "obese", color: "#f43f5e", range: "> 30" },
];

const rangesFor = (age) => (age >= 65 ? SENIOR_RANGES : ADULT_RANGES);

function classify(bmi, age) {
  const ranges = rangesFor(age);
  for (const r of ranges) if (bmi < r.max) return r;
  return ranges[ranges.length - 1];
}

// Процент жира (Deurenberg) — пол и возраст входят напрямую
const bodyFat = (bmi, age, isMale) => 1.2 * bmi + 0.23 * age - 10.8 * (isMale ? 1 : 0) - 5.4;

// Процент жира по методу ВМС США (обхваты в см) — точнее, чем по ИМТ
function bodyFatNavy(sex, height, waist, neck, hip) {
  const lg = Math.log10;
  let inner, denom;
  if (sex === "male") {
    inner = waist - neck;
    if (inner <= 0) return null;
    denom = 1.0324 - 0.19077 * lg(inner) + 0.15456 * lg(height);
  } else {
    inner = waist + hip - neck;
    if (inner <= 0) return null;
    denom = 1.29579 - 0.35004 * lg(inner) + 0.221 * lg(height);
  }
  if (denom <= 0) return null;
  const bf = 495 / denom - 450;
  return isFinite(bf) ? bf : null;
}

// Норма жира и талии — РАЗНАЯ для мужчин и женщин
const FAT_NORM = { male: [10, 20], female: [18, 28] };
const WAIST_NORM = { male: 94, female: 80 };

// Идеальный вес (формула Devine) — тоже зависит от пола
function idealWeight(heightCm, isMale) {
  const over = Math.max(0, heightCm / 2.54 - 60);
  return isMale ? 50 + 2.3 * over : 45.5 + 2.3 * over;
}

// Оценка талии по полу
function waistInfo(waist, isMale) {
  const lim = WAIST_NORM[isMale ? "male" : "female"];
  if (waist < lim) return { name: "Норма", cls: "d-ok", norm: `норма до ${lim} см` };
  if (waist < lim + (isMale ? 8 : 8)) return { name: "Повышенный риск", cls: "d-warn", norm: `норма до ${lim} см` };
  return { name: "Высокий риск", cls: "d-bad", norm: `норма до ${lim} см` };
}

// ---------- Утилиты ----------
function parseNum(el) {
  const s = String(el.value).trim();
  if (s === "") return NaN;
  const v = parseFloat(s.replace(",", "."));
  return isFinite(v) ? v : NaN;
}
const num = (v, d = 1) => v.toFixed(d).replace(".", ",");

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ---------- Статус ----------
function setStatus(msg, kind) {
  const el = $("#bmiStatus");
  el.textContent = msg || "";
  el.className = "status" + (kind ? " " + kind : "");
}

// ---------- Блок половых норм ----------
function renderSexNorms() {
  const isMale = state.sex === "male";
  const fn = FAT_NORM[state.sex];
  $("#sexNorms").innerHTML = `
    <span class="sn-item">Норма жира: <b>${fn[0]}–${fn[1]} %</b></span>
    <span class="sn-item">Талия: <b>до ${WAIST_NORM[state.sex]} см</b></span>`;
}

// ---------- Вид полей под выбранный метод ----------
function applyMethodUI() {
  const navy = state.method === "navy";
  $("#neckWrap").hidden = !navy;
  $("#hipWrap").hidden = !(navy && state.sex === "female");
  $("#waistHint").textContent = navy ? "нужно" : "необязательно";
  $("#methodHint").textContent = navy
    ? `Формула ВМС США: измерь талию и шею${state.sex === "female" ? " и бёдра" : ""} (сантиметром).`
    : "Оценка по формуле Deurenberg — по ИМТ, возрасту и полу.";
}

// ---------- Таблица норм ----------
function renderNormTable(activeRange, age) {
  $("#normsHint").textContent = age >= 65
    ? "Для возраста 65+ рекомендуемый диапазон ИМТ смещён вверх."
    : "Классификация ВОЗ для взрослых (18–64 года).";
  $("#normsBody").innerHTML = rangesFor(age)
    .map((r) => `<tr class="${r === activeRange ? "active" : ""}">
      <td class="n-range">${r.range}</td><td>${r.name}</td></tr>`)
    .join("");
}

// ---------- Сброс ----------
function reset() {
  $("#bmiValue").textContent = "—";
  const v = $("#bmiVerdict");
  v.textContent = "";
  v.style.color = "";
  const badge = $("#bmiCat");
  badge.innerHTML = "";
  badge.style.cssText = "";
  $("#scaleMarker").hidden = true;
  $("#bmiDetails").innerHTML = '<p class="bmi-placeholder">Заполни возраст, рост и вес и нажми «Рассчитать».</p>';
  renderNormTable(null, 30);
}

// ---------- Расчёт ----------
function render(verbose) {
  const age = parseNum($("#age"));
  const height = parseNum($("#height"));
  const weight = parseNum($("#weight"));
  const waist = parseNum($("#waist"));
  const isMale = state.sex === "male";

  const missing = [];
  if (!isFinite(age)) missing.push("возраст");
  if (!isFinite(height)) missing.push("рост");
  if (!isFinite(weight)) missing.push("вес");
  if (missing.length) {
    reset();
    if (verbose) setStatus("Укажи: " + missing.join(", "), "err");
    return;
  }
  if (age < 2 || age > 120 || height < 50 || height > 250 || weight < 10 || weight > 400) {
    reset();
    if (verbose) setStatus("Проверь значения: возраст 2–120, рост 50–250 см, вес 10–400 кг.", "err");
    return;
  }

  const hM = height / 100;
  const bmi = weight / (hM * hM);
  const cat = classify(bmi, age);

  // Процент жира — по выбранному методу
  const fn = FAT_NORM[state.sex];
  let bf = null;
  let bfNote = "";
  if (state.method === "navy") {
    const neck = parseNum($("#neck"));
    const hip = parseNum($("#hip"));
    const okNeck = isFinite(neck);
    const okHip = isMale || isFinite(hip);
    if (isFinite(waist) && okNeck && okHip) {
      bf = bodyFatNavy(state.sex, height, waist, neck, isFinite(hip) ? hip : 0);
      bfNote = "метод ВМС США (по обхватам)";
    } else {
      bfNote = `укажи ${isMale ? "талию и шею" : "талию, шею и бёдра"}`;
    }
    if (bf === null && bfNote === "метод ВМС США (по обхватам)") bfNote = "проверь обхваты (талия должна быть больше шеи)";
  } else {
    bf = bodyFat(bmi, age, isMale);
    bfNote = "формула Deurenberg (по ИМТ)";
  }
  bf = bf !== null && isFinite(bf) ? Math.max(3, Math.min(65, bf)) : null;

  const bfAbove = bf !== null && bf > fn[1];

  $("#bmiValue").textContent = num(bmi, 1);

  const badge = $("#bmiCat");
  badge.style.color = cat.color;
  badge.style.background = hexA(cat.color, 0.12);
  badge.style.borderColor = hexA(cat.color, 0.45);
  badge.innerHTML = `<span class="dot"></span>${cat.name}`;

  // Метка на шкале
  const clamped = Math.max(15, Math.min(40, bmi));
  const marker = $("#scaleMarker");
  marker.hidden = false;
  marker.style.paddingLeft = ((clamped - 15) / 25 * 100).toFixed(2) + "%";

  // Вердикт: ИМТ по возрасту + половая норма жира
  let text, color;
  if (cat.key === "normal" && bfAbove) {
    text = "▲ ИМТ в норме, но жир выше нормы для вашего пола";
    color = "#fbbf24";
  } else if (cat.key === "normal") {
    text = "✓ В норме";
    color = cat.color;
  } else if (cat.key === "under") {
    text = "▲ ИМТ ниже нормы";
    color = cat.color;
  } else if (cat.key === "over") {
    text = "▲ ИМТ выше нормы";
    color = cat.color;
  } else {
    text = "✕ ИМТ значительно выше нормы";
    color = cat.color;
  }
  const verdictEl = $("#bmiVerdict");
  verdictEl.textContent = text;
  verdictEl.style.color = color;

  // Данные
  const wMin = 18.5 * hM * hM, wMax = 24.9 * hM * hM;
  const ideal = idealWeight(height, isMale);
  const bfCls = bf === null ? "d-warn" : bf < fn[0] ? "d-info" : bf <= fn[1] ? "d-ok" : "d-warn";

  const rows = [];
  rows.push(`
    <div class="detail-row">
      <span class="d-name">Рекомендуемый ИМТ</span>
      <span class="d-val d-info">${cat.range}<span class="d-sub">${age >= 65 ? "для возраста 65+ (смещён вверх)" : "стандарт ВОЗ, 18–64 года"}</span></span>
    </div>`);
  rows.push(`
    <div class="detail-row">
      <span class="d-name">Нормальный вес по ИМТ</span>
      <span class="d-val d-info">${num(wMin, 1)} – ${num(wMax, 1)} кг<span class="d-sub">диапазон ИМТ 18,5 – 24,9</span></span>
    </div>`);
  rows.push(`
    <div class="detail-row">
      <span class="d-name">Идеальный вес (для ${isMale ? "мужчин" : "женщин"})</span>
      <span class="d-val d-info">${num(ideal, 1)} кг<span class="d-sub">формула Devine, с учётом пола</span></span>
    </div>`);
  if (bf !== null) {
    rows.push(`
      <div class="detail-row">
        <span class="d-name">Процент жира (оценка)</span>
        <span class="d-val ${bfCls}">${num(bf, 1)} %<span class="d-sub">${bfNote} · норма для ${isMale ? "мужчин" : "женщин"}: ${fn[0]}–${fn[1]} %</span></span>
      </div>`);
  } else {
    rows.push(`
      <div class="detail-row">
        <span class="d-name">Процент жира</span>
        <span class="d-val d-warn">—<span class="d-sub">${bfNote}</span></span>
      </div>`);
  }

  if (isFinite(waist) && waist >= 30) {
    const wi = waistInfo(waist, isMale);
    rows.push(`
      <div class="detail-row">
        <span class="d-name">Обхват талии</span>
        <span class="d-val ${wi.cls}">${wi.name}<span class="d-sub">${num(waist, 0)} см · ${wi.norm}</span></span>
      </div>`);
  }

  $("#bmiDetails").innerHTML = rows.join("");
  renderNormTable(cat, age);

  if (verbose) {
    setStatus(age < 18
      ? "Для возраста до 18 лет нормы ИМТ определяются по центильным таблицам — оценка ориентировочная."
      : "Расчёт ориентировочный и не заменяет консультацию врача.",
      age < 18 ? "err" : "ok");
  }
  return true;
}

// ---------- Инициализация ----------
function init() {
  if (window.self !== window.top) document.body.classList.add("embedded");

  const FIELDS = ["#age", "#height", "#weight", "#waist", "#neck", "#hip"];

  document.querySelectorAll("#sexToggle .seg").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.sex = btn.dataset.sex;
      document.querySelectorAll("#sexToggle .seg").forEach((b) => b.classList.toggle("active", b === btn));
      renderSexNorms();
      applyMethodUI(); // у женщин в методе «по обхватам» появляется поле «бёдра»
      render();
    });
  });

  document.querySelectorAll("#fatMethod .seg").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.method = btn.dataset.method;
      document.querySelectorAll("#fatMethod .seg").forEach((b) => b.classList.toggle("active", b === btn));
      applyMethodUI();
      render();
    });
  });

  FIELDS.forEach((sel) => $(sel).addEventListener("input", () => render()));

  $("#bmiCalc").addEventListener("click", () => render(true));
  $("#bmiClear").addEventListener("click", () => {
    FIELDS.forEach((sel) => { $(sel).value = ""; });
    reset();
    setStatus("");
  });

  renderSexNorms();
  applyMethodUI();
  reset();
}

document.addEventListener("DOMContentLoaded", init);
