/* ============================================================
   CalcHub — приложение
   Данные категорий и калькуляторов, навигация «главная →
   категория → калькулятор», живой поиск, эффекты.
   ============================================================ */

// ---------- Данные ----------
// Категории и калькуляторы живут в js/data.js — единый источник
// для приложения и всех вариантов главного экрана.
const CATEGORIES = window.CALC_CATEGORIES;

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
}

// ---------- Маршрутизация (hash) ----------
//   #/                      — главная
//   #/category/<catId>      — раздел
//   #/calc/<catId>/<slug>   — калькулятор
// Позволяет: работать кнопке «Назад», ссылкам на калькулятор и F5.
function slugOf(calc) {
  const m = /calculators\/([^/]+)\//.exec(calc.url || "");
  return m ? m[1] : "";
}
const routeCategory = (id) => "#/category/" + id;
const routeCalculator = (cat, calc) => "#/calc/" + cat.id + "/" + slugOf(calc);

function parseHash() {
  const parts = decodeURIComponent(location.hash.replace(/^#\/?/, "")).split("/").filter(Boolean);
  if (parts[0] === "category" && parts[1]) return { view: "category", catId: parts[1] };
  if (parts[0] === "calc" && parts[1] && parts[2]) return { view: "calculator", catId: parts[1], slug: parts[2] };
  return { view: "home" };
}

function findCalc(catId, slug) {
  const cat = categoryById(catId);
  if (!cat) return null;
  const calc = cat.calculators.find((c) => c.url && slugOf(c) === slug);
  return calc ? { cat, calc } : null;
}

// Переход вперёд: добавляет запись в историю — работает кнопка «Назад»
function goTo(hash) {
  if (location.hash === hash) { applyRoute(); return; }
  location.hash = hash;
}

// Кнопки «назад» в интерфейсе: заменяют запись, чтобы не плодить дубли
function backTo(hash) {
  try {
    location.replace(location.href.split("#")[0] + hash);
  } catch (e) {
    location.hash = hash;
  }
}

function applyRoute() {
  const r = parseHash();
  if (r.view === "category") {
    const cat = categoryById(r.catId);
    if (cat) { state.categoryId = cat.id; renderCategoryView(cat); showView("category"); window.scrollTo(0, 0); return; }
  } else if (r.view === "calculator") {
    const found = findCalc(r.catId, r.slug);
    if (found) { state.categoryId = found.cat.id; renderCalculator(found.cat, found.calc); showView("calculator"); window.scrollTo(0, 0); return; }
  }
  showView("home");
  window.scrollTo(0, 0);
}

// ---------- Избранное и недавние (localStorage) ----------
const LS_FAV = "calchub.favorites";
const LS_REC = "calchub.recent";

function lsGet(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* нет доступа — работаем без сохранения */ }
}

let favorites = lsGet(LS_FAV);
let recents = lsGet(LS_REC);

const calcBySlug = (slug) => (window.CALC_FLAT || []).find((c) => c.url && slugOf(c) === slug);
const isFav = (slug) => favorites.includes(slug);

function toggleFav(slug) {
  favorites = isFav(slug) ? favorites.filter((s) => s !== slug) : [slug, ...favorites];
  lsSet(LS_FAV, favorites);
  refreshStars();
  renderQuickAccess();
}

function refreshStars() {
  $$(".star-btn").forEach((b) => {
    const on = isFav(b.dataset.slug);
    b.classList.toggle("on", on);
    b.textContent = on ? "★" : "☆";
    b.title = on ? "Убрать из избранного" : "Добавить в избранное";
  });
}

function addRecent(slug) {
  if (!slug) return;
  recents = [slug, ...recents.filter((s) => s !== slug)].slice(0, 6);
  lsSet(LS_REC, recents);
  renderQuickAccess();
}

const qaItemHtml = (c) => `<button class="qa-item" type="button" data-slug="${slugOf(c)}" title="${escapeHtml(c.name)}">
    <span class="qa-ico">${c.icon}</span><span class="qa-name">${escapeHtml(c.name)}</span>
  </button>`;

function renderQuickAccess() {
  const favList = favorites.map(calcBySlug).filter(Boolean);
  const recList = recents.map(calcBySlug).filter(Boolean);

  $("#qaFavWrap").hidden = favList.length === 0;
  $("#qaRecentWrap").hidden = recList.length === 0;
  $("#quickAccess").hidden = favList.length === 0 && recList.length === 0;

  $("#qaFav").innerHTML = favList.map(qaItemHtml).join("");
  $("#qaRecent").innerHTML = recList.map(qaItemHtml).join("");

  $$(".qa-item").forEach((el) =>
    el.addEventListener("click", () => {
      const calc = calcBySlug(el.dataset.slug);
      if (calc) openCalculator(calc.category, calc);
    })
  );
  refreshStars();
}

// ---------- Поиск: нечёткое совпадение и подсветка ----------
// Расстояние редактирования не больше 1 (одна опечатка)
function within1(a, b) {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (edits === 1) return false;
    edits++;
    if (la > lb) i++;
    else if (la < lb) j++;
    else { i++; j++; }
  }
  if (i < la || j < lb) edits++;
  return edits <= 1;
}
function isSubsequence(text, q) {
  let i = 0;
  for (const ch of q) {
    i = text.indexOf(ch, i);
    if (i === -1) return false;
    i++;
  }
  return true;
}
// Оценка совпадения: начало слова > слово целиком > опечатка > символы по порядку.
// Середина слова учитывается только для запросов от 4 символов, иначе «ом»
// находился бы внутри «автОМобиль» и засорял выдачу.
function matchScore(text, q) {
  if (!q) return 0;
  const words = text.split(/[^0-9a-zа-яё]+/);

  // 1. слово начинается с запроса
  let best = 0;
  for (const w of words) {
    if (w.startsWith(q)) best = Math.max(best, 900 - Math.min(w.length - q.length, 90));
  }
  if (best) return best;

  // 2. запрос встречается как подстрока
  const idx = text.indexOf(q);
  if (idx !== -1) {
    const atBoundary = idx === 0 || !/[0-9a-zа-яё]/.test(text[idx - 1]);
    if (atBoundary) return 500 - Math.min(idx, 90);
    if (q.length >= 4) return 200 - Math.min(idx, 90);
  }

  // 3. одна опечатка в слове
  if (q.length >= 4) {
    for (const w of words) if (w.length >= 3 && within1(w, q)) return 300;
  }

  // 4. символы по порядку внутри близкого по длине слова
  if (q.length >= 3) {
    for (const w of words) {
      if (w.length < q.length || w.length > q.length * 1.6) continue;
      if (isSubsequence(w, q)) return 120;
    }
  }
  return 0;
}
function highlight(text, q) {
  const t = String(text);
  const i = q ? t.toLowerCase().indexOf(q) : -1;
  if (i === -1) return escapeHtml(t);
  return escapeHtml(t.slice(0, i)) + "<mark>" + escapeHtml(t.slice(i, i + q.length)) + "</mark>" + escapeHtml(t.slice(i + q.length));
}

