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

// Hero: word-by-word headline entrance + pointer parallax on floating artifacts.
(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const h1 = document.querySelector(".hero h1");
  if (h1 && !reduced) {
    const parts = [];
    Array.from(h1.childNodes).forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        n.textContent.split(/(\s+)/).forEach((t) => {
          if (!t) return;
          if (/^\s+$/.test(t)) { parts.push(document.createTextNode(t)); return; }
          const s = document.createElement("span"); s.className = "w"; s.textContent = t; parts.push(s);
        });
      } else { n.classList.add("w"); parts.push(n); }
    });
    h1.textContent = "";
    parts.forEach((p) => h1.appendChild(p));
    h1.querySelectorAll(".w").forEach((w, i) => { w.style.transitionDelay = (0.055 * i) + "s"; });
    requestAnimationFrame(() => requestAnimationFrame(() => h1.classList.add("h1-in")));
  } else if (h1) { h1.classList.add("h1-in"); }

  const hero = document.querySelector(".hero");
  const art = document.querySelector(".hero-art");
  if (!hero || !art || reduced || window.matchMedia("(pointer: coarse)").matches) return;
  const layers = art.querySelectorAll("[data-depth]");
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
  hero.addEventListener("mousemove", (e) => {
    const r = hero.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width - 0.5;
    ty = (e.clientY - r.top) / r.height - 0.5;
    if (!raf) loop();
  });
  function loop() {
    raf = requestAnimationFrame(loop);
    cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
    layers.forEach((l) => {
      const d = parseFloat(l.dataset.depth || "0.5");
      l.style.transform = "translate3d(" + (-cx * 38 * d).toFixed(2) + "px, " + (-cy * 28 * d).toFixed(2) + "px, 0)";
    });
    if (Math.abs(tx - cx) < 0.001 && Math.abs(ty - cy) < 0.001) { cancelAnimationFrame(raf); raf = null; }
  }
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

/* ---------- hero reel: Ken-Burns showreel over project screens ---------- */
// A framed "showreel": each shot's img runs a slow zoom/pan (pure CSS, see the
// m-* classes); this module runs the cut list — dissolve to the next shot and
// update the lower-third tag + progress dots. Pauses on hover and offscreen;
// never starts under prefers-reduced-motion (the first frame just sits still).
(() => {
  const art = document.querySelector(".hero-art");
  const reel = document.querySelector(".hreel");
  if (!art || !reel) return;
  const shots = Array.from(reel.querySelectorAll(".hreel-shot"));
  const tag = reel.querySelector(".hreel-tag");
  const dots = Array.from(reel.querySelectorAll(".hreel-dots i"));
  if (shots.length < 2) return;
  let i = 0;

  const cut = (n) => {
    const cur = shots[i], next = shots[n];
    cur.classList.add("out");          // outgoing dissolves above…
    next.classList.add("on");          // …the incoming, already moving
    setTimeout(() => cur.classList.remove("on", "out"), 1050);
    if (tag) {
      tag.textContent = next.dataset.name || "";
      tag.classList.remove("bump"); void tag.offsetWidth; tag.classList.add("bump");
    }
    dots.forEach((d, k) => d.classList.toggle("on", k === n));
    i = n;
  };

  shots[0].classList.add("on");
  if (tag) tag.textContent = shots[0].dataset.name || "";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const SHOT_MS = 5600;
  let timer = setInterval(() => cut((i + 1) % shots.length), SHOT_MS);
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const start = () => { if (!timer) timer = setInterval(() => cut((i + 1) % shots.length), SHOT_MS); };
  art.addEventListener("mouseenter", stop);
  art.addEventListener("mouseleave", start);
  // don't churn while the hero is scrolled away
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => {
      if (es[es.length - 1].isIntersecting) start(); else stop();
    }).observe(reel);
  }
})();

