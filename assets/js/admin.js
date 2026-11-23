/* 数据管理后台：逐条编辑 / CSV 批量导入 / 导出发布 / 质量检查
   说明：浏览器不能直接写本地文件，因此采用「本地草稿（localStorage）+ 导出文件覆盖」的发布闭环。 */
(function (global) {
  "use strict";
  var ZJ = global.ZJ = global.ZJ || {};
  var U = ZJ.util;
  var D = ZJ.data;
  var A = ZJ.admin = {};

  var LONG = { summary: 1, supportDetail: 1, facts: 1, result: 1, insight: 1, applyWindow: 1, contact: 1 };
  var CHECKBOX = { stages: 1, targets: 1, markets: 1 };
  var SELECTS = {
    level: ["national", "province", "city", "county"],
    verification: ["verified", "pending", "demo"],
    datePrecision: ["day", "month", "year"],
    category: null, type: null, supportType: null, industry: null, ipType: null, status: null
  };
  var LABELS = {
    id: "条目 ID", title: "标题", docNo: "文号", level: "政策层级", region: "适用区域",
    issuer: "发文机关", issuedAt: "发布日期", effectiveFrom: "施行日期", effectiveTo: "有效期至",
    status: "效力状态", category: "政策类别", topics: "主题标签", stages: "适用出海阶段",
    targets: "适用主体", supportType: "支持方式", supportDetail: "扶持口径／支持内容",
    summary: "摘要", highlights: "条款速览", applyWindow: "申报窗口", contact: "联系渠道",
    sourceName: "来源名称", sourceUrl: "原文链接", verification: "核验状态", verifiedAt: "核验日期",
    keywords: "检索关键词", datePrecision: "日期精度",
    type: "案例类型", organ: "办案／服务机构", date: "案例时间", industry: "涉及产业",
    ipType: "权利类型", overseas: "是否涉外", markets: "目标市场", facts: "基本案情／服务过程",
    result: "处理结果", insight: "对企业的启示", legalBasis: "主要依据", takeaways: "可复用做法"
  };

  function label(f) { return LABELS[f] || f; }

  function optionsFor(field) {
    var t = ZJ.data.taxonomy;
    if (field === "level") return (t.levels || []).map(function (x) { return { v: x.id, n: x.name }; });
    if (field === "verification") return (t.verification || []).map(function (x) { return { v: x.id, n: x.name }; });
    if (field === "datePrecision") return [{ v: "day", n: "精确到日" }, { v: "month", n: "精确到月" }, { v: "year", n: "精确到年" }];
    if (field === "category") return (t.policyCategories || []).map(function (x) { return { v: x, n: x }; });
    if (field === "type") return (t.caseTypes || []).map(function (x) { return { v: x, n: x }; });
    if (field === "supportType") return (t.supportTypes || []).map(function (x) { return { v: x, n: x }; });
    if (field === "industry") return (t.industries || []).map(function (x) { return { v: x, n: x }; });
    if (field === "ipType") return (t.ipTypes || []).map(function (x) { return { v: x, n: x }; });
    if (field === "status") return ["现行有效", "试行并修订中", "推进实施中", "持续运行", "阶段性申报", "已过申报期", "已废止", "待核验"]
      .map(function (x) { return { v: x, n: x }; });
    if (field === "stages") return (t.stages || []).map(function (x) { return { v: x.id, n: x.name }; });
    if (field === "targets") return (t.targets || []).map(function (x) { return { v: x, n: x }; });
    if (field === "markets") return (t.markets || []).map(function (x) { return { v: x, n: x }; });
    return [];
  }

  function renderField(kind, f, it) {
    var v = it[f], id = "f_" + f, lb = label(f);
    if (f === "region") {
      var cities = (ZJ.data.regions.cities || []).map(function (c) { return c.name; });
      return '<label class="field full"><span>' + e(lb) + '（设区市）</span><select class="select" name="city">' +
        '<option value="">省级／国家层面（不下设）</option>' + cities.map(function (c) {
          return '<option value="' + e(c) + '"' + ((it.region || {}).city === c ? " selected" : "") + ">" + e(c) + "</option>";
        }).join("") + "</select></label>" +
        '<label class="field full"><span>区县（市）</span><input class="input" name="district" list="districtList" value="' +
        e((it.region || {}).district || "") + '" placeholder="如：滨江区；留空表示市级／省级"><datalist id="districtList">' +
        (ZJ.data.regions.cities || []).reduce(function (arr, c) { return arr.concat(c.districts || []); }, [])
          .map(function (d) { return '<option value="' + e(d) + '">'; }).join("") + "</datalist></label>";
    }
    if (f === "overseas") {
      return '<label class="field full"><span>' + e(lb) + '</span><label class="opt"><input type="checkbox" name="overseas"' +
        (v ? " checked" : "") + '><span>是（涉外／海外案例）</span></label></label>';
    }
    if (CHECKBOX[f]) {
      var vals = v || [];
      return '<div class="field full"><span>' + e(lb) + '（可多选）</span><div class="chips mt8">' +
        optionsFor(f).map(function (o) {
          return '<label class="opt" style="display:inline-flex;background:#f5f8fb;border-radius:20px;padding:4px 11px;margin:3px">' +
            '<input type="checkbox" name="' + f + '" value="' + e(o.v) + '"' + (vals.indexOf(o.v) >= 0 ? " checked" : "") +
            '><span>' + e(o.n) + "</span></label>";
        }).join("") + "</div></div>";
    }
    if (f === "id" || f === "verifiedAt") {
      return '<label class="field"><span>' + e(lb) + '</span><input class="input" name="' + f + '" value="' + e(v || "") + '"' +
        (f === "id" ? " readonly" : "") + "></label>";
    }
    if (SELECTS[f] && optionsFor(f).length) {
      return '<label class="field"><span>' + e(lb) + '</span><select class="select" name="' + f + '">' +
        '<option value="">— 请选择 —</option>' + optionsFor(f).map(function (o) {
          return '<option value="' + e(o.v) + '"' + (v === o.v ? " selected" : "") + ">" + e(o.n) + "</option>";
        }).join("") + "</select></label>";
    }
    if (D.ARRAY_FIELDS[f]) {
      return '<label class="field full"><span>' + e(lb) + '（每行一项）</span>' +
        '<textarea class="textarea" name="' + f + '" rows="3" placeholder="每行填写一项">' + e((v || []).join("\n")) + "</textarea></label>";
    }
    if (LONG[f]) {
      return '<label class="field full"><span>' + e(lb) + '</span><textarea class="textarea" name="' + f + '" rows="' +
        (f === "summary" ? 3 : 4) + '">' + e(v || "") + "</textarea></label>";
    }
    return '<label class="field' + (f === "title" || f === "sourceUrl" || f === "sourceName" ? " full" : "") +
      '"><span>' + e(lb) + '</span><input class="input" name="' + f + '" value="' + e(v || "") + '"' +
      (f.indexOf("At") >= 0 || f === "date" || f === "effectiveFrom" || f === "effectiveTo" ? ' placeholder="YYYY-MM-DD"' : "") + "></label>";
  }

  function e(s) { return U.esc(s); }

  /* 编辑表单（供局部刷新） */
  A.form = function (kind, it) {
    if (!it) return '<div class="empty">从左侧选择一条记录，或点击「新增条目」。</div>';
    var fields = kind === "policies" ? D.POLICY_FIELDS : D.CASE_FIELDS;
    var groups = [
      { t: "基本信息", fs: ["id", "title", "level", "region", "verification", "verifiedAt", "datePrecision"] },
      { t: kind === "policies" ? "政策属性" : "案例属性",
        fs: kind === "policies" ? ["docNo", "issuer", "issuedAt", "effectiveFrom", "effectiveTo", "status", "category", "supportType"]
                               : ["type", "organ", "date", "industry", "ipType", "overseas"] },
      { t: "分类标注", fs: ["topics", "stages", "targets", "markets", "keywords"].filter(function (f) { return fields.indexOf(f) >= 0; }) },
      { t: "内容字段", fs: ["summary", "highlights", "supportDetail", "applyWindow", "contact", "facts", "result", "insight", "takeaways", "legalBasis"]
          .filter(function (f) { return fields.indexOf(f) >= 0; }) },
      { t: "来源与溯源", fs: ["sourceName", "sourceUrl"] }
    ];
    var html = '<form id="adminForm"><input type="hidden" name="_kind" value="' + e(kind) + '">';
    groups.forEach(function (g) {
      html += '<div class="detail-block" style="margin-top:16px"><h3>' + e(g.t) + '</h3><div class="form-grid">' +
        g.fs.map(function (f) { return renderField(kind, f, it); }).join("") + "</div></div>";
    });
    html += '<div class="btn-row mt24"><button class="btn primary" type="submit">' + U.icon("check", 15) + " 保存到本地草稿</button>" +
      '<button class="btn danger" type="button" data-action="admin-delete">删除本条</button>' +
      '<button class="btn" type="button" data-action="admin-cancel">放弃修改</button></div></form>';
    return html;
  };

  /* 从表单读回对象 */
  A.read = function (form, kind, base) {
    var fields = kind === "policies" ? D.POLICY_FIELDS : D.CASE_FIELDS;
    var o = JSON.parse(JSON.stringify(base || {}));
    fields.forEach(function (f) {
      if (f === "region") {
        o.region = { city: form.elements.city ? form.elements.city.value.trim() : "",
                     district: form.elements.district ? form.elements.district.value.trim() : "" };
      } else if (f === "overseas") {
        o.overseas = !!(form.elements.overseas && form.elements.overseas.checked);
      } else if (CHECKBOX[f]) {
        var boxes = form.querySelectorAll('input[name="' + f + '"]:checked');
        o[f] = Array.prototype.map.call(boxes, function (b) { return b.value; });
      } else if (D.ARRAY_FIELDS[f]) {
        var el = form.elements[f];
        o[f] = el ? el.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean) : [];
      } else {
        var input = form.elements[f];
        o[f] = input ? input.value.trim() : "";
      }
    });
    return o;
  };

  A.qualityHtml = function () {
    var issues = D.quality();
    var err = issues.filter(function (x) { return x.level === "err"; }).length;
    var warn = issues.length - err;
    return '<div class="notice ' + (err ? "warn" : "ok") + ' mb16"><b>质量检查：</b>错误 ' + err +
      " 项，提示 " + warn + " 项，共扫描 " + (D.policies.length + D.cases.length) + " 条记录。</div>" +
      (issues.length ? '<div style="max-height:280px;overflow:auto">' + issues.slice(0, 60).map(function (x) {
        return '<div class="qa-row"><span class="' + (x.level === "err" ? "err" : "warn") + '">' +
          (x.level === "err" ? "✗" : "·") + "</span><b style='min-width:110px'>" + e(x.id) +
          "</b><span>" + e(x.msg) + "</span></div>";
      }).join("") + (issues.length > 60 ? '<p class="small muted">仅显示前 60 项</p>' : "") + "</div>" :
        '<p class="small muted">未发现问题。</p>');
  };

  A.view = function (ctx) {
    var kind = ctx.admin.kind || "policies";
    var list = kind === "policies" ? D.policies : D.cases;
    var kw = (ctx.admin.q || "").trim();
    var shown = kw ? list.filter(function (x) { return (x.title || "").indexOf(kw) >= 0 || (x.id || "").indexOf(kw) >= 0; }) : list;
    var current = list.filter(function (x) { return x.id === ctx.admin.id; })[0] || null;

    var html = '<div class="section-head"><div><div class="eyebrow">DATA CONSOLE</div><h2>数据管理后台</h2>' +
      '<div class="sub">录入、校验、批量导入与发布。所有修改先存为浏览器本地草稿，导出后覆盖站点数据文件即可上线。</div></div>' +
      '<a class="btn sm" href="' + ctx.href({ path: "sources" }) + '">数据规范 ' + U.icon("arrow", 14) + "</a></div>";

    html += '<div class="notice ' + (D.hasDraft() ? "warn" : "info") + ' mb16">' +
      (D.hasDraft() ? U.icon("alert", 15) + " <b>存在未发布的本地草稿</b>：前台已按草稿展示，但这台设备以外的人看不到，需导出发布。" :
        U.icon("info", 15) + " 当前展示的是站点正式数据（data/bundle.js）。修改任意条目后将自动创建本地草稿。") +
      " 共 " + D.policies.length + " 条政策 / " + D.cases.length + " 条案例。</div>";

    html += '<div class="admin-grid"><aside>' +
      '<div class="card pad mb16"><div class="btn-row mb8">' +
      '<button class="btn sm ' + (kind === "policies" ? "primary" : "") + '" data-admin-kind="policies">政策 ' + D.policies.length + "</button>" +
      '<button class="btn sm ' + (kind === "cases" ? "primary" : "") + '" data-admin-kind="cases">案例 ' + D.cases.length + "</button>" +
      "</div>" +
      '<input class="input" id="adminQ" placeholder="搜索标题或 ID" value="' + e(ctx.admin.q || "") + '">' +
      '<button class="btn sm teal mt8" data-action="admin-new" style="width:100%">＋ 新增' + (kind === "policies" ? "政策" : "案例") + "条目</button></div>" +
      '<div class="card admin-list">' + (shown.length ? shown.map(function (x) {
        return '<div class="admin-row ' + (current && current.id === x.id ? "active" : "") + '" data-admin-row="' + e(x.id) + '">' +
          '<span class="badge level-' + e(x.level) + '">' + e(U.levelName(x.level)) + "</span>" +
          '<span class="t">' + e(x.title) + "</span>" +
          '<span class="badge ' + (x.verification === "verified" ? "verified" : "pending") + '">' +
          (x.verification === "verified" ? "✓" : "!") + "</span></div>";
      }).join("") : '<div class="empty small">无匹配记录</div>') + "</div></aside>";

    html += '<main><div class="card pad" id="adminEditor">' + A.form(kind, current) + "</div>";

    html += '<div class="grid g2 mt16">' +
      '<div class="card pad"><h3 style="font-size:16px" class="mb16">批量导入 / 导出</h3>' +
      '<div class="dropzone" id="dropzone" data-action="admin-import">' + U.icon("upload", 22) +
      '<div class="small"><b>点击选择或拖入 CSV 文件</b></div><div class="tiny muted mt8">用 Excel 按模板整理后另存为 CSV（UTF-8）；数组字段用 | 分隔。' +
      '可用 <code>python tools/build_data.py --new-template policies</code> 生成表头。</div></div>' +
      '<input type="file" id="csvFile" accept=".csv,text/csv" style="display:none">' +
      '<div class="btn-row mt16">' +
      '<button class="btn sm" data-action="export-data" data-what="' + kind + '.csv">' + U.icon("download", 14) + " 导出 CSV</button>" +
      '<button class="btn sm" data-action="export-data" data-what="' + kind + '.json">' + U.icon("download", 14) + " 导出 JSON</button>" +
      '<button class="btn sm primary" data-action="export-data" data-what="bundle.js">' + U.icon("upload", 14) + " 导出整站数据包</button>" +
      "</div>" +
      '<div class="divider"></div><p class="small muted"><b>三步发布：</b>① 后台导出 <code>bundle.js</code>（或导出 JSON 后运行构建脚本）；' +
      '② 用导出文件覆盖站点 <code>data/</code> 下的同名文件；③ 上传站点目录，刷新即全站生效。前台代码无需任何改动。</p></div>' +

      '<div class="card pad"><h3 style="font-size:16px" class="mb16">质量检查与草稿管理</h3>' +
      '<div id="qualityBox">' + A.qualityHtml() + "</div>" +
      '<div class="btn-row mt16">' +
      '<button class="btn sm" data-action="admin-quality">重新检查</button>' +
      '<button class="btn sm danger" data-action="admin-clear">放弃草稿，恢复站点数据</button></div>' +
      '<div class="notice info mt16" style="font-size:12px"><b>提示：</b>正式上线前建议运行 <code>python tools/build_data.py</code> 做一次服务端校验，' +
      "它会重新生成倒排索引、覆盖度统计与质量报告。</div></div></div>";
    html += "</main></div>";
    return html;
  };
})(window);
