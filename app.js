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
  var LS_PASS = "wt.pass.v1" + SUFFIX;
  var DB_NAME = DEMO ? "workout-tracker-demo" : "workout-tracker";

  // やり方の動画。ザ・きんにくTV の解説動画が種目に対応するものは直接、
  // 対応する回が確かめられないものは、チャンネル名を添えた検索に飛ばす。
  // 検索なら動画が入れ替わっても行き先が切れない。
  function howTo(q) {
    return "https://www.youtube.com/results?search_query=" +
      encodeURIComponent("なかやまきんに君 " + q + " やり方");
  }
  var YT = "https://www.youtube.com/watch?v=";

  var ABS = {
    id: "abs", name: "ニートゥチェスト", reps: 10, note: "腹。どの回でも最後に",
    how: YT + "OPeDVbIDcgg"
  };

  var SESSIONS = [
    {
      id: "chest", label: "胸の日",
      moves: [
        { id: "pushup", name: "腕立て伏せ", reps: 10, note: "きつければ膝をついて",
          how: YT + "k4fsFKCp5iU" },
        { id: "kickback", name: "キックバック", reps: 20, note: "左右10回ずつ。ペットボトルを持つ",
          how: howTo("キックバック 二の腕") },
        ABS
      ]
    },
    {
      id: "legs", label: "脚の日",
      moves: [
        { id: "squat", name: "スクワット", reps: 10, note: "椅子に座って立つ動作から",
          how: YT + "SFnfYPktYBU" },
        { id: "calf", name: "カーフレイズ", reps: 15, note: "かかとの上げ下げ",
          how: howTo("カーフレイズ ふくらはぎ") },
        ABS
      ]
    },
    {
      id: "back", label: "背中の日",
      moves: [
        { id: "row", name: "ベントオーバーローイング", reps: 20, note: "左右10回ずつ。ペットボトルを持つ",
          how: howTo("ベントオーバーローイング 背中") },
        { id: "backext", name: "バックエクステンション", reps: 10, note: "うつ伏せから上体を反らす",
          how: howTo("バックエクステンション 背中") },
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
        '<div class="prog-sub" id="progSub">1セットで6マス削れます</div>' +
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
          '<label>シーズン</label>' +
          '<div id="seasonNow"></div>' +
          '<button class="btn primary" id="startSeason" style="margin-top:9px">新しいシーズンを開始</button>' +
          '<p class="note">押した日から新しいシーズンが始まります。' +
          '画像・動画はシーズンごとに分かれ、前のシーズンの分は下に残ります。</p>' +
          '<div class="seasonlist" id="seasonList"></div>' +
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
        '<div class="field">' +
          '<label>伏せたまま取り込む</label>' +
          '<div class="pass"><input type="text" id="passInput" ' +
          'autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="合言葉">' +
          '<button class="act" id="passSave">保存</button></div>' +
          '<div class="note" id="passState" style="margin-top:7px"></div>' +
          '<button class="btn" id="addSealed" style="margin-top:9px">.kcz を取り込む</button>' +
          '<input type="file" id="sealedInput" multiple>' +
          '<p class="note">PCで伏せておいたファイルを、中身を出さずに取り込みます。' +
          '取り込むまで何が入っているかは分かりません。</p>' +
        '</div>' +
        '<button class="btn quiet" id="closeSheet">閉じる</button>' +
      '</div>' +
    '</div>' +

    '<div class="viewer" id="viewer">' +
      '<div class="viewer-in" id="viewerIn"></div>' +
      '<button class="btn quiet" id="closeViewer">閉じる</button>' +
    '</div>';

  document.getElementById("app").innerHTML = SHELL;

  var settings = loadSettings();
  var log = loadLog();
  migrateSeasons();
  var allImages = [];
  var images = [];
  var urls = {};
  var db = null;
  var dbReady = null;
  var lastTiles = -1;
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
      debug: false,
      seasons: []
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
      if (Array.isArray(s.seasons) && s.seasons.length) d.seasons = s.seasons;
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
  // 伏せたファイルを開くための合言葉。素材そのものは復号してから保存するので、
  // 忘れても取り込み済みのものは読める。困るのは次の取り込みだけ。
  function loadPass() {
    try { return localStorage.getItem(LS_PASS) || ""; } catch (e) { return ""; }
  }
  function savePass(v) {
    try {
      if (v) localStorage.setItem(LS_PASS, v);
      else localStorage.removeItem(LS_PASS);
    } catch (e) {}
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

  /* ---------- 伏せたファイルを開く ----------
   *
   * PC 側の kcz.py が書き出した形式。
   *   "KCZ2" | 塩16 | かたまりの大きさ4 | ( iv12 | 長さ4 | 暗号文 ) のくりかえし
   * 最初のかたまりの中身が MIME で、2つ目から本体。MIME を暗号の内側に置くので、
   * 開くまでは画像か動画かも分からない。
   *
   * かたまりごとに読んで復号し、そのつど Blob へ移す。
   * まるごと読むと素材の大きさぶんメモリを抱えるので、端末によっては落ちる。
   */

  var KCZ_MAGIC = [75, 67, 90, 50];
  var KCZ_ITER = 300000;
  var keyCache = {};          // 塩ごとの鍵。1回の取り込みでは塩が共通なので効く

  function hex(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += ("0" + bytes[i].toString(16)).slice(-2);
    return s;
  }

  function deriveKey(pass, salt) {
    var k = pass + "|" + hex(salt);   // 合言葉を変えたら作り直す
    if (keyCache[k]) return keyCache[k];
    keyCache[k] = crypto.subtle
      .importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: salt, iterations: KCZ_ITER, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      });
    return keyCache[k];
  }

  function isSealed(file) {
    return /\.kcz$/i.test(file.name || "");
  }

  function openSealed(file, pass) {
    if (!window.crypto || !crypto.subtle) {
      return Promise.reject(new Error("この環境では開けません（HTTPS で開いてください）"));
    }
    return file.slice(0, 24).arrayBuffer().then(function (buf) {
      var head = new Uint8Array(buf);
      if (head.length < 24) throw new Error("ファイルが壊れています");
      for (var i = 0; i < 4; i++) {
        if (head[i] !== KCZ_MAGIC[i]) throw new Error("この形式のファイルではありません");
      }
      return deriveKey(pass, head.slice(4, 20));
    }).then(function (key) {
      var pos = 24, parts = [], mime = null;

      function step() {
        if (pos >= file.size) {
          if (mime === null) throw new Error("ファイルが壊れています");
          return new Blob(parts, { type: mime });
        }
        var at = pos;
        return file.slice(at, at + 16).arrayBuffer().then(function (hb) {
          var h = new Uint8Array(hb);
          if (h.length < 16) throw new Error("ファイルが壊れています");
          var iv = h.slice(0, 12);
          var len = new DataView(h.buffer, h.byteOffset + 12, 4).getUint32(0, false);
          pos = at + 16 + len;
          return file.slice(at + 16, at + 16 + len).arrayBuffer().then(function (cb) {
            return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, cb);
          });
        }).then(function (pb) {
          var plain = new Uint8Array(pb);
          if (mime === null) {
            mime = new TextDecoder().decode(plain.slice(1, 1 + plain[0]));
          } else {
            parts.push(new Blob([plain]));   // JS のメモリから逃がす
          }
          return step();
        }, function (e) {
          // 鍵が違えば復号そのものが失敗する。壊れたまま入ることはない
          if (e && e.name === "OperationError") throw new Error("合言葉が違うようです");
          throw e;
        });
      }
      return step();
    });
  }

  /* ---------- dates ---------- */

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function key(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function today() { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
  function fromKey(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }

  /* ---------- seasons ---------- */

  // 記録は日付で持っているので、シーズンは期間として重ねる。
  // 最後の要素が実施中で、end は締めたときに入る。
  function migrateSeasons() {
    if (settings.seasons.length) return;
    var ks = Object.keys(log).sort();
    settings.seasons = [{
      n: 1,
      start: ks.length ? ks[0] : key(today()),
      end: null,
      sets: settings.sets
    }];
    saveSettings();
  }

  function curSeason() { return settings.seasons[settings.seasons.length - 1]; }

  function seasonSets(s) {
    var to = s.end || key(today());
    var n = 0;
    for (var k in log) {
      if (!Object.prototype.hasOwnProperty.call(log, k)) continue;
      if (k >= s.start && k <= to) n += daySets(k);
    }
    return n;
  }

  function seasonTerm(s) {
    var a = fromKey(s.start);
    var t = (a.getMonth() + 1) + "/" + a.getDate();
    if (!s.end) return t + " 〜";
    var b = fromKey(s.end);
    return t + " 〜 " + (b.getMonth() + 1) + "/" + b.getDate();
  }

  function imagesOfSeason(n) {
    return allImages.filter(function (im) { return (im.season || 1) === n; });
  }

  function fullImagesOfSeason(s) {
    var lim = s.sets || settings.sets;
    return imagesOfSeason(s.n).filter(function (im) { return (im.sets || 0) >= lim; });
  }

  function syncImages() { images = imagesOfSeason(curSeason().n); }

  function startSeason() {
    var cur = curSeason();
    var tk = key(today());
    if (cur.start === tk) {
      alert("シーズン" + cur.n + "は今日始まったばかりです。");
      return;
    }
    var msg = "今日からシーズン" + (cur.n + 1) + "を始めます。\n\n" +
      "いまの画像・動画はシーズン" + cur.n + "の記録として残り、" +
      "新しいシーズンの画像はあらためて追加します。";
    // シーズンは日付で区切るので、今日の分は新しい側に入る
    if (daySets(tk) > 0) msg += "\n\n今日すでに記録した分は、シーズン" + (cur.n + 1) + "の記録になります。";
    if (!confirm(msg)) return;

    cur.end = key(addDays(today(), -1));
    cur.sets = settings.sets;
    settings.seasons.push({ n: cur.n + 1, start: tk, end: null, sets: settings.sets });
    settings.anchor = tk;       // 隔日の起点を開始日にそろえる
    settings.currentId = null;
    settings.sampleSets = 0;
    saveSettings();

    syncImages();
    lastTiles = -1;
    delete document.getElementById("stage").dataset.im;
    renderSettings();
    renderAll();
  }

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
    if (k < curSeason().start) return null;   // シーズンが始まる前は予定日にしない
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
    var i = currentIndex();
    var sets = i < 0 ? Math.max(0, Math.min(settings.sets, settings.sampleSets || 0)) : setsOf(images[i]);
    return {
      idx: i, sets: sets,
      tiles: sets * TILES_PER_SET,
      total: settings.sets * TILES_PER_SET
    };
  }

  // Blob から一時URLを作る。同じ素材では使い回す
  function urlFor(im) {
    if (!urls[im.id]) urls[im.id] = URL.createObjectURL(im.blob);
    return urls[im.id];
  }

  function artHtml(m) {
    if (!m.rec) return sampleTpl.innerHTML;
    if (m.rec.type === "video") {
      return '<video class="art" muted loop playsinline autoplay preload="auto">' +
        '<source src="' + urlFor(m.rec) + '" type="' + (m.rec.mime || "video/mp4") + '"></video>';
    }
    return '<img class="art" src="' + urlFor(m.rec) + '" alt="">';
  }

  // 素材を2枚重ねる。下はぼかした層で、上の鮮明な層を開いたマスぶんだけ見せる。
  // 下の層は動画ならそのまま動くので、モヤも一緒に動く。
  function mediaHtml(m) {
    return '<div class="haze">' + artHtml(m) + "</div>" +
      '<div class="tint"></div>' +
      '<div class="sharp">' + artHtml(m) + "</div>";
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
    allImages.forEach(function (im) { if (typeof im.sets !== "number") needs = true; });
    if (!needs) return Promise.resolve();
    var remaining = totalSets();
    var jobs = allImages.map(function (im) {
      if (typeof im.sets !== "number") {
        im.sets = Math.min(remaining, settings.sets);
        remaining -= im.sets;
      }
      return tx("readwrite", function (s) { return s.put(im); });
    });
    return Promise.all(jobs);
  }

  // シーズンを持たない素材は、最初のシーズンのものとして扱う。
  function migrateImageSeason() {
    var jobs = [];
    allImages.forEach(function (im) {
      if (typeof im.season === "number") return;
      im.season = 1;
      jobs.push(tx("readwrite", function (s) { return s.put(im); }));
    });
    return Promise.all(jobs);
  }

  /* ---------- 覆いと、なぞって削る演出 ----------
   *
   * 覆いはぼかした素材そのもの。上に鮮明な素材を重ね、開いた区画ぶんだけ
   * CSS のマスクで見せる。隙間が出ても見えるのはぼかした側なので、
   * 開けすぎになることがない。素材が動画なら、モヤも一緒に動く。
   * ピンクの光は別のキャンバスに描く。
   */

  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var TILE_MS = 330;   // 1区画を削りきるまで。順に1区画ずつ進む
  var PINK = "255,92,166";

  var scratchRAF = 0;
  var syncTimer = 0;

  // ぼかしはステージの大きさに合わせる。固定値だと、大きい画面で効きが弱い。
  // ぼかすと縁が薄くなるので、その幅ぶん引き伸ばして縁を画面の外へ出す。
  function hazeStyle(stage) {
    var w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    var el = stage.querySelector(".haze");
    if (!el) return;
    var r = Math.max(12, Math.round(Math.max(w, h) / 22));
    var pad = r * 2;
    var s = Math.max((w + pad * 2) / w, (h + pad * 2) / h);
    el.style.filter = "blur(" + r + "px) saturate(0.85)";
    el.style.transform = "scale(" + s.toFixed(3) + ")";
  }

  // 同じ動画を2本再生するので時刻が少しずつずれる。たまに合わせておく。
  function syncHaze(stage) {
    if (syncTimer) { clearInterval(syncTimer); syncTimer = 0; }
    var a = stage.querySelector(".haze video");
    var b = stage.querySelector(".sharp video");
    if (!a || !b) return;
    syncTimer = setInterval(function () {
      if (!document.body.contains(b) || b.paused || !b.duration) return;
      if (Math.abs(a.currentTime - b.currentTime) > 0.25) a.currentTime = b.currentTime;
    }, 2000);
  }


  // 区画の並び。素材ごとに固定なので、開き直しても同じ順で開く
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

  // 区画がなるべく正方形に近くなる割り方を選ぶ。
  // 縦長の素材で 6x6 に固定すると、マスが短冊のように縦長になってしまう。
  function gridOf(total, w, h) {
    if (!w || !h) return total === 36 ? 6 : total === 72 ? 8 : 12;
    var best = 1, score = Infinity;
    for (var c = 1; c <= total; c++) {
      if (total % c) continue;
      var r = total / c;
      var d = Math.abs(Math.log((w / c) / (h / r)));
      if (d < score) { score = d; best = c; }
    }
    return best;
  }

  // 区画の矩形。c0〜c1 をまとめて1つにできる
  function spanRect(c0, c1, r, cols, rows, w, h, k) {
    var x0 = Math.round(c0 * w / cols), x1 = Math.round((c1 + 1) * w / cols);
    var y0 = Math.round(r * h / rows), y1 = Math.round((r + 1) * h / rows);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, k: k };
  }

  function tileRect(i, cols, rows, w, h) {
    return spanRect(i % cols, i % cols, Math.floor(i / cols), cols, rows, w, h, -1);
  }

  function stageCanvas(stage, cls) {
    var cv = stage.querySelector("canvas." + cls);
    if (!cv) {
      cv = document.createElement("canvas");
      cv.className = cls;
      stage.appendChild(cv);
    }
    var w = stage.clientWidth, h = stage.clientHeight;
    var bw = Math.round(w * DPR), bh = Math.round(h * DPR);
    // 幅だけを見ていると、動画のように後から高さが決まる素材で作り直されず、
    // 古い高さの絵が縦に引き伸ばされる
    if (cv.width !== bw || cv.height !== bh) {
      cv.width = bw;
      cv.height = bh;
    }
    return cv;
  }

  // 削っている途中の区画の、筆先がどこにいるか。
  // 光は削っている当の区画の中を通る。外へはみ出すと、どこを削っているか分からなくなる。
  function brushAt(t, k) {
    // 端で止めると光が隣のマスへ半分はみ出すので、少し内側を通す。
    // 削る線は筆が太く端が丸いので、内側を通してもマスは端まで削れる。
    var inset = Math.min(t.w * 0.26, t.h * 0.30);
    var kk = Math.max(0, Math.min(1, k));
    return {
      x: t.x + inset + (t.w - inset * 2) * kk,
      y: t.y + t.h / 2 + Math.sin(kk * 6.2) * t.h * 0.16
    };
  }

  // 開いた区画を、行ごとにひとつづきの帯へまとめる。
  // 区画数が多い設定でも、マスクの層数が増えすぎない。
  function openRects(revealed, partial, ord, cols, rows, w, h) {
    var open = {}, i;
    for (i = 0; i < revealed; i++) open[ord[i]] = 1;
    var cur = partial ? ord[partial.index] : -1;
    var out = [];
    for (var r = 0; r < rows; r++) {
      var run = -1;
      for (var c = 0; c <= cols; c++) {
        var idx = r * cols + c;
        if (c < cols && open[idx]) { if (run < 0) run = c; continue; }
        if (run >= 0) { out.push(spanRect(run, c - 1, r, cols, rows, w, h, -1)); run = -1; }
        if (c < cols && idx === cur) out.push(spanRect(c, c, r, cols, rows, w, h, partial.k));
      }
    }
    return out;
  }

  // 鮮明な層を、渡した矩形のぶんだけ見せる。
  // k が 0以上の矩形は削っている最中で、左から右へ境目をぼかしながら開く。
  function setMask(el, rects) {
    if (!rects) {
      el.style.webkitMaskImage = el.style.maskImage = "none";
      return;
    }
    var img = [], pos = [], size = [];
    for (var i = 0; i < rects.length; i++) {
      var t = rects[i];
      if (t.k < 0) {
        img.push("linear-gradient(rgba(0,0,0,1),rgba(0,0,0,1))");
      } else {
        var edge = Math.round(t.w * Math.max(0, Math.min(1, t.k)));
        var soft = Math.max(6, Math.round(Math.min(18, t.w * 0.35)));
        img.push("linear-gradient(to right, rgba(0,0,0,1) " + edge + "px, rgba(0,0,0,0) " +
          (edge + soft) + "px)");
      }
      pos.push(t.x + "px " + t.y + "px");
      size.push(t.w + "px " + t.h + "px");
    }
    var mi = img.join(","), mp = pos.join(","), ms = size.join(",");
    el.style.webkitMaskImage = mi;
    el.style.webkitMaskPosition = mp;
    el.style.webkitMaskSize = ms;
    el.style.maskImage = mi;
    el.style.maskPosition = mp;
    el.style.maskSize = ms;
  }

  // revealed: 開ききった区画の数 / partial: 削っている最中の {index, k}
  function applyCover(stage, mediaId, revealed, partial) {
    var w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    var sharp = stage.querySelector(".sharp");
    var haze = stage.querySelector(".haze");
    if (!sharp || !haze) return;

    hazeStyle(stage);

    var total = settings.sets * TILES_PER_SET;
    var cols = gridOf(total, w, h), rows = total / cols;
    var ord = order(mediaId, total);

    if (revealed >= total && !partial) {
      // 開ききったら覆いは要らない。動画なら復号も1本に戻る
      setMask(sharp, null);
      sharp.style.visibility = "visible";
      haze.style.visibility = "hidden";
      return;
    }
    haze.style.visibility = "visible";

    var rects = openRects(Math.min(revealed, total), partial, ord, cols, rows, w, h);
    if (!rects.length) { sharp.style.visibility = "hidden"; return; }
    sharp.style.visibility = "visible";
    setMask(sharp, rects);
  }

  // 削る演出を止める。止め忘れると、残ったコマが次の素材の上に描き続ける
  function stopScratch() {
    if (scratchRAF) { cancelAnimationFrame(scratchRAF); scratchRAF = 0; }
  }

  // from/to は開いた区画の数。1区画ずつ順に削る
  function scratchTo(stage, mediaId, from, to) {
    stopScratch();
    var w = stage.clientWidth, h = stage.clientHeight;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !w || !h) { applyCover(stage, mediaId, to, null); clearFx(stage); return; }

    var total = settings.sets * TILES_PER_SET;
    var cols = gridOf(total, w, h), rows = total / cols;
    var ord = order(mediaId, total);
    var count = to - from;
    var span = count * TILE_MS;

    var fxcv = stageCanvas(stage, "fxlayer");
    var fx = fxcv.getContext("2d");
    fx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fx.clearRect(0, 0, w, h);
    var t0 = performance.now();

    function frame(now) {
      // 途中で素材が切り替わったら、この素材の続きは描かない
      if (stage.dataset.im !== mediaId) { scratchRAF = 0; return; }
      // rAF が渡す時刻は直前の performance.now() より前になることがある。
      // そのまま計算すると経過時間が負になり、区画番号が -1 に落ちる。
      var el = Math.max(0, Math.min(span, now - t0));
      var done = Math.max(0, Math.min(count, Math.floor(el / TILE_MS)));
      var k = Math.min(1, (el - done * TILE_MS) / TILE_MS);
      var idx = from + done;
      var partial = (done < count) ? { index: idx, k: k } : null;
      applyCover(stage, mediaId, from + done, partial);

      // 尾を引かせてから筆先を光らせる
      fx.globalCompositeOperation = "destination-out";
      fx.fillStyle = "rgba(0,0,0,0.16)";
      fx.fillRect(0, 0, w, h);
      fx.globalCompositeOperation = "source-over";
      if (partial && idx < total) {
        var t = tileRect(ord[idx], cols, rows, w, h);
        var q = brushAt(t, k);
        glow(fx, q.x, q.y, t.h * 0.62, 0.85);
        glow(fx, q.x, q.y, t.h * 0.24, 1);
      }

      if (el < span) scratchRAF = requestAnimationFrame(frame);
      else { scratchRAF = 0; applyCover(stage, mediaId, to, null); fadeOutFx(stage); }
    }
    scratchRAF = requestAnimationFrame(frame);
  }

  function clearFx(stage) {
    var cv = stage.querySelector("canvas.fxlayer");
    if (!cv) return;
    var x = cv.getContext("2d");
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    x.globalCompositeOperation = "source-over";
    x.clearRect(0, 0, stage.clientWidth, stage.clientHeight);
  }

  function fadeOutFx(stage) {
    var cv = stage.querySelector("canvas.fxlayer");
    if (!cv) return;
    var x = cv.getContext("2d");
    var w = stage.clientWidth, h = stage.clientHeight;
    var left = 26;
    function step() {
      x.setTransform(DPR, 0, 0, DPR, 0, 0);
      x.globalCompositeOperation = "destination-out";
      x.fillStyle = "rgba(0,0,0,0.18)";
      x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = "source-over";
      if (--left > 0) requestAnimationFrame(step);
      else x.clearRect(0, 0, w, h);
    }
    requestAnimationFrame(step);
  }

  function glow(ctx, x, y, r, a) {
    if (!isFinite(x) || !isFinite(y) || !isFinite(r) || r <= 0) return;
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,225,240," + a + ")");
    g.addColorStop(0.35, "rgba(" + PINK + "," + (a * 0.8).toFixed(3) + ")");
    g.addColorStop(1, "rgba(" + PINK + ",0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }

  // 素材の実寸が決まったとき・ステージの大きさが変わったときに覆いを組み直す
  function repaintCover() {
    var stage = document.getElementById("stage");
    if (!stage || !stage.dataset.im) return;
    applyCover(stage, stage.dataset.im, progress().tiles, null);
  }

  function watchStage(stage) {
    if (!window.ResizeObserver || stage.dataset.watched) return;
    stage.dataset.watched = "1";
    var last = "";
    new ResizeObserver(function () {
      var k = stage.clientWidth + "x" + stage.clientHeight;
      if (k === last) return;
      last = k;
      repaintCover();
    }).observe(stage);
  }

  window.addEventListener("resize", repaintCover);
  window.addEventListener("orientationchange", repaintCover);

  /* ---------- render: reveal ---------- */

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

    document.getElementById("progN").innerHTML =
      p.sets + '<small>/ ' + settings.sets + " セット</small>";

    renderMediaNav();

    var m = mediaFor(p.idx);
    if (!m) {
      stage.innerHTML = '<div class="empty">画像がまだありません。<br>右上の設定から追加してください。</div>';
      document.getElementById("progSub").textContent = "1セットで" + TILES_PER_SET + "マス削れます";
      delete stage.dataset.im;
      lastTiles = -1;
      return;
    }

    // 素材が変わったら組み直す
    if (stage.dataset.im !== m.id) {
      stage.innerHTML = mediaHtml(m);
      stage.dataset.im = m.id;
      lastTiles = -1;
      // ぼかす側と鮮明な側の2枚があるので、どちらも動かす
      var vs = stage.querySelectorAll("video");
      for (var vi = 0; vi < vs.length; vi++) {
        vs[vi].play().catch(function () {});
        // 動画は読み込み前の高さが 150px。実寸が分かった時点で覆いを組み直す
        vs[vi].addEventListener("loadedmetadata", repaintCover);
        vs[vi].addEventListener("loadeddata", repaintCover);
      }
      var ims = stage.querySelectorAll("img.art");
      for (var ii = 0; ii < ims.length; ii++) {
        if (!ims[ii].complete) ims[ii].addEventListener("load", repaintCover);
      }
      watchStage(stage);
      syncHaze(stage);
    }

    // 進んだときだけ、区画を削る演出を走らせる
    if (lastTiles >= 0 && p.tiles > lastTiles) scratchTo(stage, m.id, lastTiles, p.tiles);
    else { stopScratch(); applyCover(stage, m.id, p.tiles, null); clearFx(stage); }
    lastTiles = p.tiles;

    var rest = 0;
    images.forEach(function (im) { if (!isFull(im)) rest += 1; });
    var banner = stage.querySelector(".done-banner");
    if (p.sets >= settings.sets) {
      if (!banner) {
        banner = document.createElement("div");
        banner.className = "done-banner";
        stage.appendChild(banner);
      }
      banner.textContent = (!m.rec || rest === 0)
        ? "開ききりました。設定から追加できます"
        : "開ききりました。次のセットは未開封の1枚へ";
    } else if (banner) {
      banner.remove();
    }

    document.getElementById("progSub").textContent =
      p.sets >= settings.sets
        ? (m.rec ? "未開封が " + rest + " 枚" : "開ききりました")
        : "あと " + (settings.sets - p.sets) + " セットで完成";
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
        '<div class="move-note">' + m.note +
        (m.how ? ' <a class="how" href="' + m.how + '" target="_blank" rel="noopener">やり方 ↗</a>' : "") +
        "</div>" +
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
        (DEMO ? "未登録です。いまはサンプル素材を表示しています。"
              : "シーズン" + curSeason().n + "の画像はまだありません。") + "</p>";
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

  function seasonMeta(s, now) {
    var f = fullImagesOfSeason(s).length;
    return '<div class="meta"><b>シーズン' + s.n + (now ? "（実施中）" : "") + "</b><span>" +
      seasonTerm(s) + "　" + seasonSets(s) + " セット　" +
      f + " / " + imagesOfSeason(s.n).length + " 枚開封</span></div>";
  }

  function renderSeasons() {
    var cur = curSeason();
    document.getElementById("seasonNow").innerHTML =
      '<div class="season now">' + seasonMeta(cur, true) + "</div>";

    var past = settings.seasons.slice(0, -1).reverse();
    document.getElementById("seasonList").innerHTML = past.map(function (s) {
      var f = fullImagesOfSeason(s);
      return '<div class="season">' + seasonMeta(s, false) +
        (f.length ? '<button class="act" data-open="' + s.n + '">開封済みを見る</button>' : "") +
        "</div>" +
        '<div class="seasonimgs" id="si' + s.n + '" hidden>' +
        f.map(function (im) {
          return '<button class="sthumb" data-view="' + im.id + '">' +
            (im.type === "video"
              ? "<span>動画</span>"
              : '<img src="' + urlFor(im) + '" alt="">') + "</button>";
        }).join("") + "</div>";
    }).join("");
  }

  // 開封し切った素材は、ぼかさずそのまま見られる
  function openViewer(id) {
    var im = null;
    for (var i = 0; i < allImages.length; i++) if (allImages[i].id === id) im = allImages[i];
    if (!im) return;
    document.getElementById("viewerIn").innerHTML = im.type === "video"
      ? '<video src="' + urlFor(im) + '" controls autoplay loop playsinline></video>'
      : '<img src="' + urlFor(im) + '" alt="">';
    document.getElementById("viewer").classList.add("open");
  }

  function closeViewer() {
    document.getElementById("viewer").classList.remove("open");
    document.getElementById("viewerIn").innerHTML = "";
  }

  function renderPassState() {
    var el = document.getElementById("passState");
    if (!el) return;
    if (!window.crypto || !crypto.subtle) {
      el.textContent = "この環境では使えません。HTTPS で開いてください。";
      return;
    }
    el.textContent = loadPass()
      ? "保存済みです。PC 側の .env と同じであることを確かめてください。"
      : "PC 側の .env に入れたものと同じ合言葉を保存してください。";

    // 打っている最中に書き換えない
    var inp = document.getElementById("passInput");
    if (inp && document.activeElement !== inp) inp.value = loadPass();
  }

  function renderSettings() {
    renderSeasons();
    renderPassState();

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

  document.getElementById("startSeason").addEventListener("click", startSeason);

  document.getElementById("closeViewer").addEventListener("click", closeViewer);

  document.getElementById("seasonList").addEventListener("click", function (e) {
    var o = e.target.closest("[data-open]");
    if (o) {
      var box = document.getElementById("si" + o.dataset.open);
      box.hidden = !box.hidden;
      o.textContent = box.hidden ? "開封済みを見る" : "閉じる";
      return;
    }
    var v = e.target.closest("[data-view]");
    if (v) openViewer(v.dataset.view);
  });

  document.getElementById("addImage").addEventListener("click", function () {
    document.getElementById("fileInput").click();
  });

  // blob と名前から1件ぶん作って保存する。素通しでも伏せたものでも通り道は同じ。
  function storeMedia(blob, name) {
    var mime = blob.type || "";
    var rec = {
      id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8),
      name: name || "ファイル",
      blob: blob,
      mime: mime,
      type: mime.indexOf("video") === 0 ? "video" : "image",
      sets: 0,
      season: curSeason().n,
      added: Date.now()
    };
    return tx("readwrite", function (s) { return s.put(rec); }).then(function () { return rec; });
  }

  function afterStore(recs) {
    allImages = allImages.concat(recs);
    syncImages();
    delete document.getElementById("stage").dataset.im;
    renderSettings();
    renderAll();
  }

  // File の参照を先に配列へ写してから入力欄を空にする。
  // 順番を逆にすると value を空にした時点で選択が消え、何も保存されない。
  function pickedFiles(e) {
    var list = e.target.files ? Array.prototype.slice.call(e.target.files) : [];
    e.target.value = "";
    return list;
  }

  function dbOrWarn() {
    return (dbReady || Promise.resolve()).then(function () {
      if (!db) throw new Error("この環境では保存できません。プライベートブラウズを解除して開いてください。");
    });
  }

  document.getElementById("fileInput").addEventListener("change", function (e) {
    var list = pickedFiles(e);
    if (!list.length) return;

    dbOrWarn().then(function () {
      return Promise.all(list.map(function (f) { return storeMedia(f, f.name); }));
    }).then(afterStore).catch(function (err) {
      alert((err && err.message) || "保存に失敗しました。空き容量を確認してください。");
    });
  });

  document.getElementById("addSealed").addEventListener("click", function () {
    if (!loadPass()) { alert("先に合言葉を保存してください。"); return; }
    document.getElementById("sealedInput").click();
  });

  // 伏せたファイルは、復号してそのまま保存する。画面に出す処理は通らない。
  document.getElementById("sealedInput").addEventListener("change", function (e) {
    var list = pickedFiles(e);
    if (!list.length) return;
    var pass = loadPass();
    if (!pass) { alert("先に合言葉を保存してください。"); return; }

    var bad = list.filter(function (f) { return !isSealed(f); });
    if (bad.length) {
      alert(".kcz のファイルを選んでください。");
      return;
    }

    var btn = document.getElementById("addSealed");
    btn.disabled = true;
    btn.textContent = "取り込んでいます…";

    dbOrWarn().then(function () {
      var recs = [];
      // 1件ずつ順に。まとめて走らせると鍵の導出が重なって無駄が出る
      return list.reduce(function (chain, f) {
        return chain.then(function () {
          return openSealed(f, pass).then(function (blob) {
            return storeMedia(blob, "封 " + (recs.length + 1));
          }).then(function (rec) { recs.push(rec); });
        });
      }, Promise.resolve()).then(function () { return recs; });
    }).then(function (recs) {
      afterStore(recs);
      alert(recs.length + " 件を取り込みました。何が入っているかは開くまで分かりません。");
    }).catch(function (err) {
      alert((err && err.message) || "取り込めませんでした。");
    }).then(function () {
      btn.disabled = false;
      btn.textContent = ".kcz を取り込む";
    });
  });

  document.getElementById("passSave").addEventListener("click", function () {
    savePass(document.getElementById("passInput").value.trim());
    keyCache = {};
    renderPassState();
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
      allImages = allImages.filter(function (im) { return im.id !== id; });
      syncImages();
      if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; }
      if (settings.currentId === id) {
        settings.currentId = images.length ? images[0].id : null;
        saveSettings();
      }
      delete document.getElementById("stage").dataset.im;
      renderSettings();
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
    allImages = (recs || []).sort(function (a, b) { return a.added - b.added; });
    return migrateSets().then(migrateImageSeason);
  }).then(function () {
    syncImages();
    delete document.getElementById("stage").dataset.im;
    renderReveal();
  }).catch(function () {
    document.getElementById("stage").innerHTML =
      '<div class="empty">この環境では保存できません。<br>プライベートブラウズを解除して開いてください。</div>';
  });
})();