/* ---------- hero v2: curtain cleanup + cursor-weight intro ---------- */
// The intro line is split into chars; each char's variable-font weight rises
// as the cursor approaches (Plus Jakarta Sans is loaded as a variable font).
// Screen readers get the sentence via aria-label on the h1.
(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const curtain = document.querySelector(".curtain");
  if (curtain) {
    if (reduced) curtain.remove(); // CSS hides it; drop the node too
    else curtain.addEventListener("animationend", () => curtain.remove());
  }

  const intro = document.querySelector(".hero2-intro");
  if (!intro) return;

  const text = intro.textContent.trim().replace(/\s+/g, " ");
  intro.setAttribute("aria-label", text);

  // split into word spans (keep wrapping word-level) holding char spans
  const chars = [];
  const frag = document.createDocumentFragment();
  text.split(" ").forEach((word, i) => {
    if (i) frag.appendChild(document.createTextNode(" "));
    const w = document.createElement("span");
    w.className = "w2";
    w.setAttribute("aria-hidden", "true");
    for (const ch of word) {
      const c = document.createElement("span");
      c.textContent = ch;
      w.appendChild(c);
      chars.push(c);
    }
    frag.appendChild(w);
  });
  intro.textContent = "";
  intro.appendChild(frag);

  if (reduced || !window.matchMedia("(pointer: fine)").matches) return;

  const BASE = 500, MAX = 800, SIGMA = 58, CUTOFF = 240;
  const n = chars.length;
  const cur = new Float32Array(n).fill(BASE);
  const shown = new Int16Array(n).fill(BASE);
  let cx = new Float32Array(n), cy = new Float32Array(n); // char centers, page coords
  let mx = -1e4, my = -1e4, raf = null;

  const measure = () => {
    chars.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      cx[i] = r.left + r.width / 2 + window.scrollX;
      cy[i] = r.top + r.height / 2 + window.scrollY;
    });
  };
  // measure once entrance animation + fonts settle; keep fresh on resize
  const settle = () => setTimeout(measure, 1600);
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(settle);
  window.addEventListener("resize", () => setTimeout(measure, 120), { passive: true });

  const loop = () => {
    raf = requestAnimationFrame(loop);
    let busy = false;
    for (let i = 0; i < n; i++) {
      const dx = cx[i] - mx, dy = cy[i] - my;
      const d = Math.sqrt(dx * dx + dy * dy);
      const target = d > CUTOFF ? BASE : BASE + (MAX - BASE) * Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
      cur[i] += (target - cur[i]) * 0.16;
      if (Math.abs(target - cur[i]) > 0.4) busy = true;
      const rounded = Math.round(cur[i]);
      if (rounded !== shown[i]) {
        shown[i] = rounded;
        chars[i].style.fontVariationSettings = '"wght" ' + rounded;
      }
    }
    if (!busy) { cancelAnimationFrame(raf); raf = null; }
  };
  window.addEventListener("mousemove", (e) => {
    mx = e.clientX + window.scrollX;
    my = e.clientY + window.scrollY;
    if (!raf) loop();
  }, { passive: true });
})();

/* ---------- hero v2: project cards drifting along an arc ---------- */
// matmac-style strip: each card rides a CSS offset-path arc; a rAF loop
// advances a shared offset so the whole set drifts, fading at both ends.
// offset-rotate:auto (the default) tilts cards to follow the curve.
(() => {
  const arc = document.querySelector(".hero2-arc");
  if (!arc) return;
  if (!CSS.supports("offset-distance", "0%")) { arc.remove(); return; } // no pile-ups on old engines

  const cards = Array.from(arc.querySelectorAll(".hero2-card"));
  const n = cards.length;
  if (!n) return;

  const PATH = 'path("M 1 127 C 1 127 359 1 865 1 C 1371 1 1729 127 1729 127")';
  cards.forEach((c) => { c.style.offsetPath = PATH; });

  const SPACING = 10;                 // % of path between cards
  const CYCLE = n * SPACING;          // full loop length (>100 so cards wrap offstage)
  const BUF = (CYCLE - 100) / 2;      // offstage margin at each end
  const FADE = 9;                     // % of path over which cards fade in/out
  const CRUISE = 1.1, HOVER = 0.25;   // %/s — brisk drift, eases off while inspecting a card

  let base = 0, speed = CRUISE, targetSpeed = CRUISE;
  // real hover only: on touch, pointerout never fires after a tap, which would
  // latch the drift at HOVER (0.25 %/s) for the rest of the session
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    arc.addEventListener("pointerover", (e) => { if (e.target.closest(".hero2-card")) targetSpeed = HOVER; });
    arc.addEventListener("pointerout", (e) => { if (e.target.closest(".hero2-card")) targetSpeed = CRUISE; });
  }
  const place = () => {
    for (let i = 0; i < n; i++) {
      const pos = ((base + i * SPACING) % CYCLE) - BUF;
      const card = cards[i];
      // the cards are links: fading one out is not enough, it has to stop
      // hit-testing too. Off-stage cards keep their last offset-distance and
      // park on the path's end points, which are on screen above ~1560px wide.
      if (pos < 0 || pos > 100) {
        card.style.opacity = "0";
        card.style.pointerEvents = "none";
        continue;
      }
      card.style.offsetDistance = pos.toFixed(3) + "%";
      const op = Math.min(pos / FADE, (100 - pos) / FADE, 1);
      card.style.opacity = op.toFixed(3);
      card.style.pointerEvents = op > 0.4 ? "auto" : "none"; // no clicking a ghost mid-fade
    }
  };
  place();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // static arc

  let last = null, raf = null;
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    speed += (targetSpeed - speed) * 0.06; // glide between cruise and hover pace
    if (last !== null) base = (base + speed * ((now - last) / 1000)) % CYCLE;
    last = now;
    place();
  };
  const start = () => { if (!raf) { last = null; raf = requestAnimationFrame(tick); } };
  const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = null; } };
  start();
  // don't churn while the hero is scrolled away
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => {
      if (es[es.length - 1].isIntersecting) start(); else stop();
    }).observe(arc);
  }
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