// ---------- Рендер карточек категорий (главная) ----------
function renderCategories(filter = "") {
  const grid = $("#categoryGrid");
  const q = filter.trim().toLowerCase();

  // Без запроса — исходный порядок; с запросом — по релевантности
  const scored = CATEGORIES.map((cat) => {
    if (!q) return { cat, s: 1 };
    let s = matchScore(cat.searchText || "", q);
    cat.calculators.forEach((c) => {
      const cs = matchScore(c.searchText || "", q);
      if (cs > s) s = cs;
    });
    return { cat, s };
  });
  const visible = (q ? scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s) : scored).map((x) => x.cat);

  grid.innerHTML = visible
    .map((cat) => {
      const [c1, c2] = cat.colors;
      const chips = cat.calculators
        .slice(0, 3)
        .map((c) => `<span>${highlight(c.name, q)}</span>`)
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
          <h3 class="card-title">${highlight(cat.name, q)}</h3>
          <p class="card-desc">${highlight(cat.desc, q)}</p>
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
  if (categoryById(id)) goTo(routeCategory(id));
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
    .map((calc, i) => {
      const ready = !!calc.url;
      const slug = ready ? slugOf(calc) : "";
      const fav = ready && isFav(slug);
      return `
        <article class="calc-item ${ready ? "" : "disabled"}" data-i="${i}"
          tabindex="${ready ? 0 : -1}" role="${ready ? "button" : ""}">
          <div class="calc-icon">${calc.icon}</div>
          <div class="calc-info">
            <h3>${escapeHtml(calc.name)}</h3>
            <p>${escapeHtml(calc.desc || "")}</p>
          </div>
          ${ready ? `<button class="star-btn ${fav ? "on" : ""}" type="button" data-slug="${slug}"
              title="${fav ? "Убрать из избранного" : "Добавить в избранное"}"
              aria-label="Избранное">${fav ? "★" : "☆"}</button>` : ""}
          <span class="calc-status ${ready ? "on" : "off"}">${ready ? "открыть →" : "скоро"}</span>
        </article>`;
    })
    .join("");

  $$(".calc-item", $("#categoryList")).forEach((item) => {
    const calc = cat.calculators[+item.dataset.i];
    if (!calc || !calc.url) return;
    const open = () => openCalculator(cat, calc);
    item.addEventListener("click", open);
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });

  // Звёздочка избранного — не открывает калькулятор
  $$(".star-btn", $("#categoryList")).forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleFav(btn.dataset.slug);
    });
    btn.addEventListener("keydown", (e) => e.stopPropagation());
  });
}

// ---------- Вид «Калькулятор» ----------
function openCalculator(cat, calc) {
  goTo(routeCalculator(cat, calc));
}

function renderCalculator(cat, calc) {
  state.calculatorName = calc.name;
  $("#calculatorCrumb").innerHTML = `${escapeHtml(cat.name)} <b>·</b> ${escapeHtml(calc.name)}`;
  const frame = $("#calculatorFrame");
  if (frame.getAttribute("src") !== calc.url) {
    $("#frameLoader").classList.remove("done");
    frame.src = calc.url;
  }
  addRecent(slugOf(calc));
  showView("calculator");
}

