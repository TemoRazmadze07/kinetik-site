// Scroll-reveal with hard guarantees: content can never stay hidden.
// - Elements already in the viewport are revealed immediately on load.
// - IntersectionObserver animates the rest in as you scroll.
// - Failsafes re-check on load/pageshow/resize, and a final timer reveals
//   anything still pending in the viewport.
(function () {
  // Always load at the top (scrollRestoration is set to "manual" inline in <head>).
  // The 2px nudge forces the compositor to repaint — some embedded browsers
  // otherwise hold a stale blank frame after reload.
  window.scrollTo(0, 0);
  const resetScroll = () => {
    requestAnimationFrame(() => {
      window.scrollTo(0, 2);
      requestAnimationFrame(() => window.scrollTo(0, 0));
    });
  };
  window.addEventListener("load", resetScroll);
  window.addEventListener("pageshow", resetScroll);

  // Self-heal for embedded previews that restore scroll from OUTSIDE the page
  // after load (which can leave a stale, blank compositor frame): if a scroll
  // arrives early with no preceding user input, nudge 1px to force a repaint.
  let userInput = false;
  ["wheel", "touchstart", "keydown", "pointerdown"].forEach((t) =>
    window.addEventListener(t, () => { userInput = true; }, { passive: true, capture: true })
  );
  const healDeadline = performance.now() + 2500;
  window.addEventListener("scroll", () => {
    if (userInput || performance.now() > healDeadline) return;
    requestAnimationFrame(() => { window.scrollBy(0, 1); window.scrollBy(0, -1); });
  }, { passive: true });

  const els = Array.from(document.querySelectorAll(".reveal"));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const showAll = () => els.forEach((el) => el.classList.add("in"));

  if (reduced || !("IntersectionObserver" in window)) {
    showAll();
    return;
  }

  const inViewport = (el) => {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  };

  // Reveal whatever is on screen right now (handles reload mid-page,
  // scroll restoration, anchor jumps).
  const sweep = () => els.forEach((el) => { if (inViewport(el)) el.classList.add("in"); });

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.05 }
  );
  els.forEach((el) => io.observe(el));

  sweep();
  window.addEventListener("load", sweep);
  window.addEventListener("pageshow", sweep);
  window.addEventListener("resize", sweep, { passive: true });
  window.addEventListener("scroll", sweep, { passive: true, once: true });
  setTimeout(sweep, 500);
  setTimeout(sweep, 1500);

  // Smooth scrolling for in-page anchors only (CSS scroll-behavior:smooth is
  // deliberately not used — it breaks scroll restoration on reload).
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (ev) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      ev.preventDefault();
      target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      history.pushState(null, "", a.getAttribute("href"));
    });
  });
})();


// Nav scrollspy: mark the link whose section is in view. Only same-page
// anchors participate (case pages link back to index.html#… and are skipped).
(function () {
  const links = Array.from(document.querySelectorAll('.nav-links a[href^="#"]:not(.btn)'));
  const pairs = links
    .map((a) => [document.querySelector(a.getAttribute("href")), a])
    .filter(([sec]) => sec);
  if (!pairs.length || !("IntersectionObserver" in window)) return;
  const bySection = new Map(pairs);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const link = bySection.get(e.target);
      if (e.isIntersecting) {
        links.forEach((a) => a.classList.remove("active"));
        link.classList.add("active");
      } else if (link.classList.contains("active") && e.boundingClientRect.top > 0) {
        link.classList.remove("active"); // scrolled back above the section
      }
    });
  }, { rootMargin: "-20% 0px -55% 0px" });
  pairs.forEach(([sec]) => io.observe(sec));
})();

