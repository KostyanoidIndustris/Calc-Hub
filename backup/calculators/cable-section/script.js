/* ============================================================
   Сечение проводников — логика
   Два режима:
     exact — нагрев + падение напряжения (с реактивным сопротивлением)
             + потери + поправочные коэффициенты;
     rough — быстрый подбор только по длительно допустимому току.
   ============================================================ */

// ---------- Данные ----------
const SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];

// Длительно допустимый ток, А (ПВХ, 2–3 жилы, 25 °C, в трубе)
const AMP_CU = [16, 25, 32, 40, 55, 75, 95, 120, 145, 180, 220, 260, 300, 350, 410];
const AMP_AL = [0, 19, 26, 34, 46, 60, 80, 95, 120, 150, 185, 215, 250, 290, 330];

const RHO = { cu: 0.0175, al: 0.028 }; // удельное сопротивление, Ом·мм²/м
const X0 = 0.00008;                     // реактивное сопротивление, Ом/м
const MIN_SECTION = { cu: 1.5, al: 2.5 };
const MATERIAL_NAME = { cu: "медь", al: "алюминий" };

const TIP_EXACT = `
  <strong>Точный расчёт учитывает:</strong>
  <ul>
    <li><b>Нагрев</b> — длительно допустимый ток с поправками на температуру, способ прокладки и группу кабелей.</li>
    <li><b>Падение напряжения</b> — активное и реактивное сопротивление линии, 1ф и 3ф.</li>
    <li><b>Потери мощности</b> и КПД линии.</li>
    <li><b>Минимум по механической прочности</b> — 1,5 мм² для меди, 2,5 мм² для алюминия.</li>
    <li>Расчёт ориентировочный; для ответственных линий сверяйтесь с ПУЭ.</li>
  </ul>`;

const TIP_ROUGH = `
  <strong>Грубый расчёт — быстро, без уточнений:</strong>
  <ul>
    <li>Сечение берётся <b>только по длительно допустимому току</b> из таблицы.</li>
    <li><b>Не учитываются:</b> длина линии, падение напряжения, температура, способ прокладки, группа кабелей.</li>
    <li>Принято <b>cos φ = 1</b> (активная нагрузка) — для двигателей берите точный режим.</li>
    <li>Подходит для прикидки. Для длинных линий и ответственных участков — переключите на «Точный».</li>
  </ul>`;

const state = { phases: 1, loadMode: "power", material: "cu", mode: "exact" };

// ---------- Утилиты ----------
const $ = (sel, root = document) => root.querySelector(sel);

function parseNum(el) {
  const s = String(el.value).trim();
  if (s === "") return NaN;
  const v = parseFloat(s.replace(",", "."));
  return isFinite(v) ? v : NaN;
}
function num(v, d = 1) {
  if (!isFinite(v)) return "—";
  return v.toFixed(d).replace(".", ",");
}
const sectionStr = (s) => num(s, s < 10 ? 1 : 0);
const ampOf = (s, mat) => (mat === "cu" ? AMP_CU : AMP_AL)[SECTIONS.indexOf(s)];

// Наименьшее стандартное сечение с допустимым током >= I
function pickByAmp(mat, I, kTotal) {
  const arr = mat === "cu" ? AMP_CU : AMP_AL;
  for (let i = 0; i < SECTIONS.length; i++) {
    if (arr[i] > 0 && arr[i] * kTotal >= I) return SECTIONS[i];
  }
  return null;
}

// ---------- Статус ----------
function setStatus(msg, kind) {
  const el = $("#csStatus");
  el.textContent = msg || "";
  el.className = "status" + (kind ? " " + kind : "");
}

// ---------- Сброс ----------
function reset() {
  $("#csValue").textContent = "—";
  $("#csSub").textContent = "";
  $("#csDetails").innerHTML = '<p class="cs-placeholder">Заполни параметры и нажми «Рассчитать».</p>';
  renderTable(null);
}

// ---------- Таблица токов ----------
function renderTable(pick) {
  $("#ampBody").innerHTML = SECTIONS
    .map((s, i) => `<tr class="${s === pick ? "pick" : ""}">
        <td class="a-s">${num(s, s < 10 ? 1 : 0)}</td>
        <td class="a-i">${AMP_CU[i] || "—"}</td>
        <td class="a-i">${AMP_AL[i] || "—"}</td>
      </tr>`)
    .join("");
}