// --- case-v2 gallery -------------------------------------------------------
// Auto-advancing slideshow for a .case2-gallery band. Same rules as the
// marquees elsewhere in this file: never runs under reduced motion, idles while
// offscreen, pauses on hover / keyboard focus / touch.
//
// The active dot stretches into a bar whose accent fill sweeps across over the
// slide's dwell — a visible countdown to the next slide. Pausing FREEZES both
// the fill and the timer at the same instant and resuming continues from there,
// so the bar always tells the truth about when the slide will change. That's
// why the timer tracks its own `remaining` instead of re-arming a full dwell.
//
// Navigation is dots, arrows and swipe ONLY. A click on the slide must stay
// free for the image's tap-to-enlarge <a>, so a horizontal drag past the
// threshold suppresses the click that would otherwise follow the touch.
(function () {
  const galleries = document.querySelectorAll(".case2-gallery");
  if (!galleries.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DWELL = 5500;   // ms a slide holds before advancing on its own
  const RESUME = 9000;  // longer dwell after a manual move, so a deliberate choice isn't yanked away
  const SWIPE = 45;     // px of horizontal travel that counts as a swipe

  galleries.forEach((root) => {
    const track = root.querySelector(".c2g-track");
    const slides = Array.from(root.querySelectorAll(".c2g-slide"));
    if (!track || slides.length < 2) return;

    const dots = Array.from(root.querySelectorAll(".c2g-dot"));
    const viewport = root.querySelector(".c2g-viewport");
    let i = 0, timer = null, held = false, visible = true, paused = false;
    let dwell = DWELL, startedAt = 0, remaining = DWELL;

    // Slides differ in height, and the track box is as tall as the TALLEST one —
    // which parks a dead gap between a shorter image and the dots. The viewport
    // hugs the active slide instead (CSS transitions the change). Re-measured on
    // image load and resize, since both change what "the slide's height" is.
    function fitHeight() {
      // offsetHeight: layout height, immune to the inactive slide's scale(.92)
      const content = slides[i].querySelector("a") || slides[i];
      const h = content.offsetHeight;
      if (h && viewport) viewport.style.height = h + "px";
    }
    slides.forEach((s) => {
      const img = s.querySelector("img");
      if (img && !img.complete) img.addEventListener("load", fitHeight);
    });
    window.addEventListener("resize", fitHeight);
    // self-heal: a paint while the tab is hidden measures a 0-height layout and
    // skips; re-fit once the slide transition lands or the tab wakes back up
    track.addEventListener("transitionend", fitHeight);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) fitHeight(); });

    function paint() {
      track.style.transform = "translateX(" + -i * 100 + "%)";
      fitHeight();
      slides.forEach((s, n) => {
        const on = n === i;
        s.classList.toggle("is-active", on);
        // keep offscreen slides out of the tab order and off the AT tree,
        // otherwise Tab lands on a link nobody can see
        s.setAttribute("aria-hidden", on ? "false" : "true");
        const a = s.querySelector("a");
        if (a) a.tabIndex = on ? 0 : -1;
      });
      dots.forEach((d, n) => {
        d.classList.toggle("is-active", n === i);
        d.setAttribute("aria-selected", n === i ? "true" : "false");
      });
    }

    // Restart the fill sweep on the dot that just became the bar. Reassigning
    // the class alone won't replay a CSS animation on an element that already
    // had it, so knock the animation out and force a reflow between.
    function restartFill() {
      root.style.setProperty("--c2g-dwell", dwell + "ms");
      const fill = dots[i] && dots[i].querySelector(".c2g-fill");
      if (!fill) return;
      fill.style.animation = "none";
      void fill.offsetWidth;
      fill.style.animation = "";
    }

    function arm(ms) {
      clearTimeout(timer);
      remaining = ms;
      startedAt = performance.now();
      if (!reduced && !paused) timer = setTimeout(step, ms);
    }

    function step() { go(i + 1); }

    function go(n, manual) {
      i = (n + slides.length) % slides.length;
      dwell = manual ? RESUME : DWELL;
      paint();
      restartFill();
      arm(dwell);
    }

    // One pause state covering hover, focus and offscreen. Freezing stores the
    // time left; releasing arms a timer for exactly that much. The CSS fill is
    // frozen by .is-paused at the same moment, so the two stay in step.
    function sync() {
      const next = held || !visible;
      if (next === paused) return;
      paused = next;
      root.classList.toggle("is-paused", paused);
      if (paused) {
        clearTimeout(timer);
        remaining = Math.max(0, remaining - (performance.now() - startedAt));
      } else {
        startedAt = performance.now();
        if (!reduced) timer = setTimeout(step, remaining);
      }
    }
    const hold = (v) => { held = v; sync(); };

    root.querySelector(".c2g-prev")?.addEventListener("click", () => go(i - 1, true));
    root.querySelector(".c2g-next")?.addEventListener("click", () => go(i + 1, true));
    dots.forEach((d, n) => d.addEventListener("click", () => go(n, true)));

    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { go(i - 1, true); e.preventDefault(); }
      else if (e.key === "ArrowRight") { go(i + 1, true); e.preventDefault(); }
    });

    root.addEventListener("mouseenter", () => hold(true));
    root.addEventListener("mouseleave", () => hold(false));
    root.addEventListener("focusin", () => hold(true));
    root.addEventListener("focusout", () => hold(false));

    // swipe. Tracked on the viewport so the gesture works over the image itself.
    const view = root.querySelector(".c2g-viewport") || root;
    let x0 = null, y0 = null, swiped = false;
    view.addEventListener("touchstart", (e) => {
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; swiped = false;
      hold(true);
    }, { passive: true });
    view.addEventListener("touchmove", (e) => {
      if (x0 === null || swiped) return;
      const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
      // only claim clearly-horizontal travel; vertical stays a page scroll
      if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) {
        go(i + (dx < 0 ? 1 : -1), true);
        swiped = true;
      }
    }, { passive: true });
    view.addEventListener("touchend", () => { x0 = null; hold(false); }, { passive: true });
    // a completed swipe must not also open the enlarged asset
    view.addEventListener("click", (e) => { if (swiped) { e.preventDefault(); swiped = false; } }, true);

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => {
        visible = es[es.length - 1].isIntersecting;
        sync();
      }, { rootMargin: "80px 0px" }).observe(root);
    }

    paint();
    restartFill();
    arm(DWELL); // no-ops under reduced motion
  });
})();

// --- click-to-load video facade (.c2vid) -----------------------------------
// Swaps the thumbnail button for a YouTube iframe on the first click. Nothing
// from youtube.com is requested before that, which is the whole point: the
// visitor who scrolls past pays nothing for a video they never played. Uses
// youtube-nocookie.com, and autoplay=1 so the click that loads it also starts
// it — otherwise the press-play gesture is spent on loading the player.
(() => {
  document.querySelectorAll(".c2vid").forEach((v) => {
    const btn = v.querySelector(".c2vid-btn");
    const id = v.dataset.yt;
    if (!btn || !id) return;
    btn.addEventListener("click", () => {
      const f = document.createElement("iframe");
      f.className = "c2vid-frame";
      f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
      f.title = v.dataset.title || "Product film";
      f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      f.referrerPolicy = "strict-origin-when-cross-origin";
      f.allowFullscreen = true;
      btn.replaceWith(f);
      f.focus();
    });
  });
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
