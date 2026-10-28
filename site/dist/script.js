(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = document.querySelector("[data-header]");
  const menuButton = document.querySelector(".menu-button");
  const menu = document.querySelector(".mobile-menu");

  const setMenu = (open) => {
    menuButton.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-hidden", String(!open));
    menu.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
  };

  menuButton?.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
  menu?.addEventListener("click", (event) => {
    if (event.target === menu || event.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });
  window.addEventListener("scroll", () => header?.classList.toggle("is-scrolled", window.scrollY > 24), { passive: true });

  const reveals = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach((element) => element.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.16 });
    reveals.forEach((element) => observer.observe(element));
  }

  const slider = document.querySelector("[data-slider]");
  if (slider) {
    const viewport = slider.querySelector(".path-viewport");
    const track = slider.querySelector("[data-track]");
    const slides = [...slider.querySelectorAll("[data-slide]")];
    const dots = [...slider.querySelectorAll("[data-go]")];
    let index = 0;
    let x = 0;
    let velocity = 0;
    let frame = 0;
    let dragging = false;
    let pointerId = null;
    let grabX = 0;
    let originX = 0;
    let previousX = 0;
    let previousTime = 0;

    const width = () => viewport.getBoundingClientRect().width;
    const targetFor = (step) => -step * width();
    const clampIndex = (step) => Math.max(0, Math.min(slides.length - 1, step));
    const render = () => { track.style.transform = `translate3d(${x}px, 0, 0)`; };
    const updateUI = () => {
      dots.forEach((dot, dotIndex) => {
        const active = dotIndex === index;
        dot.classList.toggle("is-active", active);
        dot.setAttribute("aria-selected", String(active));
      });
      slides.forEach((slide, slideIndex) => slide.setAttribute("aria-hidden", String(slideIndex !== index)));
    };
    const stop = () => { cancelAnimationFrame(frame); frame = 0; };

    const springTo = (nextIndex, releaseVelocity = velocity) => {
      index = clampIndex(nextIndex);
      updateUI();
      stop();
      const target = targetFor(index);
      if (reduceMotion) {
        x = target;
        velocity = 0;
        render();
        return;
      }
      let last = performance.now();
      velocity = releaseVelocity;
      const stiffness = 190;
      const damping = 28;
      const tick = (now) => {
        const dt = Math.min((now - last) / 1000, 0.032);
        last = now;
        const displacement = x - target;
        const acceleration = -stiffness * displacement - damping * velocity;
        velocity += acceleration * dt;
        x += velocity * dt;
        render();
        if (Math.abs(velocity) < 2 && Math.abs(displacement) < 0.5) {
          x = target;
          velocity = 0;
          render();
          frame = 0;
        } else {
          frame = requestAnimationFrame(tick);
        }
      };
      frame = requestAnimationFrame(tick);
    };

    const rubberband = (overshoot, dimension, constant = 0.45) =>
      (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));

    viewport.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      stop();
      dragging = true;
      pointerId = event.pointerId;
      viewport.setPointerCapture(pointerId);
      grabX = event.clientX;
      originX = x;
      previousX = event.clientX;
      previousTime = performance.now();
      velocity = 0;
    });

    viewport.addEventListener("pointermove", (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      const now = performance.now();
      const delta = event.clientX - grabX;
      let nextX = originX + delta;
      const min = targetFor(slides.length - 1);
      if (nextX > 0) nextX = rubberband(nextX, width());
      if (nextX < min) nextX = min + rubberband(nextX - min, width());
      x = nextX;
      const dt = Math.max(now - previousTime, 8);
      velocity = ((event.clientX - previousX) / dt) * 1000;
      previousX = event.clientX;
      previousTime = now;
      render();
    });

    const release = (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      const projection = (velocity / 1000) * 0.99 / (1 - 0.99);
      const projected = x + projection;
      const nextIndex = Math.round(-projected / width());
      springTo(nextIndex, velocity);
    };
    viewport.addEventListener("pointerup", release);
    viewport.addEventListener("pointercancel", release);

    dots.forEach((dot) => dot.addEventListener("click", () => springTo(Number(dot.dataset.go), 0)));
    slider.querySelector("[data-prev]").addEventListener("click", () => springTo(index - 1, 0));
    slider.querySelector("[data-next]").addEventListener("click", () => springTo(index + 1, 0));
    viewport.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") springTo(index - 1, 0);
      if (event.key === "ArrowRight") springTo(index + 1, 0);
    });
    window.addEventListener("resize", () => { x = targetFor(index); render(); });
    updateUI();
    render();
  }

  const form = document.querySelector("[data-interest-form]");
  const status = document.querySelector("[data-form-status]");
  const buildNote = () => {
    const interest = new FormData(form).get("interest");
    return `Hi — I’d like to learn more about ${interest} through Ignite. The idea of a Christian brotherhood built for the long road resonates with me.`;
  };
  const copyText = async (text) => {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  };
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await copyText(buildNote());
      status.textContent = "Copied. Paste the note into a message to the Ignite organizer you know.";
    } catch {
      status.textContent = "Your note is ready: “" + buildNote() + "”";
    }
  });
  document.querySelector("[data-share]")?.addEventListener("click", async () => {
    const shareData = { title: document.title, text: "Ignite in Him — Christian brotherhood for the long road.", url: location.href };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (error) { if (error.name !== "AbortError") status.textContent = "Sharing is unavailable right now."; }
    } else {
      await copyText(location.href);
      status.textContent = "Page link copied.";
    }
  });

  document.querySelector("[data-year]").textContent = new Date().getFullYear();
})();
