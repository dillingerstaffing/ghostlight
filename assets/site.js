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

  /* ---------- Session player ---------- */
  function initSession(session) {
    var tape = session.querySelector(".session-tape");
    var screen = session.querySelector(".session-screen");
    var runBtn = session.querySelector('[data-action="run"]');
    var copyAllBtn = session.querySelector('[data-action="copy-all"]');
    var statusEl = session.querySelector("[data-status]");
    var progressEl = session.querySelector(".session-progress i");
    var speedBtns = session.querySelectorAll("[data-speed]");
    var lines = Array.prototype.slice.call(tape.querySelectorAll(".tline"));
    var speed = 1;
    var state = "ready"; // ready | playing | paused | done
    var raf = null, stepIdx = 0, charIdx = 0, waitUntil = 0, lastT = 0;
    var caret = document.createElement("span");
    caret.className = "caret";
    var targetY = 0, currentY = 0;

    var steps = lines.map(function (el) {
      if (el.classList.contains("cmd")) {
        var span = el.querySelector(".cmdtext");
        return { type: "cmd", el: el, span: span, text: span.textContent };
      }
      return { type: "out", el: el };
    });
    var totalCmds = steps.filter(function (s) { return s.type === "cmd"; }).length;

    speedBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        speedBtns.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        speed = parseFloat(b.getAttribute("data-speed"));
      });
    });

    function setStatus(t) { if (statusEl) statusEl.textContent = t; }
    function setProgress() {
      if (progressEl) progressEl.style.transform = "scaleX(" + (stepIdx / steps.length) + ")";
    }
    function reset() {
      cancelAnimationFrame(raf);
      stepIdx = 0; charIdx = 0; targetY = 0; currentY = 0;
      steps.forEach(function (s) {
        s.el.classList.remove("dim");
        if (s.type === "cmd") { s.span.textContent = ""; if (caret.parentNode) caret.parentNode.removeChild(caret); }
        else { s.el.style.visibility = "hidden"; }
      });
      tape.style.transform = "translateY(0px)";
      setProgress();
    }
    function finish(instant) {
      cancelAnimationFrame(raf);
      steps.forEach(function (s) {
        s.el.classList.remove("dim");
        if (s.type === "cmd") { s.span.textContent = s.text; }
        else { s.el.style.visibility = ""; }
      });
      if (caret.parentNode) caret.parentNode.removeChild(caret);
      stepIdx = steps.length;
      setProgress();
      state = "done";
      runBtn.innerHTML = "RUN REPLAY";
      runBtn.classList.remove("live");
      setStatus("REPLAY COMPLETE, every command above is copyable and reproducible");
      targetY = 0;
      if (!instant) { currentY = targetY; tape.style.transform = "translateY(0px)"; }
    }
    function keepVisible(el) {
      var screenH = screen.clientHeight;
      var top = el.offsetTop + currentY;
      var bottom = top + el.offsetHeight;
      if (bottom > screenH - 60) targetY = Math.min(0, targetY - (bottom - (screenH - 60)));
      if (top < 40) targetY = Math.min(0, targetY + (40 - top));
    }
    function tick(t) {
      if (state !== "playing") return;
      var dt = Math.min(64, t - lastT); lastT = t;
      // smooth tape scroll (transform only)
      currentY += (targetY - currentY) * 0.18;
      if (Math.abs(targetY - currentY) > 0.5) tape.style.transform = "translateY(" + currentY + "px)";
      if (t < waitUntil) { raf = requestAnimationFrame(tick); return; }
      var s = steps[stepIdx];
      if (!s) { finish(false); return; }
      if (s.type === "cmd") {
        if (charIdx === 0) { s.el.appendChild(caret); keepVisible(s.el); }
        var cps = 26 * speed; // chars per second
        charIdx += Math.max(1, Math.round(cps * dt / 1000));
        s.span.textContent = s.text.slice(0, charIdx);
        if (charIdx >= s.text.length) {
          s.span.textContent = s.text;
          charIdx = 0; stepIdx++;
          waitUntil = t + 160 / speed;
        }
      } else {
        s.el.style.visibility = "";
        keepVisible(s.el);
        stepIdx++;
        waitUntil = t + 260 / speed;
      }
      setProgress();
      raf = requestAnimationFrame(tick);
    }
    function play() {
      if (state === "playing") return;
      if (state === "done" || state === "ready") { reset(); }
      state = "playing";
      runBtn.innerHTML = "PAUSE";
      runBtn.classList.add("live");
      setStatus("REPLAYING, " + totalCmds + " commands");
      lastT = performance.now();
      raf = requestAnimationFrame(tick);
    }
    function pause() {
      state = "paused";
      cancelAnimationFrame(raf);
      runBtn.innerHTML = "RESUME";
      runBtn.classList.remove("live");
      setStatus("PAUSED");
    }
    runBtn.addEventListener("click", function () {
      if (reduced) { finish(true); return; }
      if (state === "playing") pause(); else play();
    });
    // Double-click run button while paused steps one command. Keep simple: not exposed.
    if (copyAllBtn) {
      copyAllBtn.addEventListener("click", function () {
        var cmds = steps.filter(function (s) { return s.type === "cmd"; }).map(function (s) { return s.text; });
        copyText(cmds.join("\n"), copyAllBtn);
      });
    }
    setStatus("READY, transcript below is the exact verified run");
  }
  document.querySelectorAll("[data-session]").forEach(initSession);

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
  var opRoot = document.querySelector("[data-op]");
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

    if ("IntersectionObserver" in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            var id = en.target.id;
            railLinks.forEach(function (a) {
              var on = a.getAttribute("href") === "#" + id;
              a.classList.toggle("active", on);
              if (on && window.innerWidth < 960) {
                a.scrollIntoView({ block: "nearest", inline: "nearest" });
              }
            });
            markSeen(id);
          }
        });
      }, { rootMargin: "-35% 0px -55% 0px" });
      document.querySelectorAll(".phase[id]").forEach(function (s) { spy.observe(s); });
    }

    // Resume: throttled scroll save
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        try { localStorage.setItem("gh-scroll-" + opId, String(window.scrollY)); } catch (e) {}
        ticking = false;
      });
    }, { passive: true });
    if (window.location.hash === "#resume") {
      try {
        var y = parseInt(localStorage.getItem("gh-scroll-" + opId) || "0", 10);
        if (y > 200) { setTimeout(function () { window.scrollTo(0, y); }, 60); }
      } catch (e) {}
      history.replaceState(null, "", window.location.pathname);
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
      if (y > 200) {
        card.classList.add("has-resume");
        var resume = card.querySelector(".resume-chip");
        if (resume) resume.parentNode.setAttribute("href", resume.parentNode.getAttribute("href"));
      }
    }
  });
  // Resume chips point at #resume
  document.querySelectorAll(".mission-card .resume-chip").forEach(function (r) {
    var link = r.closest("a.mission-card");
    if (link && link.getAttribute("href").indexOf("#resume") === -1) {
      link.setAttribute("href", link.getAttribute("href") + "#resume");
    }
  });
})();
