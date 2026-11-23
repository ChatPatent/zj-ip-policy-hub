/* 应用主控：路由、筛选状态、检索引擎装配、事件委托、详情抽屉、后台交互 */
(function (global) {
  "use strict";
  var ZJ = global.ZJ, U = ZJ.util, D = ZJ.data, V = ZJ.views;
  /* 角色模式：public = 企业用户（只读查询）｜builder = 平台构建者（含覆盖度看板与数据后台）。
     判定优先级：URL 的 ?role=user/builder > 入口 HTML 的 ZJ_MODE > 默认 public。
     正式链接都显式带 role，因此即使浏览器缓存了旧版首页，角色也由链接本身决定，不会串版；
     builder 模式额外要求后台模块确实已加载，否则安全降级为 public，避免白屏。 */
  var roleParam = "";
  try { roleParam = new URLSearchParams(global.location.search).get("role") || ""; } catch (err) { roleParam = ""; }
  var MODE = roleParam === "user" ? "public"
    : roleParam === "builder" ? "builder"
    : (global.ZJ_MODE === "builder" ? "builder" : "public");
  if (MODE === "builder" && !ZJ.admin) MODE = "public";
  var IS_PUBLIC = MODE === "public";
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var S = {
    path: "home", params: {}, engine: null,
    page: 1, pageSize: 8,
    match: { submitted: false, form: { city: "", district: "", stage: "", market: "", ipType: "", target: "", needs: [] }, policies: [], cases: [], steps: [] },
    admin: { kind: "policies", id: null, q: "" },
    focus: null
  };
  var ROUTES_BUILDER = { home: 1, policies: 1, cases: 1, search: 1, coverage: 1, match: 1, sources: 1, about: 1, admin: 1 };
  var ROUTES_PUBLIC = { home: 1, policies: 1, cases: 1, search: 1, match: 1, sources: 1, about: 1 };
  var ROUTES = IS_PUBLIC ? ROUTES_PUBLIC : ROUTES_BUILDER;
  var TITLES = { home: "首页", policies: "政策库", cases: "案例库", search: "全站检索", coverage: "覆盖度看板",
    match: "出海政策助手", sources: "数据来源与规范", about: "关于平台", admin: "数据管理后台" };

  /* ---------- URL ---------- */
  function href(overrides) {
    overrides = overrides || {};
    var p = {};
    if (!overrides.path || overrides.path === S.path) p = Object.assign({}, S.params);
    Object.keys(overrides).forEach(function (k) {
      if (k === "path") return;
      var v = overrides[k];
      if (v === "" || v === null || v === undefined) delete p[k];
      else p[k] = Array.isArray(v) ? v.join(",") : v;
    });
    return U.buildHash(overrides.path || S.path, p);
  }
  function go(updates, replace) {
    var h = href(updates);
    if (replace) history.replaceState(null, "", h);
    else location.hash = h;
    if (replace) render();
  }
  function arr(k) { return (S.params[k] || "").split(",").filter(Boolean); }

  /* ---------- 引擎与分面 ---------- */
  function rebuild() {
    S.engine = new ZJ.SearchEngine(D.taxonomy);
    S.engine.addDocs(D.policies, "policies").addDocs(D.cases, "cases");
  }
  function facets(kind) {
    var list = kind === "policies" ? D.policies : (kind === "cases" ? D.cases : D.policies.concat(D.cases));
    var out = {};
    function bump(dim, v) {
      if (!v) return;
      if (!out[dim]) out[dim] = {};
      out[dim][v] = (out[dim][v] || 0) + 1;
    }
    list.forEach(function (x) {
      bump("level", x.level); bump("city", (x.region || {}).city); bump("district", (x.region || {}).district);
      bump("category", x.category); bump("ctype", x.type); bump("supportType", x.supportType);
      bump("verification", x.verification); bump("ipType", x.ipType); bump("industry", x.industry);
      bump("year", String(x.issuedAt || x.date || "").slice(0, 4));
      (x.stages || []).forEach(function (v) { bump("stages", v); });
      (x.targets || []).forEach(function (v) { bump("targets", v); });
      (x.markets || []).forEach(function (v) { bump("markets", v); });
    });
    return out;
  }
  function currentFilters(kind) {
    var f = {}, keys = ["level", "city", "district", "category", "ctype", "stages", "targets",
      "supportType", "markets", "year", "verification"];
    keys.forEach(function (k) { f[k] = arr(k); });
    f.q = S.params.q || "";
    f.strictRegion = S.params.strictRegion === "1";
    f.types = kind === "all" ? [] : [kind];
    f.overseas = S.params.overseas || "";
    return f;
  }

  /* ---------- 出海助手匹配 ---------- */
  var NEED_TERMS = {
    "资金资助与奖补": ["资助", "补助", "奖励", "专项资金", "奖补", "代理费", "费用"],
    "风险监测与预警": ["预警", "监测", "风险", "抢注", "信息"],
    "纠纷应对与行政裁决": ["裁决", "应诉", "纠纷", "诉讼", "调解", "维权"],
    "合规体系与指引": ["合规", "指引", "规范", "体系", "标准"],
    "快速获权与海外布局": ["预审", "PPH", "专利布局", "国际注册", "马德里", "布局", "海外发明专利"],
    "公益服务与专家指导": ["公益", "服务", "专家", "指导", "工作站", "服务站", "培训"],
    "保险与成本分担": ["保险", "成本分担", "TRO", "侵权责任险", "分担"],
    "融资与质押": ["质押", "融资", "贴息", "贷款", "风险补偿"]
  };
  function computeMatch(form) {
    var pool = D.policies, cases = D.cases;
    function scorePolicy(x) {
      var sc = 0, why = [];
      var r = x.region || {};
      if (form.district && r.district === form.district) { sc += 6; why.push("属地精准匹配"); }
      else if (form.city && r.city === form.city) { sc += 4; why.push("本市适用"); }
      else if (x.level === "province" || x.level === "national") { sc += 2.2; why.push("全省适用"); }
      else if (x.level === "city") { sc += 1.2; }
      if (form.stage && (x.stages || []).indexOf(form.stage) >= 0) { sc += 3.5; why.push("对应出海阶段"); }
      if (form.target && ((x.targets || []).indexOf(form.target) >= 0 || (x.targets || []).indexOf("所有市场主体") >= 0)) {
        sc += 2; why.push("适用主体相符");
      }
      if (form.market && ((x.markets || []).indexOf(form.market) >= 0 || (x.markets || []).indexOf("全球/不限定") >= 0)) {
        sc += 1.2;
      }
      var text = [x.title, x.summary, x.supportDetail, (x.topics || []).join(" "), (x.keywords || []).join(" ")].join(" ");
      (form.needs || []).forEach(function (n) {
        var terms = NEED_TERMS[n] || [];
        if (terms.some(function (t) { return text.indexOf(t) >= 0; })) { sc += 1.6; why.push(n); }
      });
      if (form.ipType && text.indexOf(form.ipType) >= 0) { sc += 0.8; }
      if (x.verification === "verified") sc += 0.6;
      if (x.verification === "demo") sc -= 5;
      if (/资金|资助|奖励/.test(x.supportType || "")) sc += 0.5;
      return { x: x, score: sc, why: why.slice(0, 4) };
    }
    function scoreCase(x) {
      var sc = 0, why = [];
      var r = x.region || {};
      if (form.district && r.district === form.district) { sc += 5; why.push("本地案例"); }
      else if (form.city && r.city === form.city) { sc += 3; why.push("本市案例"); }
      else if (x.level === "province" || x.level === "national") { sc += 1.6; why.push("省级案例"); }
      if (form.stage && (x.stages || []).indexOf(form.stage) >= 0) { sc += 3.5; why.push("同阶段"); }
      if (form.market && ((x.markets || []).indexOf(form.market) >= 0 || (x.markets || []).indexOf("全球/不限定") >= 0)) {
        sc += 2; why.push("目标市场相符");
      }
      if (form.ipType && x.ipType === form.ipType) { sc += 1.4; why.push("权利类型相符"); }
      if (form.industry && x.industry === form.industry) sc += 1;
      var text = [x.title, x.summary, x.insight, (x.takeaways || []).join(" ")].join(" ");
      (form.needs || []).forEach(function (n) {
        var terms = NEED_TERMS[n] || [];
        if (terms.some(function (t) { return text.indexOf(t) >= 0; })) { sc += 1.2; why.push(n); }
      });
      if (x.verification === "verified") sc += 0.5;
      if (x.overseas) sc += 0.4;
      return { x: x, score: sc, why: why.slice(0, 4) };
    }
    var ps = pool.map(scorePolicy).filter(function (r) { return r.score >= 2; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 8);
    var cs = cases.map(scoreCase).filter(function (r) { return r.score >= 2; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 6);

    var stageName = (D.taxonomy.stages || []).filter(function (s) { return s.id === form.stage; })[0];
    var base = [
      { t: "第 1 步 · 确认适用与时效", d: "逐条打开政策详情，核对效力状态、申报窗口与原文链接；标注「待核验」的条目先向发文机关或属地市场监管部门复核。" },
      { t: "第 2 步 · 准备主体与权属材料", d: "整理营业执照、专利/商标证书、专利权评价报告、境外注册证明、费用清单与中文翻译件；多数资助项目要求材料齐备且维权已完结。" },
      { t: "第 3 步 · 接入属地公益服务", d: "联系所在区县市场监管局或知识产权保护中心/服务站，申请风险监测预警、专家指导与预审通道，这些服务通常免费。" },
      { t: "第 4 步 · 按窗口期申报", d: "注意省级政策常由区县窗口兑现，区县初审截止往往早于市级截止；在日历中标注两级时间节点并预留补正时间。" },
      { t: "第 5 步 · 复盘并沉淀台账", d: "把权属布局、预警记录、维权材料与申报凭证归档，形成企业知识产权合规台账，为下一次出海与后续资助申报留痕。" }
    ];
    if (form.stage === "s4" || form.stage === "s5") {
      base.unshift({ t: "紧急第 0 步 · 固定证据与期限", d: "海外诉讼答辩期短、程序刚性强：立即固定研发档案、销售合同、技术交底与送达材料，并同步联系国家级海外纠纷应对指导分中心，避免缺席判决。" });
    } else if (form.stage === "s1" || form.stage === "s2") {
      base.unshift({ t: "前置第 0 步 · 市场未动、权利先行", d: "在目标市场完成核心类别商标注册与关键专利布局（马德里/PCT/单一国家途径），并做一次 FTO 与合规自查，从源头降低抢注与临时禁令风险。" });
    }
    return { submitted: true, form: form, policies: ps, cases: cs, steps: base,
             stageName: stageName ? stageName.name : "" };
  }

  /* ---------- 详情抽屉 ---------- */
  function findItem(type, id) {
    var doc = S.engine.byId[type + ":" + id];
    if (doc) return { raw: doc.raw, _type: type };
    var alt = type === "policies" ? "cases" : "policies";
    doc = S.engine.byId[alt + ":" + id];
    return doc ? { raw: doc.raw, _type: alt } : null;
  }
  function openDrawer(type, id, fromUrl) {
    var it = findItem(type, id);
    if (!it) { U.toast("未找到该条目：" + id); return; }
    var dr = $("#drawer"), ov = $("#overlay");
    dr.innerHTML = V.detail(it, MODE);
    ov.classList.add("show"); dr.classList.add("show");
    document.body.style.overflow = "hidden";
    if (!fromUrl) {
      var p = Object.assign({}, S.params, { id: id });
      history.replaceState(null, "", U.buildHash(S.path, p));
      S.params.id = id;
    }
  }
  function hideDrawer() {
    $("#drawer").classList.remove("show");
    $("#overlay").classList.remove("show");
    document.body.style.overflow = "";
  }
  function closeDrawer() {
    hideDrawer();
    if (S.params.id) {
      delete S.params.id;
      history.replaceState(null, "", U.buildHash(S.path, S.params));
    }
  }
  function captureMatchForm() {
    var f = $("#matchForm");
    if (!f) return;
    var fd = new FormData(f);
    S.match.form = {
      city: fd.get("city") || "", district: fd.get("district") || "",
      stage: fd.get("stage") || "", market: fd.get("market") || "",
      ipType: fd.get("ipType") || "", target: fd.get("target") || "",
      needs: fd.getAll("needs") || []
    };
  }
  function filterAdminRows(kw) {
    $$("[data-admin-row]").forEach(function (row) {
      var txt = row.textContent || "";
      row.style.display = !kw || txt.indexOf(kw) >= 0 ? "" : "none";
    });
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var parsed = U.parseHash(location.hash);
    if (!ROUTES[parsed.path]) {
      /* 用户版：即使手工把地址改成 #/admin 或 #/coverage 也无法进入构建者页面，并清理地址栏。
         file:// 下部分浏览器禁止 replaceState，失败时忽略即可，页面仍安全回落到首页。 */
      try { history.replaceState(null, "", U.buildHash("home", {})); } catch (ignore) {}
      parsed = { path: "home", params: {} };
    }
    S.path = parsed.path;
    S.params = parsed.params;
    S.page = Math.max(1, parseInt(S.params.page || "1", 10) || 1);
    document.title = TITLES[S.path] + " · 浙江省知识产权政策与案例综合服务平台";
    var ctx = {
      data: D, href: href, params: S.params, kind: S.path,
      mode: MODE, isPublic: IS_PUBLIC,
      page: S.page, pageSize: S.pageSize,
      admin: S.admin, match: S.match, engine: S.engine
    };
    var html = "";
    if (S.path === "home") html = V.home(ctx);
    else if (S.path === "policies" || S.path === "cases" || S.path === "search") {
      ctx.kind = S.path === "search" ? "all" : S.path;
      ctx.result = S.engine.search(S.params.q || "", currentFilters(ctx.kind), { sort: S.params.sort || "relevance" });
      ctx.facets = facets(ctx.kind);
      var maxPage = Math.max(1, Math.ceil(ctx.result.total / S.pageSize));
      if (S.page > maxPage) { S.page = maxPage; ctx.page = S.page; }
      html = V.library(ctx);
    }
    else if (S.path === "coverage") html = V.coverage(ctx);
    else if (S.path === "match") html = V.match(ctx);
    else if (S.path === "sources") html = V.sources(ctx);
    else if (S.path === "about") html = V.about(ctx);
    else if (S.path === "admin" && !IS_PUBLIC) html = ZJ.admin.view(ctx);

    $("#app").innerHTML = html;
    $$("#nav a").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-route") === S.path);
    });
    if (!$("#mobileFilter")) {}
    else if (window.innerWidth <= 900) $("#mobileFilter").style.display = "inline-flex";
    if (S.focus) {
      var el = document.getElementById(S.focus);
      if (el) { el.focus(); if (el.setSelectionRange) { var l = el.value.length; el.setSelectionRange(l, l); } }
      S.focus = null;
    } else if (!S.params.id) window.scrollTo(0, 0);

    if (S.params.id) {
      var t = /^ZJ-P/.test(S.params.id) ? "policies" : "cases";
      openDrawer(t, S.params.id, true);
    }
  }

  /* ---------- 导出 ---------- */
  function csvEscape(v) {
    var s = Array.isArray(v) ? v.join("|") : (v === null || v === undefined ? "" : String(v));
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportResults() {
    var kind = S.path === "search" ? "all" : S.path;
    var res = S.engine.search(S.params.q || "", currentFilters(kind), { sort: S.params.sort || "relevance" });
    var head = ["类型", "ID", "标题", "层级", "区域", "机关", "日期", "核验状态", "来源", "原文链接"];
    var lines = [head.join(",")];
    res.items.forEach(function (it) {
      var x = it.raw;
      lines.push([it._type === "policies" ? "政策" : "案例", x.id, x.title, U.levelName(x.level),
        U.regionText(x), x.issuer || x.organ || "", x.issuedAt || x.date || "",
        U.verificationName(x.verification), x.sourceName, x.sourceUrl].map(csvEscape).join(","));
    });
    U.download("浙江知识产权_检索结果_" + new Date().toISOString().slice(0, 10) + ".csv", "\uFEFF" + lines.join("\r\n"), "text/csv;charset=utf-8");
    U.toast("已导出 " + res.items.length + " 条结果");
  }
  function exportGaps() {
    var lines = ["设区市,区县（市）,待采集说明"];
    D.coverage.gaps.forEach(function (g) {
      lines.push([g.city, g.district, "采集该区县人民政府/市场监管局门户政策文件与案例"].map(csvEscape).join(","));
    });
    U.download("浙江知识产权_待采集区县清单.csv", "\uFEFF" + lines.join("\r\n"), "text/csv;charset=utf-8");
    U.toast("已导出 " + D.coverage.gaps.length + " 个待采集区县");
  }
  function exportData(what) {
    if (what === "bundle.js") {
      U.download("bundle.js", D.toBundle(), "application/javascript;charset=utf-8");
      U.toast("已导出整站数据包，覆盖 data/bundle.js 即可发布");
    } else if (what === "policies.json" || what === "cases.json") {
      var name = what.split(".")[0];
      U.download(what, JSON.stringify(name === "policies" ? D.policies : D.cases, null, 2), "application/json;charset=utf-8");
      U.toast("已导出 " + what);
    } else {
      U.download(what, "\uFEFF" + D.toCSV(what.split(".")[0]), "text/csv;charset=utf-8");
      U.toast("已导出 " + what);
    }
  }

  /* ---------- 后台操作 ---------- */
  function adminList() { return S.admin.kind === "policies" ? D.policies : D.cases; }
  function adminCommit(msg) {
    D.commitDraft(); rebuild();
    U.toast(msg || "已保存到本地草稿");
    render();
  }
  function adminNew() {
    var it = D.blank(S.admin.kind);
    it.title = "（新条目）请填写标题";
    it.summary = "请填写摘要";
    adminList().push(it);
    S.admin.id = it.id;
    adminCommit("已创建草稿条目，请补全字段后保存");
  }
  function adminDelete() {
    if (!S.admin.id) return;
    if (!confirm("确定删除条目 " + S.admin.id + "？此操作只影响本地草稿，可用「恢复站点数据」撤销。")) return;
    var list = adminList();
    var i = list.findIndex(function (x) { return x.id === S.admin.id; });
    if (i >= 0) list.splice(i, 1);
    S.admin.id = null;
    adminCommit("已删除");
  }
  function importCSV(file) {
    if (IS_PUBLIC) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var r = D.fromCSV(S.admin.kind, ev.target.result, true);
        rebuild();
        U.toast("导入成功：新增 " + r.added + " 条，更新 " + r.updated + " 条");
        render();
      } catch (err) { U.toast("导入失败：" + err.message); }
    };
    reader.readAsText(file, "UTF-8");
  }

  /* ---------- 事件 ---------- */
  function setParam(k, v, resetPage) {
    var o = {};
    o[k] = v;
    if (resetPage !== false) o.page = "";
    go(o);
  }
  function toggleFilter(dim, val, checked) {
    var cur = arr(dim);
    var i = cur.indexOf(val);
    if (checked && i < 0) cur.push(val);
    if (!checked && i >= 0) cur.splice(i, 1);
    setParam(dim, cur.length ? cur.join(",") : "");
  }

  function onClick(ev) {
    var t = ev.target;
    var el;

    if ((el = t.closest("[data-hot]"))) {
      var q = el.getAttribute("data-hot");
      location.hash = U.buildHash("search", { q: q });
      return;
    }
    if ((el = t.closest("#nav a"))) { $("#nav").classList.remove("open"); }

    if ((el = t.closest("[data-open]"))) {
      var parts = el.getAttribute("data-open").split(":");
      openDrawer(parts[0], parts.slice(1).join(":"));
      return;
    }
    if ((el = t.closest("[data-action]"))) {
      var a = el.getAttribute("data-action");
      /* 用户版不响应任何构建者动作（后台编辑、缺口导出、整站数据导出） */
      if (IS_PUBLIC && /^(admin-|export-gaps|export-data)/.test(a)) return;
      switch (a) {
        case "close-drawer": closeDrawer(); break;
        case "copy-link": {
          var id = el.getAttribute("data-id");
          /* 分享链接必须保留 sharecode 等查询参数，并强制为 user 角色，
             避免从工作台复制出去的链接丢凭证或误带后台角色。 */
          var q = location.search || "";
          if (!/([?&])role=/.test(q)) q += (q ? "&" : "?") + "role=user";
          else q = q.replace(/([?&])role=builder/, "$1role=user");
          var url = location.origin + location.pathname + q + U.buildHash(S.path, Object.assign({}, S.params, { id: id }));
          if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { U.toast("分享链接已复制"); },
            function () { U.toast("复制失败，请手动复制地址栏"); });
          else U.toast("请手动复制地址栏链接");
          break;
        }
        case "print-detail":
          document.body.classList.add("print-detail");
          window.onafterprint = function () { document.body.classList.remove("print-detail"); };
          window.print();
          setTimeout(function () { document.body.classList.remove("print-detail"); }, 800);
          break;
        case "print-match": window.print(); break;
        case "clear-filters": location.hash = U.buildHash(S.path, {}); break;
        case "toggle-filter": $("#filterCard").classList.toggle("open"); break;
        case "export-csv": exportResults(); break;
        case "export-gaps": exportGaps(); break;
        case "export-data": exportData(el.getAttribute("data-what")); break;
        case "match-reset": {
          S.match = { submitted: false, form: { city: "", district: "", stage: "", market: "", ipType: "", target: "", needs: [] }, policies: [], cases: [], steps: [] };
          render(); break;
        }
        case "admin-new": adminNew(); break;
        case "admin-delete": adminDelete(); break;
        case "admin-cancel": render(); break;
        case "admin-quality": $("#qualityBox").innerHTML = ZJ.admin.qualityHtml(); break;
        case "admin-clear": {
          if (!confirm("放弃全部本地草稿，恢复到站点正式数据？")) break;
          D.clearDraft(); rebuild(); S.admin.id = null; U.toast("已恢复站点数据"); render(); break;
        }
        case "admin-import": $("#csvFile").click(); break;
      }
      if (a === "close-drawer") return;
    }
    if (t.id === "overlay" || t.classList.contains("overlay")) { closeDrawer(); return; }

    if ((el = t.closest("[data-remove]"))) {
      var kv = el.getAttribute("data-remove").split(":");
      if (kv[0] === "q") setParam("q", "");
      else toggleFilter(kv[0], kv.slice(1).join(":"), false);
      return;
    }
    if ((el = t.closest("[data-more]"))) {
      var box = document.querySelector('[data-extra="' + el.getAttribute("data-more") + '"]');
      if (box) { box.style.display = "block"; el.style.display = "none"; }
      return;
    }
    if ((el = t.closest("[data-page]"))) {
      if (!el.disabled) setParam("page", el.getAttribute("data-page") === "1" ? "" : el.getAttribute("data-page"), false);
      return;
    }
    if ((el = t.closest("[data-drill]"))) {
      var dr = el.getAttribute("data-drill").split("|");
      location.hash = U.buildHash("search", { city: dr[0], district: dr[1] });
      return;
    }
    if ((el = t.closest("[data-admin-kind]"))) {
      S.admin.kind = el.getAttribute("data-admin-kind"); S.admin.id = null; render(); return;
    }
    if ((el = t.closest("[data-admin-row]"))) {
      S.admin.id = el.getAttribute("data-admin-row"); render(); return;
    }
    if (t.id === "navToggle") { $("#nav").classList.toggle("open"); return; }
  }

  function onChange(ev) {
    var t = ev.target, el;
    if ((el = t.closest("[data-filter]"))) {
      toggleFilter(el.getAttribute("data-filter"), el.value, el.checked); return;
    }
    if (t.name === "needs") { /* 由表单提交读取 */ return; }
    if ((el = t.closest("[data-check]"))) {
      var k = el.getAttribute("data-check");
      setParam(k, el.checked ? "1" : ""); return;
    }
    if ((el = t.closest("[data-select]"))) {
      setParam(el.getAttribute("data-select"), el.value); return;
    }
    if (t.id === "csvFile" && t.files && t.files[0]) { importCSV(t.files[0]); t.value = ""; return; }
    if (t.id === "matchCity") {
      captureMatchForm();
      S.match.form.city = t.value; S.match.form.district = "";
      render(); return;
    }
    if (t.id === "matchDistrict") { S.match.form.district = t.value; return; }
  }

  var onInput = U.debounce(function (ev) {
    var t = ev.target;
    if (t.id === "libQ") { S.focus = "libQ"; setParam("q", t.value.trim()); }
    else if (t.id === "adminQ") { S.admin.q = t.value.trim(); filterAdminRows(S.admin.q); }
  }, 320);

  function onSubmit(ev) {
    var f = ev.target;
    if (f.id === "heroSearch") {
      ev.preventDefault();
      var q = ($("#heroQ") || {}).value || "";
      location.hash = U.buildHash("search", { q: q.trim() });
      return;
    }
    if (f.id === "topSearch") {
      ev.preventDefault();
      var tq = ($("#topQ") || {}).value || "";
      location.hash = U.buildHash("search", { q: tq.trim() });
      return;
    }
    if (f.id === "matchForm") {
      ev.preventDefault();
      var fd = new FormData(f);
      var form = {
        city: fd.get("city") || "", district: fd.get("district") || "",
        stage: fd.get("stage") || "", market: fd.get("market") || "",
        ipType: fd.get("ipType") || "", target: fd.get("target") || "",
        needs: fd.getAll("needs") || []
      };
      S.match = computeMatch(form);
      render();
      setTimeout(function () { var r = $(".match-results"); if (r) r.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
      return;
    }
    if (f.id === "adminForm") {
      ev.preventDefault();
      if (IS_PUBLIC) return;
      var kind = f.elements._kind.value;
      var list = kind === "policies" ? D.policies : D.cases;
      var idx = list.findIndex(function (x) { return x.id === S.admin.id; });
      if (idx < 0) { U.toast("未选中条目"); return; }
      var obj = ZJ.admin.read(f, kind, list[idx]);
      if (!obj.title || !obj.summary) { U.toast("标题与摘要为必填项"); return; }
      list[idx] = obj;
      adminCommit("已保存 " + obj.id);
      return;
    }
  }

  /* ---------- 启动 ---------- */
  function boot() {
    try { D.init({ readDraft: !IS_PUBLIC }); } catch (err) {
      document.getElementById("app").innerHTML =
        '<div class="card pad"><h2>数据未加载</h2><p>' + U.esc(err.message) + "</p>" +
        (IS_PUBLIC ? "<p>请稍后刷新重试；若持续无法访问，请联系平台维护方。</p>" :
          "<p>请在项目目录运行 <code>python tools/build_data.py</code> 生成 data/bundle.js。</p>") + "</div>";
      return;
    }
    rebuild();
    /* ?live=1 开发态仅构建者可用；企业用户版永远读已发布的正式数据包 */
    if (!IS_PUBLIC) D.loadLive().then(function () { rebuild(); render(); });
    render();

    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    document.addEventListener("input", onInput);
    document.addEventListener("submit", onSubmit);
    global.addEventListener("hashchange", function () { hideDrawer(); render(); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") closeDrawer();
      if (ev.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        ev.preventDefault();
        var box = $("#topQ") || $("#heroQ") || $("#libQ");
        if (box) box.focus();
      }
    });
    var dz = null;
    document.addEventListener("dragover", function (ev) {
      dz = ev.target.closest ? ev.target.closest("#dropzone") : null;
      if (dz) { ev.preventDefault(); dz.classList.add("over"); }
    });
    document.addEventListener("dragleave", function (ev) {
      if (dz) dz.classList.remove("over");
    });
    document.addEventListener("drop", function (ev) {
      var zone = ev.target.closest ? ev.target.closest("#dropzone") : null;
      if (!zone) return;
      ev.preventDefault(); zone.classList.remove("over");
      if (ev.dataTransfer.files && ev.dataTransfer.files[0]) importCSV(ev.dataTransfer.files[0]);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  ZJ.app = { render: render, rebuild: rebuild, go: go, state: S, mode: MODE, isPublic: IS_PUBLIC };
})(window);
