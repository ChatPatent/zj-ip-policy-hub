/* 数据层：静态数据包 / 实时 JSON / 后台草稿 三态统一，覆盖度实时计算，导入导出 */
(function (global) {
  "use strict";
  var ZJ = global.ZJ = global.ZJ || {};
  var U = ZJ.util;

  var POLICY_FIELDS = ["id", "title", "docNo", "level", "region", "issuer", "issuedAt", "effectiveFrom",
    "effectiveTo", "status", "category", "topics", "stages", "targets", "supportType", "supportDetail",
    "summary", "highlights", "applyWindow", "contact", "sourceName", "sourceUrl", "verification",
    "verifiedAt", "keywords", "datePrecision"];
  var CASE_FIELDS = ["id", "title", "type", "level", "region", "organ", "date", "industry", "ipType",
    "overseas", "markets", "stages", "summary", "facts", "result", "insight", "legalBasis",
    "takeaways", "sourceName", "sourceUrl", "verification", "verifiedAt", "keywords", "datePrecision"];
  var ARRAY_FIELDS = { topics: 1, stages: 1, targets: 1, highlights: 1, keywords: 1,
                       markets: 1, legalBasis: 1, takeaways: 1 };

  var state = {
    meta: {}, regions: {}, taxonomy: {}, policies: [], cases: [], coverage: null,
    draft: null, live: false
  };

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  /* readDraft:false 用于企业用户版——始终只读已发布的正式数据，
     不加载构建者在同一浏览器留下的本地草稿，也不启用 ?live=1 开发态。 */
  function init(opts) {
    var b = global.__ZJIP_DATA__;
    if (!b) throw new Error("未找到 data/bundle.js，请先运行 python tools/build_data.py");
    var readDraft = !(opts && opts.readDraft === false);
    state.meta = b.meta || {};
    state.regions = b.regions || {};
    state.taxonomy = b.taxonomy || {};
    state.policies = deepClone(b.policies || []);
    state.cases = deepClone(b.cases || []);
    var draft = readDraft ? U.store.get("draft", null) : null;
    if (draft && (draft.policies || draft.cases)) {
      state.draft = draft;
      if (draft.policies) state.policies = draft.policies;
      if (draft.cases) state.cases = draft.cases;
    }
    state.coverage = computeCoverage();
    return state;
  }

  /* 开发模式：?live=1 直接读取 data/*.json，改数据后刷新即可，无需重新构建 */
  function loadLive() {
    if (!/(\?|&)live=1/.test(global.location.search)) return Promise.resolve(false);
    var files = ["regions", "taxonomy", "policies", "cases"];
    return Promise.all(files.map(function (n) {
      return fetch("data/" + n + ".json?t=" + Date.now()).then(function (r) {
        if (!r.ok) throw new Error(n + ".json " + r.status);
        return r.json();
      });
    })).then(function (arr) {
      state.regions = arr[0]; state.taxonomy = arr[1];
      state.policies = arr[2]; state.cases = arr[3];
      state.live = true; state.draft = null;
      state.coverage = computeCoverage();
      return true;
    }).catch(function (e) {
      console.warn("live 模式加载失败，回退到 bundle.js：", e.message);
      return false;
    });
  }

  function computeCoverage() {
    var cities = (state.regions.cities || []).map(function (c) {
      var districts = (c.districts || []).map(function (d) {
        var p = state.policies.filter(function (x) {
          return (x.region || {}).city === c.name && (x.region || {}).district === d;
        }).length;
        var cs = state.cases.filter(function (x) {
          return (x.region || {}).city === c.name && (x.region || {}).district === d;
        }).length;
        return { name: d, policies: p, cases: cs, total: p + cs,
                 state: p + cs >= 2 ? "covered" : (p + cs === 1 ? "thin" : "blank") };
      });
      var cp = state.policies.filter(function (x) { return (x.region || {}).city === c.name; }).length;
      var cc = state.cases.filter(function (x) { return (x.region || {}).city === c.name; }).length;
      return {
        id: c.id, name: c.name, short: c.short, policies: cp, cases: cc, total: cp + cc,
        districts: districts, districtTotal: districts.length,
        coveredDistricts: districts.filter(function (d) { return d.total > 0; }).length
      };
    });
    var all = state.policies.concat(state.cases);
    var gaps = [];
    cities.forEach(function (c) {
      c.districts.forEach(function (d) { if (!d.total) gaps.push({ city: c.name, district: d.name }); });
    });
    var province = {
      policies: state.policies.length, cases: state.cases.length,
      national: all.filter(function (x) { return x.level === "national"; }).length,
      provinceLevel: all.filter(function (x) { return x.level === "province"; }).length,
      cityLevel: all.filter(function (x) { return x.level === "city"; }).length,
      countyLevel: all.filter(function (x) { return x.level === "county"; }).length,
      verified: all.filter(function (x) { return x.verification === "verified"; }).length,
      pending: all.filter(function (x) { return x.verification === "pending"; }).length,
      demo: all.filter(function (x) { return x.verification === "demo"; }).length,
      withSourceUrl: all.filter(function (x) { return !!x.sourceUrl; }).length,
      cityTotal: cities.length,
      districtTotal: cities.reduce(function (s, c) { return s + c.districtTotal; }, 0),
      coveredDistricts: cities.reduce(function (s, c) { return s + c.coveredDistricts; }, 0)
    };
    return { province: province, cities: cities, gaps: gaps };
  }

  function commitDraft() {
    state.draft = { policies: deepClone(state.policies), cases: deepClone(state.cases) };
    U.store.set("draft", state.draft);
    state.coverage = computeCoverage();
  }
  function clearDraft() {
    U.store.del("draft");
    state.draft = null;
    var b = global.__ZJIP_DATA__ || {};
    state.policies = deepClone(b.policies || []);
    state.cases = deepClone(b.cases || []);
    state.coverage = computeCoverage();
  }
  function hasDraft() { return !!state.draft; }

  function nextId(kind) {
    var prefix = kind === "policies" ? "ZJ-P" : "ZJ-C";
    var used = {};
    (kind === "policies" ? state.policies : state.cases).forEach(function (x) { used[x.id] = 1; });
    var n = 1;
    while (used[prefix + "-" + String(n).padStart(4, "0")]) n++;
    return prefix + "-" + String(n).padStart(4, "0");
  }

  function blank(kind) {
    var fields = kind === "policies" ? POLICY_FIELDS : CASE_FIELDS;
    var o = {};
    fields.forEach(function (f) {
      o[f] = ARRAY_FIELDS[f] ? [] : (f === "region" ? { city: "", district: "" } :
        (f === "overseas" ? false : ""));
    });
    o.id = nextId(kind);
    o.level = "county"; o.verification = "pending";
    o.verifiedAt = new Date().toISOString().slice(0, 10);
    o.datePrecision = "day";
    return o;
  }

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    var rows = [], row = [], cur = "", quoted = false;
    text = String(text || "").replace(/^\uFEFF/, "");
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; }
          else quoted = false;
        } else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cur); cur = "";
        if (row.some(function (c) { return c.trim() !== ""; })) rows.push(row);
        row = [];
      } else cur += ch;
    }
    row.push(cur);
    if (row.some(function (c) { return c.trim() !== ""; })) rows.push(row);
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim(); });
    return rows.slice(1).map(function (r) {
      var o = {};
      head.forEach(function (h, i) { o[h] = r[i] === undefined ? "" : r[i].trim(); });
      return o;
    });
  }

  function csvCell(v) {
    var s = Array.isArray(v) ? v.join("|") : (v === null || v === undefined ? "" : String(v));
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCSV(kind) {
    var fields = kind === "policies" ? POLICY_FIELDS : CASE_FIELDS;
    var cols = [];
    fields.forEach(function (f) {
      if (f === "region") cols.push("city", "district");
      else cols.push(f);
    });
    var lines = [cols.join(",")];
    (kind === "policies" ? state.policies : state.cases).forEach(function (it) {
      lines.push(cols.map(function (c) {
        if (c === "city") return csvCell((it.region || {}).city);
        if (c === "district") return csvCell((it.region || {}).district);
        return csvCell(it[c]);
      }).join(","));
    });
    return lines.join("\r\n");
  }

  function fromCSV(kind, text, merge) {
    var objList = parseCSV(text);
    var fields = kind === "policies" ? POLICY_FIELDS : CASE_FIELDS;
    var list = merge ? (kind === "policies" ? state.policies : state.cases) : [];
    var added = 0, updated = 0;
    objList.forEach(function (row) {
      var o = {};
      fields.forEach(function (f) {
        if (f === "region") return;
        var v = row[f];
        if (ARRAY_FIELDS[f]) o[f] = v ? v.split("|").map(function (s) { return s.trim(); }).filter(Boolean) : [];
        else if (f === "overseas") o[f] = /^(1|true|yes|是|y)$/i.test(v || "");
        else o[f] = v || "";
      });
      o.region = { city: row.city || "", district: row.district || "" };
      if (!o.title || !o.summary) return;
      if (!o.id) o.id = nextId(kind);
      if (!o.verification) o.verification = "pending";
      if (!o.verifiedAt) o.verifiedAt = new Date().toISOString().slice(0, 10);
      if (!o.datePrecision) o.datePrecision = "day";
      var idx = -1;
      for (var i = 0; i < list.length; i++) if (list[i].id === o.id) { idx = i; break; }
      if (idx >= 0) { list[idx] = o; updated++; }
      else { list.push(o); added++; }
    });
    if (kind === "policies") state.policies = list; else state.cases = list;
    commitDraft();
    return { added: added, updated: updated, total: list.length };
  }

  /* 把当前数据打包成可直接替换 data/bundle.js 的脚本 */
  function toBundle() {
    var payload = {
      meta: Object.assign({}, state.meta, {
        generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        policyCount: state.policies.length, caseCount: state.cases.length
      }),
      regions: state.regions, taxonomy: state.taxonomy,
      policies: state.policies, cases: state.cases, coverage: state.coverage
    };
    var text = JSON.stringify(payload).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
    return "/* 由平台数据后台导出；覆盖 data/bundle.js 后刷新即可生效 */\nwindow.__ZJIP_DATA__ = " + text + ";\n";
  }

  function quality() {
    var all = state.policies.concat(state.cases);
    var issues = [];
    var ids = {};
    all.forEach(function (x) {
      if (!x.id) issues.push({ id: "—", level: "err", msg: "缺少 ID" });
      else if (ids[x.id]) issues.push({ id: x.id, level: "err", msg: "ID 重复" });
      else ids[x.id] = 1;
      if (!x.title) issues.push({ id: x.id, level: "err", msg: "缺少标题" });
      if (!x.summary) issues.push({ id: x.id, level: "err", msg: "缺少摘要" });
      if (!x.sourceUrl) issues.push({ id: x.id, level: "warn", msg: "缺原文链接" });
      if (x.verification === "pending") issues.push({ id: x.id, level: "warn", msg: "待核验，需复核原文" });
      if (x.verification === "demo") issues.push({ id: x.id, level: "warn", msg: "示范条目，禁止作为决策依据" });
      if (["verified", "pending", "demo"].indexOf(x.verification) < 0) {
        issues.push({ id: x.id, level: "err", msg: "核验状态值非法" });
      }
    });
    var cityMap = {};
    (state.regions.cities || []).forEach(function (c) { cityMap[c.name] = c.districts || []; });
    all.forEach(function (x) {
      var r = x.region || {};
      if (r.city && !cityMap[r.city]) issues.push({ id: x.id, level: "err", msg: "未知设区市：" + r.city });
      else if (r.district && cityMap[r.city] && cityMap[r.city].indexOf(r.district) < 0)
        issues.push({ id: x.id, level: "err", msg: "区县与设区市不匹配：" + r.city + "/" + r.district });
    });
    return issues;
  }

  ZJ.data = {
    init: init, loadLive: loadLive, get state() { return state; },
    get meta() { return state.meta; },
    get regions() { return state.regions; },
    get taxonomy() { return state.taxonomy; },
    get policies() { return state.policies; },
    get cases() { return state.cases; },
    get coverage() { return state.coverage; },
    POLICY_FIELDS: POLICY_FIELDS, CASE_FIELDS: CASE_FIELDS, ARRAY_FIELDS: ARRAY_FIELDS,
    computeCoverage: computeCoverage, commitDraft: commitDraft, clearDraft: clearDraft,
    hasDraft: hasDraft, blank: blank, nextId: nextId,
    parseCSV: parseCSV, toCSV: toCSV, fromCSV: fromCSV,
    toBundle: toBundle, quality: quality
  };
})(window);
