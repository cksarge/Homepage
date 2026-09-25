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

    /* ---- Animation pool: add a new function here to add an effect ---- */

    // Matrix-style decode: letters cycle through random glyphs, then lock in left to right
    function decode() {
      return new Promise((resolve) => {
        // Pin each letter's width so glyph swaps can never nudge the layout
        chars.forEach((span) => {
          span.style.width = `${span.getBoundingClientRect().width}px`;
          span.classList.add("is-scrambling");
        });

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
      let x = event.clientX;
      let y = event.clientY;
      // Keyboard "clicks" have no pointer position, so start from the title's center
      if (!event.detail || (x === 0 && y === 0)) {
        const rect = button.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }

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

    const effects = { decode, scatter, glitch, shockwave, typewriter };

    // Put every letter back exactly as it started, so any effect can run next
    function reset() {
      chars.forEach((span, i) => {
        span.getAnimations().forEach((animation) => animation.cancel());
        span.textContent = word[i];
        span.className = "title__char";
        span.removeAttribute("style");
      });
      textEl.className = "title__text";
      cursor.classList.remove("is-solid");
      cursor.style.transform = "";
    }

    let running = false;
    let lastEffect = null;

    button.addEventListener("click", async (event) => {
      if (running || reducedMotion.matches) return; // ignore clicks mid-animation

      // Pick at random, but never the same effect twice in a row
      const options = Object.keys(effects).filter((name) => name !== lastEffect);
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

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