// ---------- Быстрые подсказки ----------
function renderChips() {
  const sample = ["резистор", "закон ома", "кабель", "имт", "график", "клапаны"];
  $("#quickChips").innerHTML = sample
    .map((s) => `<button class="chip" type="button">${escapeHtml(s)}</button>`)
    .join("");

  $$(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const input = $("#searchInput");
      input.value = chip.textContent;
      input.focus();
      renderCategories(input.value);
      renderSearchResults(input.value);
      toggleClear();
    });
  });
}

// ---------- Поиск ----------
let srActive = 0;

function toggleClear() {
  $("#searchClear").hidden = $("#searchInput").value.length === 0;
}

// Совпадения по названию, описанию, разделу и тегам — с оценкой релевантности
function calcMatches(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return (window.CALC_FLAT || [])
    .filter((c) => c.url)
    .map((c) => ({ c, s: matchScore(c.searchText || "", q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
}

function renderSearchResults(query) {
  const wrap = $("#searchResults");
  const q = query.trim().toLowerCase();
  const all = calcMatches(query);
  if (!all.length) {
    wrap.hidden = true;
    wrap.innerHTML = "";
    return;
  }
  const shown = all.slice(0, 8);
  wrap.hidden = false;
  wrap.innerHTML =
    `<div class="sr-head">Калькуляторы · найдено ${all.length}${all.length > shown.length ? ` · показаны первые ${shown.length}` : ""}</div>` +
    shown
      .map(
        (c) => `<button class="sr-item" type="button" role="option"
            data-url="${c.url}" data-cat="${c.category.id}" data-name="${escapeHtml(c.name)}">
            <span class="sr-ico">${c.icon}</span>
            <span class="sr-text"><b>${highlight(c.name, q)}</b><span>${highlight(c.desc || "", q)}</span></span>
            <span class="sr-cat" style="--c:${c.category.colors[0]}">${escapeHtml(c.category.name)}</span>
          </button>`
      )
      .join("");

  $$(".sr-item", wrap).forEach((el) => el.addEventListener("click", () => openFromSearch(el)));
  srActive = 0;
  setSrActive(0);
}

function setSrActive(i) {
  const items = $$("#searchResults .sr-item");
  if (!items.length) return;
  srActive = Math.max(0, Math.min(items.length - 1, i));
  items.forEach((el, k) => el.classList.toggle("active", k === srActive));
  items[srActive].scrollIntoView({ block: "nearest" });
}

function openFromSearch(el) {
  const calc = (window.CALC_FLAT || []).find((c) => c.url === el.dataset.url);
  if (!calc) return;
  clearSearch();
  openCalculator(calc.category, calc);
}

function clearSearch() {
  $("#searchInput").value = "";
  renderCategories("");
  renderSearchResults("");
  toggleClear();
}

function initSearch() {
  const input = $("#searchInput");
  const form = $("#searchForm");

  input.addEventListener("input", () => {
    renderCategories(input.value);
    renderSearchResults(input.value);
    toggleClear();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const first = $("#searchResults .sr-item");
    if (first) first.click();
  });

  $("#searchClear").addEventListener("click", () => {
    clearSearch();
    input.focus();
  });

  document.addEventListener("keydown", (e) => {
    // Ctrl+K или / — фокус в поиск
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      input.focus();
      input.select();
      return;
    }
    if (e.key === "/" && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
      return;
    }
    if (document.activeElement !== input) return;

    if (e.key === "Escape") {
      clearSearch();
      input.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSrActive(srActive + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSrActive(srActive - 1);
    } else if (e.key === "Enter") {
      const item = $$("#searchResults .sr-item")[srActive];
      if (item) { e.preventDefault(); item.click(); }
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
      goTo("#/");
      const target = href === "#top" ? null : $(href);
      setTimeout(() => {
        if (target) target.scrollIntoView({ behavior: "smooth" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
      }, 80);
    });
  });

  $("#categoryBack").addEventListener("click", () => backTo("#/"));
  $("#calculatorBack").addEventListener("click", () => {
    backTo(state.categoryId ? routeCategory(state.categoryId) : "#/");
  });

  // Открыть калькулятор в отдельной вкладке
  $("#calculatorNewTab").addEventListener("click", () => {
    const src = $("#calculatorFrame").getAttribute("src");
    if (src) window.open(src, "_blank");
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
  renderQuickAccess();

  // Клик по статистике «калькуляторов» — показать все разделы
  $("#statCalcsBtn").addEventListener("click", () => {
    goTo("#/");
    setTimeout(() => {
      const t = $("#categories");
      if (t) t.scrollIntoView({ behavior: "smooth" });
    }, 80);
  });

  // Спиннер загрузки встроенного калькулятора
  const frame = $("#calculatorFrame");
  frame.addEventListener("load", () => {
    if (frame.getAttribute("src")) $("#frameLoader").classList.add("done");
  });

  // Маршрутизация: применяем текущий адрес и слушаем переходы
  window.addEventListener("hashchange", applyRoute);
  applyRoute();
}

document.addEventListener("DOMContentLoaded", init);
