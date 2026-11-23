/* 通用工具：零依赖、file:// 可用（不使用 ES Module，避免本地 CORS 限制） */
(function (global) {
  "use strict";
  var ZJ = global.ZJ = global.ZJ || {};

  function esc(v) {
    if (v === null || v === undefined) return "";
    return String(v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function stripTags(v) { return String(v || "").replace(/<[^>]*>/g, ""); }

  function formatDate(v, precision) {
    if (!v) return "—";
    var s = String(v);
    var m = s.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
    if (!m) return esc(s);
    var y = m[1], mo = m[2], d = m[3];
    if (precision === "year" || (!mo && !d)) return y + "年";
    if (precision === "month" || (mo && !d)) return y + "年" + parseInt(mo, 10) + "月";
    return y + "年" + parseInt(mo, 10) + "月" + parseInt(d, 10) + "日";
  }

  function regionText(it) {
    var r = it.region || {};
    if (r.district) return r.city + " · " + r.district;
    if (r.city) return r.city;
    var map = { national: "国家层面", province: "浙江省级", city: "市级", county: "区县级" };
    return map[it.level] || "浙江省";
  }

  function levelName(lv) {
    return { national: "国家", province: "省级", city: "市级", county: "区县" }[lv] || lv || "";
  }

  function verificationName(v) {
    return { verified: "已核验", pending: "待核验", demo: "示范条目" }[v] || v || "";
  }

  function clip(s, n) {
    s = String(s || "");
    return s.length > n ? s.slice(0, n) + "…" : s;
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 200);
    };
  }

  function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function highlight(text, terms) {
    var out = esc(text || "");
    var list = (terms || []).filter(function (t) { return t && t.length >= 2; })
      .sort(function (a, b) { return b.length - a.length; });
    // 去重并限制数量，避免正则过长
    var seen = {}, uniq = [];
    for (var i = 0; i < list.length; i++) {
      if (!seen[list[i]]) { seen[list[i]] = 1; uniq.push(list[i]); }
      if (uniq.length >= 14) break;
    }
    if (!uniq.length) return out;
    try {
      var re = new RegExp("(" + uniq.map(escapeRegExp).join("|") + ")", "gi");
      return out.replace(re, "<mark>$1</mark>");
    } catch (e) { return out; }
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }

  var toastTimer;
  function toast(msg) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2400);
  }

  var store = {
    get: function (k, def) {
      try { var v = localStorage.getItem("zjip." + k); return v === null ? def : JSON.parse(v); }
      catch (e) { return def; }
    },
    set: function (k, v) {
      try { localStorage.setItem("zjip." + k, JSON.stringify(v)); return true; }
      catch (e) { toast("本地存储写入失败：" + e.message); return false; }
    },
    del: function (k) { try { localStorage.removeItem("zjip." + k); } catch (e) {} }
  };

  function parseHash(hash) {
    var h = String(hash || "").replace(/^#\/?/, "");
    var qi = h.indexOf("?");
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var params = {};
    if (qi >= 0) {
      h.slice(qi + 1).split("&").forEach(function (kv) {
        if (!kv) return;
        var p = kv.split("=");
        try { params[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || "").replace(/\+/g, " ")); }
        catch (e) {}
      });
    }
    return { path: path || "home", params: params };
  }

  function buildHash(path, params) {
    var q = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return;
      q.push(encodeURIComponent(k) + "=" + encodeURIComponent(Array.isArray(v) ? v.join(",") : v));
    });
    return "#/" + path + (q.length ? "?" + q.join("&") : "");
  }

  var ICONS = {
    search: '<path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="m21 21-4.35-4.35"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    scale: '<path d="M12 3v18M8 21h8M3 7h18M6 7l-3 6h6L6 7Zm12 0-3 6h6l-3-6Z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    building: '<path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M15 9h2a2 2 0 0 1 2 2v10M9 7h2M9 11h2M9 15h2"/>',
    tag: '<path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>'
  };

  function icon(name, size, color) {
    var d = ICONS[name] || ICONS.info;
    return '<svg width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="' +
      (color || "currentColor") + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  }

  function emptyBox(title, desc) {
    return '<div class="card empty">' + icon("search", 42) + "<h3>" + esc(title) + "</h3><p class='small'>" + esc(desc || "") + "</p></div>";
  }

  ZJ.util = {
    esc: esc, stripTags: stripTags, formatDate: formatDate, regionText: regionText,
    levelName: levelName, verificationName: verificationName, clip: clip,
    debounce: debounce, escapeRegExp: escapeRegExp, highlight: highlight,
    download: download, toast: toast, store: store,
    parseHash: parseHash, buildHash: buildHash, icon: icon, emptyBox: emptyBox
  };
})(window);