// ---------- Общий сбор нагрузки ----------
function readLoad(U, kPower, cosf, bad) {
  let I = NaN, PkW = NaN;
  if (state.loadMode === "power") {
    const P = parseNum($("#power"));
    if (!isFinite(P) || P <= 0) bad.push("мощность");
    else { PkW = P; I = (P * 1000) / (kPower * U * cosf); }
  } else {
    const A = parseNum($("#current"));
    if (!isFinite(A) || A <= 0) bad.push("ток");
    else { I = A; PkW = (kPower * U * A * cosf) / 1000; }
  }
  return { I, PkW };
}

// ---------- Грубый режим ----------
function renderRough(I, PkW, phases, mat) {
  const sHeat = pickByAmp(mat, I, 1);
  if (sHeat === null) {
    reset();
    setStatus("Ток слишком велик — свыше 240 мм², нужно несколько линий.", "err");
    return;
  }
  const sFinal = Math.max(sHeat, MIN_SECTION[mat]);
  const ampAllow = ampOf(sFinal, mat);
  const density = I / sFinal;

  const other = mat === "cu" ? "al" : "cu";
  const sAltRaw = pickByAmp(other, I, 1);
  const sAlt = sAltRaw === null ? null : Math.max(sAltRaw, MIN_SECTION[other]);

  $("#csValue").textContent = sectionStr(sFinal) + " мм²";
  $("#csSub").textContent = `${MATERIAL_NAME[mat]} · ${phases === 1 ? "однофазная" : "трёхфазная"} · быстрый подбор по току`;

  const rows = [];
  rows.push(`
    <div class="cs-row">
      <span class="r-name">Расчётный ток</span>
      <span class="r-val r-info">${num(I, 1)} А<span class="r-sub">${num(PkW, 2)} кВт · принято cos φ = 1</span></span>
    </div>`);
  rows.push(`
    <div class="cs-row highlight">
      <span class="r-name">Подбор по таблице токов</span>
      <span class="r-val r-info">${sectionStr(sFinal)} мм²<span class="r-sub">допустимый ток ${ampAllow} А ≥ ${num(I, 1)} А</span></span>
    </div>`);
  rows.push(`
    <div class="cs-row">
      <span class="r-name">Плотность тока</span>
      <span class="r-val ${density <= 10 ? "r-ok" : "r-warn"}">${num(density, 1)} А/мм²<span class="r-sub">${density <= 6 ? "спокойный режим" : density <= 10 ? "норма" : "высокая"}</span></span>
    </div>`);
  if (sAlt !== null) {
    rows.push(`
      <div class="cs-row">
        <span class="r-name">Альтернатива: ${MATERIAL_NAME[other]}</span>
        <span class="r-val r-info">${sectionStr(sAlt)} мм²<span class="r-sub">эквивалент по току</span></span>
      </div>`);
  }

  $("#csDetails").innerHTML = rows.join("");
  renderTable(sFinal);
  setStatus("Грубый расчёт: без учёта длины, падения напряжения и поправочных коэффициентов.", "");
}

