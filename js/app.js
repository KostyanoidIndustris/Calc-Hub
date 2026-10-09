/* ============================================================
   CalcHub — приложение
   Данные категорий и калькуляторов, навигация «главная →
   категория → калькулятор», живой поиск, эффекты.
   ============================================================ */

// ---------- Данные ----------
// Каждый калькулятор: name, icon, описание и url автономного модуля.
// Новые разделы и калькуляторы добавляются сюда по мере разработки.
const CATEGORIES = [
  {
    id: "auto",
    icon: "🚗",
    name: "Автомобиль",
    desc: "Расчёты для автомобиля: регулировка клапанов и другие.",
    colors: ["#f97316", "#fbbf24"],
    calculators: [
      { name: "Регулировочные шайбы клапанов", icon: "🔧", desc: "Расчёт новой шайбы по зазору и старой шайбе — для 8-клапанных двигателей.", url: "calculators/valve-shim-calculator/index.html" },
    ],
  },
  {
    id: "electronics",
    icon: "🔌",
    name: "Электроника",
    desc: "Маркировка резисторов, закон Ома и другие схемотехнические расчёты.",
    colors: ["#22d3ee", "#38bdf8"],
    calculators: [
      { name: "Цветовая маркировка резисторов", icon: "🎨", desc: "Сопротивление по цветным полосам (4/5/6 полос).", url: "calculators/resistor-color-code/index.html" },
      { name: "SMD-коды", icon: "🏷️", desc: "Расшифровка маркировки резисторов, конденсаторов и индуктивностей.", url: "calculators/smd-code/index.html" },
      { name: "Закон Ома", icon: "⚡", desc: "Напряжение, ток, сопротивление и мощность — введи любые два.", url: "calculators/ohm-law/index.html" },
    ],
  },
  {
    id: "health",
    icon: "❤️",
    name: "Здоровье",
    desc: "Расчёты для здоровья: индекс массы тела и другое.",
    colors: ["#34d399", "#22d3ee"],
    calculators: [
      { name: "Индекс массы тела", icon: "⚖️", desc: "ИМТ с оценкой нормы по возрасту и полу, процент жира и обхват талии.", url: "calculators/bmi/index.html" },
    ],
  },
  {
    id: "programming",
    icon: "💻",
    name: "Программирование",
    desc: "Системы счисления и другие расчёты для разработчиков.",
    colors: ["#22c55e", "#4ade80"],
    calculators: [
      { name: "Системы счисления", icon: "🔢", desc: "Перевод чисел между основаниями 2–36 с пошаговым расчётом.", url: "calculators/number-systems/index.html" },
    ],
  },
  {
    id: "tools",
    icon: "🧰",
    name: "Инструменты",
    desc: "Построение графиков и другие универсальные утилиты.",
    colors: ["#14b8a6", "#2dd4bf"],
    calculators: [
      { name: "Построитель графиков", icon: "📈", desc: "Строй зависимости по точкам x и y — несколько графиков на одной сетке.", url: "calculators/graph-plotter/index.html" },
    ],
  },
];

const availableCount = CATEGORIES.reduce((s, c) => s + c.calculators.filter((x) => x.url).length, 0);

// ---------- Короткие утилиты ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const categoryById = (id) => CATEGORIES.find((c) => c.id === id);

// ---------- Состояние навигации ----------
const state = { view: "home", categoryId: null, calculatorName: null };
let cursorSupported = false;

function showView(view) {
  state.view = view;
  $("#homeView").hidden = view !== "home";
  $("#categoryView").hidden = view !== "category";
  $("#calculatorView").hidden = view !== "calculator";
  // Над iframe кастомный курсор не работает — включаем системный
  if (cursorSupported) document.body.classList.toggle("custom-cursor", view !== "calculator");
  window.scrollTo(0, 0);
}

