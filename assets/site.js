/* GHOSTLIGHT interactions. Vanilla, lean, no frameworks. */
(function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Clipboard with fallback ---------- */
  function copyText(text, btn) {
    function done(ok) {
      if (!btn) return;
      btn.classList.remove("ok", "fail");
      var label = btn.querySelector("[data-label]") || btn;
      var original = btn.getAttribute("data-original") || label.textContent;
      if (!btn.getAttribute("data-original")) btn.setAttribute("data-original", original);
      btn.classList.add(ok ? "ok" : "fail");
      label.textContent = ok ? "COPIED" : "FAILED";
      setTimeout(function () {
        btn.classList.remove("ok", "fail");
        label.textContent = btn.getAttribute("data-original");
      }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        done(ok);
      } catch (e) { done(false); }
    }
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-copy]");
    if (btn) { copyText(btn.getAttribute("data-copy"), btn); }
  });


  /* ---------- Long codeblocks: collapse with expander ---------- */
  document.querySelectorAll(".codeblock").forEach(function (block) {
    var body = block.querySelector("pre");
    if (!body || block.querySelector(".codeblock-expand")) return;
    if (body.scrollHeight > 360) {
      block.classList.add("long");
      var wrap = document.createElement("div");
      wrap.className = "codeblock-body";
      block.insertBefore(wrap, body);
      wrap.appendChild(body);
      var btn = document.createElement("button");
      btn.className = "codeblock-expand";
      btn.innerHTML = '<span class="more">Show full output</span><span class="less">Show less</span>';
      btn.setAttribute("aria-expanded", "false");
      btn.addEventListener("click", function () {
        var open = block.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      block.appendChild(btn);
    }
  });

  /* ---------- Reveal on scroll ---------- */
  if ("IntersectionObserver" in window && !reduced) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); ro.unobserve(en.target); }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll(".reveal").forEach(function (el) { ro.observe(el); });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Codeblock scroll hint ---------- */
  function hintCheck() {
    document.querySelectorAll(".codeblock-scrollhint").forEach(function (el) {
      var pre = el.querySelector("pre");
      if (!pre) return;
      el.classList.toggle("can-scroll", pre.scrollWidth > pre.clientWidth + 4 && pre.scrollLeft < pre.scrollWidth - pre.clientWidth - 4);
    });
  }
  window.addEventListener("resize", hintCheck, { passive: true });
  document.querySelectorAll(".codeblock-scrollhint pre").forEach(function (pre) {
    pre.addEventListener("scroll", hintCheck, { passive: true });
  });
  hintCheck();

  /* ---------- Home: search + filters ---------- */
  var searchInput = document.querySelector("[data-search-input]");
  if (searchInput) {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".mission-card"));
    var chips = Array.prototype.slice.call(document.querySelectorAll("[data-filter]"));
    var countEl = document.querySelector("[data-result-count]");
    var emptyEl = document.querySelector(".empty-state");
    var activeFilter = "all";
    function apply() {
      var q = searchInput.value.trim().toLowerCase();
      var n = 0;
      cards.forEach(function (c) {
        var hay = (c.getAttribute("data-search") || "").toLowerCase();
        var plat = c.getAttribute("data-platform") || "";
        var okQ = !q || hay.indexOf(q) !== -1;
        var okF = activeFilter === "all" || plat === activeFilter;
        var show = okQ && okF;
        c.style.display = show ? "" : "none";
        if (show) n++;
      });
      if (countEl) countEl.textContent = String(n).padStart(2, "0") + (n === 1 ? " FILE" : " FILES");
      if (emptyEl) emptyEl.classList.toggle("show", n === 0);
    }
    var deb = null;
    searchInput.addEventListener("input", function () {
      clearTimeout(deb);
      deb = setTimeout(apply, 60);
    });
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");
        activeFilter = chip.getAttribute("data-filter");
        apply();
      });
    });
    apply();
  }

  /* ---------- Op pages: scroll spy, checklist, resume, status ---------- */
  var opRoot = document.querySelector(".page[data-op]");
  if (opRoot) {
    var opId = opRoot.getAttribute("data-op");
    var seenKey = "gh-seen-" + opId;
    var seen = {};
    try { seen = JSON.parse(localStorage.getItem(seenKey) || "{}"); } catch (e) { seen = {}; }
    function saveSeen() { try { localStorage.setItem(seenKey, JSON.stringify(seen)); } catch (e) {} }

    var railLinks = Array.prototype.slice.call(document.querySelectorAll(".rail a[href^='#']"));
    var objItems = {};
    document.querySelectorAll(".objectives li[data-phase]").forEach(function (li) {
      objItems[li.getAttribute("data-phase")] = li;
    });
    function markSeen(id) {
      if (seen[id]) return;
      seen[id] = true; saveSeen();
      railLinks.forEach(function (a) {
        if (a.getAttribute("href") === "#" + id) a.classList.add("seen");
      });
      if (objItems[id]) objItems[id].classList.add("done");
      updateCardStatus();
    }
    railLinks.forEach(function (a) {
      var id = a.getAttribute("href").slice(1);
      if (seen[id]) {
        a.classList.add("seen");
        if (objItems[id]) objItems[id].classList.add("done");
      }
    });

    // Phase tracking: viewport-relative rects vs a line 30% down the viewport.
    // Deterministic, no observer lag at section boundaries, no offsetParent math.
    var phaseSections = Array.prototype.slice.call(document.querySelectorAll(".phase[id]"));
    function currentPhaseId() {
      var line = window.innerHeight * 0.3;
      var cur = phaseSections.length ? phaseSections[0].id : null;
      phaseSections.forEach(function (s) { if (s.getBoundingClientRect().top <= line) cur = s.id; });
      return cur;
    }
    function syncRail() {
      var id = currentPhaseId();
      if (!id) return;
      railLinks.forEach(function (a) {
        var on = a.getAttribute("href") === "#" + id;
        if (on && !a.classList.contains("active") && window.innerWidth < 960 && !railInit) {
          a.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
        a.classList.toggle("active", on);
      });
      railInit = false;
      markSeen(id);
    }
    var spyTicking = false;
    var railInit = true;
    window.addEventListener("scroll", function () {
      if (spyTicking) return;
      spyTicking = true;
      requestAnimationFrame(function () { syncRail(); spyTicking = false; });
    }, { passive: true });
    window.addEventListener("resize", function () { syncRail(); });
    syncRail();

    // Resume: throttled scroll save, plus pagehide so the last position survives
    var saveTicking = false;
    function saveScroll() {
      try { localStorage.setItem("gh-scroll-" + opId, String(window.scrollY)); } catch (e) {}
    }
    window.addEventListener("scroll", function () {
      if (saveTicking) return;
      saveTicking = true;
      requestAnimationFrame(function () { saveScroll(); saveTicking = false; });
    }, { passive: true });
    window.addEventListener("pagehide", saveScroll);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") saveScroll();
    });
    if (window.location.hash === "#resume") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
      var restore = function () {
        try {
          var y = parseInt(localStorage.getItem("gh-scroll-" + opId) || "0", 10);
          if (y > 200) {
            var root = document.documentElement;
            var prev = root.style.scrollBehavior;
            root.style.scrollBehavior = "auto";
            window.scrollTo(0, y);
            root.style.scrollBehavior = prev;
            syncRail();
          }
        } catch (e) {}
      };
      if (document.readyState === "complete") { setTimeout(restore, 150); }
      else { window.addEventListener("load", function () { setTimeout(restore, 150); }); }
    }

    function updateCardStatus() {
      // status is read on the home page; nothing to render here
    }

    // One-time onboarding strip
    var onboard = document.querySelector("[data-onboard]");
    if (onboard) {
      var done = false;
      try { done = localStorage.getItem("gh-onboarded") === "1"; } catch (e) {}
      if (!done) {
        onboard.hidden = false;
        var btn = onboard.querySelector("button");
        if (btn) btn.addEventListener("click", function () {
          onboard.hidden = true;
          try { localStorage.setItem("gh-onboarded", "1"); } catch (e) {}
        });
      }
    }
  }

  /* ---------- Home: card status from op progress ---------- */
  document.querySelectorAll(".mission-card[data-op]").forEach(function (card) {
    var opId = card.getAttribute("data-op");
    var seen = {};
    try { seen = JSON.parse(localStorage.getItem("gh-seen-" + opId) || "{}"); } catch (e) {}
    var keys = Object.keys(seen);
    var chip = card.querySelector(".status-chip");
    if (!chip) return;
    var y = 0;
    try { y = parseInt(localStorage.getItem("gh-scroll-" + opId) || "0", 10); } catch (e) {}
    if (seen["debrief"]) {
      chip.textContent = "COMPLETE";
      chip.classList.add("done");
    } else if (keys.length > 0) {
      chip.textContent = "IN PROGRESS";
      chip.classList.add("progress");
      if (y > 200) card.classList.add("has-resume");
    }
  });
})();