// ---------- Точный режим ----------
function renderExact(I, PkW, U, phases, mat, cosf, len, dropPct, kTotal) {
  const kPower = phases === 1 ? 1 : Math.sqrt(3);
  const kDrop = phases === 1 ? 2 : Math.sqrt(3);
  const sinf = Math.sqrt(Math.max(0, 1 - cosf * cosf));
  const dropMax = (U * dropPct) / 100;

  // 1) по нагреву (с поправками)
  const sHeat = pickByAmp(mat, I, kTotal);
  // 2) по падению напряжения
  let sDrop = null;
  for (const s of SECTIONS) {
    const R = (RHO[mat] * len) / s;
    if (kDrop * I * (R * cosf + X0 * len * sinf) <= dropMax) { sDrop = s; break; }
  }
  const parts = [sHeat, sDrop, MIN_SECTION[mat]].filter((v) => v !== null && isFinite(v));
  const sFinal = parts.length ? Math.max(...parts) : null;

  if (sFinal === null) {
    reset();
    setStatus("Ток слишком велик — сечение свыше 240 мм², нужно несколько линий.", "err");
    return;
  }

  const R = (RHO[mat] * len) / sFinal;
  const X = X0 * len;
  const dU = kDrop * I * (R * cosf + X * sinf);
  const dUPct = (dU / U) * 100;
  const Ploss = (phases === 1 ? 2 : 3) * I * I * R;
  const Pload = kPower * U * I * cosf;
  const eff = (Pload / (Pload + Ploss)) * 100;
  const ampActual = ampOf(sFinal, mat) * kTotal;
  const dropOk = dU <= dropMax + 1e-9;

  const other = mat === "cu" ? "al" : "cu";
  const altHeat = pickByAmp(other, I, kTotal);
  let altDrop = null;
  for (const s of SECTIONS) {
    const Ra = (RHO[other] * len) / s;
    if (kDrop * I * (Ra * cosf + X0 * len * sinf) <= dropMax) { altDrop = s; break; }
  }
  const altParts = [altHeat, altDrop, MIN_SECTION[other]].filter((v) => v !== null && isFinite(v));
  const sAlt = altParts.length ? Math.max(...altParts) : null;

  $("#csValue").textContent = sectionStr(sFinal) + " мм²";
  $("#csSub").textContent = `${MATERIAL_NAME[mat]} · ${phases === 1 ? "однофазная" : "трёхфазная"} линия · ток ${num(I, 1)} А`;

  const rows = [];
  rows.push(`
    <div class="cs-row">
      <span class="r-name">Расчётный ток</span>
      <span class="r-val r-info">${num(I, 1)} А<span class="r-sub">мощность ${num(PkW, 2)} кВт · cos φ ${num(cosf, 2)}</span></span>
    </div>`);
  rows.push(`
    <div class="cs-row">
      <span class="r-name">Сечение по нагреву</span>
      <span class="r-val ${sHeat === sFinal && sHeat !== null ? "r-ok" : ""}">${sHeat !== null ? sectionStr(sHeat) + " мм²" : "> 240 мм²"}<span class="r-sub">по длительному току</span></span>
    </div>`);
  rows.push(`
    <div class="cs-row">
      <span class="r-name">Сечение по падению</span>
      <span class="r-val ${sDrop === sFinal && sDrop !== null ? "r-ok" : ""}">${sDrop !== null ? sectionStr(sDrop) + " мм²" : "> 240 мм²"}<span class="r-sub">при допустимых ${num(dropPct, 1)} %</span></span>
    </div>`);
  rows.push(`
    <div class="cs-row highlight">
      <span class="r-name">Поправочный коэффициент</span>
      <span class="r-val r-info">${num(kTotal, 2)}<span class="r-sub">прокладка × температура × группа</span></span>
    </div>`);
  rows.push(`
    <div class="cs-row">
      <span class="r-name">Допустимый ток выбранного</span>
      <span class="r-val ${ampActual >= I ? "r-ok" : "r-bad"}">${num(ampActual, 1)} А<span class="r-sub">${ampActual >= I ? "запас есть" : "недостаточно!"}</span></span>
    </div>`);
  rows.push(`
    <div class="cs-row">
      <span class="r-name">Падение напряжения</span>
      <span class="r-val ${dropOk ? "r-ok" : "r-bad"}">${num(dU, 2)} В · ${num(dUPct, 2)} %<span class="r-sub">допустимо ${num(dropPct, 1)} %</span></span>
    </div>`);
  rows.push(`
    <div class="cs-row">
      <span class="r-name">Потери в линии</span>
      <span class="r-val ${Ploss / Pload < 0.05 ? "r-ok" : "r-warn"}">${num(Ploss, 1)} Вт<span class="r-sub">КПД линии ${num(eff, 2)} %</span></span>
    </div>`);
  rows.push(`
    <div class="cs-row">
      <span class="r-name">Сопротивление жилы</span>
      <span class="r-val r-info">${num(R, 3)} Ом<span class="r-sub">на длине ${num(len, 0)} м</span></span>
    </div>`);
  if (sAlt !== null) {
    rows.push(`
      <div class="cs-row">
        <span class="r-name">Альтернатива: ${MATERIAL_NAME[other]}</span>
        <span class="r-val r-info">${sectionStr(sAlt)} мм²<span class="r-sub">эквивалент по току и падению</span></span>
      </div>`);
  }
  if (sFinal === MIN_SECTION[mat] && (sHeat === null || sHeat < MIN_SECTION[mat]) && (sDrop === null || sDrop < MIN_SECTION[mat])) {
    rows.push(`
      <div class="cs-row">
        <span class="r-name">Принято по механической прочности</span>
        <span class="r-val r-warn">${sectionStr(MIN_SECTION[mat])} мм²<span class="r-sub">минимум для ${MATERIAL_NAME[mat]}</span></span>
      </div>`);
  }

  $("#csDetails").innerHTML = rows.join("");
  renderTable(sFinal);
  setStatus(dropOk
    ? "Готово: сечение подобрано с учётом нагрева, падения напряжения и условий прокладки."
    : "Внимание: падение напряжения превышает допустимое.", dropOk ? "ok" : "err");
}