// ---------- Рендер карточек категорий (главная) ----------
function renderCategories(filter = "") {
  const grid = $("#categoryGrid");
  const query = filter.trim().toLowerCase();

  const visible = CATEGORIES.filter((cat) => {
    if (!query) return true;
    const haystack = [cat.name, cat.desc, ...cat.calculators.map((c) => c.name)].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  grid.innerHTML = visible
    .map((cat) => {
      const [c1, c2] = cat.colors;
      const chips = cat.calculators
        .slice(0, 3)
        .map((c) => `<span>${escapeHtml(c.name)}</span>`)
        .join("");
      const more = cat.calculators.length - 3 > 0 ? `<span>+${cat.calculators.length - 3}</span>` : "";

      return `
        <article class="card reveal" data-category="${cat.id}" tabindex="0" role="button"
          aria-label="Открыть категорию ${escapeHtml(cat.name)}"
          style="--icon-bg: linear-gradient(135deg, ${c1}, ${c2}); --icon-shadow: ${c1}55; --card-glow: ${c1}22;">
          <div class="card-top">
            <div class="card-icon">${cat.icon}</div>
            <span class="card-count">${cat.calculators.length} шт.</span>
          </div>
          <h3 class="card-title">${escapeHtml(cat.name)}</h3>
          <p class="card-desc">${escapeHtml(cat.desc)}</p>
          <div class="card-list">${chips}${more}</div>
          <span class="card-open">Открыть раздел <span class="arrow">→</span></span>
        </article>`;
    })
    .join("");

  $("#emptyState").hidden = visible.length > 0;

  requestAnimationFrame(() => {
    $$(".card", grid).forEach((el, i) => {
      setTimeout(() => el.classList.add("visible"), i * 60);
    });
  });

  $$(".card", grid).forEach((card) => {
    card.addEventListener("click", () => openCategory(card.dataset.category));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openCategory(card.dataset.category);
      }
    });
    attachTilt(card);
    attachGlow(card);
  });
}

// ---------- Вид «Категория» ----------
function openCategory(id) {
  const cat = categoryById(id);
  if (!cat) return;
  state.categoryId = id;
  renderCategoryView(cat);
  showView("category");
}

function renderCategoryView(cat) {
  const [c1, c2] = cat.colors;
  $("#categoryHeader").innerHTML = `
    <div class="cat-hero">
      <div class="cat-icon" style="background: linear-gradient(135deg, ${c1}, ${c2}); box-shadow: 0 14px 34px ${c1}55;">${cat.icon}</div>
      <div>
        <h2>${escapeHtml(cat.name)}</h2>
        <p>${escapeHtml(cat.desc)}</p>
        <div class="cat-meta">калькуляторов: ${cat.calculators.length} · готово: ${cat.calculators.filter((c) => c.url).length}</div>
      </div>
    </div>`;

  $("#categoryList").innerHTML = cat.calculators
    .map((calc) => {
      const ready = !!calc.url;
      return `
        <article class="calc-item ${ready ? "" : "disabled"}" data-name="${escapeHtml(calc.name)}" data-url="${calc.url || ""}"
          tabindex="${ready ? 0 : -1}" role="${ready ? "button" : ""}">
          <div class="calc-icon">${calc.icon}</div>
          <div class="calc-info">
            <h3>${escapeHtml(calc.name)}</h3>
            <p>${escapeHtml(calc.desc || "")}</p>
          </div>
          <span class="calc-status ${ready ? "on" : "off"}">${ready ? "открыть →" : "скоро"}</span>
        </article>`;
    })
    .join("");

  $$(".calc-item", $("#categoryList")).forEach((item) => {
    if (!item.dataset.url) return;
    item.addEventListener("click", () => openCalculator(cat, item.dataset.name, item.dataset.url));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openCalculator(cat, item.dataset.name, item.dataset.url);
      }
    });
  });
}

// ---------- Вид «Калькулятор» ----------
function openCalculator(cat, name, url) {
  state.calculatorName = name;
  $("#calculatorCrumb").innerHTML = `${escapeHtml(cat.name)} <b>·</b> ${escapeHtml(name)}`;
  $("#calculatorFrame").src = url;
  showView("calculator");
}

// ---------- Быстрые подсказки ----------
function renderChips() {
  const sample = ["Маркировка резисторов", "Закон Ома", "Шайбы клапанов", "График", "Сопротивление", "Мощность"];
  $("#quickChips").innerHTML = sample
    .map((s) => `<button class="chip" type="button">${escapeHtml(s)}</button>`)
    .join("");

  $$(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const input = $("#searchInput");
      input.value = chip.textContent;
      input.focus();
      renderCategories(input.value);
      toggleClear();
    });
  });
}

