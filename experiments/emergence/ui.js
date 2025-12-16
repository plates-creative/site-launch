// ui.js (page boot: svg inlining + audio toggle)
function wireUI(){
  const btnRandom = document.getElementById("btn-randomize");
  const btnColor  = document.getElementById("btn-color");
  const btnSave   = document.getElementById("btn-save");

  if (btnRandom) btnRandom.addEventListener("click", startTransition);
  if (btnColor)  btnColor.addEventListener("click", cycleMode);
  if (btnSave)   btnSave.addEventListener("click", saveHiResSnowflake);
}

async function inlineSvgs() {
  const imgs = document.querySelectorAll('img[data-inline-svg]');

  await Promise.all([...imgs].map(async (img) => {
    const res = await fetch(img.src);
    const text = await res.text();
    const svg = new DOMParser()
      .parseFromString(text, "image/svg+xml")
      .querySelector("svg");

    // Preserve classes like svg-on/svg-off so CSS toggles work
    svg.setAttribute("class", img.getAttribute("class") || "");
    svg.classList.add("svg-icon");

    img.replaceWith(svg);
  }));
}

function setupAudioToggle() {
  const btn = document.getElementById("btn-volume");
  if (!btn) return;

  const MOBILE_BREAKPOINT = 1024;
  const mobile = window.matchMedia(`(max-width:${MOBILE_BREAKPOINT}px)`).matches;

  function setMutedUI(muted) {
    btn.classList.toggle("is-muted", muted);
    btn.setAttribute("aria-pressed", muted ? "false" : "true");
    btn.setAttribute("aria-label", muted ? "Sound off" : "Sound on");
  }

  async function startAudioUnmuted() {
    if (!window.PlatesAudio) return false;
    try {
      await window.PlatesAudio.start();
      window.PlatesAudio.setMuted?.(false);
      return true;
    } catch {
      return false;
    }
  }

  function stopAudio() {
    try { window.PlatesAudio?.stop(); } catch {}
  }

  // default: muted on load (especially for mobile)
  setMutedUI(true);

  // desktop autostart attempt (best-effort)
  if (!mobile) {
    startAudioUnmuted().then((ok) => {
      if (ok) return setMutedUI(false);

      // if blocked, start on first user interaction
            const prime = async () => {
        const ok2 = await startAudioUnmuted();
        if (ok2) setMutedUI(false);

        window.removeEventListener("pointerdown", prime);
        window.removeEventListener("keydown", prime);
        window.removeEventListener("scroll", prime);
      };

      window.addEventListener("pointerdown", prime);
      window.addEventListener("keydown", prime);
      window.addEventListener("scroll", prime, { passive: true });

    });
  }

  // click toggles audio on/off
  btn.addEventListener("click", async (e) => {
    e.preventDefault();

    const isMuted = btn.classList.contains("is-muted");
    if (!isMuted) {
      stopAudio();
      setMutedUI(true);
      return;
    }

    const ok = await startAudioUnmuted();
    setMutedUI(!ok ? true : false);
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  await inlineSvgs();
  wireUI();
  setupAudioToggle();
  setupInfoOverlay();
});

function setupInfoOverlay() {
  const openBtn = document.getElementById("btn-info");
  const closeBtn = document.getElementById("btn-info-close");
  const overlay = document.getElementById("info-overlay");

  if (!openBtn || !closeBtn || !overlay) return;

  const open = () => {
    document.body.classList.add("info-open");
    overlay.setAttribute("aria-hidden", "false");
  };

  const close = () => {
    document.body.classList.remove("info-open");
    overlay.setAttribute("aria-hidden", "true");
  };

  openBtn.addEventListener("click", (e) => { e.preventDefault(); open(); });
  closeBtn.addEventListener("click", (e) => { e.preventDefault(); close(); });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("info-open")) close();
  });
}
