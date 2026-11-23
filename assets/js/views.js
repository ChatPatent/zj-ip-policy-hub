/* 视图层（一）：首页 / 政策与案例库 / 详情抽屉 / 覆盖度看板 */
(function (global) {
  "use strict";
  var ZJ = global.ZJ = global.ZJ || {};
  var U = ZJ.util;
  var V = ZJ.views = ZJ.views || {};
  function e(s) { return U.esc(s); }
  function ic(n, s) { return U.icon(n, s); }

  function badgeLevel(lv) {
    return '<span class="badge level-' + e(lv) + '">' + e(U.levelName(lv)) + "</span>";
  }
  function badgeVer(v) {
    var t = U.verificationName(v);
    var cls = v === "verified" ? "verified" : (v === "demo" ? "demo" : "pending");
    var mark = v === "verified" ? "✓ " : (v === "pending" ? "! " : "◈ ");
    return '<span class="badge ' + cls + '" title="' + e(t) + '">' + mark + e(t) + "</span>";
  }
  function chips(list, cls, max) {
    list = (list || []).filter(Boolean);
    var n = max || 4;
    var out = list.slice(0, n).map(function (x) { return '<span class="chip ' + (cls || "") + '">' + e(x) + "</span>"; }).join("");
    if (list.length > n) out += '<span class="chip gray">+' + (list.length - n) + "</span>";
    return '<span class="chips">' + out + "</span>";
  }

  /* ==================== 首页 ==================== */
  V.home = function (ctx) {
    var d = ctx.data, p = d.coverage.province, isPub = !!ctx.isPublic;
    var all = d.policies.map(function (x) { return { x: x, t: "policies" }; })
      .concat(d.cases.map(function (x) { return { x: x, t: "cases" }; }))
      .sort(function (a, b) {
        return String(b.x.issuedAt || b.x.date || "").localeCompare(String(a.x.issuedAt || a.x.date || ""));
      });
    var latest = all.slice(0, 6);
    var stages = d.taxonomy.stages || [];
    var hot = ["海外维权", "商标抢注", "行政裁决", "海外发明专利补助", "TRO保险", "出海合规"];

    var html = '<section class="hero">' +
      '<div class="kicker">ZHEJIANG IP POLICY & CASE HUB · 面向中小微企业出海</div>' +
      "<h1>浙江省知识产权政策与案例<br>综合服务平台</h1>" +
      '<p class="lead">汇聚国家、省、市、区县四级知识产权政策与官方案例，按出海阶段精准匹配，让中小微企业找得到、看得懂、用得上政府政策与公益服务。</p>' +
      '<form class="hero-search" id="heroSearch">' +
        '<div class="hero-search-wrapper"><span class="search-ico">' + ic("search", 17) + "</span>" +
        '<input id="heroQ" type="search" placeholder="试试：海外维权资助、展会侵权、商标抢注预警…" autocomplete="off" aria-label="全站检索"></div>' +
        '<button class="btn teal" type="submit" style="padding:0 22px;background:#e2b661;border-color:#e2b661;color:#2c2110;font-weight:600">检索</button>' +
      "</form>" +
      '<div class="hero-quick"><span>热门：</span>' + hot.map(function (h) {
        return '<button type="button" data-hot="' + e(h) + '">' + e(h) + "</button>";
      }).join("") + "</div>" +
    "</section>";

    html += '<div class="stat-strip">' +
      statCard(d.policies.length, "条", "收录政策", "国家／省／市／区县四级") +
      statCard(d.cases.length, "条", "收录案例", "行政裁决 · 公益服务 · 海外维权") +
      (isPub ? statCard("4", "级", "政策覆盖层级", p.cityTotal + " 个设区市 · 上位政策全省适用") :
        statCard(p.coveredDistricts + " / " + p.districtTotal, "", "区县收录覆盖", p.cityTotal + " 个设区市 · 持续补录中")) +
      statCard(p.verified + " / " + (d.policies.length + d.cases.length), "", "已核验条目", "附官方原文链接 " + p.withSourceUrl + " 条") +
    "</div>";

    html += '<div class="section-head"><div><div class="eyebrow">' + (isPub ? "三大入口" : "四大入口") +
      '</div><h2>按你的需要进入</h2></div>' +
      '<a class="btn sm" href="' + ctx.href({ path: "sources" }) + '">' +
      (isPub ? "数据说明" : "数据来源与规范") + " " + ic("arrow", 14) + "</a></div>";
    html += '<div class="grid ' + (isPub ? "g3" : "g4") + ' mb16">' +
      tile("book", "政策库", "按层级、地区、主题、出海阶段、扶持方式多维筛选，条款与申报窗口一眼看清。", "policies", "进入政策库", ctx) +
      tile("scale", "案例库", "行政裁决、行政执法、公益服务、海外维权等官方案例，附企业可复用做法。", "cases", "进入案例库", ctx) +
      (isPub ? "" : tile("chart", "覆盖度看板", "省—市—县三级收录矩阵，缺口公开可见，形成可执行的采集任务清单。", "coverage", "查看覆盖度", ctx)) +
      tile("compass", "出海政策助手", "填写企业所在区县、出海阶段与目标市场，生成个性化政策清单与行动路径。", "match", "开始匹配", ctx) +
    "</div>";

    html += '<div class="section-head mt32"><div><div class="eyebrow">出海全流程</div><h2>按阶段找政策，而不是按文件名找</h2>' +
      '<div class="sub">平台把每一条政策、案例标注到企业出海的五个阶段，避免"知道有政策、不知道何时用"。</div></div></div>';
    html += '<div class="stage-row">' + stages.map(function (s) {
      var n = d.policies.filter(function (x) { return (x.stages || []).indexOf(s.id) >= 0; }).length +
              d.cases.filter(function (x) { return (x.stages || []).indexOf(s.id) >= 0; }).length;
      return '<div class="card stage-card"><b>' + e(s.name) + "</b><span>" + e(s.desc) + "</span>" +
        '<span class="cnt">' + n + " 条政策与案例 →</span></div>";
    }).join("") + "</div>";

    html += '<div class="grid g2 mt24">' +
      '<div class="card pad"><div class="section-head" style="margin-bottom:12px"><div><h2 style="font-size:18px">最近收录</h2></div>' +
      '<a class="btn sm" href="' + ctx.href({ path: "search", q: "" }) + '">全站检索</a></div>' +
      latest.map(function (o) {
        var x = o.x;
        return '<a class="qa-row" href="' + ctx.href({ path: o.t, id: x.id }) + '" style="color:inherit">' +
          badgeLevel(x.level) + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + e(x.title) + "</span>" +
          '<span class="tiny muted">' + e(U.formatDate(x.issuedAt || x.date, x.datePrecision)) + "</span></a>";
      }).join("") + "</div>" +
      '<div class="card pad"><div class="section-head" style="margin-bottom:12px"><div><h2 style="font-size:18px">中小微企业最关心的三件事</h2></div></div>' +
      '<div class="timeline">' +
        '<div class="tl-item"><b>出海前，钱和通道怎么找</b><p>海外发明专利省拨补助、专利预审＋PPH 快速获权、马德里国际注册窗口，都有明确的受理层级与年度窗口期。</p></div>' +
        '<div class="tl-item"><b>被起诉了，先找谁</b><p>国家级海外纠纷应对指导分中心与地方工作站提供公益监测预警、专家指导；行政裁决简易程序可在 30 日内结案。</p></div>' +
        '<div class="tl-item"><b>维权费用谁分担</b><p>多地对海外维权胜诉按代理费或维权费用 50% 左右资助，并配套知识产权保险与成本分担试点。</p></div>' +
      "</div>" +
      '<a class="btn sm teal mt8" href="' + ctx.href({ path: "match" }) + '">生成我的政策清单 ' + ic("arrow", 14) + "</a></div>" +
    "</div>";

    html += isPub
      ? '<div class="notice info mt24"><b>使用提示：</b>本平台为公益信息聚合与检索工具，每条政策与案例均标注来源、核验状态与原文链接。' +
        '「已核验」条目已核对官方来源；标注「待核验」的内容请先复核原文。政策适用、资格条件、金额与有效期一律以各级政府及其部门正式发布文本为准。' +
        ' <a href="' + ctx.href({ path: "sources" }) + '">了解数据说明与免责声明</a></div>'
      : '<div class="notice info mt24"><b>关于数据边界：</b>本平台为竞赛作品与公益信息聚合，已收录条目均标注来源与核验状态；' +
        '全省 ' + p.districtTotal + " 个县级行政区中尚有 " + d.coverage.gaps.length + " 个待采集，平台把缺口如实公开而非虚报覆盖。政策适用请以各级政府官方原文为准。" +
        ' <a href="' + ctx.href({ path: "sources" }) + '">查看数据来源与更新机制</a></div>';
    return html;
  };

  function statCard(num, unit, label, foot) {
    return '<div class="card stat-card"><div class="num">' + e(num) + (unit ? "<em>" + e(unit) + "</em>" : "") + "</div>" +
      '<div class="lbl">' + e(label) + '</div><div class="foot">' + e(foot) + "</div></div>";
  }
  function tile(icon, title, desc, path, go, ctx) {
    return '<a class="card tile" href="' + ctx.href({ path: path }) + '" style="color:inherit">' +
      '<div class="tile-ico">' + ic(icon, 20) + "</div><h3>" + e(title) + "</h3><p>" + e(desc) +
      '</p><span class="go">' + e(go) + " " + ic("arrow", 13) + "</span></a>";
  }

  /* ==================== 政策 / 案例库 ==================== */
  function filterGroup(title, name, values, selected, ctx, max) {
    var counts = ctx.facets[name] || {};
    var lim = max || 8;
    var list = values.slice(0, lim).map(function (v) {
      var val = typeof v === "string" ? v : v.v;
      var lab = typeof v === "string" ? v : v.n;
      var on = selected.indexOf(val) >= 0;
      return '<label class="opt"><input type="checkbox" data-filter="' + e(name) + '" value="' + e(val) + '"' + (on ? " checked" : "") + ">" +
        "<span>" + e(lab) + '</span><span class="cnt">' + (counts[val] || 0) + "</span></label>";
    }).join("");
    if (values.length > lim) {
      list += '<div class="opt more" data-more="' + e(name) + '">展开全部 ' + values.length + " 项 ↓</div>";
      list += '<div data-extra="' + e(name) + '" style="display:none">' + values.slice(lim).map(function (v) {
        var val = typeof v === "string" ? v : v.v;
        var lab = typeof v === "string" ? v : v.n;
        return '<label class="opt"><input type="checkbox" data-filter="' + e(name) + '" value="' + e(val) + '"' +
          (selected.indexOf(val) >= 0 ? " checked" : "") + "><span>" + e(lab) + '</span><span class="cnt">' + (counts[val] || 0) + "</span></label>";
      }).join("") + "</div>";
    }
    return '<div class="filter-group"><b>' + e(title) + "</b>" + list + "</div>";
  }

  V.library = function (ctx) {
    var p = ctx.params, kind = ctx.kind;
    var title = kind === "policies" ? "政策库" : (kind === "cases" ? "案例库" : "全站检索");
    var sub = kind === "policies" ? "按层级、地区、主题与出海阶段筛选，查看条款要点、扶持口径与申报窗口。" :
      kind === "cases" ? "行政裁决、行政执法、公益服务与海外维权案例，附企业可复用做法。" :
      "政策与案例统一检索，支持中文短语、同义词与文号命中。";
    var sel = function (k) { return (p[k] || "").split(",").filter(Boolean); };
    var d = ctx.data;
    var cities = (d.regions.cities || []).map(function (c) { return c.name; });
    var dists = [];
    (d.regions.cities || []).forEach(function (c) {
      if (sel("city").indexOf(c.name) >= 0 || sel("city").length === 0)
        (c.districts || []).forEach(function (x) { dists.push(x); });
    });
    var cats = kind === "cases" ? d.taxonomy.caseTypes : d.taxonomy.policyCategories;
    var years = ["2026", "2025", "2024", "2023", "2022", "2021"];

    var html = '<div class="section-head"><div><div class="eyebrow">POLICY & CASE LIBRARY</div><h2>' + e(title) + "</h2>" +
      '<div class="sub">' + e(sub) + "</div></div>" +
      '<div class="btn-row"><a class="btn sm" href="' + ctx.href({ path: "match" }) + '">' + ic("compass", 15) + " 出海助手</a>" +
      (ctx.isPublic ? "" : '<a class="btn sm" href="' + ctx.href({ path: "coverage" }) + '">' + ic("chart", 15) + " 覆盖度</a>") +
      "</div></div>";

    html += '<div class="layout"><aside class="sidebar"><div class="card filter-card" id="filterCard">' +
      '<h3>筛选条件 <button class="btn sm ghost" data-action="clear-filters" style="padding:2px 8px">重置</button></h3>' +
      '<div class="filter-group"><b>全站检索</b><input class="input" id="libQ" type="search" placeholder="关键词／文号／机关" value="' + e(p.q || "") + '"></div>' +
      filterGroup("政策层级", "level", (d.taxonomy.levels || []).map(function (x) { return { v: x.id, n: x.name }; }), sel("level"), ctx, 6) +
      filterGroup("设区市", "city", cities, sel("city"), ctx, 6) +
      (dists.length ? '<div class="filter-group"><b>区县（市）</b><select class="select" data-select="district"><option value="">全部区县</option>' +
        dists.map(function (x) { return '<option value="' + e(x) + '"' + (sel("district").indexOf(x) >= 0 ? " selected" : "") + ">" + e(x) + "</option>"; }).join("") +
        "</select></div>" : "") +
      filterGroup(kind === "cases" ? "案例类型" : "政策类别", kind === "cases" ? "ctype" : "category", cats || [], sel(kind === "cases" ? "ctype" : "category"), ctx, 6) +
      filterGroup("出海阶段", "stages", (d.taxonomy.stages || []).map(function (x) { return { v: x.id, n: x.name.split("·")[0] }; }), sel("stages"), ctx, 6) +
      filterGroup("适用主体", "targets", d.taxonomy.targets || [], sel("targets"), ctx, 5) +
      (kind !== "cases" ? filterGroup("支持方式", "supportType", d.taxonomy.supportTypes || [], sel("supportType"), ctx, 5) : "") +
      filterGroup("目标市场", "markets", d.taxonomy.markets || [], sel("markets"), ctx, 5) +
      filterGroup("发布年份", "year", years, sel("year"), ctx, 6) +
      filterGroup("核验状态", "verification", (d.taxonomy.verification || []).map(function (x) { return { v: x.id, n: x.name }; }), sel("verification"), ctx, 4) +
      '<div class="filter-group"><label class="opt"><input type="checkbox" data-check="strictRegion"' + (p.strictRegion === "1" ? " checked" : "") + '><span>仅看本级发布（不含上位适用）</span></label></div>' +
      "</div>" +
      '<div class="notice info" style="font-size:12px">上位层级政策对下位区域同样适用，因此筛选某区县时，省级与市级政策也会一并出现。</div>' +
      "</aside>";

    html += '<main><div class="toolbar">' +
      '<div class="count">命中 <b>' + ctx.result.total + "</b> 条 · 检索耗时 " + ctx.result.took + " ms" +
      (ctx.result.expanded.length ? " · 已扩展同义词 " + ctx.result.expanded.length + " 个" : "") + "</div>" +
      '<select class="select" data-select="sort" style="width:auto;min-width:130px">' +
        option("relevance", "按相关度", p.sort) + option("date", "按发布时间", p.sort) +
        option("level", "按层级", p.sort) + option("support", "按扶持力度", p.sort) + "</select>" +
      '<button class="btn sm" data-action="export-csv">' + ic("download", 14) + " 导出结果</button>" +
      '<button class="btn sm" data-action="toggle-filter" style="display:none" id="mobileFilter">' + ic("menu", 14) + " 筛选</button>" +
      "</div>";

    var active = [];
    var labels = { level: "层级", city: "地市", district: "区县", category: "类别", ctype: "类型", stages: "阶段", targets: "主体", supportType: "方式", markets: "市场", year: "年份", verification: "核验" };
    Object.keys(labels).forEach(function (k) {
      sel(k).forEach(function (v) {
        var lab = v;
        if (k === "level") lab = U.levelName(v);
        if (k === "stages") lab = ((d.taxonomy.stages || []).filter(function (s) { return s.id === v; })[0] || {}).name || v;
        if (k === "verification") lab = U.verificationName(v);
        active.push('<span class="chip blue" data-remove="' + e(k) + ":" + e(v) + '">' + e(labels[k] + "：" + lab) + " ×</span>");
      });
    });
    if (p.q) active.unshift('<span class="chip amber" data-remove="q">' + e("关键词：" + p.q) + " ×</span>");
    if (active.length) html += '<div class="active-filters">' + active.join("") + "</div>";

    var items = ctx.result.items.slice((ctx.page - 1) * ctx.pageSize, ctx.page * ctx.pageSize);
    html += '<div class="result-list">' + (items.length ? items.map(function (it) { return renderItem(it, ctx); }).join("") :
      U.emptyBox("没有找到匹配内容", "试试减少筛选条件，或换一个更短的关键词；平台支持同义词扩展。")) + "</div>";
    html += pager(ctx);
    html += "</main></div>";
    return html;
  };

  function option(v, label, cur) { return '<option value="' + e(v) + '"' + (cur === v ? " selected" : "") + ">" + e(label) + "</option>"; }

  function renderItem(it, ctx) {
    var x = it.raw, isPolicy = it._type === "policies";
    var terms = ctx.result.terms;
    var h = '<article class="card item" data-open="' + e(it._type + ":" + x.id) + '" tabindex="0">';
    if (ctx.params.q) h += '<div class="score">相关度 ' + it._score.toFixed(1) + "</div>";
    h += '<div class="item-top">' + badgeLevel(x.level) + badgeVer(x.verification) +
      (isPolicy ? '<span class="chip">' + e(x.category || "") + "</span>" :
        '<span class="chip teal">' + e(x.type || "") + "</span>" + (x.overseas ? '<span class="chip amber">涉外</span>' : "")) +
      "</div>";
    h += "<h3>" + U.highlight(x.title, terms) + "</h3>";
    h += '<div class="desc">' + U.highlight(x.summary, terms) + "</div>";
    if (isPolicy && x.supportDetail) {
      h += '<div class="support-line">' + ic("tag", 13) + " " + U.highlight(U.clip(x.supportDetail, 130), terms) + "</div>";
    }
    if (!isPolicy && x.result) {
      h += '<div class="support-line" style="background:#eef5fb;color:#1c5686">' + ic("check", 13) + " " + U.highlight(U.clip(x.result, 130), terms) + "</div>";
    }
    h += '<div class="meta mt8">' +
      "<span>" + ic("building", 13) + " " + e(U.regionText(x)) + "</span>" +
      "<span>" + ic("calendar", 13) + " " + e(U.formatDate(x.issuedAt || x.date, x.datePrecision)) + "</span>" +
      "<span>" + e(isPolicy ? (x.issuer || "") : (x.organ || "")) + "</span>" +
      (x.docNo ? "<span>文号 " + e(x.docNo) + "</span>" : "") +
      "</div>";
    h += '<div class="mt8">' + chips(isPolicy ? x.topics : (x.takeaways || []).slice(0, 2), isPolicy ? "blue" : "gray", 3) + "</div>";
    if (ctx.params.q && it._why.length) h += '<div class="tiny muted mt8">命中依据：' + e(it._why.slice(0, 3).join(" · ")) + "</div>";
    h += "</article>";
    return h;
  }

  function pager(ctx) {
    var total = Math.ceil(ctx.result.total / ctx.pageSize);
    if (total <= 1) return "";
    var cur = ctx.page, out = [];
    for (var i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - cur) <= 2) out.push(i);
      else if (out[out.length - 1] !== "…") out.push("…");
    }
    return '<div class="pager">' +
      '<button data-page="' + (cur - 1) + '"' + (cur <= 1 ? " disabled" : "") + ">上一页</button>" +
      out.map(function (i) {
        return i === "…" ? '<button disabled>…</button>' :
          '<button data-page="' + i + '" class="' + (i === cur ? "cur" : "") + '">' + i + "</button>";
      }).join("") +
      '<button data-page="' + (cur + 1) + '"' + (cur >= total ? " disabled" : "") + ">下一页</button></div>";
  }

  /* ==================== 详情抽屉 ==================== */
  V.detail = function (it, mode) {
    var isPub = mode ? mode === "public" : !!(ZJ.app && ZJ.app.isPublic);
    var x = it.raw, isPolicy = it._type === "policies";
    var h = '<div class="drawer-head"><div><div class="chips mb8">' + badgeLevel(x.level) + badgeVer(x.verification) +
      (isPolicy ? '<span class="chip">' + e(x.category) + "</span>" : '<span class="chip teal">' + e(x.type) + "</span>" +
        (x.overseas ? '<span class="chip amber">涉外案例</span>' : "")) + "</div>" +
      "<h2>" + e(x.title) + "</h2></div>" +
      '<button class="drawer-close" data-action="close-drawer" aria-label="关闭">×</button></div>';

    h += '<div class="drawer-body">';
    if (x.verification === "pending") h += '<div class="notice warn mb16">' + ic("alert", 15) +
      " 本条为<b>待核验</b>条目：线索来自公开报道，尚未核对正式原文或文号。用于决策前请点击原文链接或咨询发文机关复核。</div>";
    if (x.verification === "demo") h += '<div class="notice warn mb16">' + ic("alert", 15) +
      " 本条为<b>示范条目</b>，用于演示数据结构，不代表真实政策或案例，禁止作为决策依据。</div>";
    if (!x.sourceUrl) h += '<div class="notice info mb16">' + ic("info", 15) +
      (isPub ? " 该条目的官方原文链接尚待补录，建议直接向发文机关核实后使用。" :
        " 原文链接待补录。可通过平台数据后台补充 sourceUrl 字段后重新构建。") + "</div>";

    h += '<dl class="kv">';
    var rows = isPolicy ? [
      ["发文机关", x.issuer], ["文号", x.docNo || "—"], ["层级", U.levelName(x.level)],
      ["适用区域", U.regionText(x)], ["发布日期", U.formatDate(x.issuedAt, x.datePrecision)],
      ["施行日期", U.formatDate(x.effectiveFrom, x.datePrecision)],
      ["有效期至", x.effectiveTo ? U.formatDate(x.effectiveTo, x.datePrecision) : "长期／依条款"],
      ["效力状态", x.status], ["支持方式", x.supportType], ["申报窗口", x.applyWindow], ["联系渠道", x.contact || "—"]
    ] : [
      ["办案／服务机构", x.organ], ["案例类型", x.type], ["层级", U.levelName(x.level)],
      ["适用区域", U.regionText(x)], ["时间", U.formatDate(x.date, x.datePrecision)],
      ["涉及产业", x.industry], ["权利类型", x.ipType],
      ["是否涉外", x.overseas ? "是" : "否"], ["目标市场", (x.markets || []).join("、") || "—"]
    ];
    rows.forEach(function (r) { h += "<dt>" + e(r[0]) + "</dt><dd>" + e(r[1] || "—") + "</dd>"; });
    h += "</dl>";

    if (isPolicy) {
      h += block("政策要点", x.summary);
      if (x.supportDetail) h += '<div class="notice ok mt16"><b>扶持／支持口径</b><br>' + e(x.supportDetail) + "</div>";
      if ((x.highlights || []).length) h += blockList("条款速览（重点摘录）", x.highlights);
      h += "<div class='detail-block'><h3>分类标签</h3>" + chips((x.topics || []).concat(x.targets || []), "blue", 12) + "</div>";
      h += "<div class='detail-block'><h3>适用出海阶段</h3>" + stageText(x.stages, ZJ.data.taxonomy) + "</div>";
    } else {
      h += block("案例概要", x.summary);
      if (x.facts) h += block("基本案情／服务过程", x.facts);
      if (x.result) h += block("处理结果", x.result);
      if (x.insight) h += block("对企业的启示", x.insight);
      if ((x.takeaways || []).length) h += blockList("可复用做法", x.takeaways);
      if ((x.legalBasis || []).length) h += blockList("主要依据", x.legalBasis);
      h += "<div class='detail-block'><h3>适用出海阶段</h3>" + stageText(x.stages, ZJ.data.taxonomy) + "</div>";
    }
    h += '<div class="detail-block"><h3>来源与核验</h3><p>' + e(x.sourceName || "—") + "</p>" +
      '<p class="tiny muted">核验状态：' + e(U.verificationName(x.verification)) +
      " · 核验日期：" + e(x.verifiedAt || "—") + (isPub ? "" : " · 条目 ID：" + e(x.id)) + "</p>" +
      (x.sourceUrl ? '<a class="btn sm mt8" target="_blank" rel="noopener noreferrer" href="' + e(x.sourceUrl) + '">' +
        ic("external", 14) + " 查看官方原文</a>" : "") + "</div>";
    h += '<div class="notice warn mt16" style="font-size:12px">免责声明：本页为信息聚合与要点摘录，不构成法律意见。政策适用、申报条件与金额以发文机关正式文本及当年度申报通知为准。</div>';
    h += "</div>";

    h += '<div class="drawer-foot">' +
      '<button class="btn sm" data-action="copy-link" data-id="' + e(x.id) + '">' + ic("copy", 14) + " 复制分享链接</button>" +
      (x.sourceUrl ? '<a class="btn sm primary" target="_blank" rel="noopener noreferrer" href="' + e(x.sourceUrl) + '">官方原文 ' + ic("external", 14) + "</a>" : "") +
      '<button class="btn sm" data-action="print-detail">打印／存为 PDF</button>' +
      "</div>";
    return h;
  };

  function block(title, text) {
    return '<div class="detail-block"><h3>' + e(title) + "</h3><p>" + e(text || "—") + "</p></div>";
  }
  function blockList(title, list) {
    return '<div class="detail-block"><h3>' + e(title) + "</h3><ul>" +
      (list || []).map(function (x) { return "<li>" + e(x) + "</li>"; }).join("") + "</ul></div>";
  }
  function stageText(ids, tax) {
    if (!ids || !ids.length) return '<span class="muted small">未标注</span>';
    return '<div class="chips">' + ids.map(function (id) {
      var s = (tax.stages || []).filter(function (x) { return x.id === id; })[0];
      return s ? '<span class="chip teal" title="' + e(s.desc) + '">' + e(s.name) + "</span>" : "";
    }).join("") + "</div>";
  }

  /* ==================== 覆盖度看板 ==================== */
  V.coverage = function (ctx) {
    var c = ctx.data.coverage, p = c.province;
    var html = '<div class="section-head"><div><div class="eyebrow">COVERAGE DASHBOARD</div><h2>省—市—县三级收录覆盖度</h2>' +
      '<div class="sub">把"全网覆盖"做成可度量、可持续推进的指标：已收录的公开，未收录的也公开，缺口即采集任务清单。</div></div>' +
      '<button class="btn sm" data-action="export-gaps">' + ic("download", 14) + " 导出待采集清单</button></div>";

    html += '<div class="stat-strip">' +
      statCard(p.cityTotal ? c.cities.filter(function (x) { return x.total > 0; }).length : 0, " / " + p.cityTotal, "已覆盖设区市", "按属地条目统计") +
      statCard(p.coveredDistricts, " / " + p.districtTotal, "已覆盖区县", "覆盖率 " + Math.round(p.coveredDistricts / p.districtTotal * 100) + "%") +
      statCard(c.gaps.length, "个", "待采集区县", "下一阶段任务清单") +
      statCard(p.withSourceUrl, "条", "附官方原文链接", "另有 " + p.pending + " 条待核验") +
    "</div>";

    html += '<div class="grid g2 mt16">' +
      '<div class="card pad"><h3 style="font-size:16px" class="mb16">按发布层级分布</h3>' +
      [["国家层面", p.national], ["省级", p.provinceLevel], ["市级", p.cityLevel], ["区县级", p.countyLevel]].map(function (r) {
        var max = Math.max(p.national, p.provinceLevel, p.cityLevel, p.countyLevel, 1);
        return '<div class="bar-row"><span class="name">' + e(r[0]) + '</span><div class="bar-track"><div class="bar-fill" style="width:' +
          (r[1] / max * 100) + '%"></div></div><span class="val">' + r[1] + "</span></div>";
      }).join("") +
      '<div class="divider"></div><p class="small muted">说明：上位层级政策对全省适用，因此"区县覆盖度"仅统计明确标注到该区县的条目，不代表该地区没有可用政策。</p></div>' +
      '<div class="card pad"><h3 style="font-size:16px" class="mb16">数据可信度构成</h3>' +
      [["已核验", p.verified, "#0e8f83"], ["待核验", p.pending, "#d9822b"], ["示范条目", p.demo, "#8b6bb1"]].map(function (r) {
        var total = Math.max(p.verified + p.pending + p.demo, 1);
        return '<div class="bar-row"><span class="name">' + e(r[0]) + '</span><div class="bar-track"><div class="bar-fill" style="width:' +
          (r[1] / total * 100) + "%;background:" + r[2] + '"></div></div><span class="val">' + r[1] + "</span></div>";
      }).join("") +
      '<div class="divider"></div><p class="small muted">每条记录均带来源名称、原文链接、核验状态与核验日期；缺链接或待核验的条目在前台显著提示。</p>' +
      '<a class="btn sm mt8" href="' + ctx.href({ path: "sources" }) + '">查看数据规范 ' + ic("arrow", 14) + "</a></div></div>";

    html += '<div class="section-head mt32"><div><h2 style="font-size:20px">11 个设区市 · 90 个县级行政区</h2>' +
      '<div class="sub">颜色越深表示属地条目越多；点击有色格子可查看该区县已收录内容。</div></div>' +
      '<div class="coverage-legend"><span><i class="legend-dot lv-3"></i>≥3 条</span><span><i class="legend-dot lv-2"></i>2 条</span>' +
      '<span><i class="legend-dot lv-1"></i>1 条</span><span><i class="legend-dot lv-0"></i>待采集</span></div></div>';
    html += '<div class="grid g2">' + c.cities.map(function (city) {
      return '<div class="card city-block"><h3>' + e(city.name) +
        '<small>属地条目 ' + city.total + " · 已覆盖 " + city.coveredDistricts + "/" + city.districtTotal + " 个区县</small></h3>" +
        '<div class="dist-grid">' + city.districts.map(function (d) {
          var cls = d.total >= 3 ? "s3" : (d.total === 2 ? "s2" : (d.total === 1 ? "s1" : ""));
          return '<div class="dist ' + cls + '"' + (d.total ? ' data-drill="' + e(city.name + "|" + d.name) + '" style="cursor:pointer"' : "") +
            ' title="' + e(d.name + "：" + d.policies + " 条政策 / " + d.cases + " 条案例") + '">' + e(d.name) + "</div>";
        }).join("") + "</div></div>";
    }).join("") + "</div>";

    html += '<div class="card pad mt24"><h3 style="font-size:18px" class="mb8">待采集区县清单（' + c.gaps.length + " 个）</h3>" +
      '<p class="small muted">建议学生团队按设区市分工，从各区县人民政府、市场监管局门户的"政策文件／知识产权／专项资金"栏目采集，经核验后通过数据后台批量导入。</p>' +
      '<div class="chips mt8">' + c.gaps.slice(0, 60).map(function (g) {
        return '<span class="chip gray">' + e(g.city + " · " + g.district) + "</span>";
      }).join("") + (c.gaps.length > 60 ? '<span class="chip">+' + (c.gaps.length - 60) + " 个，导出查看全部</span>" : "") + "</div></div>";
    return html;
  };
})(window);