// ---------- Поиск ----------
function toggleClear() {
  $("#searchClear").hidden = $("#searchInput").value.length === 0;
}

function initSearch() {
  const input = $("#searchInput");
  const form = $("#searchForm");

  input.addEventListener("input", () => {
    renderCategories(input.value);
    toggleClear();
  });
  form.addEventListener("submit", (e) => e.preventDefault());
  $("#searchClear").addEventListener("click", () => {
    input.value = "";
    input.focus();
    renderCategories("");
    toggleClear();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
    }
    if (e.key === "Escape" && document.activeElement === input) {
      input.value = "";
      renderCategories("");
      toggleClear();
      input.blur();
    }
  });
}

// ---------- Счётчики статистики ----------
function animateCounters() {
  const animated = new WeakSet();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || animated.has(entry.target)) return;
      animated.add(entry.target);
      const target = +entry.target.dataset.count;
      const dur = 1200;
      const start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        entry.target.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });

  $$(".stat-num[data-count]").forEach((el) => observer.observe(el));
}

// ---------- Появление секций при прокрутке ----------
function initReveal() {
  const targets = $$(".stats, .about-card, .section-head");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "none";
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  targets.forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(24px)";
    el.style.transition = "opacity .7s var(--ease), transform .7s var(--ease)";
    observer.observe(el);
  });
}

// ---------- 3D-наклон карточки ----------
function attachTilt(card) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * 7;
    const ry = (px - 0.5) * 9;
    card.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
  });
  card.addEventListener("mouseleave", () => {
    card.style.transform = "perspective(900px) rotateX(0) rotateY(0)";
  });
}

// ---------- Подсветка по позиции курсора ----------
function attachGlow(card) {
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    card.style.setProperty("--my", `${e.clientY - rect.top}px`);
  });
}

// ---------- Кастомный курсор ----------
function initCursor() {
  const fine = window.matchMedia("(pointer: fine)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  cursorSupported = fine && !reduced;
  if (!cursorSupported) return;

  document.body.classList.add("custom-cursor");
  const dot = $(".cursor-dot");
  const ring = $(".cursor-ring");
  let mx = 0, my = 0, rx = 0, ry = 0;

  document.addEventListener("mousemove", (e) => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.left = mx + "px";
    dot.style.top = my + "px";
  });

  (function loop() {
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    ring.style.left = rx + "px";
    ring.style.top = ry + "px";
    requestAnimationFrame(loop);
  })();

  const interactive = "a, button, .card, .calc-item, input, .chip";
  document.addEventListener("mouseover", (e) => {
    if (e.target.closest(interactive)) ring.classList.add("is-hover");
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest(interactive)) ring.classList.remove("is-hover");
  });
}

// ---------- Toast ----------
let toastTimer;
function showToast(msg) {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

// ---------- Утилиты ----------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------- Навигация в шапке ----------
function initHeaderNav() {
  $$('.logo, .nav-link, a[href="#top"], a[href="#categories"], a[href="#about"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("#")) return;
      e.preventDefault();
      showView("home");
      const target = href === "#top" ? null : $(href);
      setTimeout(() => {
        if (target) target.scrollIntoView({ behavior: "smooth" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
      }, 60);
    });
  });

  $("#categoryBack").addEventListener("click", () => showView("home"));
  $("#calculatorBack").addEventListener("click", () => {
    if (state.categoryId) {
      renderCategoryView(categoryById(state.categoryId));
      showView("category");
    } else {
      showView("home");
    }
  });
}

// ---------- Инициализация ----------
function init() {
  $("#heroCount").textContent = availableCount;
  $("#statCats").dataset.count = CATEGORIES.length;
  $("#statCalcs").dataset.count = availableCount;
  $("#year").textContent = new Date().getFullYear();

  renderCategories();
  renderChips();
  initSearch();
  initReveal();
  initCursor();
  initHeaderNav();
  animateCounters();
}

document.addEventListener("DOMContentLoaded", init);
