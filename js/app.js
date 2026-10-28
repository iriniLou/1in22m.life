/* 1 из 22 миллионов — движок игры */
(function () {
  "use strict";

  var app = document.getElementById("app");
  var dots = document.querySelectorAll(".steps i");
  var S = {}; // состояние текущей жизни
  var settings = { era: "any", region: "real", gender: "any" };

  // ---------- утилиты ----------
  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[rnd(arr.length)]; }
  function between(a, b) { return a + rnd(b - a + 1); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function fmt(n) { return Math.round(n).toLocaleString("ru-RU").replace(/,/g, " "); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || "null");
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }

  // Подстановка рода {он|она} и переменных {name}
  function T(str) {
    if (!str) return "";
    var s = String(str).replace(/\{([^{}|]*)\|([^{}|]*)\}/g, function (_, m, f) { return S.g === "f" ? f : m; });
    s = s.replace(/\{(\w+)\}/g, function (all, k) { return S.v && S.v[k] !== undefined ? S.v[k] : all; });
    return s;
  }
  function H(str) { return esc(T(str)); }

  function step(n) {
    for (var i = 0; i < dots.length; i++) dots[i].className = i < n ? "on" : (i === n ? "now" : "");
  }

  function show(html, eraAttr) {
    if (eraAttr !== undefined) document.body.setAttribute("data-era", eraAttr || "");
    app.innerHTML = '<section class="screen">' + html + "</section>";
    window.scrollTo(0, 0);
  }

  function chipGroup(name, options, current) {
    return '<div class="chips" data-group="' + name + '">' + options.map(function (o) {
      return '<button class="chip' + (o[0] === current ? " sel" : "") + '" data-val="' + o[0] + '">' +
        '<b>' + o[1] + "</b>" + (o[2] ? "<small>" + o[2] + "</small>" : "") + "</button>";
    }).join("") + "</div>";
  }

  // ---------- 1. Старт ----------
  function startScreen() {
    step(0);
    var e = window.ERAS;
    show(
      '<p class="kicker">Интерактив · 5–7 минут</p>' +
      '<h1 class="hero"><span class="one">1</span><span class="of">из</span><span class="count" id="count">22 000 000</span></h1>' +
      '<p class="lead">Столько детей и подростков учатся в школах, колледжах и техникумах России. Случай выберет одного из них, а ты проживёшь его историю.</p>' +
      '<p class="lead dim">Регион, год, класс и ситуация выпадут случайно. Решения принимаешь ты, и у каждого будут последствия.</p>' +
      '<div class="set"><h3>Когда?</h3>' + chipGroup("era", [
        ["any", "🎲 Как повезёт", "любое время"],
        ["past", e.past.icon + " " + e.past.label, e.past.sub],
        ["present", e.present.icon + " " + e.present.label, e.present.sub],
        ["future", e.future.icon + " " + e.future.label, e.future.sub]
      ], settings.era) + "</div>" +
      '<div class="set"><h3>Где?</h3>' + chipGroup("region", [
        ["real", "👥 Как в жизни", "чем больше учащихся в регионе, тем выше шанс"],
        ["equal", "🗺️ Любой из 89", "все регионы с равным шансом"]
      ], settings.region) + "</div>" +
      '<div class="set"><h3>Кто?</h3>' + chipGroup("gender", [
        ["any", "🎲 Как повезёт"], ["m", "Мальчик / юноша"], ["f", "Девочка / девушка"]
      ], settings.gender) + "</div>" +
      '<button class="btn big" id="go">Родиться</button>' +
      '<p class="fine">Истории вымышлены, но собраны из реальных ситуаций. Тяжёлых сцен нет.</p>',
      ""
    );
    countUp(document.getElementById("count"), 22000000);
    app.querySelectorAll(".chips").forEach(function (g) {
      g.addEventListener("click", function (ev) {
        var b = ev.target.closest(".chip"); if (!b) return;
        settings[g.dataset.group] = b.dataset.val;
        g.querySelectorAll(".chip").forEach(function (c) { c.classList.toggle("sel", c === b); });
      });
    });
    document.getElementById("go").onclick = birth;
  }

  function countUp(el, target) {
    if (!el) return;
    var t0 = null, dur = 1400;
    function f(t) {
      if (!t0) t0 = t;
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(target * e);
      if (k < 1) requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  }

  // ---------- выбор истории и героя ----------
  function chooseStory() {
    var forced = new URLSearchParams(location.search).get("story");
    var all = window.STORIES;
    if (forced) { var fs = all.filter(function (s) { return s.id === forced; }); if (fs.length) return fs[0]; }
    var era = settings.era === "any" ? pick(["past", "present", "future"]) : settings.era;
    var pool = all.filter(function (s) { return s.era === era; });
    var played = store("1in22m-played") || [];
    var fresh = pool.filter(function (s) { return played.indexOf(s.id) < 0; });
    if (!fresh.length) { fresh = pool; played = played.filter(function (id) { return !pool.some(function (s) { return s.id === id; }); }); }
    var st = pick(fresh);
    played.push(st.id); store("1in22m-played", played);
    return st;
  }

  function chooseRegion() {
    var R = window.REGIONS, share = window.YOUNG_SHARE;
    if (settings.region === "equal") return pick(R);
    var w = R.map(function (r) { return r[3] * (share[r[0]] || 0.15); });
    var sum = w.reduce(function (a, b) { return a + b; }, 0), x = Math.random() * sum;
    for (var i = 0; i < R.length; i++) { x -= w[i]; if (x <= 0) return R[i]; }
    return R[R.length - 1];
  }

  function makeLife() {
    var st = chooseStory();
    var era = st.era;
    var reg = chooseRegion();
    var g = settings.gender === "any" ? pick(["m", "f"]) : settings.gender;
    var name = pick(window.NAMES[era][g]);
    var friend; do { friend = pick(window.NAMES[era][g]); } while (friend === name);
    var mentor = pick(window.MENTORS[era]);
    var age = pick(st.ages);
    var spo = typeof age === "string";
    var level = spo ? parseInt(age.slice(1), 10) : age;
    var years = spo ? 15 + level + rnd(2) : level + 6 + rnd(2);
    var letter = pick(["А", "Б", "В", "Г"]);
    var spec = pick(window.SPECS);
    var sch = spo ? (era === "past" ? "техникум" : "колледж") : "школа";
    var isCity = reg[0] === reg[2];
    var place = isCity || Math.random() < 0.55 ? reg[2]
      : pick(["Райцентр", "Посёлок", "Село", "Небольшой город"]) + " · " + between(25, 260) + " км до регионального центра (" + reg[2] + ")";
    var eraInfo = window.ERAS[era];
    var learners = reg[3] * 1000 * (window.YOUNG_SHARE[reg[0]] || 0.15) * eraInfo.total / 22000000;

    var v = {
      name: name, friend: friend, year: between(st.years[0], st.years[1]), age: years,
      region: reg[0], in_region: reg[1], city: reg[2], spec: spec,
      mentor: mentor[0], mentor_dat: mentor[1], mentor_acc: mentor[2], mentor_ins: mentor[3],
      grade: spo ? level + " курс" : level + " «" + letter + "» класс"
    };
    if (spo) {
      var gen = sch === "техникум" ? "техникума" : "колледжа";
      Object.assign(v, {
        school: sch, school_cap: cap(sch), in_school: "в " + gen.replace(/а$/, "е"), school_gen: gen, to_school: "в " + sch,
        mates: "одногруппники", mates_dat: "одногруппникам", mates_gen: "одногруппников",
        in_class: "в группе", klass_gen: "группы", all_klass: "всей группой",
        class_chat: "чат группы", class_chat_gen: "чата группы", in_chat: "в чате группы",
        parallel: "из соседней группы", mentor_role: "куратор группы", mentor_role_dat: "куратору группы"
      });
    } else {
      Object.assign(v, {
        school: "школа", school_cap: "Школа", in_school: "в школе", school_gen: "школы", to_school: "в школу",
        mates: "одноклассники", mates_dat: "одноклассникам", mates_gen: "одноклассников",
        in_class: "в классе", klass_gen: "класса", all_klass: "всем классом",
        class_chat: "чат класса", class_chat_gen: "чата класса", in_chat: "в чате класса",
        parallel: "из параллельного класса", mentor_role: "классная руководительница", mentor_role_dat: "классной руководительнице"
      });
    }
    v.in_school_cap = cap(v.in_school);
    v.in_class_cap = cap(v.in_class);
    v.mentor_role_cap = cap(v.mentor_role);

    S = {
      st: st, era: era, g: g, v: v, spo: spo, place: place, learners: learners,
      tilt: null, stats: { f: 40, t: 40, c: 40, d: 40 }, a: null, b: null
    };
  }

  // ---------- 2. Рождение ----------
  function birth() {
    makeLife();
    step(1);
    var e = window.ERAS[S.era];
    var v = S.v;
    var schoolLine = S.spo
      ? cap(v.school) + ", " + v.grade + " · «" + v.spec + "»"
      : cap(v.grade);
    show(
      '<p class="kicker">Случай выбирает…</p>' +
      '<div class="roller" id="roller"><span>' + esc(window.REGIONS[0][0]) + "</span></div>" +
      '<div class="card birth hidden" id="card">' +
      row("📍", "Регион", v.region) +
      row("🏠", "Где", S.place) +
      row("📅", "Год", v.year + " · " + e.label.toLowerCase()) +
      row("🙂", "Имя", v.name + ", " + v.age + " " + plural(v.age, "год", "года", "лет")) +
      row("🎒", "Учёба", schoolLine) +
      "</div>" +
      '<div class="odds hidden" id="odds">' +
      '<p>Ты — <b>1 из ≈ ' + fmt(round2(S.learners)) + "</b> школьников и студентов " + esc(v.in_region) + ".</p>" +
      '<p>И <b>1 из ' + e.totalText + "</b> по всей стране.</p>" +
      '<p class="dim small">' + e.totalNote + ". Цифры примерные.</p>" +
      "</div>" +
      '<button class="btn hidden" id="next">Дальше</button>',
      S.era
    );
    var roller = document.getElementById("roller").firstChild, i = 0, ticks = 0;
    var iv = setInterval(function () {
      if (!document.getElementById("roller")) return clearInterval(iv);
      roller.textContent = window.REGIONS[(i = (i + 7) % window.REGIONS.length)][0];
      if (++ticks > 16) {
        clearInterval(iv);
        roller.textContent = v.region;
        document.getElementById("roller").classList.add("done");
        reveal(["card", "odds", "next"]);
      }
    }, 70);
    document.getElementById("next").onclick = tiltScreen;
  }

  function round2(n) {
    var p = Math.pow(10, Math.max(0, String(Math.round(n)).length - 2));
    return Math.round(n / p) * p;
  }
  function row(ic, k, val) {
    return '<div class="row"><span class="ic">' + ic + '</span><span class="k">' + k + '</span><span class="val">' + esc(val) + "</span></div>";
  }
  function plural(n, a, b, c) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return a;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b;
    return c;
  }
  function reveal(ids) {
    ids.forEach(function (id, k) {
      setTimeout(function () { var el = document.getElementById(id); if (el) el.classList.remove("hidden"); }, 150 + k * 380);
    });
  }

  // ---------- 3. Уклон жизни ----------
  function tiltScreen() {
    step(1);
    show(
      '<p class="kicker">' + H("{name}, {year}") + "</p>" +
      "<h2>Чем ты живёшь?</h2>" +
      '<p class="dim">От этого зависит, кто окажется рядом и что сработает в трудную минуту.</p>' +
      '<div class="tilts">' + window.TILTS.map(function (t) {
        return '<button class="tilt" data-id="' + t.id + '"><span class="ti">' + t.icon + "</span><b>" + t.label + "</b><small>" + t.desc + "</small></button>";
      }).join("") + "</div>"
    );
    app.querySelectorAll(".tilt").forEach(function (b) {
      b.onclick = function () {
        var t = window.TILTS.filter(function (x) { return x.id === b.dataset.id; })[0];
        S.tilt = t.id;
        Object.keys(t.base).forEach(function (k) { S.stats[k] += t.base[k]; });
        lifeScreen();
      };
    });
  }

  // ---------- 4. Жизнь до истории ----------
  function lifeScreen() {
    step(2);
    var e = window.ERAS[S.era];
    show(
      '<p class="kicker">' + H("{year} · тебе {age}") + "</p>" +
      '<p class="big-text">' + H(window.BEATS[S.era][S.tilt]) + "</p>" +
      "<p>" + H(e.mentor) + "</p>" +
      '<p class="fact">' + H(e.fact) + "</p>" +
      '<h3 class="mt">Твои опоры</h3>' + bars() +
      '<button class="btn" id="next">Начать историю</button>'
    );
    document.getElementById("next").onclick = actOne;
  }

  function bars(delta) {
    return '<div class="bars">' + Object.keys(window.STATS).map(function (k) {
      var s = window.STATS[k], val = clamp(S.stats[k]);
      var d = delta && delta[k] ? '<em class="' + (delta[k] > 0 ? "up" : "down") + '">' + (delta[k] > 0 ? "+" : "") + delta[k] + "</em>" : "";
      return '<div class="bar"><span class="bl">' + s.icon + " " + s.label + d + '</span><span class="track"><span style="width:' + val + '%"></span></span></div>';
    }).join("") + "</div>";
  }
  function clamp(x) { return Math.max(4, Math.min(100, x)); }

  function applyFx(fx) { Object.keys(fx || {}).forEach(function (k) { S.stats[k] += fx[k]; }); }

  function fxChips(fx) {
    var keys = Object.keys(fx || {});
    if (!keys.length) return "";
    return '<div class="fx">' + keys.map(function (k) {
      var n = fx[k], s = window.STATS[k];
      return '<span class="' + (n > 0 ? "up" : "down") + '">' + (n > 0 ? "+" : "−") + Math.abs(n) + " " + s.icon + " " + s.label + "</span>";
    }).join("") + "</div>";
  }

  function storyHead() {
    return '<div class="story-head"><span class="emoji">' + S.st.emoji + '</span><div><b>' + H(S.st.title) +
      '</b><small>' + H(S.st.role) + " · " + H("{name}, {grade}") + "</small></div></div>";
  }

  function options(list) {
    return '<div class="opts">' + list.map(function (o, i) {
      return '<button class="opt" data-i="' + i + '"><span class="n">' + "АБВ"[i] + "</span><span>" + H(o.t) + "</span></button>";
    }).join("") + "</div>";
  }

  function bindOptions(list, onPick) {
    var btns = app.querySelectorAll(".opt");
    btns.forEach(function (b) {
      b.onclick = function () {
        if (app.querySelector(".opt.sel")) return;
        b.classList.add("sel");
        btns.forEach(function (x) { if (x !== b) x.classList.add("off"); x.disabled = true; });
        onPick(list[+b.dataset.i], +b.dataset.i);
      };
    });
  }

  function outcome(o, nextLabel) {
    var extra = o.tl && o.tl[S.tilt] ? '<p class="tilt-line"><span>' + tiltIcon() + "</span> " + H(o.tl[S.tilt]) + "</p>" : "";
    return '<div class="result">' +
      "<p>" + H(o.r) + "</p>" + extra + fxChips(o.fx) +
      '</div><button class="btn" id="next">' + nextLabel + "</button>";
  }
  function tiltIcon() { return window.TILTS.filter(function (t) { return t.id === S.tilt; })[0].icon; }

  // ---------- 5. Первый выбор ----------
  function actOne() {
    step(2);
    var st = S.st;
    show(storyHead() + st.intro.map(function (p) { return "<p>" + H(p) + "</p>"; }).join("") +
      '<h3 class="q">' + H(st.q1) + "</h3>" + options(st.a) + '<div id="out"></div>');
    bindOptions(st.a, function (o) {
      S.a = o; applyFx(o.fx);
      var out = document.getElementById("out");
      out.innerHTML = outcome(o, "Дальше");
      out.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("next").onclick = actTwo;
    });
  }

  // ---------- 6. Поворот ----------
  function actTwo() {
    step(3);
    var st = S.st;
    show(storyHead() +
      (S.a.br ? '<p class="bridge">' + H(S.a.br) + "</p>" : "") +
      '<div class="twist"><span>Поворот</span><p>' + H(st.twist) + "</p></div>" +
      '<h3 class="q">' + H(st.q2) + "</h3>" + options(st.b) + '<div id="out"></div>');
    bindOptions(st.b, function (o) {
      S.b = o; applyFx(o.fx);
      var out = document.getElementById("out");
      out.innerHTML = outcome(o, "Что было потом →");
      out.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("next").onclick = epilogue;
    });
  }

  // ---------- 7. Финал ----------
  function epilogue() {
    step(4);
    var later = between(8, 14);
    var ageNow = S.v.age + later;
    var keys = ["f", "t", "c", "d"];
    var top = keys.reduce(function (a, b) { return S.stats[b] > S.stats[a] ? b : a; });
    var title = S.stats[top] < 50 ? window.FINAL_TITLES.low : window.FINAL_TITLES[top];
    var career = pick(window.CAREERS[S.tilt]);
    var st = S.st;
    show(
      '<p class="kicker">' + (S.v.year + later) + " · прошло " + later + " " + plural(later, "год", "года", "лет") + "</p>" +
      "<h2>" + H("{name}, " + ageNow + " " + plural(ageNow, "год", "года", "лет")) + "</h2>" +
      '<div class="epi">' +
      "<p>" + H(S.a.ep) + "</p>" +
      "<p>" + H(S.b.ep) + "</p>" +
      "<p>" + H(career) + "</p>" +
      "</div>" +
      '<div class="final-title"><small>Итог этой жизни</small><b>' + H(title) + "</b></div>" +
      bars() +
      '<div class="path"><h3>Твой путь</h3>' +
      "<p><span>" + st.emoji + "</span> " + H(st.title) + " · " + esc(S.v.region) + " · " + S.v.year + "</p>" +
      "<ol><li>" + H(S.a.t) + "</li><li>" + H(S.b.t) + "</li></ol></div>" +
      '<div class="teacher"><h3>Взгляд педагога</h3><p>' + H(st.view) + "</p></div>" +
      '<div class="hall"><p><b>В зале сейчас ещё сотни таких жизней.</b> Покажите экран соседу: какая история выпала вам и что вы выбрали? Совпали ли решения?</p></div>' +
      '<button class="btn big" id="again">Прожить другую жизнь</button>' +
      '<button class="btn ghost" id="share">Поделиться итогом</button>'
    );
    document.getElementById("again").onclick = startScreen;
    document.getElementById("share").onclick = function () {
      var text = T("Я прожил{|а} одну из ≈ 22 миллионов жизней: {name}, {age} лет, " + S.v.region + ", " + S.v.year + ". История «" + st.title + "». Итог: " + title + ".");
      var url = location.href.split("?")[0];
      if (navigator.share) { navigator.share({ title: "1 из 22 миллионов", text: text, url: url }).catch(function () {}); }
      else if (navigator.clipboard) {
        navigator.clipboard.writeText(text + " " + url).then(function () {
          document.getElementById("share").textContent = "Скопировано ✓";
        });
      }
    };
  }

  startScreen();
})();