/* ---------- Dual theme: notebook folio (default) + classic field dossier ----------
   Shared contract: localStorage key "emi-site-theme". The head script already set
   data-theme before first paint; the toggle flips live with a radial view-transition
   wipe from the toggle, instant swap where unsupported, reduced motion respected. */
(function () {
  "use strict";
  var KEY = "emi-site-theme";
  var root = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  var COLORS = { notebook: "#ece6d5", classic: "#0a0c0f" };
  var NAMES = { notebook: "notebook folio", classic: "dark field dossier" };
  var btn = document.querySelector(".theme-toggle");
  function current() { return root.dataset.theme === "classic" ? "classic" : "notebook"; }
  function apply(t) {
    root.dataset.theme = t;
    if (meta) meta.setAttribute("content", COLORS[t]);
    if (btn) btn.setAttribute("aria-label", "Switch to " + NAMES[t === "classic" ? "notebook" : "classic"] + " theme");
  }
  function toggle() {
    var next = current() === "classic" ? "notebook" : "classic";
    try { localStorage.setItem(KEY, next); } catch (e) {}
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (btn) {
      var r = btn.getBoundingClientRect();
      root.style.setProperty("--tx", Math.round(r.left + r.width / 2) + "px");
      root.style.setProperty("--ty", Math.round(r.top + r.height / 2) + "px");
      btn.classList.toggle("is-flipped", next === "classic");
    }
    if (!reduced && document.startViewTransition) {
      document.startViewTransition(function () { apply(next); });
    } else {
      apply(next);
    }
  }
  if (btn) {
    btn.classList.toggle("is-flipped", current() === "classic");
    btn.addEventListener("click", toggle);
  }
  apply(current());
})();
