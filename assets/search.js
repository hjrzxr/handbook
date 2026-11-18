/* 安徽大学学生手册 · 检索引擎
 * 纯前端：规范化 + 精确匹配 + 单字容错（应对 OCR 误差）+ 短语加分
 */
(function (global) {
  "use strict";

  var PUNCT_SRC = "[\\s\\u3000\\u00a0，。、；：？！…—－·「」『』（）()《》〈〉“”‘’\"'\\[\\]【】,.;:!?~\\/\\\\|*#@&+=<>_^`%$]";
  var PUNCT_G = new RegExp(PUNCT_SRC, "g");
  var PUNCT_ONE = new RegExp(PUNCT_SRC);

  function normalize(s) {
    return (s || "").replace(PUNCT_G, "").toLowerCase();
  }

  var state = {
    items: [],
    bigText: "",
    offsets: [],
    byDoc: {},
    chapters: [],
    meta: null
  };

  function buildNormMap(text) {
    var map = new Int32Array(text.length);
    var idx = 0;
    for (var i = 0; i < text.length; i++) {
      if (PUNCT_ONE.test(text[i])) { continue; }
      map[idx++] = i;
    }
    return map.subarray(0, idx);
  }

  function init(data) {
    state.meta = data.meta;
    state.chapters = data.chapters;
    var items = [];
    var parts = [];
    var offsets = [];
    var cursor = 0;
    var docIndex = 0;

    data.chapters.forEach(function (ch) {
      ch.docs.forEach(function (doc) {
        state.byDoc[doc.id] = { doc: doc, chapter: ch, index: docIndex };
        doc.paras.forEach(function (p, pi) {
          var norm = normalize(p.t);
          items.push({
            docId: doc.id,
            docTitle: doc.title,
            docNorm: normalize(doc.title),
            chapterId: ch.id,
            chapterTitle: ch.title,
            page: p.p,
            paraId: p.id,
            pi: pi,
            docIndex: docIndex,
            text: p.t,
            norm: norm,
            map: null
          });
          offsets.push(cursor);
          parts.push(norm);
          cursor += norm.length + 1;
        });
        docIndex++;
      });
    });

    state.items = items;
    state.offsets = offsets;
    state.bigText = parts.join("\u0001");
    return state;
  }

  function findItem(pos) {
    var offs = state.offsets;
    var lo = 0, hi = offs.length - 1, ans = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (offs[mid] <= pos) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return ans;
  }

  function escapeReg(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function bucket(acc, ii, ti) {
    var e = acc[ii];
    if (!e) { e = acc[ii] = { exact: [], fuzzy: [], terms: {} }; }
    if (!e.terms[ti]) { e.terms[ti] = { exact: [], fuzzy: [] }; }
    return e;
  }

  function addHit(acc, pos, len, kind, ti) {
    var ii = findItem(pos);
    var item = state.items[ii];
    var rel = pos - state.offsets[ii];
    if (rel < 0 || rel + len > item.norm.length) { return; }
    var e = bucket(acc, ii, ti);
    (kind === "exact" ? e.exact : e.fuzzy).push([rel, rel + len]);
    (kind === "exact" ? e.terms[ti].exact : e.terms[ti].fuzzy).push([rel, rel + len]);
  }

  function collectExact(term, acc, ti) {
    var text = state.bigText;
    var from = 0;
    var guard = 0;
    while (guard++ < 500) {
      var at = text.indexOf(term, from);
      if (at === -1) { break; }
      addHit(acc, at, term.length, "exact", ti);
      from = at + term.length;
    }
  }

  function collectFuzzy(term, acc, ti, maxWild) {
    var len = term.length;
    if (len < 2) { return 0; }
    var patterns = [];
    for (var i = 0; i < len; i++) {
      patterns.push(term.slice(0, i) + "[^\\u0001]" + escapeReg(term.slice(i + 1)));
      if (maxWild >= 2 && len >= 5) {
        for (var j = i + 1; j < len; j++) {
          patterns.push(term.slice(0, i) + "[^\\u0001]" +
            escapeReg(term.slice(i + 1, j)) + "[^\\u0001]" + escapeReg(term.slice(j + 1)));
        }
      }
    }
    var hits = 0;
    patterns.forEach(function (pat) {
      var re;
      try { re = new RegExp(pat, "g"); } catch (e) { return; }
      var m, guard = 0;
      while ((m = re.exec(state.bigText)) && guard++ < 200) {
        addHit(acc, m.index, len, "fuzzy", ti);
        hits++;
        re.lastIndex = m.index + len;
      }
    });
    return hits;
  }

  function scoreQuery(q, opts) {
    opts = opts || {};
    var chapterFilter = opts.chapter || null;
    var raw = (q || "").trim();
    if (!raw) { return { total: 0, results: [], terms: [], query: "" }; }

    var terms = raw.split(/[\s,，、]+/).map(normalize).filter(function (t) { return t.length > 0; });
    terms = terms.filter(function (t, i, arr) { return arr.indexOf(t) === i; });
    if (!terms.length) { return { total: 0, results: [], terms: [], query: raw }; }
    var phrase = normalize(raw);

    var acc = {};
    terms.forEach(function (t, ti) {
      collectExact(t, acc, ti);
      // 若精确命中很少，补一次单字容错，兼顾 OCR 误差
      var exactCount = 0;
      for (var k in acc) { exactCount += acc[k].terms[ti] ? acc[k].terms[ti].exact.length : 0; }
      if (exactCount < 3) { collectFuzzy(t, acc, ti, terms.length <= 2 ? 2 : 1); }
    });

    var results = [];
    Object.keys(acc).forEach(function (key) {
      var ii = +key;
      var item = state.items[ii];
      if (chapterFilter && item.chapterId !== chapterFilter) { return; }
      var entry = acc[key];
      var score = 0;
      var matched = 0;
      var spans = [];
      var exactTotal = 0;
      var fuzzyTotal = 0;

      terms.forEach(function (t, ti) {
        var tt = entry.terms[ti];
        if (!tt) { return; }
        var ex = tt.exact.length, fz = tt.fuzzy.length;
        if (ex > 0) {
          score += 10 + Math.min(ex - 1, 3) * 3;
          matched++;
          exactTotal += ex;
        } else if (fz > 0) {
          score += 4 + Math.min(fz - 1, 2);
          matched++;
          fuzzyTotal += fz;
        }
        if (item.docNorm.indexOf(t) >= 0) { score += 14; }
      });

      Array.prototype.push.apply(spans, entry.exact);
      Array.prototype.push.apply(spans, entry.fuzzy);
      var coverage = matched / terms.length;
      if (coverage < 0.34) { return; }
      if (item.norm.indexOf(phrase) >= 0 && phrase.length > 2) { score += 26; }
      if (terms[0] && item.norm.indexOf(terms[0]) === 0) { score += 8; }
      score += Math.min(exactTotal + fuzzyTotal, 12) * 0.6;
      score -= Math.min(item.norm.length, 800) * 0.005;

      results.push({ item: item, score: score, coverage: coverage, spans: spans });
    });

    results.sort(function (a, b) {
      if (b.coverage !== a.coverage) { return b.coverage - a.coverage; }
      if (b.score !== a.score) { return b.score - a.score; }
      return a.item.docIndex - b.item.docIndex;
    });

    var limit = opts.limit || 120;
    return { total: results.length, results: results.slice(0, limit), terms: terms, query: raw };
  }

  function spansFor(item, res) {
    if (!item.map) { item.map = buildNormMap(item.text); }
    var out = [];
    var seen = {};
    res.spans.forEach(function (s) {
      var a = item.map[s[0]];
      var b = item.map[s[1] - 1];
      if (a === undefined || b === undefined) { return; }
      var key = a + ":" + b;
      if (seen[key]) { return; }
      seen[key] = 1;
      out.push([a, b + 1]);
    });
    out.sort(function (x, y) { return x[0] - y[0]; });
    return out;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]'/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function highlight(text, spans) {
    if (!spans || !spans.length) { return escapeHtml(text); }
    var out = "";
    var cursor = 0;
    spans.forEach(function (s) {
      if (s[0] < cursor) { return; }
      out += escapeHtml(text.slice(cursor, s[0]));
      out += "<mark>" + escapeHtml(text.slice(s[0], s[1])) + "</mark>";
      cursor = s[1];
    });
    out += escapeHtml(text.slice(cursor));
    return out;
  }

  function snippet(text, spans, maxLen) {
    maxLen = maxLen || 132;
    if (text.length <= maxLen) { return { text: text, spans: spans || [], prefix: "", suffix: "" }; }
    var first = spans && spans.length ? spans[0][0] : 0;
    var start = Math.max(0, first - 32);
    var end = Math.min(text.length, start + maxLen);
    if (end === text.length) { start = Math.max(0, end - maxLen); }
    var shifted = (spans || []).map(function (s) {
      return [s[0] - start, s[1] - start];
    }).filter(function (s) { return s[1] > 0 && s[0] < maxLen; });
    return {
      text: text.slice(start, end),
      spans: shifted,
      prefix: start > 0 ? "…" : "",
      suffix: end < text.length ? "…" : ""
    };
  }

  global.HandbookSearch = {
    init: init,
    query: scoreQuery,
    spansFor: spansFor,
    highlight: highlight,
    snippet: snippet,
    escapeHtml: escapeHtml,
    normalize: normalize,
    state: state
  };
})(typeof window !== "undefined" ? window : globalThis);