// ---------- Расчёт ----------
function calculate(verbose) {
  const phases = state.phases;
  const mat = state.material;
  const rough = state.mode === "rough";
  const U = parseNum($("#volt"));
  const kPower = phases === 1 ? 1 : Math.sqrt(3);
  const cosf = rough ? 1 : parseNum($("#cosf"));

  const bad = [];
  if (!isFinite(U) || U <= 0) bad.push("напряжение");
  if (!rough && (!isFinite(cosf) || cosf <= 0 || cosf > 1)) bad.push("cos φ (0,1–1)");

  let len = NaN, dropPct = NaN, kTotal = 1;
  if (!rough) {
    len = parseNum($("#len"));
    dropPct = parseNum($("#drop"));
    if (!isFinite(len) || len <= 0) bad.push("длину линии");
    if (!isFinite(dropPct) || dropPct <= 0) bad.push("допустимое падение");
    kTotal = parseFloat($("#lay").value) * parseFloat($("#temp").value) * parseFloat($("#group").value);
  }

  const { I, PkW } = readLoad(U, kPower, cosf, bad);

  if (bad.length) {
    reset();
    if (verbose) setStatus("Укажи: " + bad.join(", "), "err");
    return;
  }

  if (rough) renderRough(I, PkW, phases, mat);
  else renderExact(I, PkW, U, phases, mat, cosf, len, dropPct, kTotal);
}

// ---------- Вид под режим ----------
function applyModeUI() {
  const rough = state.mode === "rough";
  $("#cosfWrap").hidden = rough;
  $("#lineExtra").hidden = rough;
  $("#conditionsPanel").hidden = rough;
  $("#modeHint").textContent = rough
    ? "Быстрый подбор по току: без cos φ, длины и поправочных коэффициентов."
    : "Полный расчёт: cos φ, длина, падение напряжения, температура, способ прокладки и группа.";
  $("#tipBox").innerHTML = rough ? TIP_ROUGH : TIP_EXACT;
}

// ---------- Инициализация ----------
function init() {
  if (window.self !== window.top) document.body.classList.add("embedded");

  let voltageTouched = false;

  $("#modeToggle").querySelectorAll(".seg").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.mode = btn.dataset.mode;
      $("#modeToggle").querySelectorAll(".seg").forEach((b) => b.classList.toggle("active", b === btn));
      applyModeUI();
      calculate();
    });
  });

  $("#phaseToggle").querySelectorAll(".seg").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.phases = +btn.dataset.phase;
      $("#phaseToggle").querySelectorAll(".seg").forEach((b) => b.classList.toggle("active", b === btn));
      if (!voltageTouched) $("#volt").value = state.phases === 1 ? 230 : 400;
      calculate();
    });
  });

  $("#loadToggle").querySelectorAll(".seg").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.loadMode = btn.dataset.load;
      $("#loadToggle").querySelectorAll(".seg").forEach((b) => b.classList.toggle("active", b === btn));
      $("#powerWrap").hidden = state.loadMode !== "power";
      $("#currentWrap").hidden = state.loadMode !== "current";
      calculate();
    });
  });

  $("#matToggle").querySelectorAll(".seg").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.material = btn.dataset.mat;
      $("#matToggle").querySelectorAll(".seg").forEach((b) => b.classList.toggle("active", b === btn));
      calculate();
    });
  });

  ["#volt", "#cosf", "#len", "#drop", "#power", "#current"].forEach((sel) => {
    $(sel).addEventListener("input", () => {
      if (sel === "#volt") voltageTouched = true;
      calculate();
    });
  });
  ["#lay", "#temp", "#group"].forEach((sel) => $(sel).addEventListener("change", () => calculate()));

  $("#csCalc").addEventListener("click", () => calculate(true));
  $("#csClear").addEventListener("click", () => {
    ["#power", "#current", "#len"].forEach((sel) => { $(sel).value = ""; });
    reset();
    setStatus("");
  });

  applyModeUI();
  renderTable(null);
  reset();
}

document.addEventListener("DOMContentLoaded", init);
