/* 1 из 22 миллионов — симуляция жизни (движок и интерфейс) */
(function () {
  "use strict";
  var W = window.WORLD, EV = window.EVENTS, RISKS = window.RISKS, R = window.REGIONS;
  var app = document.getElementById("app");
  var S = null;
  var settings = { era: "any", region: "real", length: "normal", gender: "any" };
  var FAM_LOST = { "c-grandma-loss": 46000, "r-parent-scam": 60000, "c-voice-clone": 30000, "c-dialer-bill": 4800 };

  // ---------- утилиты ----------
  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(a) { return a[rnd(a.length)]; }
  function between(a, b) { return a + rnd(b - a + 1); }
  function chance(p) { return Math.random() < p; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function fmt(n) { return Math.round(n).toLocaleString("ru-RU").replace(/,/g, " "); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function plural(n, a, b, c) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return a;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b;
    return c;
  }
  function years(n) { return n + " " + plural(n, "год", "года", "лет"); }
  function weighted(list, wf) {
    var ws = list.map(wf), sum = ws.reduce(function (a, b) { return a + b; }, 0);
    if (!sum) return null;
    var x = Math.random() * sum;
    for (var i = 0; i < list.length; i++) { x -= ws[i]; if (x <= 0) return list[i]; }
    return list[list.length - 1];
  }
  function femSurname(s) { return /(ов|ев|ёв|ин|ын)$/.test(s) ? s + "а" : /ий$/.test(s) ? s.replace(/ий$/, "ая") : s; }
  var TR = { а: "A", б: "B", в: "V", г: "G", д: "D", е: "E", ё: "E", ж: "ZH", з: "Z", и: "I", й: "I", к: "K", л: "L", м: "M", н: "N", о: "O", п: "P", р: "R", с: "S", т: "T", у: "U", ф: "F", х: "KH", ц: "TS", ч: "CH", ш: "SH", щ: "SHCH", ъ: "", ы: "Y", ь: "", э: "E", ю: "IU", я: "IA" };
  function translit(s) { return s.toLowerCase().split("").map(function (c) { return TR[c] !== undefined ? TR[c] : (/[a-z]/.test(c) ? c.toUpperCase() : ""); }).join(""); }
  function pad(s, n) { s = s.slice(0, n); while (s.length < n) s += "<"; return s; }

  // Род и подстановки
  function T(str) {
    if (!str) return "";
    var s = String(str).replace(/\{([^{}|]*)\|([^{}|]*)\}/g, function (_, m, f) { return S && S.g === "f" ? f : m; });
    return s.replace(/\{(\w+)\}/g, function (all, k) { var v = vars()[k]; return v !== undefined ? v : all; });
  }
  function vars() {
    var t = W.tech(S.year), tr = S.flags.track || "school";
    var mates = { school: "одноклассники", spo: "одногруппники", work: "коллеги" }[tr];
    return Object.assign({}, t, {
      name: S.first, friend: S.friend, city: S.city, mates: mates, Mates: cap(mates),
      to_study: { school: "в школу", spo: "в колледж", work: "на работу" }[tr],
      in_study: { school: "школы", spo: "колледжа", work: "работы" }[tr],
      in_study_short: { school: "школа", spo: "колледж", work: "работа" }[tr],
      klass_gen: tr === "school" ? "класса" : tr === "work" ? "коллектива" : "группы",
      class_size: S.classSize + " " + plural(S.classSize, "человек", "человека", "человек"), spec1: S.specs[0], spec2: S.specs[1], spec3: S.specs[2]
    });
  }

  // ---------- старт ----------
  function startScreen() {
    stopLoop();
    document.body.className = "start";
    var e = W.ERAS;
    app.innerHTML =
      '<section class="start-wrap">' +
      '<p class="mono dim">Бесплатная симуляция взросления · 89 регионов России · 5–12 минут</p>' +
      '<h1 class="hero"><span class="one">1</span> из 22<br>миллионов</h1>' +
      '<p class="lead">Прямо сейчас в России учатся около 22 миллионов школьников и студентов колледжей. Вы станете одним из них и проживёте детство и юность — с первого класса до 23 лет. Где вы родитесь и в какой семье, выбрать нельзя. Как поступать в сети — можно.</p>' +
      '<p class="lead dim">Время идёт само. Решения приходят неожиданно, а их последствия — иногда через годы.</p>' +
      '<div class="settings">' +
      group("era", "Мир", [["any", "Любой", "случайно"], ["past", e.past.label, e.past.sub], ["present", e.present.label, e.present.sub], ["future", e.future.label, e.future.sub]]) +
      group("region", "Регион рождения", [["real", "Как в жизни", "чем больше учащихся в регионе, тем выше шанс"], ["equal", "Любой из 89", "все регионы с равным шансом"]]) +
      group("length", "Длительность", [["fast", W.LENGTHS.fast.label, "меньше решений"], ["normal", W.LENGTHS.normal.label, "около 20 решений"], ["long", W.LENGTHS.long.label, "больше решений"]]) +
      group("gender", "Пол", [["any", "Случайно"], ["m", "Мужской"], ["f", "Женский"]]) +
      "</div>" +
      '<button class="btn primary big" id="born">Родиться</button>' +
      '<p class="mono dim small">Истории вымышлены, но собраны из реальных схем мошенников и реальных ситуаций в школах. Тяжёлых сцен нет.</p>' +
      "</section>";
    app.querySelectorAll(".chips").forEach(function (g) {
      g.addEventListener("click", function (ev) {
        var b = ev.target.closest(".chip"); if (!b) return;
        settings[g.dataset.group] = b.dataset.val;
        g.querySelectorAll(".chip").forEach(function (c) { c.classList.toggle("sel", c === b); });
      });
    });
    document.getElementById("born").onclick = rollRegion;
  }
  function group(name, title, opts) {
    return '<div class="set"><h3>' + title + '</h3><div class="chips" data-group="' + name + '">' + opts.map(function (o) {
      return '<button class="chip' + (settings[name] === o[0] ? " sel" : "") + '" data-val="' + o[0] + '"><b>' + o[1] + "</b>" + (o[2] ? "<small>" + o[2] + "</small>" : "") + "</button>";
    }).join("") + "</div></div>";
  }

  // ---------- рождение ----------
  function regionWeight(r) { return r[4] + r[5]; }
  function makePerson(era, born, regionMode, genderSetting) {
    var reg = regionMode === "equal" ? pick(R) : weighted(R, regionWeight);
    var g = genderSetting === "any" || !genderSetting ? pick(["m", "f"]) : genderSetting;
    var local = null;
    Object.keys(W.LOCAL).forEach(function (k) { if (W.LOCAL[k].regions.indexOf(reg[0]) >= 0) local = W.LOCAL[k]; });
    var useLocal = local && chance(0.6);
    var first = useLocal ? pick(local[g]) : pick(W.NAMES[era][g]);
    var sur = useLocal ? pick(local.s) : pick(W.SURNAMES);
    return { reg: reg, g: g, first: first, last: g === "f" ? femSurname(sur) : sur, sur: sur };
  }

  function rollRegion() {
    var era = settings.era === "any" ? pick(["past", "present", "future"]) : settings.era;
    var born = between(W.ERAS[era].born[0], W.ERAS[era].born[1]);
    var p = makePerson(era, born, settings.region, settings.gender);
    var total = R.reduce(function (a, r) { return a + regionWeight(r); }, 0);
    var prob = settings.region === "equal" ? 100 / 89 : regionWeight(p.reg) / total * 100;
    document.body.className = "start";
    app.innerHTML = '<section class="roll"><p class="mono dim">ОПРЕДЕЛЯЕТСЯ МЕСТО РОЖДЕНИЯ</p><h2 id="rr">' + esc(R[0][0]) + '</h2><p class="mono dim" id="rp">&nbsp;</p></section>';
    var i = 0, n = 0, el = document.getElementById("rr");
    var iv = setInterval(function () {
      if (!document.getElementById("rr")) return clearInterval(iv);
      el.textContent = R[(i = (i + 11) % R.length)][0];
      if (++n > 22) {
        clearInterval(iv);
        el.textContent = p.reg[0];
        document.getElementById("rp").textContent = "Вероятность: " + prob.toFixed(1).replace(".", ",") + " %";
        setTimeout(function () { register(era, born, p); }, 1300);
      }
    }, 60);
  }

  function register(era, born, p) {
    var reg = p.reg, isCity = reg[0] === reg[2];
    var settlement = isCity ? "city" : weighted(["city", "town", "village"], function (x) { return { city: 0.5, town: 0.3, village: 0.2 }[x]; });
    var place = settlement === "city" ? reg[2] :
      (settlement === "town" ? "небольшой город" : "село") + " в " + between(30, 240) + " км от регионального центра (" + reg[2] + ")";
    var wealth = weighted([0, 1, 2, 3, 4], function (x) { return [0.15, 0.25, 0.3, 0.2, 0.1][x]; });
    var pn = W.PARENT_NAMES[era];
    var momAge = between(21, 34), hasDad = chance(0.82), sibs = weighted([0, 1, 2, 3], function (x) { return [0.3, 0.42, 0.2, 0.08][x]; });
    var friendG = p.g;
    S = {
      era: era, born: born, month: between(1, 12), reg: reg, region: reg[0], regionIn: reg[1], city: reg[2],
      settlement: settlement, place: place, g: p.g, first: p.first, last: p.last,
      friend: pick(W.NAMES[era][friendG].filter(function (x) { return x !== p.first; })),
      mom: { name: pick(pn.f), age: momAge, job: pick(W.JOBS) },
      dad: hasDad ? { name: pick(pn.m), age: momAge + between(0, 6), job: pick(W.JOBS) } : null,
      sibs: sibs, wealth: wealth, home: pick(W.HOMES[settlement]),
      classSize: settlement === "village" ? between(7, 16) : between(22, 31),
      specs: (function () { var a = W.SPECS.slice().sort(function () { return Math.random() - 0.5; }); return [a[0], a[1], a[2]]; })(),
      flags: { pwdWeak: true, hasGm: chance(0.35), track: "school" }, nums: { exp: 0, click: 0 }, trackFrom: 7, hackAge: -9,
      stats: { sec: 45 + rnd(10), hap: 52 + wealth * 3 + rnd(10), kno: 42 + wealth * 2 + rnd(10), rel: 48 + rnd(12), tru: 48 + rnd(14) },
      money: 0, lost: 0, famLost: 0, age: W.START_AGE, year: born + W.START_AGE, t: 0,
      speed: 1, paused: false, focus: null, used: {}, queue: [], plan: [], chron: [], map: [],
      log: [], hits: { hack: 0, bully: 0, scam: 0, blocked: 0, lo: [] }, peers: [], pause16: null,
      len: W.LENGTHS[settings.length], yearBad: 0, yearStartHap: 0
    };
    for (var i = 0; i < 4; i++) {
      var q = makePerson(era, born, "real", "any");
      S.peers.push({ name: q.first + " " + q.last, region: q.reg[0], g: q.g, status: "первый класс", news: "" });
    }
    var e = W.ERAS[era];
    var school = reg[4] * 1000, spo = reg[5] * 1000, learners = school + spo, est = reg[6] === 1;
    var no = "RUS-" + born + "-" + (100000 + rnd(899999));
    var monthName = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"][S.month - 1];
    var sibText = sibs === 0 ? "Вы — единственный ребёнок." : "У вас " + sibs + " " + plural(sibs, "брат или сестра", "брата или сестры", "братьев и сестёр") + ".";
    document.body.className = "start";
    app.innerHTML =
      '<section class="reg-card">' +
      '<div class="reg-head"><span>Регистрация рождения</span><span class="mono">No. ' + no + "</span></div>" +
      '<div class="reg-body"><p class="mono dim small">ИМЯ</p><h2 class="serif">' + esc(S.first + " " + S.last) + "</h2>" +
      "<p>" + esc("В " + monthName + " " + born + " года вы родились " + (S.g === "f" ? "девочкой" : "мальчиком") + ". " + reg[0] + ", " + place + ". " + cap(W.WEALTH[wealth]) + ". " + sibText) + "</p>" +
      '<p class="dim">Жизнь начнётся с первого класса, в ' + (born + 7) + " году. Чтобы дожить до 23 лет, нужно " + S.len.label.replace("≈ ", "примерно ") + " (1 год ≈ " + S.len.sec + " с). Время можно ставить на паузу и ускорять.</p>" +
      '<div class="reg-grid">' +
      cell("Пол", S.g === "f" ? "Женский" : "Мужской") + cell("Регион", reg[0]) + cell("Место", cap(place)) +
      cell("Доход семьи", dots(wealth) + " " + W.WEALTH[wealth]) +
      cell("Родители", "Мать, " + momAge + (S.dad ? " · Отец, " + S.dad.age : " · отца нет рядом")) +
      cell("Работа родителей", "Мать: " + S.mom.job + (S.dad ? " · Отец: " + S.dad.job : "")) +
      cell("Дом", cap(S.home)) + cell("Бабушка", S.flags.hasGm ? "живёт с вами" : "в другом городе") +
      cell("Мир", e.label + " · " + e.sub) +
      "</div>" +
      '<p class="odds">' + (era === "present"
        ? "Вы — 1 из " + (est ? "≈ " : "") + fmt(learners) + " школьников и студентов колледжей " + esc(reg[1]) + " и 1 из ≈ 22 миллионов по всей стране."
        : "Сегодня " + esc(reg[1]) + " учатся " + (est ? "≈ " : "") + fmt(learners) + " школьников и студентов колледжей, а по всей стране — около 22 миллионов.") +
      " <span class='dim small'>Из них в школах — " + fmt(school) + ", в колледжах и техникумах — " + fmt(spo) + ". " +
      (est ? "Оценка: в сборниках Росстата данных по региону нет." : "Росстат, начало 2024/25 учебного года.") + "</span></p>" +
      '<h3 class="mt">Родились в том же году</h3><div class="peers">' + S.peers.map(peerHtml).join("") + "</div>" +
      '<p class="dim small">Их жизни пойдут рядом с вашей.</p>' +
      '<button class="btn primary big" id="begin">Начать эту жизнь</button></div></section>';
    document.getElementById("begin").onclick = beginLife;
  }
  function cell(k, v) { return '<div><span class="mono dim small">' + k.toUpperCase() + "</span><b>" + esc(v) + "</b></div>"; }
  function dots(n) { var s = ""; for (var i = 0; i < 5; i++) s += i <= n ? "●" : "○"; return s; }
  function round2(n) { var p = Math.pow(10, Math.max(0, String(Math.round(n)).length - 2)); return Math.round(n / p) * p; }
  function peerHtml(p) {
    return '<div class="peer"><div><b>' + esc(p.name) + '</b><small>' + esc(p.region) + " · " + (p.g === "f" ? "Ж" : "М") + "</small></div><div class='ps'>" + esc(p.status) +
      (p.news ? "<small class='bad'>" + esc(p.news) + "</small>" : "") + "</div></div>";
  }

  // ---------- игровой экран ----------
  function beginLife() {
    document.body.className = "game era-" + S.era;
    app.innerHTML =
      '<header class="g-top">' +
      '<div class="g-title"><span class="logo"><b>1</b> из 22 миллионов</span><span class="age">Возраст <b id="age"></b></span><span class="g-info mono" id="info"></span></div>' +
      '<div class="g-bar"><i id="bar"></i></div>' +
      '<div class="ctrl" id="ctrl">' +
      '<button data-c="pause" id="pp">❚❚ Пауза</button>' +
      [1, 2, 4, 8].map(function (s) { return '<button data-c="speed" data-s="' + s + '"' + (s === 1 ? ' class="on"' : "") + ">" + s + "×</button>"; }).join("") +
      '<button data-c="skip">До следующего решения »</button><button data-c="exit">Выйти</button></div></header>' +
      '<div class="g-grid">' +
      '<aside class="col-left"><div class="panel passport" id="passport"></div><div class="panel" id="state"></div></aside>' +
      '<main class="col-mid"><div class="panel scene-panel"><div id="scene"></div><p class="scene-cap" id="scap"></p></div>' +
      '<div class="panel stats-mini" id="mini"></div>' +
      '<div class="panel" id="focus"></div>' +
      '<div class="panel"><div class="ph"><h3>Летопись жизни</h3><span class="mono dim small">СНАЧАЛА НОВЫЕ</span></div><div id="chron" class="chron"></div></div></main>' +
      '<aside class="col-right"><div class="panel" id="family"></div><div class="panel" id="peers"></div><div class="panel" id="map"></div></aside>' +
      '</div><div id="modal"></div>';
    document.getElementById("ctrl").addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      var c = b.dataset.c;
      if (c === "pause") { S.paused = !S.paused; renderCtrl(); }
      if (c === "speed") { S.speed = +b.dataset.s; S.paused = false; renderCtrl(); }
      if (c === "skip") { S.skip = true; S.paused = false; renderCtrl(); }
      if (c === "exit") { if (confirm("Выйти из этой жизни? Прогресс не сохранится.")) startScreen(); }
    });
    S.focus = null;
    startYear(true);
    renderAll();
    startLoop();
  }

  function renderCtrl() {
    document.getElementById("pp").innerHTML = S.paused ? "▶ Продолжить" : "❚❚ Пауза";
    document.querySelectorAll('[data-c="speed"]').forEach(function (b) { b.classList.toggle("on", +b.dataset.s === S.speed && !S.paused && !S.skip); });
    var sk = document.querySelector('[data-c="skip"]'); if (sk) sk.classList.toggle("on", !!S.skip);
  }

  // ---------- время ----------
  var raf = null, last = 0;
  function startLoop() { last = performance.now(); raf = requestAnimationFrame(tick); }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = null; }
  function tick(now) {
    var dt = Math.min(0.25, (now - last) / 1000); last = now;
    step(dt);
    if (S && !S.over) raf = requestAnimationFrame(tick);
  }
  function step(dt) {
    if (S && !S.paused && !S.modal) {
      var mult = S.skip ? 24 : S.speed;
      S.t += dt * mult / S.len.sec;
      // события, время которых пришло
      while (S.plan.length && S.plan[0].at <= S.t && !S.modal) fire(S.plan.shift());
      if (S.t >= 1 && !S.modal) endYear();
      if (S && !S.over) { updateBar(); drawScene(); }
    }
  }
  function updateBar() {
    var b = document.getElementById("bar"); if (b) b.style.width = (clamp(S.t, 0, 1) * 100) + "%";
  }

  // ---------- год ----------
  function grade() {
    var tr = S.flags.track;
    if (tr === "school") { var g = S.age - 6; return g === 10 && !S.done9 ? "9 класс окончен" : g > 11 ? "школа окончена" : g + " класс"; }
    if (tr === "spo") { var c = S.age - S.trackFrom + 1; return (c > 4 ? "диплом колледжа" : c + " курс колледжа") + " · «" + S.flags.spec + "»"; }
    return "работаете" + (S.flags.spec ? " · диплом «" + S.flags.spec + "»" : "");
  }

  function startYear(first) {
    S.t = 0; S.plan = []; S.yearBad = 0; S.yearStartHap = S.stats.hap;
    var a = S.age, y = S.year;
    if (!first) addLine({ age: a, text: "Вам " + years(a) + ". " + cap(grade()) + ".", tone: "dim" });
    // фокус года
    if (a >= 8 && S.focus) {
      var f = W.FOCUS.filter(function (x) { return x.id === S.focus; })[0];
      applyFx(f.fx);
    }
    if (a >= 10 && a <= 17) S.money += [300, 700, 1500, 2500, 4000][S.wealth];
    // дрейф счастья к середине
    S.stats.hap += Math.round((55 - S.stats.hap) * 0.08);

    var items = [];
    // путь после 9/11 класса, диплом
    if (a === 16 && S.flags.track === "school") items.push(evById("d-path-9"));
    if (a === 18 && S.flags.track === "school") items.push(evById("d-path-11"));
    if (S.flags.track === "spo" && a - S.trackFrom === 4) items.push(evById("d-path-diploma"));
    if (a === 16) items.push({ id: "pause16", kind: "pause" });
    // отложенные последствия
    S.queue = S.queue.filter(function (q) {
      if (q.age > a) return true;
      if (q.ev === "c-hack" && (S.hackAge >= a - 1 || items.some(function (x) { return x && x.id === "c-hack"; }))) return false;
      items.push(Object.assign({ origin: q.origin }, evById(q.ev)));
      return false;
    });
    // риски
    if (a >= 9) RISKS.forEach(function (r) {
      if (a < r.age[0] || a > r.age[1] || y < r.year[0] || y > r.year[1]) return;
      if (r.once && S.used["risk:" + r.ev]) return;
      if (items.some(function (x) { return x && x.id === r.ev; })) return;
      if (r.ev === "c-hack" && S.hackAge >= a - 2) return;
      if (r.need && !matchFlags(r.need)) return;
      var p = r.base || 0;
      Object.keys(r.flags || {}).forEach(function (k) { if (S.flags[k]) p += r.flags[k]; });
      Object.keys(r.nums || {}).forEach(function (k) { p += (S.nums[k] || 0) * r.nums[k]; });
      if (!chance(clamp(p, 0, 0.6))) return;
      S.used["risk:" + r.ev] = true;
      var prot = (r.protect || []).some(function (k) { return S.flags[k]; });
      if (prot && r.safe && chance(0.85)) items.push(Object.assign({ origin: "risk" }, evById(r.safe)));
      else items.push(Object.assign({ origin: "risk", protected: prot }, evById(r.ev)));
    });
    // события-фон (0–2 за год)
    var nf = first ? 1 : (chance(0.55) ? 1 : 0) + (chance(0.2) ? 1 : 0);
    if (first) items.push(evById("f-grade1"));
    for (var i = 0; i < nf; i++) {
      var flav = weighted(EV.filter(function (e) { return e.kind === "event" && !e.trigger && e.id !== "f-grade1" && eligible(e); }), focusW);
      if (flav) { S.used[flav.id] = true; items.push(flav); }
    }
    // решения
    var n = Math.floor(S.len.perYear) + (chance(S.len.perYear % 1) ? 1 : 0);
    if (a <= 8) n = Math.min(n, 1);
    var forced = items.filter(function (x) { return x.kind === "decision"; }).length;
    n = Math.max(0, n - Math.max(0, forced - 1));
    for (var j = 0; j < n; j++) {
      var d = weighted(EV.filter(function (e) { return e.kind === "decision" && !e.trigger && !e.path && eligible(e); }), focusW);
      if (d) { S.used[d.id] = true; items.push(d); }
    }
    // фокус выбирается в начале жизни и каждый год с 8 лет (не мешаем, просто карточка)
    // расставляем по времени года
    items = items.filter(Boolean);
    var k = items.length;
    items.forEach(function (it, idx) { it = items[idx]; items[idx] = { ev: it, at: 0.1 + 0.8 * (idx + 0.5 + (Math.random() - 0.5) * 0.6) / Math.max(1, k) }; });
    // ключевые развилки — в середине года
    items.sort(function (x, y2) { return x.at - y2.at; });
    S.plan = items;
    if (first) S.plan.unshift({ ev: { id: "focus-first", kind: "focus" }, at: 0.02 });
    renderAll();
  }

  function focusW(e) {
    var w = e.w || 1;
    if (S.focus && e.focus && e.focus.indexOf(S.focus) >= 0) w *= 3;
    return w;
  }
  function evById(id) { for (var i = 0; i < EV.length; i++) if (EV[i].id === id) return EV[i]; return null; }
  function matchFlags(need) { return Object.keys(need).every(function (k) { return (S.flags[k] || false) === need[k]; }); }
  function eligible(e) {
    if (S.used[e.id]) return false;
    if (S.age < e.age[0] || S.age > e.age[1]) return false;
    if (S.year < e.year[0] || S.year > e.year[1]) return false;
    if (e.need && !matchFlags(e.need)) return false;
    if (e.not && Object.keys(e.not).some(function (k) { return (S.flags[k] || false) === e.not[k]; })) return false;
    return true;
  }

  function endYear() {
    // карта жизни
    var dh = S.stats.hap - S.yearStartHap;
    S.map.push({ age: S.age, year: S.year, hap: S.stats.hap, bad: S.yearBad, dh: dh });
    // ровесники
    S.peers.forEach(function (p) {
      var st = W.PEER_STAGES.filter(function (x) { return S.age + 1 >= x[0] && S.age + 1 <= x[1]; })[0];
      if (st) p.status = pick(st[2]);
      p.news = S.age >= 10 && chance(0.22) ? pick(W.PEER_INCIDENTS) : (chance(0.5) ? p.news : "");
    });
    S.age++; S.year++;
    if (S.age > W.END_AGE) return finale();
    startYear(false);
  }

  // ---------- события ----------
  function fire(item) {
    var e = item.ev;
    if (!e) return;
    if (e.kind === "focus") return focusModal(true);
    if (e.kind === "pause") return pauseModal();
    if (e.kind === "decision") return decisionModal(e, item);
    // событие без выбора
    var text = e.text, tone = e.tone || "neutral", fx = e.fx || {}, variant = "base";
    if (e.alt) e.alt.forEach(function (al) { if (variant === "base" && matchFlags(al.if)) { text = al.text; tone = al.tone || tone; fx = al.fx || fx; variant = "alt"; } });
    if (variant === "base" && e.hi && (S.stats.tru >= 55 || item.ev.protected)) { text = e.hi; fx = halfBad(fx); variant = "hi"; }
    applyFx(fx); applySet(e.set, e.add);
    if (variant === "base" && e.tone === "bad" && e.hi) S.hits.lo.push({ age: S.age, id: e.id, tru: Math.round(S.stats.tru) });
    if (FAM_LOST[e.id] && (variant === "base" || e.id === "c-dialer-bill")) S.famLost += FAM_LOST[e.id];
    if (tone === "bad") { S.yearBad++; countHit(e.id); }
    if (e.id === "c-hack-blocked") S.hits.blocked++;
    var origin = item.ev.origin && item.ev.origin !== "risk" ? item.ev.origin : null;
    addLine({ age: S.age, text: T(text), tone: tone, fact: e.fact, origin: origin });
    if (e.later) schedule(e.later, origin || e.title || e.id);
    renderAll();
  }
  function halfBad(fx) { var o = {}; Object.keys(fx).forEach(function (k) { o[k] = fx[k] < 0 ? Math.round(fx[k] / 2) : fx[k]; }); return o; }
  function countHit(id) {
    if (/hack|malware|wifi/.test(id)) S.hits.hack++;
    if (/mock|doxx|photo-leak|you-next|pc-prank|friend-mess|blog-lost/.test(id)) S.hits.bully++;
    if (/loss|drain|avito|giveaway|answers|sms-sub|dialer|debt|pyramid|casino|parent-scam|voice/.test(id)) S.hits.scam++;
  }

  function applyFx(fx) {
    Object.keys(fx || {}).forEach(function (k) {
      if (k === "money") {
        if (fx.money < 0) { var loss = Math.min(S.money, -fx.money); S.money -= loss; if (fx.money <= -999999 || loss > 0) S.lost += loss; }
        else S.money += fx.money;
      } else if (k === "exp") S.nums.exp += fx.exp;
      else S.stats[k] = clamp(S.stats[k] + fx[k], 0, 100);
    });
  }
  function applySet(set, add) {
    Object.keys(set || {}).forEach(function (k) {
      var v = set[k];
      if (typeof v === "string") v = T(v);
      if (k === "track" && v !== S.flags.track) S.trackFrom = S.age;
      S.flags[k] = v;
    });
    Object.keys(add || {}).forEach(function (k) { S.nums[k] = (S.nums[k] || 0) + add[k]; });
  }
  function schedule(list, origin) {
    (list || []).forEach(function (l) {
      if (!chance(l.p)) return;
      if (l.ev === "c-hack" && (S.hackAge >= S.age - 1 || S.plan.some(function (x) { return x.ev && x.ev.id === "c-hack"; }))) return;
      var d = between(l.in[0], l.in[1]);
      var e = evById(l.ev);
      if (d === 0 && S.t < 0.97) {
        var at = Math.min(0.99, S.t + 0.08 + Math.random() * 0.12);
        S.plan.push({ ev: Object.assign({ origin: origin }, e), at: at });
        S.plan.sort(function (x, y) { return x.at - y.at; });
      } else S.queue.push({ ev: l.ev, age: S.age + Math.max(1, d), origin: origin });
    });
  }

  // ---------- окна решений ----------
  function decisionModal(e, item) {
    S.modal = true; S.skip = false; renderCtrl();
    var m = document.getElementById("modal");
    var opts = e.opts.map(function (o, i) { return { o: o, i: i }; });
    m.innerHTML = '<div class="overlay"><div class="dlg">' +
      '<div class="dlg-head"><span class="mono accent">' + (e.path ? "Развилка" : "Важное решение") + '</span><span class="mono dim">' + years(S.age) + " · " + S.year + "</span></div>" +
      '<h2 class="serif">' + esc(T(e.title)) + "</h2><p>" + esc(T(e.text)) + "</p>" +
      (e.fact ? '<div class="fact mono">' + esc(W.FACTS[e.fact]) + "</div>" : "") +
      '<div class="dopts">' + opts.map(function (x, k) { return '<button data-i="' + x.i + '"><span class="mono">' + (k + 1) + "</span><b>" + esc(T(x.o.t)) + "</b></button>"; }).join("") + "</div></div></div>";
    m.querySelectorAll(".dopts button").forEach(function (b) {
      b.onclick = function () {
        var o = e.opts[+b.dataset.i];
        applyFx(o.fx); applySet(o.set, o.add);
        if (e.id === "d-path-9") S.done9 = true;
        var title = T(e.title), choice = T(o.t);
        S.log.push({ age: S.age, year: S.year, title: title, choice: choice, id: e.id, origin: item.ev.origin || null });
        var origin = item.ev.origin && item.ev.origin !== "risk" ? item.ev.origin : null;
        if (e.trigger) { S.yearBad++; countHit(e.id); }
        if (e.id === "c-hack") S.hackAge = S.age;
        addLine({ age: S.age, text: "▸ " + title + " · Решение: " + choice, tone: "dec", origin: origin });
        addLine({ age: S.age, text: T(o.r), tone: "neutral" });
        if (o.later) schedule(o.later, title);
        m.innerHTML = ""; S.modal = false; renderAll(); renderCtrl();
      };
    });
  }

  function focusModal(firstTime) {
    S.modal = true; S.skip = false; renderCtrl();
    var m = document.getElementById("modal");
    var list = W.FOCUS.filter(function (f) { return !f.minAge || S.age >= f.minAge; });
    m.innerHTML = '<div class="overlay"><div class="dlg"><div class="dlg-head"><span class="mono accent">Фокус года</span><span class="mono dim">' + years(S.age) + " · " + S.year + "</span></div>" +
      '<h2 class="serif">' + (firstTime ? "Чем вы живёте?" : "Сменить фокус") + "</h2><p>Фокус влияет на то, что с вами случается и что растёт. Его можно менять в любой момент на панели «Фокус этого года».</p>" +
      '<div class="dopts">' + list.map(function (f, k) { return '<button data-f="' + f.id + '"><span class="mono">' + (k + 1) + "</span><b>" + f.icon + " " + f.label + "<small>" + f.desc + "</small></b></button>"; }).join("") + "</div></div></div>";
    m.querySelectorAll(".dopts button").forEach(function (b) {
      b.onclick = function () {
        S.focus = b.dataset.f;
        var f = W.FOCUS.filter(function (x) { return x.id === S.focus; })[0];
        addLine({ age: S.age, text: "Фокус года: " + f.icon + " " + f.label, tone: "dim" });
        m.innerHTML = ""; S.modal = false; renderAll(); renderCtrl();
      };
    });
  }

  function pauseModal() {
    S.modal = true; S.skip = false; renderCtrl();
    var m = document.getElementById("modal");
    var ans = ["Маме или папе", "Другу или подруге", "Учителю или куратору", "Никому — разберусь сам" + (S.g === "f" ? "а" : ""), "Поищу ответ в интернете"];
    m.innerHTML = '<div class="overlay"><div class="dlg"><div class="dlg-head"><span class="mono accent">Пауза</span><span class="mono dim">' + years(S.age) + " · " + S.year + "</span></div>" +
      '<h2 class="serif">Если в сети что-то пойдёт не так</h2><p>Вам 16. Представьте: в сети случилось что-то стыдное, страшное или вы потеряли деньги. Кому вы напишете первым?</p>' +
      '<div class="dopts">' + ans.map(function (a, k) { return '<button data-a="' + k + '"><span class="mono">' + (k + 1) + "</span><b>" + a + "</b></button>"; }).join("") + "</div></div></div>";
    m.querySelectorAll(".dopts button").forEach(function (b) {
      b.onclick = function () {
        S.pause16 = ans[+b.dataset.a];
        addLine({ age: S.age, text: "Пауза. Если что-то пойдёт не так, вы напишете: " + S.pause16.toLowerCase() + ".", tone: "dim" });
        m.innerHTML = ""; S.modal = false; renderAll(); renderCtrl();
      };
    });
  }

  // ---------- отрисовка ----------
  function addLine(l) { S.chron.unshift(l); if (S.chron.length > 120) S.chron.pop(); renderChron(); }

  function renderAll() {
    if (!S || !document.getElementById("chron")) return;
    document.getElementById("age").textContent = S.age;
    document.getElementById("info").textContent = S.year + " · " + S.first + " " + S.last + " · 1 год ≈ " + S.len.sec + " с";
    renderPassport(); renderState(); renderFocus(); renderFamily(); renderPeers(); renderMap(); renderChron(); drawScene();
  }

  function renderPassport() {
    var mrz1 = pad("P<RUS" + translit(S.last) + "<<" + translit(S.first), 36);
    var mrz2 = pad(String(S.born).slice(2) + ("0" + S.month).slice(-2) + "01" + (S.g === "f" ? "F" : "M") + "RUS<" + String(S.used ? Object.keys(S.used).length : 0).padStart(3, "0"), 36);
    document.getElementById("passport").innerHTML =
      '<div class="pp-head mono"><span>Личные данные · RUS</span><span>' + S.born + "</span></div>" +
      '<div class="pp-body"><div class="avatar">' + avatarSvg() + "</div><div><h2 class='serif'>" + esc(S.first + " " + S.last) + "</h2>" +
      kv("Пол", S.g === "f" ? "Женский" : "Мужской") + kv("Рождение", S.region + " · " + S.month + "/" + S.born) +
      kv("Живёте", cap(S.place)) + kv("Достаток", dots(S.wealth)) + kv("Учёба", cap(grade())) +
      kv("Цифровой след", dots(Math.min(4, S.nums.exp))) + "</div></div>" +
      '<div class="mrz mono">' + esc(mrz1) + "<br>" + esc(mrz2) + "</div>";
  }
  function kv(k, v) { return '<div class="kv"><span>' + k + "</span><b>" + esc(v) + "</b></div>"; }

  function statRows(compact) {
    return Object.keys(W.STATS).map(function (k) {
      var s = W.STATS[k], v = Math.round(S.stats[k]);
      return '<div class="srow' + (compact ? " c" : "") + '"><span>' + s.label + '</span><span class="sbar"><i style="width:' + v + "%;background:" + s.color + '"></i></span><b>' + v + "</b></div>";
    }).join("");
  }
  function renderState() {
    document.getElementById("state").innerHTML = '<div class="ph"><h3>Состояние</h3><span class="mono dim small">0–100</span></div>' + statRows(false) +
      '<details class="small dim"><summary>Что означают эти показатели?</summary>' + Object.keys(W.STATS).map(function (k) { return "<p><b>" + W.STATS[k].label + "</b> — " + W.STATS[k].hint + ".</p>"; }).join("") + "</details>" +
      '<div class="money"><div><span class="dim small">Ваши накопления</span><b>' + fmt(S.money) + ' ₽</b></div><div><span class="dim small">Потеряно из-за мошенников</span><b class="' + (S.lost + S.famLost ? "bad" : "") + '">' + fmt(S.lost + S.famLost) + " ₽</b></div></div>";
    document.getElementById("mini").innerHTML = statRows(true);
  }
  function renderFocus() {
    var f = S.focus ? W.FOCUS.filter(function (x) { return x.id === S.focus; })[0] : null;
    document.getElementById("focus").innerHTML = '<div class="ph"><h3>Фокус этого года</h3><button class="link" id="chf">сменить</button></div>' +
      "<p>" + (f ? f.icon + " <b>" + f.label + "</b> · " + f.desc : "Фокус ещё не выбран.") + "</p>" +
      '<p class="dim small">' + esc(cap(grade()) + " · " + S.place + " · " + S.year) + "</p>";
    document.getElementById("chf").onclick = function () { if (!S.modal) focusModal(false); };
  }
  function renderFamily() {
    var sib = S.sibs + (S.flags.sibYoung ? 1 : 0);
    document.getElementById("family").innerHTML = '<div class="ph"><h3>Семья и жизнь</h3></div>' +
      fam("Мать", S.mom.name + " · " + years(S.mom.age + S.age), S.mom.job) +
      (S.dad ? fam("Отец", S.dad.name + " · " + years(S.dad.age + S.age), S.dad.job) : fam("Отец", "не живёт с вами", "")) +
      fam("Братья и сёстры", sib ? String(sib) : "нет", "") +
      fam("Бабушка", S.flags.hasGm ? "живёт с вами" : "в другом городе", S.flags.gmLost ? "потеряла деньги на звонке «из банка»" : "") +
      fam("Друг", S.friend, "");
  }
  function fam(k, v, sub) { return '<div class="fam"><span class="dim">' + k + "</span><div><b>" + esc(v) + "</b>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</div></div>"; }
  function renderPeers() {
    document.getElementById("peers").innerHTML = '<div class="ph"><h3>Родились в том же году</h3><span class="mono dim small">СЕЙЧАС</span></div>' + S.peers.map(peerHtml).join("");
  }
  function renderMap() {
    var cells = "";
    for (var a = W.START_AGE; a <= W.END_AGE; a++) {
      var m = S.map.filter(function (x) { return x.age === a; })[0];
      var style = "", cls = "";
      if (m) { style = "background:hsl(" + (m.bad ? 350 : 150) + "," + (40 + m.hap / 3) + "%," + (14 + m.hap / 3.2) + "%)"; cls = m.bad ? " badc" : ""; }
      if (a === S.age && !S.over) cls += " now";
      cells += '<i class="' + cls + '" style="' + style + '" title="' + a + '"></i>';
    }
    document.getElementById("map").innerHTML = '<div class="ph"><h3>Карта жизни</h3><span class="mono dim small">1 КЛЕТКА = 1 ГОД</span></div><div class="lmap">' + cells +
      '</div><p class="dim small">Чем ярче, тем счастливее год. Красноватые — годы, когда случилось что-то плохое в сети.</p>';
  }
  function renderChron() {
    var el = document.getElementById("chron"); if (!el) return;
    el.innerHTML = S.chron.slice(0, 60).map(function (l) {
      return '<div class="line ' + l.tone + '"><span class="mono la">' + years(l.age) + "</span><div><p>" + esc(l.text) + "</p>" +
        (l.origin ? '<small class="mono dim">↳ последствие: «' + esc(l.origin) + "»</small>" : "") +
        (l.fact ? '<small class="mono data"><b>Данные</b> ' + esc(W.FACTS[l.fact]) + "</small>" : "") + "</div></div>";
    }).join("");
  }

  // ---------- пиксельная сцена ----------
  function avatarSvg() {
    var skin = ["#f1c7a5", "#e3b08b", "#c98e66"][S.first.length % 3], hair = ["#2b1d14", "#5a3a22", "#c9a24a", "#1b1b1b"][S.last.length % 4];
    var shirt = { past: "#b45309", present: "#2563eb", future: "#7c3aed" }[S.era];
    var long = S.g === "f";
    return '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" width="64" height="64">' +
      '<rect width="16" height="16" fill="#1d2430"/>' +
      '<rect x="4" y="3" width="8" height="7" fill="' + skin + '"/>' +
      '<rect x="4" y="2" width="8" height="3" fill="' + hair + '"/>' + (long ? '<rect x="3" y="3" width="2" height="7" fill="' + hair + '"/><rect x="11" y="3" width="2" height="7" fill="' + hair + '"/>' : "") +
      '<rect x="6" y="6" width="1" height="1" fill="#111"/><rect x="9" y="6" width="1" height="1" fill="#111"/><rect x="7" y="8" width="2" height="1" fill="#a0524a"/>' +
      '<rect x="3" y="11" width="10" height="5" fill="' + shirt + '"/></svg>';
  }
  function drawScene() {
    var el = document.getElementById("scene"); if (!el || !S) return;
    var t = clamp(S.t, 0, 1);
    var night = Math.abs(Math.sin(t * Math.PI * 2)) < 0.5 ? (t < 0.25 || t > 0.75 ? 1 : 0) : 0;
    var key = S.age + "|" + night + "|" + S.settlement + "|" + (S.flags.sibYoung ? 1 : 0);
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    var sky = night ? ["#0d1424", "#1b2540"] : ["#7fb2e5", "#cfe4f5"];
    var w = 160, h = 56, s = "";
    s += '<defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + sky[0] + '"/><stop offset="1" stop-color="' + sky[1] + '"/></linearGradient></defs>';
    s += '<rect width="' + w + '" height="' + h + '" fill="url(#sk)"/>';
    if (night) { for (var i = 0; i < 14; i++) s += '<rect x="' + ((i * 37) % w) + '" y="' + ((i * 13) % 22) + '" width="1" height="1" fill="#fff"/>'; s += '<rect x="20" y="6" width="6" height="6" fill="#f3e9b5"/><rect x="22" y="6" width="4" height="4" fill="' + sky[0] + '"/>'; }
    else s += '<rect x="130" y="6" width="8" height="8" fill="#ffe08a"/>';
    var seed = S.reg[3];
    if (S.settlement === "city") {
      for (var b = 0; b < 9; b++) {
        var bw = 12 + (seed * (b + 3)) % 8, bh = 18 + (seed * (b + 7)) % 22, bx = b * 18;
        s += '<rect x="' + bx + '" y="' + (44 - bh) + '" width="' + bw + '" height="' + bh + '" fill="' + (night ? "#232b3d" : "#8a94a6") + '"/>';
        for (var wy = 44 - bh + 3; wy < 41; wy += 4) for (var wx = bx + 2; wx < bx + bw - 2; wx += 3)
          if ((wx * wy + seed) % 5 < (night ? 2 : 1)) s += '<rect x="' + wx + '" y="' + wy + '" width="1" height="2" fill="' + (night ? "#f6d77a" : "#c9d6e6") + '"/>';
      }
    } else if (S.settlement === "town") {
      for (var b2 = 0; b2 < 5; b2++) {
        var x2 = 4 + b2 * 32;
        s += '<rect x="' + x2 + '" y="22" width="26" height="22" fill="' + (night ? "#2a2f3d" : "#b9a993") + '"/>';
        for (var r2 = 0; r2 < 5; r2++) for (var c2 = 0; c2 < 6; c2++) if ((r2 + c2 + b2 + seed) % 3 === 0 || !night) s += '<rect x="' + (x2 + 2 + c2 * 4) + '" y="' + (24 + r2 * 4) + '" width="2" height="2" fill="' + (night ? "#f6d77a" : "#e8edf3") + '"/>';
      }
    } else {
      for (var b3 = 0; b3 < 4; b3++) {
        var x3 = 6 + b3 * 40;
        s += '<rect x="' + x3 + '" y="30" width="22" height="14" fill="' + (night ? "#3a2c22" : "#9c6b45") + '"/>';
        s += '<polygon points="' + (x3 - 2) + ',30 ' + (x3 + 11) + ',21 ' + (x3 + 24) + ',30" fill="' + (night ? "#2c2a33" : "#6d4c41") + '"/>';
        s += '<rect x="' + (x3 + 8) + '" y="34" width="5" height="4" fill="' + (night ? "#f6d77a" : "#d8e8f0") + '"/>';
        s += '<rect x="' + (x3 + 30) + '" y="28" width="4" height="16" fill="' + (night ? "#1d3324" : "#3f7d4f") + '"/>';
      }
    }
    s += '<rect y="44" width="' + w + '" height="12" fill="' + (night ? "#1a1f1a" : "#4f7a43") + '"/>';
    // люди
    var people = [{ h: 13, c: "#c0504d" }];
    if (S.dad) people.push({ h: 13, c: "#3d6fb6" });
    people.push({ h: 12, c: "#7c5aa6" });
    var you = clamp(6 + (S.age - 7) * 0.45, 6, 12);
    people.push({ h: you, c: { past: "#e08a2c", present: "#3b82f6", future: "#a78bfa" }[S.era], you: true });
    for (var k = 0; k < Math.min(3, S.sibs + (S.flags.sibYoung ? 1 : 0)); k++) people.push({ h: 7 + k, c: "#6aa287" });
    if (S.flags.hasGm) people.push({ h: 11, c: "#8d8d8d" });
    var px = 80 - people.length * 4;
    people.forEach(function (p) {
      var top = 46 - p.h;
      s += '<rect x="' + px + '" y="' + top + '" width="5" height="4" fill="#e9c2a0"/>';
      s += '<rect x="' + px + '" y="' + top + '" width="5" height="1" fill="#3a2a20"/>';
      s += '<rect x="' + (px - 1) + '" y="' + (top + 4) + '" width="7" height="' + (p.h - 6) + '" fill="' + p.c + '"/>';
      s += '<rect x="' + px + '" y="' + (top + p.h - 2) + '" width="2" height="2" fill="#222"/><rect x="' + (px + 3) + '" y="' + (top + p.h - 2) + '" width="2" height="2" fill="#222"/>';
      if (p.you && S.year >= 2004) s += '<rect x="' + (px + 6) + '" y="' + (top + 5) + '" width="2" height="3" fill="' + (night ? "#9fe3ff" : "#1f2937") + '"/>';
      if (p.you) s += '<rect x="' + (px + 1) + '" y="' + (top - 3) + '" width="3" height="1" fill="#fff"/>';
      px += 9;
    });
    el.innerHTML = '<svg viewBox="0 0 ' + w + " " + h + '" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid slice">' + s + "</svg>";
    document.getElementById("scap").textContent = cap(S.place) + " · " + S.home + " · " + (S.flags.track === "work" ? "работаете" : grade());
  }

  // ---------- финал ----------
  function finale() {
    S.over = true; stopLoop();
    document.body.className = "start era-" + S.era;
    var decs = S.log.filter(function (l) { return !/^Пауза/.test(l.title); });
    var conseq = S.chron.filter(function (l) { return l.origin; });
    var insights = [];
    if (S.hits.lo.length) {
      var l0 = S.hits.lo[0];
      insights.push("В " + years(l0.age) + " с вами случилось плохое, и рядом не оказалось взрослого, которому вы бы рассказали сразу: доверие к взрослым было " + l0.tru + " из 100. С тем же событием при доверии выше 55 всё закончилось бы мягче.");
    }
    if (S.hits.hack) insights.push("Аккаунты взламывали " + S.hits.hack + " " + plural(S.hits.hack, "раз", "раза", "раз") + ". Почти каждый взлом начинался с одного решения, которое в моменте казалось удобным.");
    if (S.hits.bully) insights.push("Травля в этой жизни выросла из цифровых решений: слитые скриншоты, взломанная страница, старые посты. Ни одна из них не начиналась как «буллинг».");
    if (S.famLost) insights.push("Семья потеряла " + fmt(S.famLost) + " ₽ — мошенники звонили не вам, а близким.");
    if (!insights.length) insights.push("Эта жизнь прошла почти без потерь. Посмотрите на развилки: какие из решений были осознанными, а где просто повезло?");
    var first = conseq.length ? conseq[conseq.length - 1] : null;
    app.innerHTML =
      '<section class="final">' +
      '<div class="reg-head"><span>Запись о жизни · детство и юность</span><span class="mono">' + S.born + "–" + (S.year - 1) + "</span></div>" +
      '<div class="reg-body"><h2 class="serif">' + esc(S.first + " " + S.last) + "</h2>" +
      "<p>" + esc("Вам 23. " + (S.place === S.region ? S.region : cap(S.place) + ", " + S.region) + ". " + cap(grade()) + ".") + "</p>" +
      '<div class="fin-stats">' +
      big(decs.length, "решений принято") + big(S.hits.hack, "взломов и заражений") + big(S.hits.bully, "случаев травли") +
      big(fmt(S.lost) + " ₽", "ваших денег потеряно") + big(fmt(S.famLost) + " ₽", "потеряла семья") + big(S.hits.blocked, "атак отбито") +
      "</div>" +
      '<div class="panel">' + statRows(false) + "</div>" +
      '<div class="panel" id="map"></div>' +
      '<div class="panel teacher"><h3>Взгляд педагога</h3>' + insights.map(function (x) { return "<p>" + esc(x) + "</p>"; }).join("") +
      (S.pause16 ? "<p>В 16 лет на вопрос «кому напишете, если что-то пойдёт не так?» вы ответили: <b>" + esc(S.pause16.toLowerCase()) + "</b>.</p>" : "") +
      "<p><b>Вопрос для обсуждения:</b> в какой момент этой жизни мог появиться взрослый — и что он должен был сказать первым, чтобы его услышали?</p></div>" +
      '<div class="panel"><h3>Последствия, которые пришли позже</h3>' + (conseq.length ? conseq.slice().reverse().map(function (l) { return '<div class="line ' + l.tone + '"><span class="mono la">' + years(l.age) + "</span><div><p>" + esc(l.text) + '</p><small class="mono dim">↳ из-за решения «' + esc(l.origin) + "»</small></div></div>"; }).join("") : '<p class="dim">Отложенных последствий не было.</p>') + "</div>" +
      '<div class="panel"><h3>Все решения</h3><ol class="declog">' + decs.map(function (d) { return "<li><span class='mono dim'>" + years(d.age) + "</span> " + esc(d.title) + " — <b>" + esc(d.choice) + "</b></li>"; }).join("") + "</ol></div>" +
      '<div class="panel"><h3>Родились в том же году</h3>' + S.peers.map(peerHtml).join("") + "</div>" +
      '<div class="panel"><h3>Летопись целиком</h3><div class="chron">' + S.chron.map(function (l) { return '<div class="line ' + l.tone + '"><span class="mono la">' + years(l.age) + "</span><div><p>" + esc(l.text) + "</p></div></div>"; }).join("") + "</div></div>" +
      '<button class="btn primary big" id="again">Прожить ещё одну жизнь</button>' +
      '<button class="btn ghost" id="share">Поделиться итогом</button></div></section>';
    renderMap();
    document.getElementById("again").onclick = startScreen;
    document.getElementById("share").onclick = function () {
      var text = S.first + " " + S.last + ", " + S.region + ", " + S.born + ". " + decs.length + " решений, взломов: " + S.hits.hack + ", потеряно: " + fmt(S.lost + S.famLost) + " ₽. Я прожил" + (S.g === "f" ? "а" : "") + " 1 из 22 миллионов жизней.";
      var url = "https://irinilou.github.io/1in22m.life/";
      if (navigator.share) navigator.share({ title: "1 из 22 миллионов", text: text, url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text + " " + url).then(function () { document.getElementById("share").textContent = "Скопировано ✓"; });
    };
    window.scrollTo(0, 0);
  }
  function big(n, label) { return '<div><b class="serif">' + n + "</b><span class='dim small'>" + label + "</span></div>"; }

  // режим проверки: ?test — прогон без интерфейса
  window.__sim = {
    get: function () { return S; },
    step: function (dt) { step(dt); },
    // служебный быстрый старт для автопроверки
    quick: function (era) {
      var born = between(W.ERAS[era].born[0], W.ERAS[era].born[1]);
      register(era, born, makePerson(era, born, "real", "any"));
      beginLife(); stopLoop();
    }
  };
  startScreen();
})();
