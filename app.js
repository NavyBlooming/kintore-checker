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
          '<label>トレーニングする曜日</label>' +
          '<div class="dow-picker" id="dowPicker"></div>' +
          '<p class="note" style="margin-top:8px">選んだ曜日に、胸 → 脚 → 背中 の順でメニューが割り当てられます。</p>' +
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
    var d = { days: [1, 3, 5], sets: 6, debug: false };
    try {
      var s = JSON.parse(localStorage.getItem(LS_SETTINGS) || "{}");
      if (Array.isArray(s.days) && s.days.length) d.days = s.days;
      if (SET_CHOICES.indexOf(s.sets) >= 0) d.sets = s.sets;
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

  function sessionFor(date) {
    var days = plannedDays();
    var i = days.indexOf(date.getDay());
    if (i < 0) return null;
    return SESSIONS[i % SESSIONS.length];
  }
  function sessionById(id) {
    for (var i = 0; i < SESSIONS.length; i++) if (SESSIONS[i].id === id) return SESSIONS[i];
    return SESSIONS[0];
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

  // 1枚を開ききった直後は、次の1枚へ進まずに完成した絵を出したままにする
  function progress() {
    var total = settings.sets * TILES_PER_SET;
    var done = totalSets();
    var all = done * TILES_PER_SET;
    var idx = Math.floor(all / total);
    var revealed = all - idx * total;
    if (revealed === 0 && idx > 0) { idx -= 1; revealed = total; }
    return { total: total, idx: idx, revealed: revealed };
  }

  // 表示対象。登録画像が無いデモではサンプル素材を返す
  function mediaFor(idx) {
    if (images.length) {
      return { id: images[Math.min(idx, images.length - 1)].id, rec: images[Math.min(idx, images.length - 1)] };
    }
    if (sampleTpl) return { id: "sample", rec: null };
    return null;
  }

  function mediaHtml(m) {
    if (!m.rec) return sampleTpl.innerHTML;
    if (m.rec.type === "video") {
      return '<video class="art" muted loop playsinline autoplay preload="auto">' +
        '<source src="' + urlFor(m.rec) + '" type="' + (m.rec.mime || "video/mp4") + '"></video>';
    }
    return '<img class="art" src="' + urlFor(m.rec) + '" alt="">';
  }

  function renderReveal() {
    var stage = document.getElementById("stage");
    var p = progress();
    var total = p.total, idx = p.idx, revealed = p.revealed;
    var setsShown = Math.round(revealed / TILES_PER_SET);

    document.getElementById("progN").innerHTML =
      setsShown + '<small>/ ' + settings.sets + " セット</small>";

    var m = mediaFor(idx);
    if (!m) {
      stage.innerHTML = '<div class="empty">画像がまだありません。<br>右上の設定から追加してください。</div>';
      document.getElementById("progSub").textContent = "1セットで" + TILES_PER_SET + "マス開きます";
      delete stage.dataset.im;
      lastRevealed = -1;
      return;
    }

    var overflow = images.length > 0 && idx >= images.length;
    if (overflow) revealed = total;

    var ord = order(m.id, total);
    var posOf = new Array(total);
    for (var q = 0; q < total; q++) posOf[ord[q]] = q;
    var open = {};
    for (var i = 0; i < revealed; i++) open[ord[i]] = true;

    if (stage.dataset.im !== m.id || stage.dataset.total !== String(total)) {
      var cols = gridOf(total);
      var t = '<div class="tiles" style="grid-template-columns:repeat(' + cols +
        ',1fr);grid-template-rows:repeat(' + (total / cols) + ',1fr)">';
      for (var c = 0; c < total; c++) t += '<div class="tile"></div>';
      stage.innerHTML = mediaHtml(m) + t + "</div>";
      stage.dataset.im = m.id;
      stage.dataset.total = String(total);
      lastRevealed = -1;
      var v = stage.querySelector("video");
      if (v) v.play().catch(function () {});
    }

    var tiles = stage.querySelector(".tiles");
    var stagger = lastRevealed >= 0 && revealed > lastRevealed;
    for (var j = 0; j < total; j++) {
      var el = tiles.children[j];
      if (stagger && !el.classList.contains("open") && open[j]) {
        el.style.transitionDelay = Math.min((posOf[j] - lastRevealed) * 90, 1600) + "ms";
      } else {
        el.style.transitionDelay = "0ms";
      }
      el.classList.toggle("open", !!open[j]);
    }
    lastRevealed = revealed;

    var banner = stage.querySelector(".done-banner");
    if (revealed >= total) {
      if (!banner) {
        banner = document.createElement("div");
        banner.className = "done-banner";
        stage.appendChild(banner);
      }
      banner.textContent = !m.rec || idx >= images.length - 1
        ? "全部開ききりました。設定から追加できます"
        : "完成しました。次のセットから次の1枚へ";
    } else if (banner) {
      banner.remove();
    }

    document.getElementById("progSub").textContent =
      revealed >= total
        ? (m.rec ? Math.max(0, images.length - idx - 1) + " 枚が未開封" : "開ききりました")
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
      moves.innerHTML = '<p class="rest">今日は予定日ではありません。<b>筋肉は休んでいる間に育ちます。</b><br>' +
        "予定日以外に行った分を記録したい場合は、設定のデバッグモードから入力できます。</p>";
      return;
    }

    document.getElementById("sessTitle").textContent = sess.label + "（" + sess.moves.length + "セット）";

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
    var idx = progress().idx;
    list.innerHTML = images.map(function (im, i) {
      var st = i < idx ? "開封済み" : i === idx ? "表示中" : "未開封";
      return '<div class="imgrow' + (i === idx ? " active" : "") + '">' +
        (im.type === "video"
          ? '<div class="thumb" style="filter:none;display:grid;place-items:center;font-size:0.62rem;color:var(--muted)">動画</div>'
          : '<img class="thumb" src="' + urlFor(im) + '" alt="">') +
        '<div class="meta"><b>' + escapeHtml(im.name) + "</b><span>" + st + "</span></div>" +
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

    document.getElementById("dowPicker").innerHTML = DOW.map(function (d, i) {
      return '<button data-dow="' + i + '" class="' + (settings.days.indexOf(i) >= 0 ? "on" : "") + '">' + d + "</button>";
    }).join("");

    document.getElementById("setSeg").innerHTML = SET_CHOICES.map(function (n) {
      return '<button data-sets="' + n + '" class="' + (settings.sets === n ? "on" : "") + '">' + n + "</button>";
    }).join("");

    var perSession = 3;
    document.getElementById("setNote").textContent =
      "1セットで " + TILES_PER_SET + " マス、合計 " + (settings.sets * TILES_PER_SET) +
      " マス。1回のトレーニングで " + perSession + " セットなので、約 " +
      Math.ceil(settings.sets / perSession) + " 回で1枚が完成します。";

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
    renderAll();
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
    var del = e.target.closest("[data-del]");
    if (!del) return;
    var id = del.dataset.del;
    if (!confirm("削除しますか。")) return;
    tx("readwrite", function (s) { return s.delete(id); }).then(function () {
      images = images.filter(function (im) { return im.id !== id; });
      if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; }
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
    delete document.getElementById("stage").dataset.im;
    renderReveal();
  }).catch(function () {
    document.getElementById("stage").innerHTML =
      '<div class="empty">この環境では保存できません。<br>プライベートブラウズを解除して開いてください。</div>';
  });
})();
