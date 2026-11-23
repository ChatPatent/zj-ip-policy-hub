/* 视图层（二）：出海政策助手 / 数据来源与规范 / 关于平台 */
(function (global) {
  "use strict";
  var ZJ = global.ZJ = global.ZJ || {};
  var U = ZJ.util;
  var V = ZJ.views = ZJ.views || {};
  function e(s) { return U.esc(s); }
  function ic(n, s) { return U.icon(n, s); }
  function selOpts(list, cur, valueKey, labelKey) {
    return list.map(function (x) {
      var v = valueKey ? x[valueKey] : x, l = labelKey ? x[labelKey] : x;
      return '<option value="' + e(v) + '"' + (String(cur) === String(v) ? " selected" : "") + ">" + e(l) + "</option>";
    }).join("");
  }

  /* ==================== 出海政策助手 ==================== */
  V.match = function (ctx) {
    var d = ctx.data, form = ctx.match.form;
    var cities = d.regions.cities || [];
    var cityObj = cities.filter(function (c) { return c.name === form.city; })[0];
    var districts = cityObj ? cityObj.districts : [];
    var needs = ["资金资助与奖补", "风险监测与预警", "纠纷应对与行政裁决", "合规体系与指引",
                 "快速获权与海外布局", "公益服务与专家指导", "保险与成本分担", "融资与质押"];

    var html = '<div class="section-head"><div><div class="eyebrow">POLICY MATCHER FOR GOING GLOBAL</div>' +
      "<h2>出海政策助手</h2>" +
      '<div class="sub">填 6 项企业画像，平台按"属地适用 ＋ 出海阶段 ＋ 主体 ＋ 诉求 ＋ 目标市场"加权匹配，输出可执行清单。</div></div>' +
      '<button class="btn sm" data-action="print-match">' + ic("download", 14) + " 打印／存 PDF</button></div>";

    html += '<div class="card pad"><form id="matchForm"><div class="match-form">' +
      field("所在设区市", '<select class="select" name="city" id="matchCity"><option value="">不限／全省</option>' +
        selOpts(cities.map(function (c) { return c.name; }), form.city) + "</select>") +
      field("所在区县（市）", '<select class="select" name="district" id="matchDistrict"><option value="">不限</option>' +
        selOpts(districts, form.district) + "</select>") +
      field("当前出海阶段", '<select class="select" name="stage"><option value="">未确定</option>' +
        selOpts(d.taxonomy.stages, form.stage, "id", "name") + "</select>") +
      field("主要目标市场", '<select class="select" name="market"><option value="">不限</option>' +
        selOpts(d.taxonomy.markets, form.market) + "</select>") +
      field("涉及权利类型", '<select class="select" name="ipType"><option value="">不限</option>' +
        selOpts(d.taxonomy.ipTypes, form.ipType) + "</select>") +
      field("企业主体类型", '<select class="select" name="target"><option value="">不限</option>' +
        selOpts(d.taxonomy.targets, form.target) + "</select>") +
      "</div>" +
      '<div class="mt16"><label class="field"><span>当前最关心的问题（可多选）</span></label><div class="chips">' +
      needs.map(function (n) {
        return '<label class="opt" style="display:inline-flex;background:#f5f8fb;border-radius:20px;padding:4px 12px;margin:3px">' +
          '<input type="checkbox" name="needs" value="' + e(n) + '"' + ((form.needs || []).indexOf(n) >= 0 ? " checked" : "") + ">" +
          "<span>" + e(n) + "</span></label>";
      }).join("") + "</div></div>" +
      '<div class="btn-row mt16"><button class="btn primary" type="submit">' + ic("compass", 16) + " 生成我的政策清单</button>" +
      '<button class="btn" type="button" data-action="match-reset">重置</button>' +
      '<span class="small muted" style="align-self:center">全部计算在浏览器本地完成，不上传任何企业信息。</span></div>' +
      "</form></div>";

    var m = ctx.match;
    if (m.submitted) {
      html += '<div class="match-results"><div class="section-head mt32"><div><div class="eyebrow">MATCH RESULT</div>' +
        "<h2 style='font-size:20px'>为你匹配到 " + m.policies.length + " 条政策、" + m.cases.length + " 条参考案例</h2>" +
        '<div class="sub">匹配依据：属地适用（上位政策全省／全市适用）＋出海阶段＋适用主体＋诉求关键词＋目标市场；结果已按匹配度排序。</div></div></div>';
      html += '<div class="grid g2">' +
        '<div class="card pad"><h3 style="font-size:16px" class="mb16">' + ic("book", 16) + " 优先争取的政策</h3>" +
        (m.policies.length ? m.policies.map(function (r) {
          return '<div class="match-item" data-open="policies:' + e(r.x.id) + '" style="cursor:pointer">' +
            '<h4>' + e(r.x.title) + "</h4>" +
            '<p>' + e(U.regionText(r.x)) + " · " + e(r.x.issuer || "") + " · " + e(r.x.status || "") + "</p>" +
            (r.x.supportDetail ? '<p class="mt8">' + e(U.clip(r.x.supportDetail, 100)) + "</p>" : "") +
            '<div class="why">匹配度 ' + r.score.toFixed(1) + " · " + e(r.why.join("、")) + "</div></div>";
        }).join("") : '<p class="small muted">暂无匹配政策，可放宽条件或查看全部政策库。</p>') +
        '<a class="btn sm mt8" href="' + ctx.href({ path: "policies" }) + '">查看全部政策 ' + ic("arrow", 14) + "</a></div>" +
        '<div class="card pad"><h3 style="font-size:16px" class="mb16">' + ic("scale", 16) + " 可借鉴的官方案例</h3>" +
        (m.cases.length ? m.cases.map(function (r) {
          return '<div class="match-item" style="border-left-color:#1b6ca8" data-open="cases:' + e(r.x.id) + '">' +
            '<h4>' + e(r.x.title) + "</h4>" +
            '<p>' + e(r.x.type) + " · " + e(U.regionText(r.x)) + " · " + e(U.formatDate(r.x.date, r.x.datePrecision)) + "</p>" +
            '<div class="why">匹配度 ' + r.score.toFixed(1) + " · " + e(r.why.join("、")) + "</div></div>";
        }).join("") : '<p class="small muted">暂无匹配案例。</p>') +
        '<a class="btn sm mt8" href="' + ctx.href({ path: "cases" }) + '">查看全部案例 ' + ic("arrow", 14) + "</a></div></div>";

      html += '<div class="card pad mt16"><h3 style="font-size:16px" class="mb16">' + ic("compass", 16) + " 建议行动路径</h3>" +
        '<div class="timeline">' + m.steps.map(function (s) {
          return '<div class="tl-item"><b>' + e(s.t) + "</b><p>" + e(s.d) + "</p></div>";
        }).join("") + "</div>" +
        '<div class="notice warn mt16" style="font-size:12px">清单为检索建议，不构成法律或申报意见。请逐条核对当年度申报通知、有效期与资格条件；标注「待核验」的条目务必先复核原文。</div></div>';
    } else {
      html += '<div class="notice info mt24">' + ic("info", 16) +
        " 填写上方画像后点击「生成我的政策清单」。常见用法：选择所在区县 → 选择所处出海阶段 → 勾选最关心的问题。</div>";
    }
    return html;
  };

  function field(label, control) {
    return '<label class="field"><span>' + e(label) + "</span>" + control + "</label>";
  }

  /* ==================== 数据来源与规范 ==================== */
  V.sources = function (ctx) {
    if (ctx.isPublic) return sourcesPublic(ctx);
    var d = ctx.data, c = d.coverage;
    var html = '<div class="section-head"><div><div class="eyebrow">DATA GOVERNANCE</div><h2>数据来源、规范与更新机制</h2>' +
      '<div class="sub">对政策信息平台而言，"数据从哪来、怎么核验、多久更新"比页面本身更重要。这里全部公开。</div></div></div>';

    html += '<div class="grid g2">' +
      '<div class="card pad"><h3 style="font-size:17px" class="mb16">一、数据来源分层</h3>' +
      '<table class="table"><thead><tr><th>来源层级</th><th>采集渠道</th><th>典型内容</th></tr></thead><tbody>' +
      [
        ["国家层面", "国家知识产权局、中国政府网、国家知识产权战略网", "纲要、普惠工程、典型案例"],
        ["省级", "浙江省市场监督管理局（省知识产权局）、省人大、省知识产权保护中心、省贸促会", "地方性法规、七项举措、专项资金通知、省级指引"],
        ["市级", "11 个设区市政府及市场监管局门户、市知识产权保护中心", "专项资金细则、年度申报通知、行政裁决案例"],
        ["区县级", "90 个县级行政区政府门户、市场监管局、知识产权快维中心", "奖补实施意见、申报通知、公益服务站、县域案例"],
        ["权威媒体／公开报道", "法治日报、中国知识产权报、地方政府新闻稿", "公益服务与海外维权案例线索（标注待核验）"]
      ].map(function (r) { return "<tr><td><b>" + e(r[0]) + "</b></td><td>" + e(r[1]) + "</td><td>" + e(r[2]) + "</td></tr>"; }).join("") +
      "</tbody></table>" +
      '<div class="notice warn mt16" style="font-size:12px">平台不自动抓取、不转载政策全文，只做结构化索引与要点摘录，并强制保留原文链接，把用户导向官方来源。这既降低合规风险，也避免全文过时。</div></div>' +

      '<div class="card pad"><h3 style="font-size:17px" class="mb16">二、核验状态与质量纪律</h3>' +
      (d.taxonomy.verification || []).map(function (v) {
        return '<div class="notice ' + (v.id === "verified" ? "ok" : "warn") + ' mb8" style="font-size:13px"><b>' + e(v.name) +
          "（" + e(v.id) + "）</b><br>" + e(v.desc) + "</div>";
      }).join("") +
      '<div class="divider"></div><p class="small muted">当前数据集：' + c.province.verified + " 条已核验、" +
      c.province.pending + " 条待核验、" + c.province.demo + " 条示范条目；" + c.province.withSourceUrl +
      " 条附官方原文链接。缺链接与待核验条目在列表和详情页均有显著提示。</p>" +
      '<p class="small muted">文号、日期、金额以官方原文为准；无法确定发布日期的条目用「年／月」精度显示，不做精确化臆测。</p></div></div>';

    html += '<div class="grid g2 mt16">' +
      '<div class="card pad"><h3 style="font-size:17px" class="mb16">三、数据字段规范（JSON Schema 摘要）</h3>' +
      '<table class="table"><thead><tr><th>字段组</th><th>政策</th><th>案例</th></tr></thead><tbody>' +
      [
        ["标识", "id / title / docNo", "id / title / type"],
        ["层级与属地", "level / region{city,district}", "level / region{city,district}"],
        ["主体与时间", "issuer / issuedAt / effectiveFrom / effectiveTo / status / datePrecision", "organ / date / datePrecision"],
        ["分类标注", "category / topics / stages / targets / markets", "industry / ipType / overseas / markets / stages"],
        ["实质内容", "summary / highlights / supportType / supportDetail", "summary / facts / result / insight / takeaways / legalBasis"],
        ["办理信息", "applyWindow / contact", "—"],
        ["溯源", "sourceName / sourceUrl / verification / verifiedAt", "同左"],
        ["检索", "keywords", "keywords"]
      ].map(function (r) { return "<tr><td><b>" + e(r[0]) + "</b></td><td class='small'>" + e(r[1]) + "</td><td class='small'>" + e(r[2]) + "</td></tr>"; }).join("") +
      "</tbody></table></div>" +
      '<div class="card pad"><h3 style="font-size:17px" class="mb16">四、更新流水线</h3>' +
      '<div class="timeline">' +
        '<div class="tl-item"><b>① 采集</b><p>学生团队按设区市分工，从各区县官方门户采集，用 Excel/CSV 按模板填写，或直接在前台数据后台逐条录入。</p></div>' +
        '<div class="tl-item"><b>② 校验</b><p>运行 <code>python tools/build_data.py --check</code>，校验必填字段、ID 唯一、层级合法、区县归属、日期格式与核验状态。</p></div>' +
        '<div class="tl-item"><b>③ 构建</b><p>运行 <code>python tools/build_data.py</code>，生成运行时数据包、倒排索引、覆盖度统计与质量报告。</p></div>' +
        '<div class="tl-item"><b>④ 发布</b><p>把 data/ 目录随站点一起上传即可，前台代码零改动；也可在后台直接导出 bundle.js 覆盖。</p></div>' +
      "</div>" +
      '<div class="notice info mt8" style="font-size:12px">开发期在网址后加 <code>?live=1</code>，前台直接读取 JSON 源文件，改完刷新即可看到效果，无需重复构建。</div></div></div>';

    html += '<div class="card pad mt16"><h3 style="font-size:17px" class="mb16">五、数据接口（供小程序与第三方复用）</h3>' +
      '<div class="grid g3">' +
      [["data/policies.json", "政策主数据，小程序可直接请求同一份 JSON"],
       ["data/cases.json", "案例主数据，字段与政策同构"],
       ["data/regions.json", "省—市—县三级行政区划映射"],
       ["data/taxonomy.json", "词表、同义词、字段权重、出海阶段"],
       ["data/index.json", "预构建倒排索引，便于服务端/云函数检索"],
       ["data/coverage.json", "覆盖度与待采集清单"]].map(function (r) {
        return '<div class="notice info" style="font-size:12px"><b>' + e(r[0]) + "</b><br>" + e(r[1]) + "</div>";
      }).join("") + "</div>" +
      '<p class="small muted mt16">小程序版本可复用完全相同的 JSON 数据契约与检索词表；网站与小程序共用一份数据源，避免两套维护成本。</p></div>';

    html += '<div class="notice warn mt24"><b>覆盖度诚实声明：</b>目前为可运行的种子数据集（' +
      d.policies.length + " 条政策、" + d.cases.length + " 条案例），已覆盖 " + c.province.coveredDistricts +
      "/" + c.province.districtTotal + " 个县级行政区。" +
      "「全网覆盖」是本平台的建设目标与持续运营机制，而非当前既成事实；平台公开缺口清单、批量导入工具与覆盖度看板，供团队逐期补录。" +
      ' <a href="' + ctx.href({ path: "coverage" }) + '">查看缺口清单</a></div>';
    return html;
  };

  /* 企业用户版「数据说明」：只讲数据可信度与使用边界，
     不展示字段 Schema、构建命令、采集流水线与第三方接口等构建者信息。 */
  function sourcesPublic(ctx) {
    var d = ctx.data, c = d.coverage;
    var html = '<div class="section-head"><div><div class="eyebrow">DATA &amp; TRUST</div><h2>数据说明与使用须知</h2>' +
      '<div class="sub">平台收录的政策与案例来自哪里、如何核验、使用时要注意什么，这里一次说清。</div></div></div>';

    html += '<div class="grid g2">' +
      '<div class="card pad"><h3 style="font-size:17px" class="mb16">一、数据来自哪里</h3>' +
      '<table class="table"><thead><tr><th>来源层级</th><th>主要渠道</th><th>典型内容</th></tr></thead><tbody>' +
      [
        ["国家层面", "国家知识产权局、中国政府网", "纲要、普惠工程、典型案例"],
        ["省级", "浙江省市场监督管理局（省知识产权局）、省人大、省知识产权保护中心", "地方性法规、专项资金通知、省级指引"],
        ["市级", "设区市政府及市场监管局门户、市知识产权保护中心", "专项资金细则、年度申报通知、行政裁决案例"],
        ["区县级", "县级行政区政府门户、市场监管局、知识产权快维中心", "奖补实施意见、申报通知、公益服务与县域案例"],
        ["公开报道", "权威媒体与地方政府新闻稿", "公益服务与海外维权案例线索（标注待核验）"]
      ].map(function (r) { return "<tr><td><b>" + e(r[0]) + "</b></td><td>" + e(r[1]) + "</td><td>" + e(r[2]) + "</td></tr>"; }).join("") +
      "</tbody></table>" +
      '<div class="notice warn mt16" style="font-size:12px">平台不转载政策全文，只做结构化索引、要点摘录与原文链接，把您导向各级政府部门正式发布页面，避免全文过时或口径误读。</div></div>' +

      '<div class="card pad"><h3 style="font-size:17px" class="mb16">二、核验状态怎么读</h3>' +
      (d.taxonomy.verification || []).map(function (v) {
        return '<div class="notice ' + (v.id === "verified" ? "ok" : "warn") + ' mb8" style="font-size:13px"><b>' +
          e(v.name) + "</b><br>" + e(v.desc) + "</div>";
      }).join("") +
      '<div class="divider"></div><p class="small muted">当前数据集：' + c.province.verified + " 条已核验、" +
      c.province.pending + " 条待核验、" + c.province.demo + " 条示范条目；" + c.province.withSourceUrl +
      " 条附官方原文链接。缺链接与待核验条目在列表和详情页均有显著提示。</p>" +
      '<p class="small muted">文号、日期、金额以官方原文为准；无法确定发布日期的条目只显示到年／月，不做精确化推断。</p></div></div>';

    html += '<div class="grid g2 mt16">' +
      '<div class="card pad"><h3 style="font-size:17px" class="mb16">三、平台能帮您做什么</h3>' +
      '<ul class="small" style="line-height:2">' +
      "<li><b>一次查全：</b>把散落在省、市、区县多个门户的政策按主题与出海阶段聚合，支持关键词、文号、机关、地区组合检索。</li>" +
      "<li><b>按阶段找：</b>从出海前布局、合规、监测到纠纷应对与事后救济，直接定位当下用得上的条款。</li>" +
      "<li><b>生成清单：</b>填写企业画像后输出可打印的政策清单、参考案例与办理路径，计算全部在浏览器本地完成。</li>" +
      "<li><b>溯源核对：</b>每条记录给出来源名称、原文链接、核验状态与核验日期，方便向属地部门复核。</li>" +
      "</ul></div>" +
      '<div class="card pad"><h3 style="font-size:17px" class="mb16">四、使用边界与免责</h3>' +
      '<ul class="small" style="line-height:2">' +
      "<li>本平台是教学与竞赛用途的公益信息聚合工具，<b>不构成法律意见、申报承诺或政策解释</b>。</li>" +
      "<li>政策适用、资格条件、扶持金额、申报窗口与有效期，一律以各级政府及其部门正式发布文本及当年度申报通知为准。</li>" +
      "<li>标注「待核验」「示范条目」的内容请勿直接用于决策，须先核对官方原文。</li>" +
      "<li>页面内容持续更新；如发现错漏或失效链接，请以官方渠道为准并向发文机关核实。</li>" +
      "</ul></div></div>";

    html += '<div class="notice info mt24"><b>数据范围说明：</b>目前收录 ' + d.policies.length + " 条政策、" +
      d.cases.length + " 条案例，覆盖国家、省、市、区县四级，其中 " + c.province.verified +
      " 条已核验、" + c.province.withSourceUrl + " 条附官方原文链接。平台仍在持续补录；" +
      "上位层级政策对全省适用，因此暂未单独收录区县条目的地区，企业同样可以适用省级与国家级政策。" +
      ' <a href="' + ctx.href({ path: "policies" }) + '">直接查看政策库</a></div>';
    return html;
  }

  /* ==================== 关于平台 ==================== */
  V.about = function (ctx) {
    var d = ctx.data, isPub = !!ctx.isPublic;
    var html = '<div class="section-head"><div><div class="eyebrow">ABOUT THE PLATFORM</div><h2>关于本平台</h2>' +
      '<div class="sub">面向浙江省中小微企业出海的知识产权政策与案例公共服务检索工具。</div></div></div>';

    html += '<div class="card pad"><h3 style="font-size:18px" class="mb16">要解决的四个真实痛点</h3>' +
      '<div class="grid g4">' +
      [["信息分散", "同一事项散落在省、市、区县多个门户，企业不知道去哪查"],
       ["层级传导不清", "省级专项资金常由区县窗口兑现，两级时间节点容易错过"],
       ["看不懂条款", "政策原文长、口径专业，中小微企业缺少要点摘录与办理指引"],
       ["不知何时用", "政策与案例未按出海阶段组织，遇到纠纷时才临时找依据"]].map(function (r, i) {
        return '<div class="card pad" style="box-shadow:none;background:#fafcfe"><b style="color:var(--navy)">' +
          (i + 1) + ". " + e(r[0]) + "</b><p class='small muted mt8'>" + e(r[1]) + "</p></div>";
      }).join("") + "</div></div>";

    var archRows = isPub ? [
      ["database", "数据层", "国家、省、市、区县四级政策与官方案例，逐条标注来源"],
      ["search", "检索层", "支持关键词、文号、发文机关、地区与出海阶段组合查询"],
      ["layers", "应用层", "政策库 / 案例库 / 全站检索 / 出海政策助手"],
      ["shieldCheck", "可信层", "原文链接 + 核验状态 + 核验日期 + 效力与申报窗口提示"]
    ] : [
      ["database", "数据层", "省—市—县行政区划 + 政策/案例 JSON + 词表同义词 + 覆盖度统计"],
      ["search", "检索层", "领域词典 + 中文 2-gram + 同义词扩展 + 字段加权 + IDF，前端毫秒级响应"],
      ["layers", "应用层", "政策库 / 案例库 / 覆盖度看板 / 出海助手 / 数据后台"],
      ["shieldCheck", "治理层", "来源链接 + 核验状态 + 质量报告 + CSV 批量导入 + 构建流水线"]
    ];
    html += '<div class="card pad mt16"><h3 style="font-size:18px" class="mb16">' +
      (isPub ? "平台能做什么" : "平台架构") + '</h3>' +
      '<div class="grid g4">' +
      archRows.map(function (r) {
        return '<div class="card pad" style="box-shadow:none">' + ic(r[0], 22) + '<h3 style="font-size:15px" class="mt8">' +
          e(r[1]) + "</h3><p class='small muted mt8'>" + e(r[2]) + "</p></div>";
      }).join("") + "</div>" +
      '<div class="notice info mt16" style="font-size:13px">' +
      (isPub ? "<b>零门槛、隐私友好：</b>无需注册登录、无需安装，打开浏览器即可检索；" +
        "企业填写的画像与检索词只在本地浏览器参与计算，不上传服务器。政策清单可一键打印或存为 PDF。"
        : "<b>纯静态架构：</b>HTML + CSS + 原生 JavaScript + JSON，无后端、无数据库、无第三方 CDN。" +
        "可托管在任意静态空间（对象存储 / GitHub Pages / Nginx / 云托管静态站点），" +
        "绑定自定义域名只需一条 CNAME 记录，无需迁移或改造代码。断网时亦可从本地直接打开使用。") + "</div></div>";

    html += '<div class="grid g2 mt16">' +
      '<div class="card pad"><h3 style="font-size:18px" class="mb16">设计原则</h3><ul class="small" style="line-height:2">' +
      "<li><b>来源可溯：</b>每条记录带来源名称、原文链接与核验状态，不转载全文，导向官方。</li>" +
      (isPub ? "<li><b>如实标注：</b>每条注明来源与核验状态，未核验内容显著提示，不做夸大承诺。</li>" :
        "<li><b>缺口可见：</b>不虚报覆盖，把未采集区县做成任务清单，接受检验。</li>") +
      "<li><b>按场景组织：</b>以企业出海五阶段为主轴，而非按发文机关堆文件。</li>" +
      "<li><b>可解释检索：</b>展示命中依据与耗时，避免黑箱排序。</li>" +
      "<li><b>零门槛访问：</b>无需注册、无需安装、无需等待接口，打开即用。</li>" +
      (isPub ? "<li><b>隐私友好：</b>检索与匹配都在浏览器本地完成，不上传任何企业信息。</li>" :
        "<li><b>易共建：</b>CSV/Excel 批量导入，学生团队可按地市分工持续补录。</li>") +
      "</ul></div>" +
      '<div class="card pad"><h3 style="font-size:18px" class="mb16">建设路线</h3>' +
      '<div class="timeline">' +
      (isPub ? '<div class="tl-item"><b>第一阶段 · 网站版（当前）</b><p>开放政策库、案例库、全站检索与出海政策助手，支持自定义域名。</p></div>' +
        '<div class="tl-item"><b>第二阶段 · 扩大收录</b><p>持续补录各设区市与区县政策，逐条核验文号、有效期与申报窗口，扩大政策覆盖面。</p></div>' +
        '<div class="tl-item"><b>第三阶段 · 移动端</b><p>推出小程序版本，增加收藏、订阅推送与政策到期提醒。</p></div>'
        : '<div class="tl-item"><b>第一阶段 · 网站版（当前）</b><p>完成数据契约、检索引擎、政策/案例库、覆盖度看板、出海助手与数据后台；支持自定义域名。</p></div>' +
        '<div class="tl-item"><b>第二阶段 · 数据共建</b><p>按 11 个设区市分工补录区县政策，逐条核验文号与有效期，把覆盖度提升至可对外宣称的水平。</p></div>' +
        '<div class="tl-item"><b>第三阶段 · 小程序版</b><p>复用同一份 JSON 数据契约与词表，增加订阅推送、收藏与政策到期提醒。</p></div>') +
      "</div></div></div>";

    html += '<div class="notice warn mt24"><b>使用与免责：</b>本平台为教学与竞赛用途的公益信息聚合工具，' +
      "不构成法律意见、申报承诺或政策解释。政策适用、资格条件、金额与有效期以各级政府及其部门正式发布的文本为准；" +
      "标注「待核验」的内容请勿直接用于决策。" +
      (isPub ? "如发现内容与官方文本不一致，请以官方原文为准并向发文机关核实。</div>"
        : "发现错漏欢迎通过数据后台修正并重新构建。</div>");
    return html;
  };
})(window);
