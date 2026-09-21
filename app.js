/*
 * kintore-checker
 *
 * 本体（index.html）とデモ（demo.html）で同じこのファイルを読み込む。
 * 違いは window.KC_CONFIG.demo だけで、デモは次の3点が変わる。
 *   1. 保存先を分ける（同じオリジンなので本体の記録を壊さないため）
 *   2. デバッグモード固定（当日以外・任意のメニューを完了できる）
 *   3. 画像未登録のときは埋め込みのサンプル素材を表示する
 */
(function () {
  "use strict";

  var CFG = window.KC_CONFIG || {};
  var DEMO = !!CFG.demo;

  var DOW = ["日", "月", "火", "水", "木", "金", "土"];
  var TILES_PER_SET = 6;
  var SET_CHOICES = [6, 12, 24];
  var INTERVAL_CHOICES = [1, 2, 3];
  var INTERVAL_LABEL = { 1: "毎日", 2: "隔日", 3: "3日に1回" };
  var DAY_MS = 86400000;
  var SUFFIX = DEMO ? ".demo" : "";
  var LS_SETTINGS = "wt.settings.v3" + SUFFIX;
  var LS_LOG = "wt.log.v3" + SUFFIX;
  var DB_NAME = DEMO ? "workout-tracker-demo" : "workout-tracker";

  var ABS = { id: "abs", name: "ニートゥチェスト", reps: 10, note: "腹。どの回でも最後に" };

  var SESSIONS = [
    {
      id: "chest", label: "胸の日",
      moves: [
        { id: "pushup", name: "腕立て伏せ", reps: 10, note: "きつければ膝をついて" },
        { id: "kickback", name: "キックバック", reps: 20, note: "左右10回ずつ。ペットボトルを持つ" },
        ABS
      ]
    },
    {
      id: "legs", label: "脚の日",
      moves: [
        { id: "squat", name: "スクワット", reps: 10, note: "椅子に座って立つ動作から" },
        { id: "calf", name: "カーフレイズ", reps: 15, note: "かかとの上げ下げ" },
        ABS
      ]
    },
    {
      id: "back", label: "背中の日",
      moves: [
        { id: "row", name: "ベントオーバーローイング", reps: 20, note: "左右10回ずつ。ペットボトルを持つ" },
        { id: "backext", name: "バックエクステンション", reps: 10, note: "うつ伏せから上体を反らす" },
        ABS
      ]
    }
  ];

  /* ---------- 画面（本体とデモで完全に共通） ---------- */

  var SHELL =
    '<div class="topbar">' +
      '<h1>kintore-checker</h1>' +
      '<span class="debug-flag" id="debugFlag" hidden>DEBUG</span>' +
      '<span class="spacer"></span>' +
      '<button class="icon-btn" id="openSettings" aria-label="設定">⚙</button>' +
    '</div>' +

    '<section class="card">' +
      '<div class="prog">' +
        '<div class="prog-n" id="progN">0<small>/ 6 セット</small></div>' +
        '<div class="prog-sub" id="progSub">1セットで6マス開きます</div>' +
      '</div>' +
      '<div class="stage" id="stage"></div>' +
      '<div class="medianav" id="mediaNav" hidden>' +
        '<button id="prevMedia" aria-label="前へ">‹</button>' +
        '<span class="pos" id="mediaPos"></span>' +
        '<button id="nextMedia" aria-label="次へ">›</button>' +
      '</div>' +
    '</section>' +

    '<section class="card">' +
      '<div class="sess-head">' +
        '<div class="sess-title" id="sessTitle">—</div>' +
        '<div class="sess-date" id="sessDate"></div>' +
      '</div>' +
      '<div class="tabs" id="sessTabs" hidden></div>' +
      '<div id="moves"></div>' +
    '</section>' +

    '<section class="card">' +
      '<div class="cal-head">' +
        '<div class="cal-title" id="calTitle">—</div>' +
        '<div class="nav">' +
          '<button id="prevMonth" aria-label="前の月">‹</button>' +
          '<button id="thisMonth" aria-label="今月">·</button>' +
          '<button id="nextMonth" aria-label="次の月">›</button>' +
        '</div>' +
      '</div>' +
      '<div class="grid7" id="dowRow"></div>' +
      '<div class="grid7" id="calGrid"></div>' +
      '<div class="legend">' +
        '<span><i class="swatch" style="background:var(--panel-2)"></i>予定日</span>' +
        '<span><i class="swatch" style="background:#2f5a4c"></i>途中</span>' +
        '<span><i class="swatch" style="background:var(--accent)"></i>全セット完了</span>' +
      '</div>' +
    '</section>' +

    '<div class="sheet-bg" id="sheetBg">' +
      '<div class="sheet" role="dialog" aria-label="設定">' +
        '<h2>設定</h2>' +
        '<div class="field" id="debugField">' +
          '<div class="toggle">' +
            '<div class="lab">デバッグモード<small>任意の日・任意のメニューのセットを自由に増減できます。通常は切っておいてください。</small></div>' +
            '<button class="switch" id="debugSwitch" aria-label="デバッグモード"></button>' +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label>スケジュール</label>' +
          '<div class="seg" id="modeSeg"></div>' +
          '<div id="weeklyBox" style="margin-top:9px">' +
            '<div class="dow-picker" id="dowPicker"></div>' +
            '<p class="note" style="margin-top:8px">選んだ曜日に、胸 → 脚 → 背中 の順でメニューが割り当てられます。</p>' +
          '</div>' +
          '<div id="intervalBox" style="margin-top:9px">' +
            '<div class="seg" id="intervalSeg"></div>' +
            '<p class="note" id="anchorNote" style="margin-top:8px"></p>' +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label>1枚あたりのセット数</label>' +
          '<div class="seg" id="setSeg"></div>' +
          '<p class="note" id="setNote" style="margin-top:8px"></p>' +
        '</div>' +
        '<div class="field">' +
          '<label>画像・動画</label>' +
          '<div class="imglist" id="imgList"></div>' +
          '<button class="btn primary" id="addImage" style="margin-top:9px">追加する</button>' +
          '<input type="file" id="fileInput" accept="image/*,video/*" multiple>' +
          '<p class="note">この端末の中だけに保存され、どこにも送信されません。' +
          'ブラウザのデータを消すと一緒に消えるので、元のファイルは端末に残しておいてください。</p>' +
        '</div>' +
        '<button class="btn quiet" id="closeSheet">閉じる</button>' +
      '</div>' +
    '</div>';

  document.getElementById("app").innerHTML = SHELL;

  var settings = loadSettings();
  var log = loadLog();
  var images = [];
  var urls = {};
  var db = null;
  var dbReady = null;
  var lastRevealed = -1;
  var selDate = null;
  var selSession = null;
  var viewYear, viewMonth;

  var sampleTpl = document.getElementById("sampleArt");

  /* ---------- storage ---------- */

  function loadSettings() {
    var t = new Date();
    var d = {
      mode: "weekly",
      days: [1, 3, 5],
      interval: 2,
      anchor: t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate()),
      moved: {},
      skipped: {},
      shifted: {},
      sets: 6,
      currentId: null,
      sampleSets: 0,
      debug: false
    };
    try {
      var s = JSON.parse(localStorage.getItem(LS_SETTINGS) || "{}");
      if (s.mode === "interval" || s.mode === "weekly") d.mode = s.mode;
      if (Array.isArray(s.days) && s.days.length) d.days = s.days;
      if (INTERVAL_CHOICES.indexOf(s.interval) >= 0) d.interval = s.interval;
      if (typeof s.anchor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.anchor)) d.anchor = s.anchor;
      if (s.moved && typeof s.moved === "object") d.moved = s.moved;
      if (s.skipped && typeof s.skipped === "object") d.skipped = s.skipped;
      if (s.shifted && typeof s.shifted === "object") d.shifted = s.shifted;
      if (SET_CHOICES.indexOf(s.sets) >= 0) d.sets = s.sets;
      if (typeof s.currentId === "string") d.currentId = s.currentId;
      if (typeof s.sampleSets === "number") d.sampleSets = s.sampleSets;
      d.debug = !!s.debug;
    } catch (e) {}
    if (DEMO) d.debug = true;
    return d;
  }
  function saveSettings() {
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); } catch (e) {}
  }
  function loadLog() {
    try { return JSON.parse(localStorage.getItem(LS_LOG) || "{}"); } catch (e) { return {}; }
  }
  function saveLog() {
    try { localStorage.setItem(LS_LOG, JSON.stringify(log)); } catch (e) {}
  }

  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains("images")) d.createObjectStore("images", { keyPath: "id" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function tx(mode, fn) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction("images", mode);
      var out = fn(t.objectStore("images"));
      t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
      t.onerror = function () { reject(t.error); };
    });
  }

  /* ---------- dates ---------- */

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function key(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function today() { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
  function fromKey(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }

  /* ---------- sessions ---------- */

  function plannedDays() { return settings.days.slice().sort(function (a, b) { return a - b; }); }

  function sessionById(id) {
    for (var i = 0; i < SESSIONS.length; i++) if (SESSIONS[i].id === id) return SESSIONS[i];
    return SESSIONS[0];
  }

  function dayDiff(fromDateKey, date) {
    return Math.round((date - fromKey(fromDateKey)) / DAY_MS);
  }

  function addDays(date, n) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  }

  // その日のメニュー。トレーニング日でなければ null
  function sessionFor(date) {
    var k = key(date);
    if (settings.moved[k]) return sessionById(settings.moved[k]);
    if (settings.skipped[k]) return null;

    if (settings.mode === "interval") {
      var n = dayDiff(settings.anchor, date);
      var iv = settings.interval;
      if (((n % iv) + iv) % iv !== 0) return null;
      var idx = Math.floor(n / iv);
      return SESSIONS[((idx % SESSIONS.length) + SESSIONS.length) % SESSIONS.length];
    }

    var days = plannedDays();
    var p = days.indexOf(date.getDay());
    if (p < 0) return null;
    return SESSIONS[p % SESSIONS.length];
  }

  // 前日が未実施のトレーニング日で、今日が休養日なら繰り上げられる
  function shiftable() {
    var t = today();
    if (sessionFor(t)) return null;
    var y = addDays(t, -1);
    var ys = sessionFor(y);
    if (!ys) return null;
    if (daySets(key(y)) > 0) return null;
    return { yesterday: y, session: ys };
  }

  function shiftedToday() { return !!settings.shifted[key(today())]; }

  function doShift() {
    var c = shiftable();
    if (!c) return;
    var tk = key(today());
    if (settings.mode === "interval") {
      settings.anchor = key(addDays(fromKey(settings.anchor), 1));
    } else {
      settings.moved[tk] = c.session.id;
      settings.skipped[key(c.yesterday)] = true;
    }
    settings.shifted[tk] = settings.mode === "interval" ? "interval" : key(c.yesterday);
    saveSettings();
    renderAll();
  }

  function undoShift() {
    var tk = key(today());
    var mark = settings.shifted[tk];
    if (!mark) return;
    if (mark === "interval") {
      settings.anchor = key(addDays(fromKey(settings.anchor), -1));
    } else {
      delete settings.moved[tk];
      delete settings.skipped[mark];
    }
    delete settings.shifted[tk];
    saveSettings();
    renderAll();
  }

  /* ---------- sets ---------- */

  function setsOn(k, moveId) { return (log[k] && log[k][moveId]) || 0; }

  function daySets(k) {
    var o = log[k], n = 0;
    if (!o) return 0;
    for (var m in o) if (Object.prototype.hasOwnProperty.call(o, m)) n += o[m];
    return n;
  }

  function dayTargetSets(date) {
    var s = sessionFor(date);
    return s ? s.moves.length : 0;
  }

  function totalSets() {
    var n = 0;
    for (var k in log) if (Object.prototype.hasOwnProperty.call(log, k)) n += daySets(k);
    return n;
  }

  function addSet(k, moveId, delta) {
    if (!log[k]) log[k] = {};
    var v = (log[k][moveId] || 0) + delta;
    if (v <= 0) delete log[k][moveId]; else log[k][moveId] = v;
    if (!Object.keys(log[k]).length) delete log[k];
    saveLog();
  }

  /* ---------- reveal ---------- */

  function order(id, total) {
    var seed = 0;
    for (var i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
    seed = (seed + total) >>> 0;
    var arr = [];
    for (var j = 0; j < total; j++) arr.push(j);
    for (var k = total - 1; k > 0; k--) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      var m = seed % (k + 1);
      var t = arr[k]; arr[k] = arr[m]; arr[m] = t;
    }
    return arr;
  }

  function urlFor(im) {
    if (!urls[im.id]) urls[im.id] = URL.createObjectURL(im.blob);
    return urls[im.id];
  }

  function gridOf(total) {
    if (total === 36) return 6;
    if (total === 72) return 8;
    return 12;
  }

  var CAN_BLUR = !!(window.CSS && CSS.supports &&
    (CSS.supports("backdrop-filter", "blur(4px)") || CSS.supports("-webkit-backdrop-filter", "blur(4px)")));

  // 未開封の区画だけを覆うマスクを組み立てる。
  // 区画ごとにぼかすと境目に継ぎ目が出るので、ぼかしは1枚の層でかけ、形だけマスクで抜く。
  //
  // 位置と大きさは % ではなくピクセルで出す。% だと区画の境界が小数ピクセルに落ち、
  // 隣り合う矩形がその1ピクセルを半分ずつしか塗らないため、覆いが薄い筋になって残る
  // （縦に長い画像で目立つ）。境界を BLEED 分だけ重ねて塗り残しをなくす。
  var BLEED = 1;

  function frostMask(cols, rows, closed, w, h) {
    var imgs = [], sizes = [], poss = [];
    for (var i = 0; i < closed.length; i++) {
      var t = closed[i];
      var c = t % cols;
      var r = Math.floor(t / cols);
      var x0 = Math.round(c * w / cols) - BLEED;
      var x1 = Math.round((c + 1) * w / cols) + BLEED;
      var y0 = Math.round(r * h / rows) - BLEED;
      var y1 = Math.round((r + 1) * h / rows) + BLEED;
      imgs.push("linear-gradient(#000,#000)");
      sizes.push((x1 - x0) + "px " + (y1 - y0) + "px");
      poss.push(x0 + "px " + y0 + "px");
    }
    return { image: imgs.join(","), size: sizes.join(","), position: poss.join(",") };
  }

  var frostState = null;

  function applyFrost(frost, cols, rows, closed, ratio) {
    if (!frost) return;
    frostState = { cols: cols, rows: rows, closed: closed, ratio: ratio };
    if (!closed.length) { frost.hidden = true; return; }
    frost.hidden = false;

    var box = frost.getBoundingClientRect();
    if (!box.width || !box.height) return; // まだ大きさが決まっていない。読み込み後に呼び直される

    var m = frostMask(cols, rows, closed, box.width, box.height);
    frost.style.webkitMaskImage = m.image;
    frost.style.maskImage = m.image;
    frost.style.webkitMaskSize = m.size;
    frost.style.maskSize = m.size;
    frost.style.webkitMaskPosition = m.position;
    frost.style.maskPosition = m.position;

    // 進むほど残りのぼかしも少しずつ弱める
    var px = Math.round(34 - 10 * ratio);
    frost.style.webkitBackdropFilter = "blur(" + px + "px) saturate(0.85)";
    frost.style.backdropFilter = "blur(" + px + "px) saturate(0.85)";
  }

  // 素材の読み込みや画面の回転で大きさが変わったら、マスクを組み直す
  function refreshFrost() {
    if (!frostState) return;
    applyFrost(document.getElementById("frost"),
      frostState.cols, frostState.rows, frostState.closed, frostState.ratio);
  }

  function watchStageSize(stage) {
    if (!window.ResizeObserver) return;
    if (stage.dataset.watched) return;
    stage.dataset.watched = "1";
    new ResizeObserver(function () { refreshFrost(); }).observe(stage);
  }

  window.addEventListener("resize", refreshFrost);
  window.addEventListener("orientationchange", refreshFrost);

  function setsOf(im) { return Math.max(0, Math.min(settings.sets, im.sets || 0)); }
  function isFull(im) { return setsOf(im) >= settings.sets; }

  // いま表示している素材の位置。開封状況に関係なく前後へ動かせる
  function currentIndex() {
    if (!images.length) return -1;
    for (var i = 0; i < images.length; i++) {
      if (images[i].id === settings.currentId) return i;
    }
    for (var j = 0; j < images.length; j++) {
      if (!isFull(images[j])) return j;
    }
    return 0;
  }

  // 開封状況は素材ごとに持つ。表示中のものだけを見る
  function progress() {
    var total = settings.sets * TILES_PER_SET;
    var i = currentIndex();
    var sets = i < 0 ? Math.max(0, Math.min(settings.sets, settings.sampleSets || 0)) : setsOf(images[i]);
    return { total: total, idx: i, sets: sets, revealed: sets * TILES_PER_SET };
  }

  // 表示対象。登録素材が無いデモではサンプルを返す
  function mediaFor(idx) {
    if (idx >= 0 && images.length) return { id: images[idx].id, rec: images[idx] };
    if (sampleTpl) return { id: "sample", rec: null };
    return null;
  }

  // セットの増減を、いま表示している素材の開封状況に反映する。
  // 表示中が開ききっていれば次の未開封へ、0なら手前の開封済みへ自動で移る。
  function applySetDelta(delta) {
    if (!images.length) {
      settings.sampleSets = Math.max(0, Math.min(settings.sets, (settings.sampleSets || 0) + delta));
      saveSettings();
      return Promise.resolve();
    }
    var i = currentIndex();
    var j;
    if (delta > 0) {
      if (isFull(images[i])) {
        for (j = 0; j < images.length; j++) if (!isFull(images[j])) { i = j; break; }
      }
      if (isFull(images[i])) return Promise.resolve();
      images[i].sets = setsOf(images[i]) + 1;
    } else {
      if (setsOf(images[i]) <= 0) {
        for (j = i - 1; j >= 0; j--) if (setsOf(images[j]) > 0) { i = j; break; }
      }
      if (setsOf(images[i]) <= 0) return Promise.resolve();
      images[i].sets = setsOf(images[i]) - 1;
    }
    settings.currentId = images[i].id;
    saveSettings();
    return tx("readwrite", function (s) { return s.put(images[i]); });
  }

  // 旧版は総セット数から開封状況を計算していた。素材ごとの保持へ一度だけ移す。
  function migrateSets() {
    var needs = false;
    images.forEach(function (im) { if (typeof im.sets !== "number") needs = true; });
    if (!needs) return Promise.resolve();
    var remaining = totalSets();
    var jobs = images.map(function (im) {
      if (typeof im.sets !== "number") {
        im.sets = Math.min(remaining, settings.sets);
        remaining -= im.sets;
      }
      return tx("readwrite", function (s) { return s.put(im); });
    });
    return Promise.all(jobs);
  }

  function mediaHtml(m) {
    if (!m.rec) return sampleTpl.innerHTML;
    if (m.rec.type === "video") {
      return '<video class="art" muted loop playsinline autoplay preload="auto">' +
        '<source src="' + urlFor(m.rec) + '" type="' + (m.rec.mime || "video/mp4") + '"></video>';
    }
    return '<img class="art" src="' + urlFor(m.rec) + '" alt="">';
  }

  function renderMediaNav() {
    var nav = document.getElementById("mediaNav");
    if (images.length < 1) { nav.hidden = true; return; }
    nav.hidden = false;
    var i = currentIndex();
    var im = images[i];
    var st = isFull(im) ? "開封済み" : setsOf(im) > 0 ? "途中" : "未開封";
    document.getElementById("mediaPos").innerHTML =
      "<b>" + (i + 1) + "</b> / " + images.length + "　" + st;
    document.getElementById("prevMedia").disabled = i <= 0;
    document.getElementById("nextMedia").disabled = i >= images.length - 1;
  }

  function renderReveal() {
    var stage = document.getElementById("stage");
    var p = progress();
    var total = p.total, idx = p.idx, revealed = p.revealed;
    var setsShown = p.sets;

    document.getElementById("progN").innerHTML =
      setsShown + '<small>/ ' + settings.sets + " セット</small>";

    renderMediaNav();

    var m = mediaFor(idx);
    if (!m) {
      stage.innerHTML = '<div class="empty">画像がまだありません。<br>右上の設定から追加してください。</div>';
      document.getElementById("progSub").textContent = "1セットで" + TILES_PER_SET + "マス開きます";
      delete stage.dataset.im;
      lastRevealed = -1;
      return;
    }

    var ord = order(m.id, total);
    var posOf = new Array(total);
    for (var q = 0; q < total; q++) posOf[ord[q]] = q;
    var open = {};
    for (var i = 0; i < revealed; i++) open[ord[i]] = true;

    var cols = gridOf(total);
    var rows = total / cols;

    if (stage.dataset.im !== m.id || stage.dataset.total !== String(total)) {
      var t = '<div class="frost" id="frost"></div>' +
        '<div class="tiles" style="grid-template-columns:repeat(' + cols +
        ',1fr);grid-template-rows:repeat(' + rows + ',1fr)">';
      for (var c = 0; c < total; c++) t += '<div class="tile"></div>';
      stage.innerHTML = mediaHtml(m) + t + "</div>";
      stage.classList.toggle("noblur", !CAN_BLUR);
      stage.dataset.im = m.id;
      stage.dataset.total = String(total);
      lastRevealed = -1;
      var v = stage.querySelector("video");
      if (v) {
        v.play().catch(function () {});
        v.addEventListener("loadedmetadata", refreshFrost);
      }
      var im0 = stage.querySelector("img.art");
      if (im0) im0.addEventListener("load", refreshFrost);
      watchStageSize(stage);
    }

    var tiles = stage.querySelector(".tiles");
    var stagger = lastRevealed >= 0 && revealed > lastRevealed;

    // まず演出をすべて解除し、1回だけ再計算させてから付け直す
    for (var j = 0; j < total; j++) {
      tiles.children[j].classList.remove("mist");
      tiles.children[j].style.animationDelay = "";
    }
    void tiles.offsetWidth;

    var closed = [];
    for (var k = 0; k < total; k++) {
      var el = tiles.children[k];
      if (open[k]) {
        if (stagger && posOf[k] >= lastRevealed) {
          el.style.animationDelay = Math.min((posOf[k] - lastRevealed) * 130, 2400) + "ms";
          el.classList.add("mist");
        }
      } else {
        closed.push(k);
      }
    }

    applyFrost(document.getElementById("frost"), cols, rows, closed, total ? revealed / total : 0);
    lastRevealed = revealed;

    var banner = stage.querySelector(".done-banner");
    if (revealed >= total) {
      if (!banner) {
        banner = document.createElement("div");
        banner.className = "done-banner";
        stage.appendChild(banner);
      }
      var left = 0;
      images.forEach(function (im) { if (!isFull(im)) left += 1; });
      banner.textContent = !m.rec || left === 0
        ? "開ききりました。設定から追加できます"
        : "開ききりました。次のセットは未開封の1枚へ";
    } else if (banner) {
      banner.remove();
    }

    var rest = 0;
    images.forEach(function (im) { if (!isFull(im)) rest += 1; });
    document.getElementById("progSub").textContent =
      revealed >= total
        ? (m.rec ? "未開封が " + rest + " 枚" : "開ききりました")
        : "あと " + (settings.sets - setsShown) + " セットで完成";
  }

  /* ---------- session ---------- */

  function activeDate() {
    if (settings.debug && selDate) return fromKey(selDate);
    return today();
  }
  function activeSession(date) {
    if (settings.debug) return selSession ? sessionById(selSession) : (sessionFor(date) || SESSIONS[0]);
    return sessionFor(date);
  }

  function renderSession() {
    var date = activeDate();
    var k = key(date);
    var sess = activeSession(date);
    var tabs = document.getElementById("sessTabs");
    var moves = document.getElementById("moves");

    document.getElementById("sessDate").textContent =
      (date.getMonth() + 1) + "月" + date.getDate() + "日（" + DOW[date.getDay()] + "）";

    if (settings.debug) {
      tabs.hidden = false;
      tabs.innerHTML = SESSIONS.map(function (s) {
        return '<button data-sess="' + s.id + '" class="' + (s.id === sess.id ? "on" : "") + '">' + s.label + "</button>";
      }).join("");
    } else {
      tabs.hidden = true;
    }

    if (!sess) {
      document.getElementById("sessTitle").textContent = "休養日";
      var sh = shiftable();
      var html = '<p class="rest">今日は予定日ではありません。<b>筋肉は休んでいる間に育ちます。</b></p>';
      if (sh) {
        html += '<p class="rest" style="margin-top:10px">' +
          "前日の" + sh.session.label + "が未実施です。今日にずらせます。</p>" +
          '<div class="ctl" style="margin-top:9px">' +
          '<button class="wide plus" id="shiftBtn">今日にずらす</button></div>';
      } else if (!settings.debug) {
        html += '<p class="rest" style="margin-top:10px">' +
          "予定日以外に行った分を記録したい場合は、設定のデバッグモードから入力できます。</p>";
      }
      moves.innerHTML = html;
      var sb = document.getElementById("shiftBtn");
      if (sb) sb.addEventListener("click", doShift);
      return;
    }

    document.getElementById("sessTitle").textContent =
      sess.label + "（" + sess.moves.length + "セット）" +
      (key(date) === key(today()) && shiftedToday() ? " ・繰り上げ" : "");

    moves.innerHTML = sess.moves.map(function (m) {
      var n = setsOn(k, m.id);
      var ctl;
      if (settings.debug) {
        ctl = '<button class="step" data-d="-1"' + (n <= 0 ? " disabled" : "") + ">−1</button>" +
          '<button class="wide plus" data-d="1">セット追加</button>';
      } else if (n > 0) {
        ctl = '<button class="wide undo" data-d="-1">完了 ✓　取り消す</button>';
      } else {
        ctl = '<button class="wide plus" data-d="1">セット完了</button>';
      }
      return '<div class="move" data-move="' + m.id + '">' +
        '<div class="move-top"><div>' +
        '<div class="move-name">' + m.name + "</div>" +
        '<div class="move-note">' + m.note + "</div>" +
        (settings.debug && n > 0 ? '<div class="move-sets">' + n + " セット記録済み</div>" : "") +
        "</div>" +
        '<div class="move-n">' + m.reps + "<small>回</small></div></div>" +
        '<div class="ctl">' + ctl + "</div></div>";
    }).join("");

    if (key(date) === key(today()) && shiftedToday() && daySets(k) === 0) {
      moves.innerHTML += '<p class="rest" style="margin-top:14px">' +
        '<button id="undoShiftBtn" style="color:var(--muted);text-decoration:underline;font-size:0.78rem">' +
        "繰り上げを取り消す</button></p>";
      document.getElementById("undoShiftBtn").addEventListener("click", undoShift);
    }
  }

  /* ---------- calendar ---------- */

  function renderDow() {
    document.getElementById("dowRow").innerHTML = DOW.map(function (d, i) {
      return '<div class="dow' + (i === 0 ? " sun" : i === 6 ? " sat" : "") + '">' + d + "</div>";
    }).join("");
  }

  function renderCalendar() {
    var first = new Date(viewYear, viewMonth, 1);
    var last = new Date(viewYear, viewMonth + 1, 0);
    var tdyKey = key(today());

    document.getElementById("calTitle").textContent = viewYear + "年 " + (viewMonth + 1) + "月";

    var cells = [];
    for (var p = 0; p < first.getDay(); p++) cells.push('<button class="day pad" disabled></button>');

    for (var d = 1; d <= last.getDate(); d++) {
      var date = new Date(viewYear, viewMonth, d);
      var k = key(date);
      var planned = !!sessionFor(date);
      var got = daySets(k);
      var tgt = dayTargetSets(date) || 1;
      var cls = "day in";
      if (planned) cls += " planned";
      if (got > 0 && got < tgt) cls += " part";
      if (got >= tgt && got > 0) cls += " full";
      if (k === tdyKey) cls += " today";
      if (settings.debug && k === selDate) cls += " sel";
      cells.push(
        '<button class="' + cls + '" data-k="' + k + '"' + (settings.debug ? "" : " disabled") + ">" +
        d + (planned || got > 0 ? '<i class="dot"></i>' : "") + "</button>"
      );
    }
    document.getElementById("calGrid").innerHTML = cells.join("");
  }

  /* ---------- settings ---------- */

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function renderImageList() {
    var list = document.getElementById("imgList");
    if (!images.length) {
      list.innerHTML = '<p class="note" style="margin:0">' +
        (DEMO ? "未登録です。いまはサンプル素材を表示しています。" : "まだ登録されていません。") + "</p>";
      return;
    }
    var idx = currentIndex();
    list.innerHTML = images.map(function (im, i) {
      var n = setsOf(im);
      var st = (isFull(im) ? "開封済み" : n > 0 ? "途中 " + n + " / " + settings.sets : "未開封") +
        (i === idx ? "・表示中" : "");
      return '<div class="imgrow' + (i === idx ? " active" : "") + '">' +
        (im.type === "video"
          ? '<div class="thumb" style="filter:none;display:grid;place-items:center;font-size:0.62rem;color:var(--muted)">動画</div>'
          : '<img class="thumb" src="' + urlFor(im) + '" alt="">') +
        '<div class="meta"><b>' + escapeHtml(im.name) + "</b><span>" + st + "</span></div>" +
        '<button class="act" data-use="' + im.id + '">表示</button>' +
        '<button class="act del" data-del="' + im.id + '">削除</button></div>';
    }).join("");
  }

  function renderSettings() {
    var dbgField = document.getElementById("debugField");
    if (DEMO) {
      dbgField.hidden = true;
    } else {
      document.getElementById("debugSwitch").classList.toggle("on", settings.debug);
    }

    var weekly = settings.mode === "weekly";

    document.getElementById("modeSeg").innerHTML =
      '<button data-mode="weekly" class="' + (weekly ? "on" : "") + '">曜日で決める</button>' +
      '<button data-mode="interval" class="' + (weekly ? "" : "on") + '">日数で決める</button>';

    document.getElementById("weeklyBox").hidden = !weekly;
    document.getElementById("intervalBox").hidden = weekly;

    document.getElementById("dowPicker").innerHTML = DOW.map(function (d, i) {
      return '<button data-dow="' + i + '" class="' + (settings.days.indexOf(i) >= 0 ? "on" : "") + '">' + d + "</button>";
    }).join("");

    document.getElementById("intervalSeg").innerHTML = INTERVAL_CHOICES.map(function (n) {
      return '<button data-interval="' + n + '" class="' + (settings.interval === n ? "on" : "") + '">' +
        INTERVAL_LABEL[n] + "</button>";
    }).join("");

    var a = fromKey(settings.anchor);
    document.getElementById("anchorNote").textContent =
      "曜日に関係なく " + INTERVAL_LABEL[settings.interval] + " のペースで、胸 → 脚 → 背中 を順に回します。" +
      "起点は " + (a.getMonth() + 1) + "月" + a.getDate() + "日です。繰り上げるたびに起点がずれます。";

    document.getElementById("setSeg").innerHTML = SET_CHOICES.map(function (n) {
      return '<button data-sets="' + n + '" class="' + (settings.sets === n ? "on" : "") + '">' + n + "</button>";
    }).join("");

    var perSession = 3;
    var sessions = Math.ceil(settings.sets / perSession);
    document.getElementById("setNote").textContent =
      "1セットで " + TILES_PER_SET + " マス、合計 " + (settings.sets * TILES_PER_SET) +
      " マス。1回のトレーニングで " + perSession + " セットなので、約 " + sessions + " 回" +
      (weekly ? "" : "（約 " + sessions * settings.interval + " 日）") + "で1枚が完成します。";

    renderImageList();
  }

  function renderAll() {
    var flag = document.getElementById("debugFlag");
    flag.hidden = !(DEMO || settings.debug);
    flag.textContent = DEMO ? "DEMO" : "DEBUG";
    renderReveal();
    renderSession();
    renderCalendar();
  }

  /* ---------- events ---------- */

  document.getElementById("moves").addEventListener("click", function (e) {
    var b = e.target.closest("[data-d]");
    if (!b || b.disabled) return;
    var wrap = b.closest("[data-move]");
    if (!wrap) return;

    var date = activeDate();
    var k = key(date);
    if (!activeSession(date)) return;

    var moveId = wrap.dataset.move;
    var d = Number(b.dataset.d);
    if (d > 0 && !settings.debug && setsOn(k, moveId) >= 1) return;
    addSet(k, moveId, d);
    applySetDelta(d).then(renderAll, renderAll);
  });

  document.getElementById("prevMedia").addEventListener("click", function () {
    var i = currentIndex();
    if (i <= 0) return;
    settings.currentId = images[i - 1].id;
    saveSettings();
    renderAll();
    renderImageList();
  });

  document.getElementById("nextMedia").addEventListener("click", function () {
    var i = currentIndex();
    if (i < 0 || i >= images.length - 1) return;
    settings.currentId = images[i + 1].id;
    saveSettings();
    renderAll();
    renderImageList();
  });

  document.getElementById("sessTabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-sess]");
    if (!b) return;
    selSession = b.dataset.sess;
    renderSession();
  });

  document.getElementById("calGrid").addEventListener("click", function (e) {
    var b = e.target.closest(".day");
    if (!b || b.disabled || !b.dataset.k) return;
    selDate = b.dataset.k;
    var s = sessionFor(fromKey(selDate));
    if (s) selSession = s.id;
    renderAll();
  });

  document.getElementById("prevMonth").addEventListener("click", function () {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    renderCalendar();
  });
  document.getElementById("nextMonth").addEventListener("click", function () {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    renderCalendar();
  });
  document.getElementById("thisMonth").addEventListener("click", function () {
    var t = today();
    viewYear = t.getFullYear(); viewMonth = t.getMonth();
    renderCalendar();
  });

  var sheetBg = document.getElementById("sheetBg");
  document.getElementById("openSettings").addEventListener("click", function () {
    renderSettings();
    sheetBg.classList.add("open");
  });
  document.getElementById("closeSheet").addEventListener("click", function () {
    sheetBg.classList.remove("open");
  });
  sheetBg.addEventListener("click", function (e) {
    if (e.target === sheetBg) sheetBg.classList.remove("open");
  });

  if (!DEMO) {
    document.getElementById("debugSwitch").addEventListener("click", function () {
      settings.debug = !settings.debug;
      if (!settings.debug) { selDate = null; selSession = null; }
      saveSettings();
      renderSettings();
      renderAll();
    });
  }

  document.getElementById("modeSeg").addEventListener("click", function (e) {
    var b = e.target.closest("[data-mode]");
    if (!b) return;
    settings.mode = b.dataset.mode;
    if (settings.mode === "interval") settings.anchor = key(today());
    saveSettings();
    renderSettings();
    renderAll();
  });

  document.getElementById("intervalSeg").addEventListener("click", function (e) {
    var b = e.target.closest("[data-interval]");
    if (!b) return;
    settings.interval = Number(b.dataset.interval);
    saveSettings();
    renderSettings();
    renderAll();
  });

  document.getElementById("dowPicker").addEventListener("click", function (e) {
    var b = e.target.closest("[data-dow]");
    if (!b) return;
    var n = Number(b.dataset.dow);
    var i = settings.days.indexOf(n);
    if (i >= 0) { if (settings.days.length > 1) settings.days.splice(i, 1); }
    else settings.days.push(n);
    saveSettings();
    renderSettings();
    renderAll();
  });

  document.getElementById("setSeg").addEventListener("click", function (e) {
    var b = e.target.closest("[data-sets]");
    if (!b) return;
    settings.sets = Number(b.dataset.sets);
    saveSettings();
    renderSettings();
    renderAll();
  });

  document.getElementById("addImage").addEventListener("click", function () {
    document.getElementById("fileInput").click();
  });

  document.getElementById("fileInput").addEventListener("change", function (e) {
    // File の参照を先に配列へ写してから入力欄を空にする。
    // 順番を逆にすると value を空にした時点で選択が消え、何も保存されない。
    var list = e.target.files ? Array.prototype.slice.call(e.target.files) : [];
    e.target.value = "";
    if (!list.length) return;

    (dbReady || Promise.resolve()).then(function () {
      if (!db) {
        alert("この環境では保存できません。プライベートブラウズを解除して開いてください。");
        return;
      }
      var jobs = list.map(function (f) {
        var rec = {
          id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8),
          name: f.name || "ファイル",
          blob: f,
          mime: f.type || "",
          type: (f.type || "").indexOf("video") === 0 ? "video" : "image",
          sets: 0,
          added: Date.now()
        };
        return tx("readwrite", function (s) { return s.put(rec); }).then(function () { return rec; });
      });
      return Promise.all(jobs).then(function (recs) {
        images = images.concat(recs);
        delete document.getElementById("stage").dataset.im;
        renderImageList();
        renderAll();
      });
    }).catch(function () {
      alert("保存に失敗しました。空き容量を確認してください。");
    });
  });

  document.getElementById("imgList").addEventListener("click", function (e) {
    var use = e.target.closest("[data-use]");
    if (use) {
      settings.currentId = use.dataset.use;
      saveSettings();
      renderImageList();
      renderAll();
      return;
    }
    var del = e.target.closest("[data-del]");
    if (!del) return;
    var id = del.dataset.del;
    if (!confirm("削除しますか。")) return;
    tx("readwrite", function (s) { return s.delete(id); }).then(function () {
      images = images.filter(function (im) { return im.id !== id; });
      if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; }
      if (settings.currentId === id) {
        settings.currentId = images.length ? images[0].id : null;
        saveSettings();
      }
      delete document.getElementById("stage").dataset.im;
      renderImageList();
      renderAll();
    });
  });

  /* ---------- boot ---------- */

  var t0 = today();
  viewYear = t0.getFullYear();
  viewMonth = t0.getMonth();
  selDate = key(t0);

  renderDow();
  renderAll();

  dbReady = openDB().then(function (d) {
    db = d;
    return tx("readonly", function (s) { return s.getAll(); });
  }).then(function (recs) {
    images = (recs || []).sort(function (a, b) { return a.added - b.added; });
    return migrateSets();
  }).then(function () {
    delete document.getElementById("stage").dataset.im;
    renderReveal();
  }).catch(function () {
    document.getElementById("stage").innerHTML =
      '<div class="empty">この環境では保存できません。<br>プライベートブラウズを解除して開いてください。</div>';
  });
})();
