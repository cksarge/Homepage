/* =============================================================
   carterscoding.com: page behavior
   -------------------------------------------------------------
   1. Project cards   built from the PROJECTS array in projects.js
   2. Title effects   a random click animation (never the same twice in a row)
   3. Card tilt       3D tilt + glare that follows the mouse (not on touch)
   4. Particles       glowing dots and drifting 0/1s on a <canvas>
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

  /* =============================================================
     1. Project cards
     ============================================================= */

  function renderProjects() {
    const grid = document.getElementById("project-grid");
    if (!grid) return;

    // PROJECTS is a top-level const in projects.js
    const projects =
      typeof PROJECTS !== "undefined" && Array.isArray(PROJECTS) ? PROJECTS : [];

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
   * textContent is used everywhere, so project text can never inject HTML.
   */
  function createCard(project, index) {
    const id = `project-${index}`;
    const item = document.createElement("li");

    const card = document.createElement("a");
    card.className = "card";
    card.href = project.url || "#";
    card.style.setProperty("--i", index); // staggered fade-in
    // Screen readers announce just the title as the link name
    card.setAttribute("aria-labelledby", `${id}-title`);

    const media = document.createElement("div");
    media.className = "card__media";

    if (project.image) {
      const img = document.createElement("img");
      img.className = "card__img";
      img.loading = "lazy"; // set before src so the lazy hint applies
      img.decoding = "async";
      img.width = 1200;
      img.height = 800;
      img.alt = project.alt || `Preview of ${project.title}`;
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
    title.textContent = project.title || "Untitled project";

    const cta = document.createElement("span");
    cta.className = "card__cta";
    cta.setAttribute("aria-hidden", "true");
    cta.innerHTML = 'open <span class="card__arrow">→</span>';

    body.append(title, cta);
    card.append(media, glare, body);
    item.appendChild(card);
    return item;
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
    if (!button || !textEl) return;

    const cursor = button.querySelector(".cursor");
    const word = textEl.textContent.trim();

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
          else wait(450).then(resolve); // let the last flash finish
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
      const cssDone = new Promise((resolve) => {
        const onEnd = (event) => {
          if (event.target !== textEl) return;
          textEl.removeEventListener("animationend", onEnd);
          resolve();
        };
        textEl.addEventListener("animationend", onEnd);
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
      await cssDone;
    }

    // Green rings burst from the click point; letters bounce as the wave passes
    function shockwave(event) {
      const { x, y } = clickPoint(event);

      const size = Math.max(window.innerWidth, window.innerHeight) * 1.2;
      const rings = [0, 150].map((delay) => {
        const ring = document.createElement("div");
        ring.className = "shockwave";
        ring.style.setProperty("--size", `${size}px`);
        ring.style.left = `${x}px`;
        ring.style.top = `${y}px`;
        fxLayer.appendChild(ring);
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
      const beam = document.createElement("div");
      beam.className = "crt-beam";
      beam.style.left = `${rect.left + rect.width / 2}px`;
      beam.style.top = `${rect.top + rect.height / 2}px`;
      beam.style.width = `${rect.width}px`;
      fxLayer.appendChild(beam);

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
        const fall = Math.max(window.innerHeight - rect.top, 0); // all the way off the bottom
        const delay = i * 30 + rand(0, 180);
        // Longer drops take longer, so the speed feels the same on any screen
        const duration = Math.min(Math.max(fall * rand(2, 2.6), 900), 2200);

        // Trail column: starts a little below the letter's top (roughly where
        // lowercase letters begin), so the trail stays hidden until the letter
        // falls, then hugs it all the way down
        const attach = rect.height * 0.28;
        const column = document.createElement("div");
        column.className = "rain";
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
        fxLayer.appendChild(column);

        // Trail and letter move together: the strip's bottom edge tracks the letter
        const stripHeight = count * glyphSize * 1.1;
        const trail = strip.animate(
          [{ transform: `translateY(${-stripHeight}px)` }, { transform: `translateY(${fall - stripHeight}px)` }],
          { duration, delay, easing, fill: "both" }
        );
        // The falling letter is a copy on the fixed effects layer, so it can
        // drop off the bottom of the screen without ever making the page
        // taller. The real letter is hidden but keeps its space.
        const letter = document.createElement("span");
        letter.className = "rain-letter";
        letter.textContent = span.textContent;
        letter.style.left = `${rect.left}px`;
        letter.style.top = `${rect.top}px`;
        letter.style.fontFamily = letterStyle.fontFamily;
        letter.style.fontSize = letterStyle.fontSize;
        letter.style.fontWeight = letterStyle.fontWeight;
        letter.style.lineHeight = `${rect.height}px`;
        fxLayer.appendChild(letter);
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
          return [filled ? "█" : "░", filled ? "is-bar" : "is-bar-empty"];
        }
        if (i === cells) return [" ", ""];
        const label = `${pct}%`.padStart(4, " ");
        return [label[i - cells - 1] || " ", "is-meter"];
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
      await wait(350);
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

    const effects = {
      decode, scatter, glitch, shockwave, typewriter,
      crt, rain, flap, progress, jello,
    };

    // Optional: ?effects=crt,rain in the page URL limits the rotation to
    // those effects (handy for trying one out). Unknown names are ignored.
    const requested = (new URLSearchParams(window.location.search).get("effects") || "")
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name in effects);
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
      cursor.style.transform = "";
    }

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
      try {
        await effects[name](event);
      } finally {
        reset();
        running = false;
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
      let maxTilt = 8;
      let frame = 0;
      let lastEvent = null;

      const update = () => {
        frame = 0;
        if (!rect || !lastEvent) return;
        const px = (lastEvent.clientX - rect.left) / rect.width;  // 0 → 1 across the card
        const py = (lastEvent.clientY - rect.top) / rect.height;
        card.style.setProperty("--ry", `${((px - 0.5) * 2 * maxTilt).toFixed(2)}deg`);
        card.style.setProperty("--rx", `${((0.5 - py) * 2 * maxTilt).toFixed(2)}deg`);
        card.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
        card.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      };

      card.addEventListener("pointerenter", (event) => {
        if (!canTilt(event)) return;
        // Measure once on enter; measuring mid-tilt would include the tilt itself
        rect = card.getBoundingClientRect();
        maxTilt = parseFloat(getComputedStyle(card).getPropertyValue("--tilt-max")) || 8;
        card.classList.add("is-tilting");
      });

      card.addEventListener("pointermove", (event) => {
        if (!rect || !canTilt(event)) return;
        lastEvent = event;
        if (!frame) frame = requestAnimationFrame(update); // at most once per frame
      });

      card.addEventListener("pointerleave", () => {
        cancelAnimationFrame(frame);
        frame = 0;
        rect = null;
        lastEvent = null;
        card.classList.remove("is-tilting");
        ["--rx", "--ry", "--mx", "--my"].forEach((prop) => card.style.removeProperty(prop));
      });
    });
  }

  /* =============================================================
     4. Particle background
     ============================================================= */

  function initParticles() {
    const canvas = document.getElementById("particles");
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");

    const rgb = cssVar("--c-accent-rgb") || "0, 255, 156";
    const font = cssVar("--font-mono") || "monospace";

    let width = 0;
    let height = 0;
    let particles = [];
    let rafId = 0;
    let running = false;
    let lastTime = 0;

    // Pre-render one soft glowing dot and stamp it; much cheaper than shadowBlur
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 32;
    const sctx = sprite.getContext("2d");
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

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = targetCount();
      while (particles.length < count) particles.push(makeParticle());
      particles.length = count;
      particles.forEach((p) => {
        p.x = Math.min(p.x, width);
        p.y = Math.min(p.y, height);
      });
    }

    function draw(time) {
      const dt = Math.min(time - lastTime, 50); // clamp after tab switches/jank
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

        ctx.globalAlpha = p.alpha * (0.6 + 0.4 * Math.sin(time * p.twinkle + p.phase));
        if (p.digit) {
          ctx.font = `${p.size}px ${font}`;
          ctx.fillText(p.digit, p.x, p.y);
        } else {
          ctx.drawImage(sprite, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
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
  }

  /* ---------- Go ---------- */

  renderProjects();
  initTitle();
  initTilt(); // after renderProjects so the new cards get tilt too
  initParticles();
})();
