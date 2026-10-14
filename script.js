/* =============================================================
   carterscoding.com: page behavior
   -------------------------------------------------------------
   1. Project cards   built from the PROJECTS array in projects.js
   2. Title effects   a random click animation (never the same twice in a row)
   3. Card tilt       3D tilt + glare that follows the mouse (not on touch)
   4. Particles       glowing dots and drifting 0/1s on a <canvas>
   5. Click bursts    clicking empty background sends a few 1s, 0s, and dots
                      drifting out (drawn on the particle canvas, behind everything)
   6. 404 banner      "you've been redirected" notice after a bad URL (see 404.html)
   Everything respects prefers-reduced-motion.
   ============================================================= */

(() => {
  "use strict";

  /* ---------- Shared helpers ---------- */

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const rand = (min, max) => Math.random() * (max - min) + min;
  const cssVar = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  // The visible viewport, minus any scrollbar (innerWidth includes it), which is
  // exactly the area the fixed canvas and effects layer cover
  const viewport = () => ({
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  });

  /* =============================================================
     1. Project cards
     ============================================================= */

  function renderProjects() {
    const grid = document.getElementById("project-grid");
    if (!grid) return;

    // PROJECTS is a top-level const in projects.js. Reading it can throw if
    // projects.js crashed partway through, so treat that as "no projects".
    let list = [];
    try {
      list = typeof PROJECTS !== "undefined" && Array.isArray(PROJECTS) ? PROJECTS : [];
    } catch {
      /* projects.js failed to run */
    }
    // Skip stray entries (a lone null or a typo) instead of breaking every card
    const projects = list.filter((project) => project && typeof project === "object");

    if (projects.length === 0) {
      const empty = document.createElement("li");
      empty.className = "grid__empty";
      empty.textContent = "No projects yet. Check back soon!";
      grid.replaceChildren(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    projects.forEach((project, index) => fragment.appendChild(createCard(project, index)));
    grid.replaceChildren(fragment);
  }

  /**
   * Builds:
   * <li><a class="card" href="…">
   *   <div class="card__media"><img class="card__img" …></div>
   *   <span class="card__glare"></span>
   *   <div class="card__body"><h3>title</h3><span>open →</span></div>
   * </a></li>
   * Project data is only ever set with textContent (the one innerHTML below is
   * fixed markup), so project text can never inject HTML.
   */
  function createCard(project, index) {
    const id = `project-${index}`;
    const name = project.title || "Untitled project";
    const item = document.createElement("li");

    const card = document.createElement("a");
    card.className = "card";
    card.href = safeUrl(project.url);
    card.style.setProperty("--i", index); // staggered fade-in
    // Screen readers announce just the title as the link name
    card.setAttribute("aria-labelledby", `${id}-title`);

    const media = document.createElement("div");
    media.className = "card__media";

    if (project.image) {
      const img = document.createElement("img");
      img.className = "card__img";
      // The first row is on screen straight away, so load it right away;
      // the rest wait until they're scrolled near. Set before src so it applies.
      img.loading = index < 3 ? "eager" : "lazy";
      if (index === 0) img.fetchPriority = "high";
      img.decoding = "async";
      img.width = 1200; // card images are 1200×900 (4:3, same as the card)
      img.height = 900;
      img.alt = project.alt || `Preview of ${name}`;
      // If the image is missing, fall back to the patterned background
      img.addEventListener("error", () => card.classList.add("card--no-image"), { once: true });
      img.src = project.image;
      media.appendChild(img);
    } else {
      card.classList.add("card--no-image");
    }

    const glare = document.createElement("span");
    glare.className = "card__glare";
    glare.setAttribute("aria-hidden", "true");

    const body = document.createElement("div");
    body.className = "card__body";

    const title = document.createElement("h3");
    title.className = "card__title";
    title.id = `${id}-title`;
    title.textContent = name;

    const cta = document.createElement("span");
    cta.className = "card__cta";
    cta.setAttribute("aria-hidden", "true");
    cta.innerHTML = 'open <span class="card__arrow">→</span>';

    body.append(title, cta);
    card.append(media, glare, body);
    item.appendChild(card);
    return item;
  }

  // Only http(s) links or links on this site; anything else (javascript:,
  // data:, a typo) becomes "#" so a card can never run code when clicked
  function safeUrl(url) {
    if (!url) return "#";
    try {
      const parsed = new URL(url, window.location.href);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "#";
    } catch {
      return "#";
    }
  }

  /* =============================================================
     2. Title click animations
     ============================================================= */

  // Only ASCII so every glyph has the same width in a monospace font (no layout shift)
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#%&*+=<>/\\|{}[]";
  const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

  function initTitle() {
    const button = document.getElementById("title-btn");
    const textEl = document.getElementById("title-text");
    const fxLayer = document.getElementById("fx-layer");
    const cursor = button && button.querySelector(".cursor");
    const page = document.querySelector(".page");
    if (!button || !textEl || !fxLayer || !cursor || !page) return;

    const word = textEl.textContent.trim();

    // The effect that's playing right now, so it can be stopped part-way
    // (window resized, reduced motion switched on): its pending waits are
    // cancelled, its animations are cancelled, and reset() tidies up.
    let current = null;
    // Every element an effect adds, so reset() can always remove them
    const effectNodes = new Set();

    // Like the shared wait(), but stops (rejects) if the effect is stopped
    const wait = (ms) =>
      new Promise((resolve, reject) => {
        const run = current;
        const cancel = () => {
          clearTimeout(timer);
          reject(new DOMException("Effect stopped", "AbortError"));
        };
        const timer = setTimeout(() => {
          if (run) run.cancels.delete(cancel);
          resolve();
        }, ms);
        if (run) run.cancels.add(cancel);
      });
    const stopped = () => !current || current.stopped;

    // Split the word into one <span> per letter so each can be animated
    textEl.textContent = "";
    const chars = [...word].map((letter) => {
      const span = document.createElement("span");
      span.className = "title__char";
      span.textContent = letter;
      textEl.appendChild(span);
      return span;
    });

    // Pin each letter's width so glyph swaps can never nudge the layout
    const lockWidths = () =>
      chars.forEach((span) => (span.style.width = `${span.getBoundingClientRect().width}px`));

    // Where the click happened. Keyboard "clicks" have no pointer position,
    // so those start from the title's center.
    const clickPoint = (event) => {
      if (event.detail && (event.clientX || event.clientY)) return { x: event.clientX, y: event.clientY };
      const rect = button.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };

    /* ---- Animation pool: add a new function here to add an effect ---- */

    // Matrix-style decode: letters cycle through random glyphs, then lock in left to right
    function decode() {
      return new Promise((resolve) => {
        lockWidths();
        chars.forEach((span) => span.classList.add("is-scrambling"));

        const resolveAt = chars.map((_, i) => 250 + i * 60 + rand(0, 140));
        const end = Math.max(...resolveAt);
        const start = performance.now();
        let lastSwap = 0;

        function frame(now) {
          if (stopped()) return resolve();
          const elapsed = now - start;
          const swap = now - lastSwap > 50; // ~20 glyph changes per second
          if (swap) lastSwap = now;

          chars.forEach((span, i) => {
            if (elapsed >= resolveAt[i]) {
              if (span.classList.contains("is-scrambling")) {
                span.textContent = word[i];
                span.classList.replace("is-scrambling", "is-resolved");
              }
            } else if (swap) {
              span.textContent = randomGlyph();
            }
          });

          if (elapsed < end) requestAnimationFrame(frame);
          else wait(FLASH_MS).then(resolve, resolve); // let the last flash finish
        }
        requestAnimationFrame(frame);
      });
    }

    // Letters fly apart, spin, then spring back into place
    function scatter() {
      const size = parseFloat(getComputedStyle(textEl).fontSize);
      const animations = chars.map((span) => {
        const dx = rand(-1.2, 1.2) * size;
        const dy = rand(-1, 1) * size;
        return span.animate(
          [
            { transform: "none", easing: "cubic-bezier(.15,.8,.3,1)" },
            {
              transform: `translate(${dx}px, ${dy}px) rotate(${rand(-200, 200)}deg) scale(${rand(0.5, 1.3)})`,
              opacity: rand(0.3, 0.8),
              offset: 0.4,
              easing: "cubic-bezier(.34,1.56,.64,1)", // overshoot = "snap"
            },
            { transform: "none", opacity: 1 },
          ],
          { duration: 1100, delay: rand(0, 90) }
        );
      });
      return Promise.all(animations.map((a) => a.finished));
    }

    // RGB-split glitch (CSS keyframes) plus a few corrupted letters
    async function glitch() {
      let onEnd;
      const cssDone = new Promise((resolve) => {
        onEnd = (event) => {
          if (event.target === textEl) resolve();
        };
        textEl.addEventListener("animationend", onEnd);
        textEl.addEventListener("animationcancel", onEnd);
      });
      textEl.classList.add("fx-glitch");

      for (let n = 0; n < 6; n++) {
        const i = Math.floor(Math.random() * chars.length);
        chars[i].textContent = randomGlyph();
        chars[i].classList.add("is-glitched");
        await wait(rand(60, 120));
        chars[i].textContent = word[i];
        chars[i].classList.remove("is-glitched");
      }
      try {
        // The CSS animation is ~0.6s; don't hang if it never runs or never ends
        await Promise.race([cssDone, wait(1500)]);
      } finally {
        textEl.removeEventListener("animationend", onEnd);
        textEl.removeEventListener("animationcancel", onEnd);
      }
    }

    // Green rings burst from the click point; letters bounce as the wave passes
    function shockwave(event) {
      const { x, y } = clickPoint(event);

      const { width, height } = viewport();
      const size = Math.max(width, height) * 1.2;
      const rings = [0, 150].map((delay) => {
        const ring = fx("shockwave");
        ring.style.setProperty("--size", `${size}px`);
        ring.style.left = `${x}px`;
        ring.style.top = `${y}px`;
        return ring
          .animate(
            [
              { transform: "scale(0.02)", opacity: 1 },
              { transform: "scale(1)", opacity: 0 },
            ],
            { duration: 1100, delay, easing: "cubic-bezier(.1,.7,.3,1)", fill: "both" }
          )
          .finished.then(() => ring.remove());
      });

      const bounces = chars.map((span) => {
        const rect = span.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const direction = centerX < x ? -1 : 1;
        return span.animate(
          [
            { transform: "none" },
            {
              transform: `translate(${direction * 6}px, -0.35em) scale(1.25)`,
              color: "#ffffff",
              offset: 0.3,
            },
            { transform: "none" },
          ],
          { duration: 600, delay: Math.abs(centerX - x) * 1.1, easing: "cubic-bezier(.3,.7,.4,1)" }
        ).finished;
      });

      return Promise.all([...rings, ...bounces]);
    }

    // Typewriter: backspace the word, pause, retype it. Letters are hidden
    // (not removed) and the cursor slides with a transform, so nothing reflows.
    async function typewriter() {
      cursor.classList.add("is-solid");
      const last = chars[chars.length - 1];
      const endX = last.offsetLeft + last.offsetWidth;
      const placeCursor = (visibleCount) => {
        const x = visibleCount < chars.length ? chars[visibleCount].offsetLeft : endX;
        cursor.style.transform = `translateX(${x - endX}px)`;
      };

      for (let i = chars.length - 1; i >= 0; i--) {
        chars[i].classList.add("is-hidden");
        placeCursor(i);
        await wait(45);
      }
      await wait(450);
      for (let i = 0; i < chars.length; i++) {
        chars[i].classList.remove("is-hidden");
        placeCursor(i + 1);
        await wait(rand(55, 120));
      }
      await wait(250);
    }

    // Old CRT monitor switching off and back on: the title squashes into a
    // glowing line, shrinks to a dot, goes dark, then reverses.
    function crt() {
      const rect = button.getBoundingClientRect();
      const beam = pinned("crt-beam", "", rect.left + rect.width / 2, rect.top + rect.height / 2);
      beam.style.width = `${rect.width}px`;

      // Easing goes on each step (not the whole animation) so the
      // line/dot/off moments land exactly at their offsets
      const frame = (offset, sx, sy, brightness, opacity) => ({
        offset,
        transform: `scale(${sx}, ${sy})`,
        filter: `brightness(${brightness}) saturate(${brightness > 1 ? 0.4 : 1})`,
        opacity,
        easing: "ease-in-out",
      });
      const tube = button.animate(
        [
          frame(0, 1, 1, 1, 1),
          frame(0.1, 1.03, 0.5, 1.8, 1),
          frame(0.2, 1.1, 0.02, 3, 1),   // collapsed to a line
          frame(0.3, 0.01, 0.02, 3, 1),  // then a dot
          frame(0.36, 0, 0, 3, 0),       // off
          frame(0.6, 0, 0, 3, 0),
          frame(0.66, 0.01, 0.02, 3, 1), // dot again
          frame(0.78, 1.1, 0.02, 3, 1),  // line again
          frame(0.9, 0.98, 1.08, 1.5, 1),
          frame(1, 1, 1, 1, 1),
        ],
        { duration: 1600 }
      );
      // A bright horizontal beam that sells the line → dot → off look
      const glow = beam.animate(
        [
          { offset: 0, opacity: 0, transform: "scaleX(1)" },
          { offset: 0.16, opacity: 0, transform: "scaleX(1)" },
          { offset: 0.2, opacity: 1, transform: "scaleX(1.1)" },
          { offset: 0.3, opacity: 1, transform: "scaleX(0.02)" },
          { offset: 0.42, opacity: 0, transform: "scaleX(0.02)" },
          { offset: 0.6, opacity: 0, transform: "scaleX(0.02)" },
          { offset: 0.66, opacity: 1, transform: "scaleX(0.02)" },
          { offset: 0.78, opacity: 1, transform: "scaleX(1.1)" },
          { offset: 0.84, opacity: 0, transform: "scaleX(1)" },
          { offset: 1, opacity: 0, transform: "scaleX(1)" },
        ].map((step) => ({ ...step, easing: "ease-in-out" })),
        { duration: 1600 }
      );
      return Promise.all([tube.finished, glow.finished.then(() => beam.remove())]);
    }

    // Matrix rain: the letters themselves fall away like Matrix code, each one
    // the bright head of a trail of green characters, then drop back into place
    async function rain() {
      const titleSize = parseFloat(getComputedStyle(textEl).fontSize);
      const glyphSize = Math.max(11, Math.round(titleSize * 0.3));
      const letterStyle = getComputedStyle(chars[0]);
      const accent = cssVar("--c-accent") || "#00ff9c";
      const easing = "cubic-bezier(.45,0,.9,.6)"; // speeds up as it falls

      const drops = chars.map((span, i) => {
        const rect = span.getBoundingClientRect();
        const fall = Math.max(viewport().height - rect.top, 0); // all the way off the bottom
        const delay = i * 30 + rand(0, 180);
        // Longer drops take longer, so the speed feels the same on any screen
        const duration = Math.min(Math.max(fall * rand(2, 2.6), 900), 2200);

        // Trail column: starts a little below the letter's top (roughly where
        // lowercase letters begin), so the trail stays hidden until the letter
        // falls, then hugs it all the way down
        const attach = rect.height * 0.28;
        const column = fx("rain");
        column.style.left = `${rect.left + rect.width / 2}px`;
        column.style.top = `${rect.top + attach}px`;
        column.style.height = `${fall + rect.height}px`;
        column.style.fontSize = `${glyphSize}px`;

        const strip = document.createElement("div");
        strip.className = "rain__strip";
        const count = Math.round(rand(6, 12));
        const glyphs = [];
        for (let k = 0; k < count; k++) {
          const glyph = document.createElement("span");
          glyph.textContent = randomGlyph();
          glyph.style.opacity = ((k + 1) / count).toFixed(2); // brightest next to the letter
          glyphs.push(glyph);
          strip.appendChild(glyph);
        }
        column.appendChild(strip);

        // Trail and letter move together: the strip's bottom edge tracks the letter
        const stripHeight = count * glyphSize * 1.1;
        const trail = strip.animate(
          [{ transform: `translateY(${-stripHeight}px)` }, { transform: `translateY(${fall - stripHeight}px)` }],
          { duration, delay, easing, fill: "both" }
        );
        // The falling letter is a copy on the fixed effects layer, so it can
        // drop off the bottom of the screen without ever making the page
        // taller. The real letter is hidden but keeps its space. (Being on the
        // fixed layer, the drops don't follow the page if it scrolls mid-fall;
        // that's the trade-off for never adding a scrollbar.)
        const letter = fx("rain-letter");
        letter.textContent = span.textContent;
        letter.style.left = `${rect.left}px`;
        letter.style.top = `${rect.top}px`;
        letter.style.fontFamily = letterStyle.fontFamily;
        letter.style.fontSize = letterStyle.fontSize;
        letter.style.fontWeight = letterStyle.fontWeight;
        letter.style.lineHeight = `${rect.height}px`;
        span.classList.add("is-hidden");

        const drop = letter.animate(
          [{ transform: "none" }, { transform: `translateY(${fall}px)` }],
          { duration, delay, easing, fill: "both" }
        );
        // Letter and trail stay solid for most of the fall, then dissolve,
        // fully gone by the time they reach the bottom of the screen
        const dissolve = [{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }];
        const fades = [letter, column].map(
          (el) => el.animate(dissolve, { duration, delay, fill: "both" }).finished
        );
        return { span, column, letter, glyphs, trail, drop, fades };
      });

      // Trail characters keep changing as they fall
      const flicker = setInterval(() => {
        drops.forEach(({ glyphs }) => {
          glyphs[Math.floor(Math.random() * glyphs.length)].textContent = randomGlyph();
        });
      }, 70);

      try {
        await Promise.all(
          drops.map(({ trail, drop, fades }) => Promise.all([trail.finished, drop.finished, ...fades]))
        );
      } finally {
        clearInterval(flicker);
        drops.forEach(({ column, letter }) => {
          column.remove();
          letter.remove();
        });
      }

      // Letters drop back in from just above, left to right, with a white flash
      const returns = drops.map(({ span }, i) => {
        span.classList.remove("is-hidden"); // stays invisible until its turn (fill: backwards)
        return span.animate(
          [
            { transform: "translateY(-0.6em)", opacity: 0, color: "#ffffff" },
            { transform: "none", opacity: 1, color: "#ffffff", offset: 0.6 },
            { transform: "none", opacity: 1, color: accent },
          ],
          { duration: 380, delay: i * 40, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }
        ).finished;
      });
      await Promise.all(returns);
      await wait(150);
    }

    // Split-flap board: each letter flips through a few characters like an
    // airport departures board before landing on the right one
    async function flap() {
      const FLAP_GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789";
      // One flip = top half folds away (0 → -90°), glyph swaps, next half folds in (90 → 0°)
      const half = (span, from, to, easing) =>
        span.animate(
          [{ transform: `perspective(300px) rotateX(${from}deg)` }, { transform: `perspective(300px) rotateX(${to}deg)` }],
          { duration: 60, easing, fill: "forwards" }
        ).finished;
      const flipTo = async (span, glyph) => {
        await half(span, 0, -90, "ease-in");
        span.textContent = glyph;
        await half(span, 90, 0, "ease-out");
      };

      lockWidths();
      chars.forEach((span) => span.classList.add("is-flap"));

      await Promise.all(
        chars.map(async (span, i) => {
          await wait(i * 45);
          const flips = 3 + Math.floor(Math.random() * 4);
          for (let k = 0; k < flips; k++) {
            await flipTo(span, FLAP_GLYPHS[Math.floor(Math.random() * FLAP_GLYPHS.length)]);
          }
          await flipTo(span, word[i]);
          span.classList.add("is-resolved");
        })
      );
      await wait(350);
      chars.forEach((span) => span.classList.add("is-flap-out")); // tiles fade away
      await wait(300);
    }

    // Fake loading bar: the word turns into "████░░░░  47%", fills up
    // (with the classic stall near the end), then turns back into the word
    async function progress() {
      const cells = Math.max(chars.length - 5, 1); // room for " 100%" on the right

      const slot = (i, pct) => {
        if (i < cells) {
          const filled = i < Math.round((pct / 100) * cells);
          return [filled ? "█" : "░", filled ? "" : "is-bar-empty"];
        }
        // NBSP rather than a plain space, so the empty slots keep their width
        if (i === cells) return [NBSP, ""];
        const label = `${pct}%`.padStart(4, NBSP);
        return [label[i - cells - 1] || NBSP, "is-meter"];
      };
      const render = (pct) =>
        chars.forEach((span, i) => {
          const [text, cls] = slot(i, pct);
          span.textContent = text;
          span.className = `title__char ${cls}`;
        });

      lockWidths();
      cursor.classList.add("is-solid");

      // The bar rolls out leftward from the cursor
      for (let i = chars.length - 1; i >= 0; i--) {
        const [text, cls] = slot(i, 0);
        chars[i].textContent = text;
        chars[i].className = `title__char ${cls}`;
        await wait(22);
      }

      let pct = 0;
      let stalled = false;
      while (pct < 100) {
        pct = Math.min(100, pct + Math.round(rand(4, 16)));
        render(pct);
        if (pct >= 80 && pct < 100 && !stalled) {
          stalled = true;
          await wait(rand(380, 560)); // "almost done…"
        } else {
          await wait(rand(50, 120));
        }
      }
      await wait(300);

      // Back to the word, left to right
      for (let i = 0; i < chars.length; i++) {
        chars[i].textContent = word[i];
        chars[i].className = "title__char is-resolved";
        await wait(28);
      }
      await wait(FLASH_MS); // let the last letter's flash finish
    }

    // Jello: the word gets poked where you clicked, squishes, and wobbles
    function jello(event) {
      const { x } = clickPoint(event);
      const rect = textEl.getBoundingClientRect();
      const originX = Math.min(Math.max(x - rect.left, 0), rect.width);
      textEl.style.transformOrigin = `${originX}px 100%`;

      const squish = textEl.animate(
        [
          { transform: "none" },
          { transform: "scale(1.2, 0.72)", offset: 0.14 },
          { transform: "scale(0.85, 1.2) skewX(-7deg)", offset: 0.3 },
          { transform: "scale(1.1, 0.9) skewX(5deg)", offset: 0.46 },
          { transform: "scale(0.95, 1.06) skewX(-3deg)", offset: 0.62 },
          { transform: "scale(1.03, 0.97) skewX(1.5deg)", offset: 0.78 },
          { transform: "none" },
        ].map((step) => ({ ...step, easing: "ease-in-out" })),
        { duration: 1100 }
      );

      // Letters jiggle a beat later the farther they are from the poke
      const jiggles = chars.map((span) => {
        const r = span.getBoundingClientRect();
        const distance = Math.abs(r.left + r.width / 2 - x);
        return span.animate(
          [
            { transform: "none" },
            { transform: "translateY(-0.12em) scaleY(1.12)", offset: 0.35 },
            { transform: "translateY(0.04em) scaleY(0.94)", offset: 0.7 },
            { transform: "none" },
          ],
          { duration: 500, delay: 120 + distance * 0.6, easing: "ease-in-out" }
        ).finished;
      });

      return Promise.all([squish.finished, ...jiggles]);
    }

    /* ---- Everyday-computer jokes ---- */

    // Make an element on the fixed effects layer. html must be fixed markup
    // written here, never text from a variable (use textContent for that).
    const fx = (className, html = "") => {
      const el = document.createElement("div");
      el.className = className;
      el.innerHTML = html;
      fxLayer.appendChild(el);
      effectNodes.add(el);
      return el;
    };
    // Same, but placed on the page at viewport point (x, y), so it scrolls
    // along with the title instead of staying stuck to the screen. It's
    // decorative, so it's hidden from screen readers like the fx layer is.
    const pinned = (className, html, x, y) => {
      const el = fx(`fx-pinned ${className}`, html);
      el.setAttribute("aria-hidden", "true");
      const origin = page.getBoundingClientRect();
      page.appendChild(el);
      el.style.left = `${x - origin.left}px`;
      el.style.top = `${y - origin.top}px`;
      return el;
    };
    const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
    const NBSP = "\u00a0"; // no-break space: holds a letter's width where a space would collapse
    const FLASH_MS = 450; // length of the white "resolved" flash (char-flash in styles.css)

    // DVD screensaver: the title shrinks into a logo, bounces around the
    // screen changing color, nails the corner, then flies home
    async function dvd() {
      const COLORS = ["#00ff9c", "#00d8c4", "#ff4fd8", "#ffd84f", "#4f9bff", "#ff7a4f"];
      const textRect = textEl.getBoundingClientRect();
      const titleStyle = getComputedStyle(textEl);
      const logo = fx("dvd", "<span></span>");
      logo.firstChild.textContent = word;
      logo.style.fontFamily = titleStyle.fontFamily;
      logo.style.fontSize = titleStyle.fontSize;
      logo.style.fontWeight = titleStyle.fontWeight;
      logo.style.letterSpacing = titleStyle.letterSpacing;

      // Line the logo's text up exactly with the real title before swapping
      const boxRect = logo.getBoundingClientRect();
      const inner = logo.firstChild.getBoundingClientRect();
      const offsetX = inner.left - boxRect.left;
      const offsetY = inner.top - boxRect.top + inner.height / 2;
      const startX = textRect.left - offsetX;
      const startY = textRect.top + textRect.height / 2 - offsetY;
      const w = boxRect.width;
      const h = boxRect.height;
      const view = viewport();
      const scale = Math.min(Math.min(view.width * 0.42, 240) / w, 0.45);
      // How far the logo can travel (at least 1px, so the maths below never
      // divides by zero on a very short or narrow window)
      const roomX = Math.max(view.width - w * scale, 1);
      const roomY = Math.max(view.height - h * scale, 1);
      const place = (x, y, s) => `translate(${x}px, ${y}px) scale(${s})`;

      textEl.style.visibility = "hidden";
      cursor.style.visibility = "hidden";
      logo.style.transform = place(startX, startY, 1);

      // 1. Shrink into a logo
      const x0 = clamp(startX + (w * (1 - scale)) / 2, 0, roomX);
      const y0 = clamp(startY + (h * (1 - scale)) / 2, 0, roomY);
      await logo.animate(
        [{ transform: place(startX, startY, 1) }, { transform: place(x0, y0, scale) }],
        { duration: 450, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" }
      ).finished;

      // 2. Bounce. The path is planned so it lands exactly in a corner at the
      // end: moving diagonally, each axis must travel a whole number of
      // screen-widths/heights. Pick the combo with the most DVD-like angle.
      const duration = 2800;
      const dirX = Math.random() < 0.5 ? 1 : -1;
      const dirY = Math.random() < 0.5 ? 1 : -1;
      const fromX = dirX > 0 ? x0 : roomX - x0; // distance measured in the travel direction
      const fromY = dirY > 0 ? y0 : roomY - y0;
      let best = null;
      for (let k = 1; k <= 5; k++) {
        for (let m = 1; m <= 5; m++) {
          const vx = (k * roomX - fromX) / duration;
          const vy = (m * roomY - fromY) / duration;
          if (vx <= 0 || vy <= 0) continue;
          const score = Math.abs(Math.log(vx / vy)) + (k + m < 4 ? 0.6 : 0); // prefer a few bounces
          if (!best || score < best.score) best = { vx, vy, score };
        }
      }
      // Can't happen with the 1px minimum above, but never get stuck without a path
      if (!best) best = { vx: roomX / duration, vy: roomY / duration };
      // Unfold the straight-line distance back into the box (a triangle wave)
      const fold = (u, len) => {
        const m = ((u % (2 * len)) + 2 * len) % (2 * len);
        return m <= len ? m : 2 * len - m;
      };
      const at = (t) => {
        const ux = fromX + best.vx * t;
        const uy = fromY + best.vy * t;
        const x = dirX > 0 ? fold(ux, roomX) : roomX - fold(ux, roomX);
        const y = dirY > 0 ? fold(uy, roomY) : roomY - fold(uy, roomY);
        return { x, y, bounces: Math.floor(ux / roomX) + Math.floor(uy / roomY) };
      };
      logo.getAnimations().forEach((a) => a.cancel()); // hand position over to the loop
      logo.style.transform = place(x0, y0, scale);
      logo.classList.add("is-logo"); // border fades in (after the cancel, so its transition survives)
      await new Promise((resolve, reject) => {
        let elapsed = 0;
        let last = performance.now();
        let lastBounces = 0;
        let color = 0;
        const step = (now) => {
          if (stopped()) return reject(new DOMException("Effect stopped", "AbortError"));
          // Clamp both ways: the first frame's timestamp can be a hair before `last`
          elapsed = Math.min(elapsed + Math.max(0, Math.min(now - last, 50)), duration);
          last = now;
          const { x, y, bounces } = at(elapsed);
          if (bounces !== lastBounces) {
            lastBounces = bounces;
            color = (color + 1) % COLORS.length;
            logo.style.color = COLORS[color]; // new color on every wall hit
          }
          logo.style.transform = place(x, y, scale);
          if (elapsed < duration) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });

      // 3. Corner! Celebrate with a flash and a burst of confetti
      const end = at(duration);
      const cornerX = end.x < roomX / 2 ? 0 : view.width;
      const cornerY = end.y < roomY / 2 ? 0 : view.height;
      const inward = Math.atan2(view.height / 2 - cornerY, view.width / 2 - cornerX);
      const confetti = Array.from({ length: 16 }, (_, i) => {
        const bit = fx("confetti");
        bit.style.left = `${cornerX}px`;
        bit.style.top = `${cornerY}px`;
        bit.style.background = COLORS[i % COLORS.length];
        const angle = inward + rand(-0.8, 0.8);
        const dist = rand(60, 170);
        return bit.animate(
          [
            { transform: "translate(0, 0) rotate(0)", opacity: 1 },
            { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) rotate(${rand(-360, 360)}deg)`, opacity: 0 },
          ],
          { duration: rand(600, 900), easing: "cubic-bezier(.2,.8,.3,1)" }
        ).finished.then(
          () => bit.remove(),
          () => {} // stopped early: reset() removes it
        );
      });
      await logo.animate(
        [{ filter: "brightness(1)" }, { filter: "brightness(2.2)" }, { filter: "brightness(1)" }, { filter: "brightness(2.2)" }, { filter: "brightness(1)" }],
        { duration: 650 }
      ).finished;

      // 4. Fly home and turn back into the title. Measure again: the page
      // may have scrolled since the start.
      const accent = cssVar("--c-accent") || "#00ff9c";
      const home = textEl.getBoundingClientRect();
      const homeX = home.left - offsetX;
      const homeY = home.top + home.height / 2 - offsetY;
      await logo.animate(
        [
          { transform: place(end.x, end.y, scale), color: logo.style.color || accent },
          { transform: place(homeX, homeY, 1), color: accent },
        ],
        { duration: 600, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" }
      ).finished;
      textEl.style.visibility = "";
      cursor.style.visibility = "";
      logo.remove();
      await Promise.all(confetti);
    }

    // Caps lock: a caps lock key lights up and the title YELLS for a moment
    async function capslock() {
      const rect = textEl.getBoundingClientRect();
      const key = pinned("keycap", '<span class="keycap__led"></span><span>⇪ caps lock</span>', rect.left + rect.width / 2, rect.top);
      const press = () =>
        key.animate([{ transform: "none" }, { transform: "translateY(3px) scale(0.97)" }, { transform: "none" }], { duration: 160 }).finished;

      lockWidths();
      await key.animate([{ opacity: 0, transform: "translateY(8px) scale(0.8)" }, { opacity: 1, transform: "none" }], {
        duration: 220,
        easing: "ease-out",
      }).finished;
      await wait(150);
      await press();
      key.classList.add("is-on");
      chars.forEach((span, i) => (span.textContent = word[i].toUpperCase()));

      // Shake like it's shouting
      const shake = [0, -7, 7, -6, 6, -4, 4, -2, 0].map((x, i, all) => ({
        transform: `translateX(${x}px) rotate(${x * 0.15}deg)`,
        offset: i / (all.length - 1),
      }));
      await textEl.animate(shake, { duration: 500 }).finished;
      await wait(120);
      await textEl.animate(shake, { duration: 450 }).finished;
      await wait(250);

      await press();
      key.classList.remove("is-on");
      chars.forEach((span, i) => (span.textContent = word[i]));
      await wait(250);
      await key.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(-6px)" }], { duration: 200, fill: "forwards" }).finished;
      key.remove();
    }

    // Low battery: the cursor becomes a draining battery and the title dims,
    // then it gets plugged in and everything brightens back up
    async function battery() {
      const c = cursor.getBoundingClientRect();
      const cell = pinned(
        "battery",
        '<div class="battery__level"></div><svg class="battery__bolt" viewBox="0 0 24 24"><path d="M13.5 1.5 3.5 14h7l-1.5 8.5 11-13h-7z"/></svg>',
        c.left,
        c.top
      );
      cell.style.width = `${c.width}px`;
      cell.style.height = `${c.height}px`;
      cell.style.fontSize = getComputedStyle(textEl).fontSize;
      cursor.style.visibility = "hidden";
      const level = cell.querySelector(".battery__level");
      const bolt = cell.querySelector(".battery__bolt");
      const DIM = "brightness(0.3) saturate(0.5)";

      // Drain: green → yellow → red while the screen dims
      await Promise.all([
        level.animate(
          [{ height: "100%", background: "#3dff8a" }, { height: "50%", background: "#ffd23d" }, { height: "8%", background: "#ff3d5a" }],
          { duration: 1400, fill: "forwards" }
        ).finished,
        textEl.animate([{ filter: "brightness(1)" }, { filter: DIM }], { duration: 1400, fill: "forwards" }).finished,
      ]);
      // Low battery blink
      await cell.animate([{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }], { duration: 650 }).finished;

      // Plugged in!
      bolt.animate(
        [{ opacity: 0, transform: "translate(-50%, -50%) scale(0)" }, { opacity: 1, transform: "translate(-50%, -50%) scale(1.4)", offset: 0.6 }, { opacity: 1, transform: "translate(-50%, -50%) scale(1)" }],
        { duration: 320, fill: "forwards" }
      );
      await wait(200);
      await Promise.all([
        level.animate([{ height: "8%", background: "#ff3d5a" }, { height: "50%", background: "#ffd23d" }, { height: "100%", background: "#3dff8a" }], {
          duration: 700,
          easing: "ease-out",
          fill: "forwards",
        }).finished,
        textEl.animate([{ filter: DIM }, { filter: "brightness(1.6) saturate(1)", offset: 0.75 }, { filter: "brightness(1) saturate(1)" }], {
          duration: 700,
          fill: "forwards",
        }).finished,
      ]);
      await wait(300);
      await cell.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }).finished;
      cursor.style.visibility = "";
      cell.remove();
    }

    // Autocorrect "fixes" the title to something silly, then gets undone
    async function autocorrect() {
      // Same length as the title, so swapping letters never shifts anything
      const WRONG = "carrot scoops".padEnd(word.length).slice(0, word.length);
      const rect = textEl.getBoundingClientRect();
      const fontSize = parseFloat(getComputedStyle(textEl).fontSize);
      const swapTo = async (target, flash) => {
        for (let i = 0; i < chars.length; i++) {
          chars[i].textContent = target[i] === " " ? NBSP : target[i];
          if (flash) chars[i].classList.add("is-resolved");
          await wait(22);
        }
      };

      lockWidths();
      // Red squiggly "spelling mistake" underline
      const squiggle = pinned("squiggle", "", rect.left, rect.top + rect.height * 0.5 + fontSize * 0.42);
      squiggle.style.width = `${rect.width}px`;
      await squiggle.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], {
        duration: 350,
        easing: "ease-out",
        fill: "forwards",
      }).finished;
      await wait(250);

      // Suggestion bubble (measured again: the page may have scrolled since the squiggle)
      const now = textEl.getBoundingClientRect();
      const bubble = pinned("autocorrect", "", now.left + now.width / 2, now.top + now.height * 0.5 + fontSize * 0.62);
      const suggestion = document.createElement("b");
      suggestion.textContent = WRONG.trim();
      bubble.append("Did you mean ", suggestion, "?");
      await bubble.animate([{ opacity: 0, transform: "translateY(-6px) scale(0.9)" }, { opacity: 1, transform: "none" }], {
        duration: 200,
        easing: "ease-out",
      }).finished;
      await wait(650);

      // "Corrected"
      squiggle.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: "forwards" });
      await swapTo(WRONG, false);
      bubble.innerHTML = `<span class="autocorrect__undo">↩ Undo</span>`;
      await wait(900);

      // Undo
      bubble.classList.add("is-pressed");
      await wait(150);
      bubble.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(0.9)" }], { duration: 180, fill: "forwards" });
      await swapTo(word, true);
      await wait(FLASH_MS); // let the last letter's flash finish
      squiggle.remove();
      bubble.remove();
    }

    // Buffering: the title goes blurry like a stalled video while a spinner
    // counts 0% → 100% (getting stuck at 99%, of course), sharpening as it loads
    async function buffering() {
      const rect = textEl.getBoundingClientRect();
      // .spinner__pct has no CSS of its own; it's just the hook used to find the label
      const spinner = pinned("spinner", '<span class="spinner__pct">0%</span>', rect.left + rect.width / 2, rect.top + rect.height / 2);
      const size = Math.round(clamp(rect.height * 0.8, 44, 72));
      spinner.style.setProperty("--s", `${size}px`);
      const label = spinner.querySelector(".spinner__pct");
      const MAX_BLUR = 7;

      // One keyframe: each step starts from whatever blur is showing right now
      const blurTo = (px, duration) =>
        textEl.animate([{ filter: `blur(${px.toFixed(2)}px)` }], { duration, fill: "forwards" }).finished;

      await blurTo(MAX_BLUR, 220);
      let pct = 0;
      let stuck = false;
      while (pct < 100) {
        pct = Math.min(100, pct + Math.round(rand(3, 11)));
        if (pct >= 99 && !stuck) {
          pct = 99; // the classic
          stuck = true;
        }
        label.textContent = `${pct}%`;
        blurTo(MAX_BLUR * (1 - pct / 100), 120);
        await wait(pct === 99 ? rand(650, 850) : rand(70, 150));
      }

      // Loaded: spinner goes away and the title pops back to full sharpness
      spinner.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(0.8)" }], { duration: 220, fill: "forwards" });
      await textEl.animate(
        [
          { filter: "blur(0px) brightness(1)", transform: "scale(1)" },
          { filter: "blur(0px) brightness(1.5)", transform: "scale(1.04)", offset: 0.4 },
          { filter: "none", transform: "none" },
        ],
        { duration: 450, fill: "forwards" }
      ).finished;
      await wait(150);
      spinner.remove();
    }

    const effects = {
      decode, scatter, glitch, shockwave, typewriter,
      crt, rain, flap, progress, jello,
      dvd, capslock, battery, autocorrect, buffering,
    };

    // Optional: ?effects=crt,rain in the page URL limits the rotation to
    // those effects (handy for trying one out). Unknown names are ignored.
    const requested = (new URLSearchParams(window.location.search).get("effects") || "")
      .split(",")
      .map((name) => name.trim())
      .filter((name) => Object.prototype.hasOwnProperty.call(effects, name)); // not "toString" etc.
    const pool = requested.length ? requested : Object.keys(effects);

    // Put every letter back exactly as it started, so any effect can run next
    function reset() {
      chars.forEach((span, i) => {
        span.getAnimations().forEach((animation) => animation.cancel());
        span.textContent = word[i];
        span.className = "title__char";
        span.removeAttribute("style");
      });
      [button, textEl].forEach((el) => el.getAnimations().forEach((animation) => animation.cancel()));
      textEl.className = "title__text";
      textEl.removeAttribute("style");
      cursor.classList.remove("is-solid");
      cursor.removeAttribute("style");
      // Anything an effect left behind (it may have been stopped part-way)
      effectNodes.forEach((el) => el.remove());
      effectNodes.clear();
    }

    // Stop the current effect where it is: pending waits reject, and its
    // script animations are cancelled (so their .finished promises reject).
    // CSS animations are left alone, so the cursor keeps blinking.
    function stopEffect() {
      if (!current || current.stopped) return;
      current.stopped = true;
      current.cancels.forEach((cancel) => cancel());
      current.cancels.clear();
      const animations = [
        ...button.getAnimations({ subtree: true }),
        ...[...effectNodes].flatMap((el) => el.getAnimations({ subtree: true })),
      ];
      animations.forEach((animation) => {
        if (typeof CSSAnimation !== "undefined" && animation instanceof CSSAnimation) return;
        if (typeof CSSTransition !== "undefined" && animation instanceof CSSTransition) return;
        animation.cancel();
      });
    }

    // A width change moves and resizes the title, so positions measured at the
    // start of an effect no longer line up: stop it rather than play it wrong.
    // (Height-only resizes, like a phone's toolbar hiding, don't matter.)
    let lastWidth = viewport().width;
    window.addEventListener("resize", () => {
      const { width } = viewport();
      if (width !== lastWidth) stopEffect();
      lastWidth = width;
    });
    // Reduce motion switched on mid-effect: stop it now, not when it ends
    reducedMotion.addEventListener("change", () => {
      if (reducedMotion.matches) stopEffect();
    });

    let running = false;
    let lastEffect = null;

    button.addEventListener("click", async (event) => {
      if (running || reducedMotion.matches) return; // ignore clicks mid-animation

      // Pick at random, but never the same effect twice in a row
      // (unless the pool only has one effect in it)
      let options = pool.filter((name) => name !== lastEffect);
      if (options.length === 0) options = pool;
      const name = options[Math.floor(Math.random() * options.length)];
      lastEffect = name;
      button.dataset.effect = name; // handy when debugging in DevTools

      running = true;
      current = { stopped: false, cancels: new Set() };
      try {
        await effects[name](event);
      } catch (error) {
        // Stopping an effect rejects its waits/animations on purpose; anything else is a bug
        if (!current.stopped) console.error(`Title effect "${name}" failed:`, error);
      } finally {
        current = null;
        try {
          reset();
        } finally {
          running = false; // never leave the title stuck, even if reset() throws
        }
      }
    });
  }

  /* =============================================================
     3. Card tilt (mouse only)
     ============================================================= */

  function initTilt() {
    const canTilt = (event) =>
      event.pointerType === "mouse" && finePointer.matches && !reducedMotion.matches;

    document.querySelectorAll(".card").forEach((card) => {
      let rect = null;
      let rectScroll = { x: 0, y: 0 }; // page scroll when rect was measured
      let maxTilt = 8;
      let frame = 0;
      let lastEvent = null;

      // Pointer position as 0 → 1 across the card (clamped at the edges).
      // rect is in viewport coordinates from when it was measured, so shift it
      // by however far the page has scrolled since.
      const position = (event) => {
        const clamp = (n) => Math.min(Math.max(n, 0), 1);
        const left = rect.left - (window.scrollX - rectScroll.x);
        const top = rect.top - (window.scrollY - rectScroll.y);
        return {
          px: clamp((event.clientX - left) / rect.width),
          py: clamp((event.clientY - top) / rect.height),
        };
      };

      const moveGlare = ({ px, py }) => {
        card.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
        card.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      };

      const update = () => {
        frame = 0;
        if (!rect || !lastEvent) return;
        const { px, py } = position(lastEvent);
        card.style.setProperty("--ry", `${((px - 0.5) * 2 * maxTilt).toFixed(2)}deg`);
        card.style.setProperty("--rx", `${((0.5 - py) * 2 * maxTilt).toFixed(2)}deg`);
        moveGlare({ px, py });
      };

      card.addEventListener("pointerenter", (event) => {
        if (!canTilt(event)) return;
        // Measure once on enter; measuring mid-tilt would include the tilt itself
        rect = card.getBoundingClientRect();
        rectScroll = { x: window.scrollX, y: window.scrollY };
        maxTilt = parseFloat(getComputedStyle(card).getPropertyValue("--tilt-max")) || 8;
        card.classList.add("is-tilting");
        // Start the glare under the cursor, not wherever it was last time
        lastEvent = event;
        update();
      });

      // Spring back to flat. Leave the glare where the pointer left (when we
      // know it) so it fades out in place.
      const flatten = (event) => {
        cancelAnimationFrame(frame);
        frame = 0;
        if (rect && event && "clientX" in event) moveGlare(position(event));
        rect = null;
        lastEvent = null;
        card.classList.remove("is-tilting");
        card.style.removeProperty("--rx");
        card.style.removeProperty("--ry");
      };

      card.addEventListener("pointermove", (event) => {
        if (!rect) return;
        // Pointer type or reduced motion changed while hovering: stop tilting
        if (!canTilt(event)) return flatten();
        lastEvent = event;
        if (!frame) frame = requestAnimationFrame(update); // at most once per frame
      });

      card.addEventListener("pointerleave", flatten);
      card.addEventListener("pointercancel", flatten);
      // Leaving the page (or coming back from the back/forward cache) mid-hover
      window.addEventListener("pagehide", () => flatten());
    });
  }

  /* =============================================================
     4. Particle background
     ============================================================= */

  function initParticles() {
    const canvas = document.getElementById("particles");
    if (!canvas || !canvas.getContext) return null;
    const ctx = canvas.getContext("2d");
    const sprite = document.createElement("canvas");
    const sctx = sprite.getContext("2d");
    if (!ctx || !sctx) return null; // no 2D canvas: just skip the particles

    // --c-accent-rgb must be "R, G, B" (commas) to work inside rgba(); fall
    // back to the default green if it's been written some other way
    const accentRgb = cssVar("--c-accent-rgb");
    const rgb = /^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/.test(accentRgb) ? accentRgb : "0, 255, 156";
    const font = cssVar("--font-mono") || "monospace";

    let width = 0;
    let height = 0;
    let particles = [];
    let bursts = [];   // short-lived bits from background clicks
    let rafId = 0;
    let running = false;
    let lastTime = 0;

    // Pre-render one soft glowing dot and stamp it; much cheaper than shadowBlur
    sprite.width = sprite.height = 32;
    const gradient = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, `rgba(${rgb}, 1)`);
    gradient.addColorStop(0.25, `rgba(${rgb}, 0.55)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    sctx.fillStyle = gradient;
    sctx.fillRect(0, 0, 32, 32);

    // Fewer particles on small screens
    const targetCount = () => {
      const byArea = Math.round((width * height) / 18000);
      return width < 640 ? Math.min(byArea, 24) : Math.min(byArea, 70);
    };

    const makeParticle = () => {
      const isDigit = Math.random() < 0.35;
      return {
        x: rand(0, width),
        y: rand(0, height),
        vx: rand(-0.006, 0.006),               // px per ms
        vy: -rand(0.006, 0.022),               // drift upward
        size: isDigit ? Math.round(rand(10, 15)) : rand(4, 11),
        alpha: isDigit ? rand(0.07, 0.2) : rand(0.25, 0.7),
        digit: isDigit ? (Math.random() < 0.5 ? "0" : "1") : null,
        phase: rand(0, Math.PI * 2),
        twinkle: rand(0.0008, 0.002),
      };
    };

    let countWidth = 0; // width the particle count was last worked out for

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ({ width, height } = viewport());
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Only re-count when the width changes. On phones the height changes
      // every time the toolbar slides in or out while scrolling, and
      // re-counting then makes particles pop in and out.
      if (width !== countWidth) {
        countWidth = width;
        const count = targetCount();
        while (particles.length < count) particles.push(makeParticle());
        particles.length = count;
      }
      particles.forEach((p) => {
        p.x = Math.min(p.x, width);
        p.y = Math.min(p.y, height);
      });
    }

    // Draw one dot or digit (shared by the drifting particles and click bursts)
    const paint = (p, alpha, time) => {
      ctx.globalAlpha = alpha * (0.6 + 0.4 * Math.sin(time * p.twinkle + p.phase));
      if (p.digit) {
        ctx.font = `${p.size}px ${font}`;
        ctx.fillText(p.digit, p.x, p.y);
      } else {
        ctx.drawImage(sprite, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    };

    const BURST_DRAG = 650; // ms; higher = bits coast farther before slowing down

    function draw(time) {
      // Clamp after tab switches/jank, and never negative (the first frame's
      // timestamp can be a hair earlier than the performance.now() in start())
      const dt = Math.max(0, Math.min(time - lastTime, 50));
      lastTime = time;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (const p of particles) {
        p.x += (p.vx + Math.sin(time * 0.0004 + p.phase) * 0.004) * dt;
        p.y += p.vy * dt;

        // Wrap around the edges
        if (p.y < -20) {
          p.y = height + 20;
          p.x = rand(0, width);
        }
        if (p.x < -20) p.x = width + 20;
        else if (p.x > width + 20) p.x = -20;

        paint(p, p.alpha, time);
      }

      // Click-burst bits glide outward, slow down, and fade away
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.age += dt;
        if (b.age >= b.life) {
          bursts.splice(i, 1);
          continue;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        const drag = Math.exp(-dt / BURST_DRAG);
        b.vx *= drag;
        b.vy *= drag;
        const fadeIn = Math.min(b.age / 150, 1);
        const fadeOut = Math.min((b.life - b.age) / (b.life * 0.45), 1);
        paint(b, b.alpha * fadeIn * fadeOut, time);
      }
      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(draw);
    }

    function start() {
      if (running || reducedMotion.matches || document.hidden) return;
      running = true;
      lastTime = performance.now();
      rafId = requestAnimationFrame(draw);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(rafId);
    }

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });

    // Moving the window to a screen with a different pixel density doesn't
    // always fire "resize", so watch the density itself (re-armed on each change)
    const watchDensity = () => {
      const query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      const onChange = () => {
        query.removeEventListener("change", onChange);
        resize();
        watchDensity();
      };
      query.addEventListener("change", onChange);
    };
    watchDensity();

    // Pause when the tab is hidden
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

    // React if the user toggles "reduce motion" while the page is open
    reducedMotion.addEventListener("change", () => {
      if (reducedMotion.matches) {
        stop();
        ctx.clearRect(0, 0, width, height);
      } else {
        start();
      }
    });

    resize();
    start();

    return {
      // Send a few bits drifting out from a point on the screen. They look
      // exactly like the background particles (same glow, size, and dimness).
      burst(x, y) {
        if (!running || bursts.length > 60) return;
        const count = 3 + Math.floor(Math.random() * 2); // 3–4
        const turn = rand(0, Math.PI * 2);
        for (let i = 0; i < count; i++) {
          const angle = turn + (i / count) * Math.PI * 2 + rand(-0.5, 0.5);
          const speed = rand(90, 170) / BURST_DRAG; // total distance ≈ 90–170px
          bursts.push({
            ...makeParticle(),
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            age: 0,
            life: rand(1700, 2300),
          });
        }
      },
    };
  }

  /* =============================================================
     5. Click bursts on the background
     ============================================================= */

  function initClickBursts(particles) {
    if (!particles) return;
    // Anything clickable does its own thing, so it doesn't get a burst
    const INTERACTIVE = "a, button, input, textarea, select, label, summary, [role='button'], .banner";

    document.addEventListener("click", (event) => {
      if (reducedMotion.matches || event.button !== 0) return;
      if (event.target.closest(INTERACTIVE)) return;
      if (String(window.getSelection()).length) return; // they were selecting text
      if (!event.detail) return;                          // keyboard "click", no position
      particles.burst(event.clientX, event.clientY);
    });
  }

  /* =============================================================
     6. "Redirected from a bad URL" banner
     ============================================================= */

  // 404.html stores { path, t } under this key, then redirects here.
  // The key must match the one in 404.html.
  const NOT_FOUND_KEY = "carterscoding:notfound";
  const NOT_FOUND_MAX_AGE = 10000; // ms; older entries are leftovers, not this visit

  function initNotFoundBanner() {
    // The old 404 page sent ?notfound=… instead; tidy it out of the address
    // bar if someone arrives with one (from a cached page or an old link)
    const params = new URLSearchParams(window.location.search);
    if (params.has("notfound")) {
      params.delete("notfound");
      const query = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : "") + window.location.hash);
    }

    let stored = null;
    try {
      stored = window.sessionStorage.getItem(NOT_FOUND_KEY);
      window.sessionStorage.removeItem(NOT_FOUND_KEY); // show it once, not on every refresh
    } catch {
      return; // storage blocked
    }
    let badUrl = null;
    try {
      const entry = JSON.parse(stored);
      // Only a fresh entry counts: one from just now, not left over from a
      // redirect that never reached this page
      if (entry && typeof entry.path === "string" && Date.now() - entry.t < NOT_FOUND_MAX_AGE) badUrl = entry.path;
    } catch {
      return; // missing or not ours
    }
    if (!badUrl || !badUrl.startsWith("/")) return;

    // Show "/my café", not "/my%20caf%C3%A9"
    try {
      badUrl = decodeURI(badUrl);
    } catch {
      /* odd escapes: show it as typed */
    }
    // Drop control, invisible-formatting and text-direction characters
    // (\p{Cc}, \p{Cf}) and line/paragraph separators, then shorten by whole
    // characters. Anyone can link to a made-up path, so the text shown here is
    // theirs: keep it short and plain.
    const MAX_CHARS = 40;
    const letters = Array.from(badUrl.replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, ""));
    const shown = letters.length > MAX_CHARS ? `${letters.slice(0, MAX_CHARS).join("")}…` : letters.join("");

    const root = document.documentElement;
    const banner = document.createElement("div");
    banner.className = "banner";

    // The text is added a moment after this (empty) live region is on the
    // page, because screen readers only announce changes to a live region
    const text = document.createElement("p");
    text.className = "banner__text";
    text.setAttribute("role", "status");

    const close = document.createElement("button");
    close.type = "button";
    close.className = "banner__close";
    close.setAttribute("aria-label", "Dismiss notice");
    close.textContent = "×";

    let closed = false;
    const onKeydown = (event) => {
      if (event.key === "Escape") dismiss();
    };
    // Keep the end of the page scrollable into view above the banner: its
    // height plus its gap from the bottom (read from the CSS, not hard-coded)
    const reserveSpace = () => {
      if (closed) return;
      const gap = parseFloat(getComputedStyle(banner).bottom) || 0;
      root.style.setProperty("--banner-space", `${banner.offsetHeight + gap}px`);
    };
    const observer = "ResizeObserver" in window ? new ResizeObserver(reserveSpace) : null;

    async function dismiss(instant = false) {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKeydown);
      if (observer) observer.disconnect();
      root.style.removeProperty("--banner-space");
      // Don't strand keyboard focus on a button that's about to disappear
      if (banner.contains(document.activeElement)) {
        const next = document.getElementById("title-btn");
        if (next) next.focus({ preventScroll: true });
      }
      try {
        if (!reducedMotion.matches && !instant) {
          await banner.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(12px)" }], {
            duration: 250,
            easing: "ease-in",
            fill: "forwards",
          }).finished;
        }
      } catch {
        /* animation cancelled: remove it anyway */
      } finally {
        banner.remove();
      }
    }
    close.addEventListener("click", () => dismiss());
    document.addEventListener("keydown", onKeydown);
    // Coming back with Back/Forward restores the page as it was, banner
    // included; it's meant to show once, so take it away without a fade
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) dismiss(true);
    });

    banner.append(text, close);
    // Right after the skip link, so the × is one of the first Tab stops
    const skipLink = document.querySelector(".skip-link");
    if (skipLink) skipLink.after(banner);
    else document.body.prepend(banner);
    if (observer) observer.observe(banner);

    wait(100).then(() => {
      if (closed) return; // dismissed before the text arrived
      const code = document.createElement("strong");
      code.textContent = "404";
      const url = document.createElement("span");
      url.className = "banner__path";
      url.textContent = shown; // textContent: never parsed as HTML
      text.append(code, " The URL you entered (", url, ") doesn't exist, so you've been redirected to the homepage.");
      reserveSpace();
    });
  }

  /* ---------- Go ---------- */

  // Each feature starts on its own, so one failing never stops the others
  const safely = (name, init) => {
    try {
      return init();
    } catch (error) {
      console.error(`carterscoding: ${name} failed to start`, error);
      return null;
    }
  };

  safely("404 banner", initNotFoundBanner); // first, so it never depends on the decorative stuff below
  safely("project cards", renderProjects);
  safely("title", initTitle);
  safely("card tilt", initTilt); // after renderProjects so the new cards get tilt too
  const particles = safely("particles", initParticles);
  safely("click bursts", () => initClickBursts(particles));
})();
