/* --- strings this script writes into the DOM -------------------------------
 * The Georgian page is a separate document (ka/index.html) sharing this file,
 * so the copy JS creates at runtime has to follow the document's language.
 * Everything else on the site is translated in the HTML itself, which is where
 * translated copy belongs — this map is deliberately the exception, not a
 * general i18n layer. An unknown lang falls back to English rather than
 * rendering a key.
 *
 * `briefs` are the illustrative console entries: [brief, answer, tool label].
 * They stay ILLUSTRATIVE in both languages — generic problems the studio is
 * built for, never a claim about a named client.
 */
const I18N = (() => {
  const S = {
    en: {
      openMenu: "Open menu",
      closeMenu: "Close menu",
      required: "This field is required.",
      mailSubject: "New project — ",
      mailName: "Name: ",
      mailBusiness: "Business: ",
      mailNeed: "Need: ",
      mailReach: "Reach me at: ",
      briefs: [["a claims portal that agents fight with every day", "→ Product & UX: research, rebuilt flows, prototype.", "Product & UX"], ["a public site that fails its WCAG audit", "→ Accessibility: audit, fixes, AA from the wireframe.", "Accessibility"], ["three products, three different button styles", "→ Design system: one foundation, every team aligned.", "Design system"], ["an idea that needs to become a working product", "→ Design + build: from concept to launch.", "Design + build"]]
    },
    ka: {
      openMenu: "მენიუს გახსნა",
      closeMenu: "მენიუს დახურვა",
      required: "ეს ველი სავალდებულოა.",
      mailSubject: "ახალი პროექტი — ",
      mailName: "სახელი: ",
      mailBusiness: "ბიზნესი: ",
      mailNeed: "საჭიროება: ",
      mailReach: "კონტაქტი: ",
      briefs: [["განაცხადების პორტალი, რომელსაც აგენტები ყოველდღე ებრძვიან", "→ პროდუქტი და UX: კვლევა, თავიდან აწყობილი სცენარები, პროტოტიპი.", "პროდუქტი და UX"], ["საჯარო ვებსაიტი, რომელიც WCAG აუდიტს ვერ გადის", "→ ხელმისაწვდომობა: აუდიტი, გასწორებები, AA ვაირფრეიმიდან.", "ხელმისაწვდომობა"], ["სამი პროდუქტი, ღილაკის სამი სხვადასხვა სტილი", "→ დიზაინ სისტემა: ერთი საფუძველი, ყველა გუნდი ერთ რიტმში.", "დიზაინ სისტემა"], ["იდეა, რომელიც მომუშავე პროდუქტად უნდა იქცეს", "→ დიზაინი + აწყობა: კონცეფციიდან გაშვებამდე.", "დიზაინი + აწყობა"]]
    },
  };
  return S[(document.documentElement.lang || "en").slice(0, 2)] || S.en;
})();

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