// Touch carousels: on coarse-pointer devices the CSS transform-marquees can't be
// swiped and their :hover pause sticks on a tap. So on touch we turn the tracks
// into native horizontal scrollers (see styles.css) and drive a gentle auto-
// advance here that PAUSES while a finger is down and, ~1.5s after release, EASES
// back into motion (ramps the speed up) — mirroring the desktop hover behaviour.
// Testimonials also collapse from two rows to one ordered row on mobile.
(function () {
  if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Rebuild the two testimonial rows into a single row in a deliberate order:
  // lead with a photo, then two cards, then the other photo, then the rest.
  function reflowTestimonialsToOneRow() {
    const m = document.querySelector(".t-marquee");
    if (!m) return null;
    const orig = {};
    m.querySelectorAll(".t-card:not([aria-hidden])").forEach((c) => { orig[c.dataset.p] = c; });
    const order = ["andres", "ilya", "jamell", "jayne", "more"];
    const row = document.createElement("div");
    row.className = "t-row";
    order.forEach((k) => { if (orig[k]) row.appendChild(orig[k]); });          // move the originals
    order.forEach((k) => {                                                     // + a hidden clone set for the loop
      if (!orig[k]) return;
      const d = orig[k].cloneNode(true);
      d.setAttribute("aria-hidden", "true");
      if (d.tagName === "A") d.setAttribute("tabindex", "-1");
      row.appendChild(d);
    });
    m.innerHTML = "";
    m.appendChild(row);
    return row;
  }

  function drive(el, durationSec, periods) {
    if (!el) return;
    let paused = false, resumeAt = 0, rampStart = 0, last = null, visible = true;
    let loopW = el.scrollWidth / periods;      // width of one repeated set
    let speed = loopW / durationSec;           // px per second
    // Position lives in a float accumulator, NOT in el.scrollLeft: mobile Safari
    // stores scrollLeft as an integer, so per-frame increments under 1px
    // (scrollLeft += 0.4) truncate back to the old value and the carousel never
    // moves. We advance `pos` and assign it; sub-pixel progress survives here.
    let pos = el.scrollLeft;
    const recalc = () => { loopW = el.scrollWidth / periods; speed = loopW / durationSec; };
    window.addEventListener("resize", recalc, { passive: true });
    window.addEventListener("load", recalc);

    const wrap = () => {
      if (pos >= loopW) pos -= loopW;
      else if (pos < 0) pos += loopW;
    };
    // touch events are reliable on touch devices (pointer events get canceled once
    // native scrolling takes over): finger down pauses, lift schedules the resume.
    el.addEventListener("touchstart", () => { paused = true; resumeAt = Infinity; }, { passive: true });
    const resumeSoon = () => { if (resumeAt !== 0) resumeAt = performance.now() + 1500; };
    el.addEventListener("touchend", resumeSoon, { passive: true });
    el.addEventListener("touchcancel", resumeSoon, { passive: true });

    // Scrolls we didn't write (finger drags, momentum after release) become the
    // new position, so the auto-advance resumes exactly where the user left off.
    // Momentum also keeps pushing the resume deadline back — motion restarts
    // ~1.5s after the carousel actually comes to rest, not after the finger lifts.
    el.addEventListener("scroll", () => {
      const sl = el.scrollLeft;
      if (Math.abs(sl - pos) > 1.5) {
        pos = sl;
        if (paused && resumeAt !== Infinity) resumeAt = performance.now() + 1500;
      }
      if (pos >= loopW || pos < 0) { wrap(); el.scrollLeft = pos; } // seamless manual loop
    }, { passive: true });

    // don't spend cycles auto-advancing while the carousel is offscreen
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        (es) => { visible = es[es.length - 1].isIntersecting; },
        { rootMargin: "60px 0px" }
      ).observe(el);
    }

    requestAnimationFrame(function frame(t) {
      if (last == null) last = t;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (paused && performance.now() >= resumeAt) { paused = false; rampStart = performance.now(); }
      if (visible && !paused) {
        const ramp = Math.min(1, (performance.now() - rampStart) / 900); // ease speed back in
        pos += speed * ramp * dt;
        wrap();
        el.scrollLeft = pos;
      }
      requestAnimationFrame(frame);
    });
  }

  const oneRow = reflowTestimonialsToOneRow();
  drive(oneRow, 120, 2);                              // testimonials (8 cards, gentle)
  drive(document.querySelector(".work-track"), 38, 2); // projects
})();

// Mobile nav: the hamburger toggles the dropdown menu (≤760px). It closes when
// a link is tapped, on Escape, on an outside click, or when the viewport grows
// back to the desktop layout.
(function () {
  const nav = document.querySelector(".nav");
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (!nav || !toggle || !links) return;

  const setOpen = (open) => {
    nav.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };

  toggle.addEventListener("click", () => setOpen(!nav.classList.contains("nav-open")));
  links.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("nav-open")) { setOpen(false); toggle.focus(); }
  });
  document.addEventListener("click", (e) => {
    if (nav.classList.contains("nav-open") && !nav.contains(e.target)) setOpen(false);
  });
  window.addEventListener("resize", () => { if (window.innerWidth > 760) setOpen(false); }, { passive: true });
})();


