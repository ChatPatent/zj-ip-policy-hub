/* 检索引擎：领域词典 + 中文 2-gram + 同义词扩展 + 字段加权 + IDF + 可解释命中理由
   纯前端运行，无网络请求；与 tools/build_data.py 的分词规则保持一致。 */
(function (global) {
  "use strict";
  var ZJ = global.ZJ = global.ZJ || {};
  var U = ZJ.util;

  var DEFAULT_WEIGHTS = {
    title: 6.0, keywords: 4.0, topics: 3.0, summary: 2.0, issuer: 1.5, organ: 1.5,
    docNo: 2.0, region: 1.2, highlights: 1.2, takeaways: 1.2, result: 1.0,
    insight: 1.0, facts: 0.6, legalBasis: 0.5, supportDetail: 1.4, supportType: 1.0,
    category: 1.4, type: 1.4, industry: 1.0, ipType: 1.0, contact: 0.6,
    applyWindow: 0.6, status: 0.6, sourceName: 0.5
  };
  var INDEX_FIELDS = Object.keys(DEFAULT_WEIGHTS).concat(["region"]);
  // 词元置信度：领域词 > 英文数字串 > 中文 2-gram > 单字
  var W_DICT = 1.0, W_LATIN = 0.8, W_BIGRAM = 0.45, W_CHAR = 0.12;
  var LEVEL_ORDER = { national: 0, province: 1, city: 2, county: 3 };

  function normalize(text) {
    if (!text) return "";
    var out = [];
    var s = String(text).toLowerCase();
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if (code === 0x3000) code = 32;
      else if (code >= 0xFF01 && code <= 0xFF5E) code -= 0xFEE0;
      out.push(String.fromCharCode(code));
    }
    return out.join("").replace(/[^\w\u4e00-\u9fff]+/g, " ");
  }

  function SearchEngine(taxonomy) {
    this.taxonomy = taxonomy || {};
    this.weights = Object.assign({}, DEFAULT_WEIGHTS, taxonomy.fieldWeights || {});
    this.domain = (taxonomy.domainTerms || []).map(normalize).filter(Boolean);
    // 长词优先，避免短词重复计入
    this.domain.sort(function (a, b) { return b.length - a.length; });
    this.stop = {};
    (taxonomy.stopwords || []).forEach(function (w) { this.stop[normalize(w)] = 1; }, this);
    this.synonyms = taxonomy.synonyms || {};
    this.docs = [];
    this.df = {};          // document frequency
    this.byId = {};
  }

  SearchEngine.prototype.tokenize = function (text) {
    var s = normalize(text);
    var compact = s.replace(/\s+/g, "");
    var acc = {};
    var self = this;
    function put(t, w) { if (t && !self.stop[t]) acc[t] = Math.max(acc[t] || 0, w); }

    for (var d = 0; d < this.domain.length; d++) {
      var term = this.domain[d];
      if (compact.indexOf(term) >= 0) put(term, W_DICT);
    }
    var cjk = compact.match(/[\u4e00-\u9fff]+/g) || [];
    cjk.forEach(function (seg) {
      if (seg.length >= 2) {
        for (var i = 0; i < seg.length - 1; i++) put(seg.substr(i, 2), W_BIGRAM);
      }
      for (var j = 0; j < seg.length; j++) put(seg.charAt(j), W_CHAR);
    });
    var latin = s.match(/[a-z0-9][a-z0-9\-_.]*/g) || [];
    latin.forEach(function (w) { if (w.length >= 2) put(w, W_LATIN); });
    return acc;
  };

  SearchEngine.prototype.expand = function (query) {
    var q = normalize(query);
    var compact = q.replace(/\s+/g, "");
    var main = this.tokenize(query);
    var ext = {};
    var self = this;
    Object.keys(this.synonyms).forEach(function (key) {
      var k = normalize(key);
      if (!k) return;
      // 查询中包含词典键，或词典键包含查询（短查询时）
      var hit = compact.indexOf(k) >= 0 || (compact.length >= 2 && k.indexOf(compact) >= 0);
      if (!hit) return;
      (self.synonyms[key] || []).forEach(function (w) {
        var t = normalize(w);
        if (!t || t === k) return;
        ext[t] = 0.55;
      });
    });
    return { main: main, ext: ext, phrase: compact, raw: String(query || "").trim() };
  };

  SearchEngine.prototype.addDocs = function (list, type) {
    var self = this;
    (list || []).forEach(function (raw) {
      var fields = {}, all = {};
      INDEX_FIELDS.forEach(function (f) {
        var v = raw[f];
        if (f === "region") {
          var r = raw.region || {};
          v = (r.city || "") + " " + (r.district || "");
        }
        if (v === undefined || v === null || v === false) return;
        var text = Array.isArray(v) ? v.join(" ") : String(v);
        if (!text.trim()) return;
        var toks = self.tokenize(text);
        fields[f] = toks;
        Object.keys(toks).forEach(function (t) { all[t] = Math.max(all[t] || 0, toks[t]); });
      });
      var doc = {
        _type: type, _id: raw.id, raw: raw, fields: fields, tokens: all,
        _date: raw.issuedAt || raw.date || raw.effectiveFrom || "",
        _level: LEVEL_ORDER[raw.level] === undefined ? 9 : LEVEL_ORDER[raw.level]
      };
      self.docs.push(doc);
      self.byId[type + ":" + raw.id] = doc;
      Object.keys(all).forEach(function (t) { self.df[t] = (self.df[t] || 0) + 1; });
    });
    return this;
  };

  SearchEngine.prototype.idf = function (t) {
    var n = this.docs.length || 1;
    return 1 + Math.log(n / (1 + (this.df[t] || 0)));
  };

  /* 维度取值：用于多选筛选（维度内 OR，维度间 AND） */
  function dimValues(doc, dim) {
    var d = doc.raw;
    switch (dim) {
      case "level": return [d.level];
      case "city": return [(d.region || {}).city || ""];
      case "district": return [(d.region || {}).district || ""];
      case "category": return [d.category];
      case "ctype": return [d.type];
      case "stages": return d.stages || [];
      case "targets": return d.targets || [];
      case "supportType": return [d.supportType];
      case "verification": return [d.verification];
      case "markets": return d.markets || [];
      case "ipType": return [d.ipType];
      case "industry": return [d.industry];
      case "organ": return [d.organ];
      case "year": return [String(doc._date || "").slice(0, 4)];
      default: return [];
    }
  }

  SearchEngine.prototype.matchFilters = function (doc, filters) {
    var f = filters || {}, strict = !!f.strictRegion;
    var reasons = [];
    var dims = ["level", "city", "district", "category", "ctype", "stages", "targets",
                "supportType", "verification", "markets", "ipType", "industry", "year"];
    for (var i = 0; i < dims.length; i++) {
      var dim = dims[i];
      var sel = f[dim];
      if (!sel || !sel.length) continue;
      var vals = dimValues(doc, dim);
      var hit = sel.some(function (s) { return vals.indexOf(s) >= 0; });
      // 上位层级政策对下位区域同样适用（除非用户勾选「仅看本级发布」）
      if (!hit && !strict && (dim === "city" || dim === "district")) {
        var lv = doc.raw.level;
        if (dim === "city" && (lv === "province" || lv === "national")) {
          hit = true; reasons.push("全省适用");
        } else if (dim === "district" && (lv === "city" || lv === "province" || lv === "national")) {
          hit = true; reasons.push("全市/全省适用");
        }
      }
      if (!hit) return null;
    }
    if (f.overseas === "yes" && doc.raw.overseas !== true) return null;
    if (f.overseas === "no" && doc.raw.overseas === true) return null;
    if (f.types && f.types.length && f.types.indexOf(doc._type) < 0) return null;
    if (f.q && f.q.trim()) { /* 检索评分在 score() 中处理 */ }
    return reasons;
  };

  SearchEngine.prototype.score = function (doc, ex) {
    var self = this, total = 0, why = [];
    var fieldHits = {};
    var terms = Object.assign({}, ex.main);
    Object.keys(ex.ext).forEach(function (t) { terms[t] = Math.max(terms[t] || 0, ex.ext[t]); });
    var termKeys = Object.keys(terms);
    if (!termKeys.length) return { score: 0, why: why, terms: [] };

    var matchedMain = 0, mainCount = Object.keys(ex.main).length || 1;
    termKeys.forEach(function (t) {
      var qw = terms[t];
      var idf = self.idf(t);
      Object.keys(doc.fields).forEach(function (f) {
        var dw = doc.fields[f][t];
        if (!dw) return;
        var fw = self.weights[f] || 1;
        total += fw * dw * qw * idf;
        fieldHits[f] = (fieldHits[f] || 0) + 1;
      });
      if (ex.main[t] && doc.tokens[t]) matchedMain++;
    });

    // 短语完全匹配加成（标题 > 摘要 > 全文）
    var phrase = ex.phrase;
    if (phrase && phrase.length >= 2) {
      var title = normalize(doc.raw.title || "");
      var summary = normalize(doc.raw.summary || "");
      if (title.replace(/\s+/g, "").indexOf(phrase) >= 0) { total += 14; why.push("标题完整匹配"); }
      else if (summary.replace(/\s+/g, "").indexOf(phrase) >= 0) { total += 5; why.push("摘要完整匹配"); }
    }
    // 查询词覆盖率加成：命中越多主词越相关
    var cover = matchedMain / mainCount;
    total += cover * cover * 6;

    // 核心字段命中说明
    if (fieldHits.title) why.push("标题命中 " + fieldHits.title + " 词");
    if (fieldHits.keywords || fieldHits.topics) why.push("主题词命中");
    if (fieldHits.docNo) why.push("文号命中");
    if (fieldHits.supportDetail) why.push("扶持条款命中");
    if (Object.keys(ex.ext).some(function (t) { return doc.tokens[t]; })) why.push("同义词扩展命中");

    // 时效性与可信度微调
    var yr = parseInt(String(doc._date).slice(0, 4), 10);
    if (yr >= 2025) total += 0.8; else if (yr >= 2023) total += 0.3;
    if (doc.raw.verification === "verified") total += 0.5;
    else if (doc.raw.verification === "pending") total -= 0.3;
    else if (doc.raw.verification === "demo") total -= 2;

    return { score: Math.max(total, 0), why: why, terms: termKeys };
  };

  SearchEngine.prototype.search = function (query, filters, options) {
    var t0 = (global.performance && performance.now) ? performance.now() : Date.now();
    var self = this, opt = options || {};
    var ex = this.expand(query || "");
    var hasQ = !!ex.phrase;
    var out = [];

    for (var i = 0; i < this.docs.length; i++) {
      var doc = this.docs[i];
      var fReasons = this.matchFilters(doc, filters);
      if (fReasons === null) continue;
      var s = hasQ ? this.score(doc, ex) : { score: 0, why: [], terms: [] };
      if (hasQ && s.score <= 0) continue;
      var why = fReasons.concat(s.why);
      out.push({
        _type: doc._type, _id: doc._id, raw: doc.raw,
        _score: s.score, _why: why, _terms: s.terms,
        _date: doc._date, _level: doc._level
      });
    }

    var sort = hasQ ? (opt.sort || "relevance") : (opt.sort && opt.sort !== "relevance" ? opt.sort : "date");
    out.sort(function (a, b) {
      if (sort === "date") return (b._date || "").localeCompare(a._date || "") || b._score - a._score;
      if (sort === "level") return a._level - b._level || (b._date || "").localeCompare(a._date || "");
      if (sort === "support") {
        var av = /\d/.test(a.raw.supportDetail || "") ? 1 : 0;
        var bv = /\d/.test(b.raw.supportDetail || "") ? 1 : 0;
        return bv - av || b._score - a._score;
      }
      return b._score - a._score || (b._date || "").localeCompare(a._date || "");
    });

    var t1 = (global.performance && performance.now) ? performance.now() : Date.now();
    return {
      items: out, total: out.length,
      took: Math.max(0.1, Math.round((t1 - t0) * 10) / 10),
      terms: Object.keys(ex.main).concat(Object.keys(ex.ext)).filter(function (t) { return t.length >= 2; }),
      phrase: ex.raw, expanded: Object.keys(ex.ext)
    };
  };

  SearchEngine.prototype.suggest = function (query, limit) {
    var q = normalize(query).replace(/\s+/g, "");
    if (!q) return [];
    var pool = {};
    this.domain.forEach(function (t) { if (t.indexOf(q) >= 0) pool[t] = 1; });
    this.docs.forEach(function (d) {
      var t = d.raw.title || "";
      if (t.indexOf(q) >= 0) pool[t] = 1;
    });
    return Object.keys(pool).sort(function (a, b) { return a.length - b.length; }).slice(0, limit || 6);
  };

  ZJ.SearchEngine = SearchEngine;
  ZJ.searchNormalize = normalize;
})(window);