// Mobile carousels: at mobile widths the CSS transform-marquees can't be swiped
// and their :hover pause sticks on a tap. So there we turn the tracks into native
// horizontal scrollers (see styles.css) and drive a gentle auto-advance here that
// PAUSES while a finger is down and, ~1.5s after release, EASES back into motion
// (ramps the speed up) — mirroring the desktop hover behaviour.
// Testimonials also collapse from two rows to one ordered row on mobile.
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // TOUCH **or** MOBILE-WIDTH — must stay identical to the media query in
  // styles.css that makes the tracks scrollable. This used to test the pointer
  // alone, so a narrow window on a mouse machine (a resized browser, the preview
  // pane, a touch laptop) got the scroller CSS's sibling breakpoints but never
  // this driver: the cards sat in an un-swipeable, barely-moving marquee.
  const mobile = window.matchMedia("(hover: none) and (pointer: coarse), (max-width: 760px)");

  // Rebuild the two testimonial rows into a single row in a deliberate order:
  // lead with a photo, then two cards, then the other photo, then the rest.
  function reflowTestimonialsToOneRow() {
    const m = document.querySelector(".t-marquee");
    if (!m) return null;
    const orig = {};
    m.querySelectorAll(".t-card:not([aria-hidden])").forEach((c) => { orig[c.dataset.p] = c; });
    const order = ["andres", "ilya", "jamell", "jayne", "cta"];
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
      // Back on the desktop layout the CSS marquee owns the track again; a leftover
      // scrollLeft would offset it on top of its own transform, so park it at 0 and
      // stop advancing until the mobile query matches again.
      if (!mobile.matches) {
        if (pos !== 0) { pos = 0; el.scrollLeft = 0; }
      } else if (visible && !paused) {
        const ramp = Math.min(1, (performance.now() - rampStart) / 900); // ease speed back in
        pos += speed * ramp * dt;
        wrap();
        el.scrollLeft = pos;
      }
      requestAnimationFrame(frame);
    });
  }

  // reflowTestimonialsToOneRow() rewrites .t-marquee's children, so it must run
  // exactly once — hence the latch rather than re-running on every media change.
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    const oneRow = reflowTestimonialsToOneRow();
    drive(oneRow, 120, 2);                              // testimonials (8 cards, gentle)
    drive(document.querySelector(".work-track"), 38, 2); // projects
  };

  if (mobile.matches) start();
  // Rotating a phone, or dragging a desktop window narrow, crosses the breakpoint
  // after load — without this the carousels would only ever exist if the page
  // happened to be loaded at mobile width.
  mobile.addEventListener("change", (e) => { if (e.matches) start(); });
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
    toggle.setAttribute("aria-label", open ? I18N.closeMenu : I18N.openMenu);
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
  // The three copy strings per brief come from I18N at the top of this file;
  // the tool keys that light the dock are language-independent, so they stay here.
  const PAIRS = [
    [...I18N.briefs[0], ["figma", "claude"]],
    [...I18N.briefs[1], ["claude", "gpt"]],
    [...I18N.briefs[2], ["figma", "claude", "gemini"]],
    [...I18N.briefs[3], ["figma", "claude", "lovable"]],
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
// own mail app carries the brief. Swap for a real endpoint (Formspree /
// serverless) when one exists.
//
// Validation is ours, not the browser's. The native bubble ("Please fill out this
// field") is a tooltip the page can't style, position or keep on screen: it points
// at whatever field the browser picked, vanishes on the next click, and on a long
// mobile page it can fire against a field that is scrolled out of view entirely —
// the visitor sees a form that simply refused to send. So on submit we mark every
// offending field, write a real message under it, then scroll the FIRST one into
// view and focus it.
//
// Progressive enhancement, same contract as the custom <select>: `required` stays
// in the markup and `novalidate` is set HERE, from JS. If this script never runs,
// the browser's own validation is still on duty.
(() => {
  const form = document.getElementById("startForm");
  if (!form) return;
  form.setAttribute("novalidate", "");

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Icon + colour, never colour alone — the accent of this brand is green and
  // green/red is the worst pair for red-green colourblindness (see --err).
  const ICON =
    '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round">' +
    '<circle cx="8" cy="8" r="6.6"/><path d="M8 4.7v4"/><path d="M8 11.1h.01"/></svg>';

  const fieldOf = (el) => el.closest(".cfield") || el.parentElement;

  const clearError = (el) => {
    if (el.getAttribute("aria-invalid") !== "true") return;
    el.removeAttribute("aria-invalid");
    el.removeAttribute("aria-describedby");
    const msg = fieldOf(el).querySelector(".cfield-error");
    if (msg) msg.remove();
  };

  const showError = (el, text) => {
    const field = fieldOf(el);
    let msg = field.querySelector(".cfield-error");
    if (!msg) {
      // <span>, not <p>: the two required fields sit in a <div class="cfield">, but
      // the optional ones are still <label> wrappers — and <label> only accepts
      // phrasing content, so a <p> here would be invalid the day one of those
      // becomes required.
      msg = document.createElement("span");
      msg.className = "cfield-error";
      // role=alert so the message is announced the moment it lands, not only when
      // focus reaches the field.
      msg.setAttribute("role", "alert");
      msg.id = "err-" + (el.name || Math.random().toString(36).slice(2));
      field.appendChild(msg);
    }
    msg.innerHTML = ICON + "<span></span>";
    msg.querySelector("span").textContent = text;
    el.setAttribute("aria-invalid", "true");
    el.setAttribute("aria-describedby", msg.id);
    return field;
  };

  // Required-and-empty only. Nothing here guesses at the SHAPE of "Phone or email":
  // that field legitimately holds +995…, a mail address, or a messenger handle, and
  // a regex that rejects one of those would be a worse bug than no check at all.
  const invalidFields = () =>
    Array.from(form.elements).filter(
      (el) => el.willValidate && el.required && !el.value.trim()
    );

  // Clear a field's error as soon as it has content — an error that outlives the
  // mistake trains people to ignore it.
  form.addEventListener("input", (e) => {
    if (e.target.value && e.target.value.trim()) clearError(e.target);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    Array.from(form.elements).forEach(clearError);
    const bad = invalidFields();
    if (bad.length) {
      let firstField = null;
      bad.forEach((el) => {
        const field = showError(el, el.dataset.error || I18N.required);
        if (!firstField) firstField = field;
      });
      // Focus first (preventScroll, or the browser's own jump fights the smooth
      // scroll), then bring the whole field — label, input, message — into view.
      // .cfield carries scroll-margin-top so it clears the sticky nav.
      bad[0].focus({ preventScroll: true });
      firstField.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      return;
    }

    const v = (n) => (form.elements[n] && form.elements[n].value.trim()) || "—";
    const subject = I18N.mailSubject + (v("business") !== "—" ? v("business") : v("name"));
    const body = [
      I18N.mailName + v("name"),
      I18N.mailBusiness + v("business"),
      I18N.mailNeed + v("need"),
      I18N.mailReach + v("reach"),
      "",
      v("message") === "—" ? "" : v("message"),
    ].join("\n");
    window.location.href =
      "mailto:contact@kinetik.ge?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
  });
})();


/* ---------------------------------------------------------------------------
 * Custom select — ARIA 1.2 combobox + listbox, so the dropdown matches the dark
 * brand instead of the OS popup the native control opens.
 *
 * PROGRESSIVE ENHANCEMENT, deliberately: the real <select> stays in the DOM and
 * remains the single source of truth. The form handler reads
 * form.elements.need.value and never learns this widget exists, and if this
 * module never runs (JS off, an error above it) the user gets the styled native
 * control, which still works. Only ever hide the native one from here.
 *
 * Accessibility is a service this studio sells, so the full pattern is here:
 * roles, aria-expanded/-selected/-activedescendant, arrow/Home/End/Enter/Escape/
 * Tab handling, and type-ahead. Focus never leaves the button — the active
 * option is communicated with aria-activedescendant, per the listbox pattern.
 * ------------------------------------------------------------------------- */
(function () {
  document.querySelectorAll("select[data-ksel]").forEach(build);

  function build(sel) {
    const key = sel.name || sel.id;
    const opts = Array.from(sel.options);
    const labelId = sel.getAttribute("aria-labelledby") || "";

    const wrap = document.createElement("div");
    wrap.className = "ksel";

    const btn = document.createElement("button");
    btn.type = "button";                       // never submit the form
    btn.className = "ksel-btn";
    btn.id = "ksel-btn-" + key;
    btn.setAttribute("role", "combobox");
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "ksel-list-" + key);
    // name = the field label + the current value, the way a native select reads
    btn.setAttribute("aria-labelledby", (labelId + " " + btn.id).trim());

    const val = document.createElement("span");
    val.className = "ksel-value";
    val.textContent = opts[sel.selectedIndex].text;
    btn.appendChild(val);

    const list = document.createElement("ul");
    list.className = "ksel-list";
    list.id = "ksel-list-" + key;
    list.setAttribute("role", "listbox");
    if (labelId) list.setAttribute("aria-labelledby", labelId);
    list.hidden = true;

    opts.forEach((o, i) => {
      const li = document.createElement("li");
      li.className = "ksel-opt";
      li.id = "ksel-opt-" + key + "-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === sel.selectedIndex));
      li.textContent = o.text;
      li.addEventListener("click", () => { commit(i); close(true); });
      li.addEventListener("mousemove", () => setActive(i, false));
      list.appendChild(li);
    });

    wrap.appendChild(btn);
    wrap.appendChild(list);
    sel.parentNode.insertBefore(wrap, sel.nextSibling);
    sel.classList.add("ksel-native");           // display:none — still submits

    let open = false, active = sel.selectedIndex, typed = "", typeTimer = 0;

    function setActive(i, scroll) {
      active = i;
      Array.from(list.children).forEach((li, n) => li.classList.toggle("is-active", n === i));
      btn.setAttribute("aria-activedescendant", "ksel-opt-" + key + "-" + i);
      if (scroll !== false && list.children[i]) list.children[i].scrollIntoView({ block: "nearest" });
    }

    function commit(i) {
      sel.selectedIndex = i;
      val.textContent = opts[i].text;
      Array.from(list.children).forEach((li, n) => li.setAttribute("aria-selected", String(n === i)));
      setActive(i, false);
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function openList() {
      if (open) return;
      open = true;
      list.hidden = false;
      wrap.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      setActive(sel.selectedIndex);
      document.addEventListener("pointerdown", onOutside, true);
    }

    function close(refocus) {
      if (!open) return;
      open = false;
      list.hidden = true;
      wrap.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      btn.removeAttribute("aria-activedescendant");
      document.removeEventListener("pointerdown", onOutside, true);
      if (refocus) btn.focus();
    }

    function onOutside(e) { if (!wrap.contains(e.target)) close(false); }

    btn.addEventListener("click", () => (open ? close(true) : openList()));

    btn.addEventListener("keydown", (e) => {
      const k = e.key;
      if (!open) {
        if (k === "ArrowDown" || k === "ArrowUp" || k === "Enter" || k === " ") {
          e.preventDefault(); openList(); return;
        }
        if (k === "Home") { e.preventDefault(); openList(); setActive(0); return; }
        if (k === "End")  { e.preventDefault(); openList(); setActive(opts.length - 1); return; }
      } else {
        if (k === "ArrowDown") { e.preventDefault(); setActive(Math.min(active + 1, opts.length - 1)); return; }
        if (k === "ArrowUp")   { e.preventDefault(); setActive(Math.max(active - 1, 0)); return; }
        if (k === "Home")      { e.preventDefault(); setActive(0); return; }
        if (k === "End")       { e.preventDefault(); setActive(opts.length - 1); return; }
        if (k === "Enter" || k === " ") { e.preventDefault(); commit(active); close(true); return; }
        if (k === "Escape")    { e.preventDefault(); close(true); return; }
        // Tab commits and lets focus move on, matching the native control
        if (k === "Tab") { commit(active); close(false); return; }
      }
      // type-ahead works open or closed, like a native select
      if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        typed += k.toLowerCase();
        clearTimeout(typeTimer);
        typeTimer = setTimeout(() => (typed = ""), 600);
        const hit = opts.findIndex((o) => o.text.toLowerCase().startsWith(typed));
        if (hit > -1) { open ? setActive(hit) : commit(hit); }
      }
    });
  }
})();
