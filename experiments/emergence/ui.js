// ui.js (page boot: svg inlining + audio toggle)
function wireUI(){
  const btnRandom = document.getElementById("btn-randomize");
  const btnColor  = document.getElementById("btn-color");
  const btnSave   = document.getElementById("btn-save");

  if (btnRandom) btnRandom.addEventListener("click", startTransition);
  if (btnColor)  btnColor.addEventListener("click", cycleMode);
  if (btnSave)   btnSave.addEventListener("click", saveHiResSnowflake);

  window.addEventListener("DOMContentLoaded", async () => {
  await inlineSvgs();
  wireUI();
  setupAudioToggle();
  setupInfoOverlay();     // if not already being called elsewhere :contentReference[oaicite:3]{index=3}
  syncInfoBlurText();

  if (document.fonts?.ready) document.fonts.ready.then(syncInfoBlurText);
  window.addEventListener("resize", syncInfoBlurText);
});

}



function syncInfoBlurText() {
  const sharp = document.getElementById("info-text-sharp");
  const blur  = document.getElementById("info-text-blur");
  if (!sharp || !blur) return;

  blur.innerHTML = sharp.innerHTML;
  blur.style.height = sharp.scrollHeight + "px";
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

function setupInfoOverlay() {
  const btnInfo = document.getElementById("btn-info");
  const overlay = document.getElementById("info-overlay");
  const btnClose = document.getElementById("btn-close");
  const scrollEl = document.getElementById("info-scroll");

  const sharp = document.getElementById("info-text-sharp");
  const blur  = document.getElementById("info-text-blur");

  // duplicate text into blur layer
  blur.innerHTML = sharp.innerHTML;

  // keep blur aligned with scroll
  const sync = () => {
    blur.style.transform = `translateY(${-scrollEl.scrollTop}px)`;
  };
  scrollEl.addEventListener("scroll", sync, { passive: true });
  sync();

  const open = () => {
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    btnInfo?.setAttribute("aria-expanded", "true");
  };

  const close = () => {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    btnInfo?.setAttribute("aria-expanded", "false");
  };

  btnInfo?.addEventListener("click", (e) => {
    e.preventDefault();
    open();
  });

  btnClose?.addEventListener("click", (e) => {
    e.preventDefault();
    close();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  await inlineSvgs();
  setupInfoOverlay();
  setupAudioToggle();
});