/* ---------- mobile nav: hide on scroll down, reveal on scroll up ---------- */
(() => {
  const nav = document.querySelector(".nav");
  if (!nav) return;
  const mq = window.matchMedia("(max-width: 760px)");
  const SHOW_AT = 90; // always visible this close to the top
  const THRESH = 8;   // ignore micro-jitter between direction flips
  let lastY = Math.max(0, window.scrollY), raf = null;
  const update = () => {
    raf = null;
    const y = Math.max(0, window.scrollY);
    if (!mq.matches || nav.classList.contains("nav-open")) { nav.classList.remove("nav-hide"); lastY = y; return; }
    if (y < SHOW_AT) { nav.classList.remove("nav-hide"); lastY = y; return; }
    if (y > lastY + THRESH) { nav.classList.add("nav-hide"); lastY = y; }
    else if (y < lastY - THRESH) { nav.classList.remove("nav-hide"); lastY = y; }
    // inside the jitter window: keep lastY so small deltas accumulate
  };
  window.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  if (mq.addEventListener) mq.addEventListener("change", () => { if (!mq.matches) nav.classList.remove("nav-hide"); });
})();

/* ---------- AI console: real workflow prompts type themselves ----------
   Nothing sits under the console, so this driver only types the prompt/outcome pair
   and lights the matching tools in the title bar and the logo dock below. */
(() => {
  const typed = document.getElementById("aiTyped");
  const out = document.getElementById("aiOut");
  const tool = document.getElementById("aiTool");
  if (!typed || !out) return;
  // Illustrative briefs → the package that answers each. Deliberately generic:
  // these are the kinds of businesses KINETIK is built for, not client claims.
  const PAIRS = [
    ["a claims portal that agents fight with every day",
     "→ Product & UX: research, rebuilt flows, prototype.", "Product & UX", ["figma", "claude"]],
    ["a public site that fails its WCAG audit",
     "→ Accessibility: audit, fixes, AA from the wireframe.", "Accessibility", ["claude", "gpt"]],
    ["three products, three different button styles",
     "→ Design system: one foundation, every team aligned.", "Design system", ["figma", "claude", "gemini"]],
    ["an idea that needs to become a working product",
     "→ Design + build: from concept to launch.", "Design + build", ["figma", "claude", "lovable"]]
  ];
  const dock = {};
  document.querySelectorAll("#process .ai-sicon[data-tool]").forEach((el) => { dock[el.dataset.tool] = el; });
  const lightDock = (keys) => Object.keys(dock).forEach((k) => dock[k].classList.toggle("on", keys.includes(k)));
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    typed.textContent = PAIRS[0][0];
    out.textContent = PAIRS[0][1];
    out.classList.add("show");
    if (tool) tool.textContent = PAIRS[0][2];
    lightDock(PAIRS[0][3]);
    return;
  }
  const sec = document.getElementById("process");
  let visible = true;
  if (sec && "IntersectionObserver" in window) {
    new IntersectionObserver((es) => {
      visible = es[es.length - 1].isIntersecting;
      sec.classList.toggle("paused", !visible);
    }, { rootMargin: "80px 0px" }).observe(sec);
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitVisible = async () => { while (!visible) await sleep(400); };
  (async () => {
    let i = 0;
    for (;;) {
      const [q, a, t, keys] = PAIRS[i % PAIRS.length];
      await waitVisible();
      if (tool) tool.textContent = t;
      lightDock(keys);
      for (let c = 1; c <= q.length; c++) {
        typed.textContent = q.slice(0, c);
        await sleep(26 + Math.random() * 26);
      }
      await sleep(380);
      out.textContent = a;
      out.classList.add("show");
      await sleep(2700);
      await waitVisible();
      out.classList.remove("show");
      await sleep(320);
      while (typed.textContent.length) {
        typed.textContent = typed.textContent.slice(0, -3);
        await sleep(11);
      }
      await sleep(420);
      i++;
    }
  })();
})();


// --- start-project form ------------------------------------------------------
// Static site, no backend yet: the submit composes a mailto so the visitor's
// own mail app carries the brief. Native validation runs first (no novalidate),
// so this only fires with the required fields filled. Swap for a real endpoint
// (Formspree / serverless) when one exists.
(() => {
  const form = document.getElementById("startForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = (n) => (form.elements[n] && form.elements[n].value.trim()) || "—";
    const subject = "New project — " + (v("business") !== "—" ? v("business") : v("name"));
    const body = [
      "Name: " + v("name"),
      "Business: " + v("business"),
      "Need: " + v("need"),
      "Reach me at: " + v("reach"),
      "",
      v("message") === "—" ? "" : v("message"),
    ].join("\n");
    window.location.href =
      "mailto:temorazmadze01@gmail.com?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
  });
})();
