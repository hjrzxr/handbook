/* 安徽大学学生手册 · 界面与路由 */
(function () {
  "use strict";

  var HS = window.HandbookSearch;
  var DATA = window.HANDBOOK;
  if (!DATA) { return; }
  HS.init(DATA);

  var main = document.getElementById("main");
  var input = document.getElementById("q");
  var clearBtn = document.getElementById("clearBtn");
  var heroInput = null;
  var topbar = document.getElementById("topbar");

  var HOT = ["奖学金", "考试作弊", "处分", "转专业", "推免", "宿舍", "医保", "补考", "学位", "请假"];

  var allDocs = [];
  DATA.chapters.forEach(function (ch) {
    ch.docs.forEach(function (doc) {
      allDocs.push({ doc: doc, chapter: ch });
    });
  });
  var docIndexById = {};
  allDocs.forEach(function (d, i) { docIndexById[d.doc.id] = i; });

  var view = { name: "home", query: "", chapter: "", docId: null, paraId: null };
  var focusIndex = -1;

  /* ------------------------------------------------------------ helpers */
  function esc(s) { return HS.escapeHtml(s); }

  function setHashUrl(url) {
    try { history.replaceState(null, "", url); }
    catch (e) { /* file:// 等环境下可能被拒绝，忽略即可 */ }
  }

  function applyPlaceholder() {
    var narrow = window.innerWidth <= 620;
    input.placeholder = narrow
      ? "搜索手册内容"
      : "搜索条款、关键词，如“奖学金”“考试作弊”“转专业”";
    if (heroInput) {
      heroInput.placeholder = narrow
        ? "输入关键词，如“奖学金”"
        : "试试：国家奖学金多少钱？考试作弊怎么处分？";
    }
  }

  function chapterCount(ch) { return ch.docs.length; }

  function quickLinks() {
    var wanted = ["学籍管理规定", "奖学金评选办法", "违纪处分实施细则", "学生宿舍管理规定",
                  "基本医疗保险", "免试攻读研究生", "课程考核管理办法", "学生申诉处理办法"];
    var seen = {};
    var links = [];
    wanted.forEach(function (key) {
      for (var i = 0; i < allDocs.length; i++) {
        if (allDocs[i].doc.title.indexOf(key) >= 0 && !seen[allDocs[i].doc.id]) {
          seen[allDocs[i].doc.id] = 1;
          links.push(allDocs[i]);
          break;
        }
      }
    });
    return links.map(function (e) {
      return '<a class="quick-link" href="#/doc/' + e.doc.id + '"><b>' + esc(e.doc.title) +
        "</b><span>" + esc(e.chapter.title) + " · 第 " + e.doc.page + " 页</span></a>";
    }).join("");
  }  function paraCount(ch) {
    return ch.docs.reduce(function (n, d) { return n + d.paras.length; }, 0);
  }

  function setQuery(v, opts) {
    view.query = v;
    if (input.value !== v) { input.value = v; }
    if (heroInput && heroInput.value !== v) { heroInput.value = v; }
    clearBtn.hidden = !v;
    if (opts && opts.silent) { return; }
    if (view.name !== "home") {
      navigate("#/?q=" + encodeURIComponent(v), true);
      return;
    }
    var url = v ? "#/?q=" + encodeURIComponent(v) : "#/";
    setHashUrl(url);
    renderHome();
  }

  function navigate(hash, replace) {
    if (replace) { setHashUrl(hash); }
    else if (location.hash !== hash) { location.hash = hash; }
    else { route(); }
  }

  function handoffToHeader(v) {
    view.query = v;
    input.value = v;
    clearBtn.hidden = !v;
    setHashUrl("#/?q=" + encodeURIComponent(v));
    renderResults(v.trim());
    input.focus();
    var len = input.value.length;
    try { input.setSelectionRange(len, len); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------ search */
  function runSearch() {
    var q = view.query.trim();
    if (!q) { return null; }
    return HS.query(q, { chapter: view.chapter || null, limit: 120 });
  }

  /* ------------------------------------------------------------ views */
  function renderHome() {
    view.name = "home";
    var q = view.query.trim();
    if (!q) { renderLanding(); return; }
    renderResults(q);
  }

  function renderLanding() {
    heroInput = null;
    var chaptersHtml = DATA.chapters.map(function (ch) {
      var preview = ch.docs.slice(0, 3).map(function (d) {
        return "<li>" + esc(d.title) + "</li>";
      }).join("");
      return '<a class="chapter-card" href="#/doc/' + ch.docs[0].id + '">' +
        "<h3>" + esc(ch.title) + "</h3>" +
        "<ul>" + preview + (ch.docs.length > 3 ? "<li>……</li>" : "") + "</ul>" +
        '<div class="count"><span>' + chapterCount(ch) + " 份文件 · " + paraCount(ch) + " 条</span><i>查看 →</i></div>" +
        "</a>";
    }).join("");

    main.innerHTML =
      '<section class="hero">' +
      '<div class="hero-inner">' +
      '<div class="hero-eyebrow">Anhui University · Student Handbook</div>' +
      "<h1>学生手册，一搜即达</h1>" +
      '<p class="lead">奖学金、学籍、考试、宿舍、处分、医保、推免……把问题交给搜索框，直接定位到原文条款。</p>' +
      '<form class="hero-search" id="heroForm" autocomplete="off">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M16.5 16.5 21 21"></path></svg>' +
      '<input id="heroQ" type="search" placeholder="试试：国家奖学金多少钱？考试作弊怎么处分？" aria-label="搜索学生手册" />' +
      '<button type="submit">搜索</button>' +
      "</form>" +
      '<div class="hot"><span class="hot-label">热门</span>' +
      HOT.map(function (k) { return '<button class="hot-chip" data-k="' + esc(k) + '">' + esc(k) + "</button>"; }).join("") +
      "</div>" +
      '<div class="hero-stats">' +
      '<div class="hero-stat"><b>' + DATA.chapters.length + "</b><span>章 节</span></div>" +
      '<div class="hero-stat"><b>' + DATA.meta.docs + "</b><span>份规章制度</span></div>" +
      '<div class="hero-stat"><b>' + DATA.meta.paras + "</b><span>条内容</span></div>" +
      '<div class="hero-stat"><b>' + Math.round(DATA.meta.chars / 1000) + "k</b><span>字全文</span></div>" +
      "</div>" +
      "</div></section>" +
      '<section class="section">' +
      '<div class="section-head"><h2 class="section-title">常用速查</h2>' +
      '<span class="section-sub">同学们问得最多的几份文件</span></div>' +
      '<div class="quick-row">' + quickLinks() + "</div>" +
      "</section>" +
      '<section class="section">' +
      '<div class="section-head"><h2 class="section-title">按章节浏览</h2>' +
      '<span class="section-sub">共 ' + DATA.meta.docs + " 份文件，点击目录查看全文</span></div>" +
      '<div class="chapter-grid">' + chaptersHtml + "</div>" +
      "</section>";

    heroInput = document.getElementById("heroQ");
    var heroForm = document.getElementById("heroForm");
    heroForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = heroInput.value.trim();
      if (v) { handoffToHeader(v); }
    });
    heroInput.addEventListener("input", function () {
      var v = heroInput.value;
      if (v.trim()) { handoffToHeader(v); }
    });
    if (view.query) {
      heroInput.value = view.query;
    }
    applyPlaceholder();
    Array.prototype.forEach.call(document.querySelectorAll(".hot-chip"), function (b) {
      b.addEventListener("click", function () { setQuery(b.getAttribute("data-k")); });
    });
  }

  function renderResults(q) {
    var res = runSearch();
    heroInput = null;
    var filters = '<aside class="filters"><h4>按章节筛选</h4>' +
      '<button class="filter-item' + (view.chapter ? "" : " active") + '" data-ch="">全部<span>' +
      DATA.meta.paras + "</span></button>" +
      DATA.chapters.map(function (ch) {
        return '<button class="filter-item' + (view.chapter === ch.id ? " active" : "") +
          '" data-ch="' + ch.id + '">' + esc(ch.title) + "<span>" + paraCount(ch) + "</span></button>";
      }).join("") + "</aside>";

    var listHtml = "";
    if (!res || !res.results.length) {
      listHtml = '<div class="empty"><strong>没有找到与「' + esc(q) + "」直接相关的内容</strong>" +
        "<p>可以试试更短的关键词，或换一种说法。例如把「挂科怎么办」换成「补考」「不及格」。</p>" +
        '<div class="sugs">' + HOT.slice(0, 6).map(function (k) {
          return '<button data-k="' + esc(k) + '">' + esc(k) + "</button>";
        }).join("") + "</div></div>";
    } else {
      listHtml = '<div class="result-list" id="resultList">' + res.results.map(function (r, i) {
        return resultCard(r, i);
      }).join("") + "</div>";
    }

    main.innerHTML =
      '<div class="result-head"><h2>「<em>' + esc(q) + "</em>」的搜索结果　<span style=\"color:var(--muted);font-weight:400;font-size:13px\">" +
      (res ? res.total : 0) + " 条</span></h2>" +
      (res && res.total > res.results.length ? '<span class="sort">显示前 ' + res.results.length + " 条</span>" : "") +
      "</div>" +
      '<div class="search-layout">' + filters + "<section>" + listHtml + "</section></div>";

    Array.prototype.forEach.call(document.querySelectorAll(".filter-item"), function (b) {
      b.addEventListener("click", function () {
        view.chapter = b.getAttribute("data-ch");
        renderResults(q);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll(".result"), function (el) {
      el.addEventListener("click", function () {
        var docId = el.getAttribute("data-doc");
        var pid = el.getAttribute("data-para");
        navigate("#/doc/" + docId + (pid ? "/p/" + pid : "") + "?q=" + encodeURIComponent(q));
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll(".empty .sugs button"), function (b) {
      b.addEventListener("click", function () { setQuery(b.getAttribute("data-k")); });
    });
    focusIndex = -1;
  }

  function resultCard(r, i) {
    var item = r.item;
    var spans = HS.spansFor(item, r);
    var sn = HS.snippet(item.text, spans, 150);
    var body = (sn.prefix ? "<span class=\"ell\">" + sn.prefix + "</span>" : "") +
      HS.highlight(sn.text, sn.spans) +
      (sn.suffix ? "<span class=\"ell\">" + sn.suffix + "</span>" : "");
    return '<article class="result" data-doc="' + item.docId + '" data-para="' + item.paraId + '" tabindex="0">' +
      '<div class="result-meta"><span class="tag">' + esc(item.chapterTitle) + "</span>" +
      '<span class="tag ghost">第 ' + item.page + " 页</span>" +
      '<span class="open-hint">查看全文 →</span></div>' +
      '<div class="result-title">' + esc(item.docTitle) + "</div>" +
      '<div class="result-text">' + body + "</div>" +
      "</article>";
  }

  function renderToc() {
    view.name = "toc";
    heroInput = null;
    var html = DATA.chapters.map(function (ch) {
      return '<div><h3>' + esc(ch.title) + "</h3><ul>" +
        ch.docs.map(function (d) {
          return '<li><a href="#/doc/' + d.id + '">' + esc(d.title) + "</a><span>第 " + d.page + " 页</span></li>";
        }).join("") + "</ul></div>";
    }).join("");
    main.innerHTML = '<div class="panel"><div class="section-head"><h2 class="section-title">全站目录</h2>' +
      '<span class="section-sub">' + DATA.meta.docs + " 份文件 · " + DATA.meta.paras + " 条内容</span></div>" +
      '<div class="toc-page-grid">' + html + "</div></div>";
  }

  function renderAbout() {
    view.name = "about";
    heroInput = null;
    main.innerHTML = '<div class="panel prose">' +
      '<h2 style="margin-top:0">这是什么</h2>' +
      "<p>本站把《安徽大学学生手册（2024）》" + DATA.meta.docs + " 份规章制度拆成 " + DATA.meta.paras +
      " 条可检索内容，支持关键词、条款号（如“第三十条”）和日常说法（如“挂科”“保研”）检索，结果可直接跳到原文条款。</p>" +
      "<h2>数据来源</h2><p>内容来自你提供的《安徽大学学生手册 2024》PDF（第 185–260 页扫描整理，共 153 页）。" +
      "正文由 PDF 文本层与 OCR 识别整理而成；其中约 15 页有原始文本层，其余为 OCR 识别结果（48 份文件中有 " +
      DATA.meta.ocrDocs + " 份经过 OCR）。本站已对 OCR 文本做了规则修正与逐段校对，" +
      "但数字与标点仍可能有误差，<b>条款内容请以学校官方发布文件为准</b>。</p>" +
      "<h2>使用技巧</h2><ul>" +
      "<li>按 <code>/</code> 快速聚焦搜索框，<code>Esc</code> 清空，<code>↑</code> <code>↓</code> 选择结果，<code>Enter</code> 打开。</li>" +
      "<li>多个关键词用空格分隔，例如「奖学金 金额」「宿舍 空调 违规」。</li>" +
      "<li>支持 1 个字的识别误差容错，OCR 错字也能搜到，例如「给子」→「给予」。</li>" +
      "<li>左侧可按章节筛选；从结果进入正文后，命中词会高亮显示。</li>" +
      "</ul>" +
      "<h2>章节构成</h2><ul>" +
      DATA.chapters.map(function (ch) {
        return "<li>" + esc(ch.title) + "：" + ch.docs.length + " 份，共 " + paraCount(ch) + " 条</li>";
      }).join("") +
      "</ul></div>";
  }

  function renderDoc(docId, paraId, q) {
    view.name = "doc";
    view.docId = docId;
    heroInput = null;
    var idx = docIndexById[docId];
    if (idx === undefined) { renderAbout(); return; }
    var entry = allDocs[idx];
    var doc = entry.doc;
    var ch = entry.chapter;

    var toc = DATA.chapters.map(function (c) {
      var docs = c.docs.map(function (d) {
        return '<li><a class="' + (d.id === docId ? "current" : "") + '" href="#/doc/' + d.id + '">' +
          esc(d.title) + "</a></li>";
      }).join("");
      return '<div class="toc-chapter"><button>' + esc(c.title) + "</button><ul class=\"toc-docs\">" + docs + "</ul></div>";
    }).join("");

    var terms = q ? q.split(/[\s,，、]+/).filter(Boolean) : [];
    var body = doc.paras.map(function (p) {
      var html = esc(p.t);
      if (terms.length) { html = highlightText(p.t, terms); }
      var cls = /^第[一二三四五六七八九十百零〇0-9]{1,4}[条章]/.test(p.t) ? "clause" : "";
      return '<p class="' + cls + '" id="' + p.id + '"><a class="anchor" href="#/doc/' + docId + "/p/" + p.id +
        '" aria-label="锚点">§</a>' + html + "</p>";
    }).join("");

    var prev = allDocs[idx - 1], next = allDocs[idx + 1];
    main.innerHTML = '<div class="doc-layout">' +
      '<aside class="toc">' + toc + "</aside>" +
      '<article class="doc">' +
      '<div class="crumbs"><a href="#/">检索</a><span>/</span><a href="#/toc">目录</a><span>/</span>' +
      esc(ch.title) + (q ? ' <a class="back-link" href="#/?q=' + encodeURIComponent(q) + '">← 返回搜索结果</a>' : "") + "</div>" +
      "<h1>" + esc(doc.title) + "</h1>" +
      '<div class="doc-meta"><span class="tag">' + esc(ch.title) + '</span><span class="tag ghost">原文第 ' +
      doc.page + ' 页</span><span class="tag ghost">' + doc.paras.length + " 条</span>" +
      (doc.ocr ? '<span class="ocr-note">OCR 整理，数字与标点可能有误差，请核对原文</span>' : "") + "</div>" +
      '<div class="doc-body">' + body + "</div>" +
      '<div class="doc-nav">' +
      (prev ? '<a href="#/doc/' + prev.doc.id + '">← ' + esc(prev.doc.title) + "</a>" : "<span></span>") +
      (next ? '<a href="#/doc/' + next.doc.id + '">' + esc(next.doc.title) + " →</a>" : "<span></span>") +
      "</div></article></div>" +
      '<button class="toc-fab" id="tocFab" aria-label="打开目录">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>目录</button>' +
      '<div class="toc-sheet" id="tocSheet"><div class="toc-sheet-head"><b>全站目录</b>' +
      '<button class="toc-sheet-close" id="tocClose" aria-label="关闭">完成</button></div>' +
      '<div class="toc-sheet-body">' + toc + "</div></div>" +
      '<div class="toc-backdrop" id="tocBackdrop" hidden></div>';

    (function bindTocSheet() {
      var fab = document.getElementById("tocFab");
      var sheet = document.getElementById("tocSheet");
      var backdrop = document.getElementById("tocBackdrop");
      var close = document.getElementById("tocClose");
      function open() {
        sheet.classList.add("open");
        backdrop.hidden = false;
        document.body.style.overflow = "hidden";
      }
      function shut() {
        sheet.classList.remove("open");
        backdrop.hidden = true;
        document.body.style.overflow = "";
      }
      fab.addEventListener("click", open);
      close.addEventListener("click", shut);
      backdrop.addEventListener("click", shut);
      Array.prototype.forEach.call(sheet.querySelectorAll("a"), function (a) {
        a.addEventListener("click", shut);
      });
    })();

    if (paraId) {
      var el = document.getElementById(paraId);
      if (el) {
        setTimeout(function () {
          if (el.scrollIntoView) { el.scrollIntoView({ block: "center", behavior: "smooth" }); }
          el.style.transition = "background .6s ease";
          el.style.background = "#fff8e3";
          setTimeout(function () { el.style.background = ""; }, 1600);
        }, 60);
      }
    } else {
      if (window.scrollTo) { window.scrollTo({ top: 0 }); }
    }
  }

  function highlightText(text, terms) {
    var spans = [];
    var lower = text.toLowerCase();
    var probes = [];
    terms.forEach(function (t) {
      if (!t) { return; }
      probes.push(t);
      var n = HS.normalize(t);
      if (n && n !== t) { probes.push(n); }
    });
    probes.forEach(function (t) {
      var from = 0, guard = 0;
      while (guard++ < 40) {
        var at = lower.indexOf(t, from);
        if (at === -1) { break; }
        spans.push([at, at + t.length]);
        from = at + t.length;
      }
    });
    if (!spans.length) { return esc(text); }
    spans.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    spans.forEach(function (s) {
      var last = merged[merged.length - 1];
      if (last && s[0] <= last[1]) { last[1] = Math.max(last[1], s[1]); }
      else { merged.push(s.slice()); }
    });
    return HS.highlight(text, merged);
  }

  /* ------------------------------------------------------------ router */
  function route() {
    var hash = location.hash.replace(/^#/, "");
    if (!hash) { hash = "/"; }
    var qi = hash.indexOf("?");
    var path = qi >= 0 ? hash.slice(0, qi) : hash;
    var query = qi >= 0 ? new URLSearchParams(hash.slice(qi + 1)) : new URLSearchParams();
    var q = query.get("q") || "";
    var seg = path.split("/").filter(Boolean);

    focusIndex = -1;
    applyPlaceholder();

    if (seg[0] === "doc" && seg[1]) {
      var pid = seg[2] === "p" ? seg[3] : null;
      view.query = q;
      input.value = q;
      clearBtn.hidden = !q;
      renderDoc(seg[1], pid, q);
      setActiveNav("");
      return;
    }
    if (seg[0] === "toc") { renderToc(); setActiveNav("toc"); return; }
    if (seg[0] === "about") { renderAbout(); setActiveNav("about"); return; }

    view.query = q;
    view.chapter = query.get("ch") || "";
    input.value = q;
    clearBtn.hidden = !q;
    renderHome();
    setActiveNav("home");
    if (q) { if (window.scrollTo) { window.scrollTo({ top: 0 }); } }
  }

  function setActiveNav(name) {
    Array.prototype.forEach.call(document.querySelectorAll(".nav-link"), function (a) {
      a.classList.toggle("active", a.getAttribute("data-nav") === name);
    });
  }

  /* ------------------------------------------------------------ events */
  document.getElementById("searchForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var first = document.querySelector(".result");
    if (first) { first.click(); }
  });
  input.addEventListener("input", function () {
    setQuery(input.value);
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      var first = document.querySelector(".result");
      if (first) { first.click(); }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveFocus(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveFocus(-1);
    } else if (e.key === "Escape") {
      input.value = "";
      setQuery("");
      input.blur();
    }
  });
  clearBtn.addEventListener("click", function () {
    input.value = "";
    setQuery("");
    input.focus();
  });

  function moveFocus(delta) {
    var nodes = document.querySelectorAll(".result");
    if (!nodes.length) { return; }
    focusIndex = Math.max(-1, Math.min(nodes.length - 1, focusIndex + delta));
    Array.prototype.forEach.call(nodes, function (n, i) { n.classList.toggle("focused", i === focusIndex); });
    if (focusIndex >= 0 && nodes[focusIndex].scrollIntoView) { nodes[focusIndex].scrollIntoView({ block: "nearest" }); }
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });

  window.addEventListener("scroll", function () {
    topbar.classList.toggle("scrolled", window.scrollY > 6);
  }, { passive: true });

  window.addEventListener("hashchange", route);
  window.addEventListener("resize", applyPlaceholder);

  document.getElementById("footerMeta").textContent =
    "共 " + DATA.meta.docs + " 份文件 · " + DATA.meta.paras + " 条内容 · 约 " +
    (DATA.meta.chars / 10000).toFixed(1) + " 万字 · 数据整理于 2026-11";

  route();
})();




