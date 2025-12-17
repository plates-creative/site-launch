// Grab controls if they exist (safe for non-inline setups)
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("start");
const stopBtn  = document.getElementById("stop");

// --- FX BUS ---
const tapeChorus = new Tone.Chorus({
  frequency: 0.14,
  delayTime: 12,
  depth: 0.45,
  spread: 180,
  wet: 0.55
}).start();

const tapeVibrato = new Tone.Vibrato({
  frequency: 0.28,
  depth: 0.1,
  wet: 0.55
});

const delay = new Tone.FeedbackDelay({
  delayTime: "8n",
  feedback: 0.35,
  wet: 0.80
});

const reverb = new Tone.Reverb({
  decay: 6,
  preDelay: 0.02,
  wet: 0.65
});

const bellDelay2 = new Tone.PingPongDelay({
  delayTime: "4n.",
  feedback: 0.6,
  wet: 0.4
});

const limiter = new Tone.Limiter(-1);
const fxBus = new Tone.Gain(1);

const master = new Tone.Gain(1.25); // start at 1.15–1.35
fxBus.chain(tapeChorus, tapeVibrato, delay, reverb, limiter, master, Tone.Destination);


// --- VOICE A: Bell / Pluck ---
const bell = new Tone.PolySynth(Tone.FMSynth, {
  maxPolyphony: 6,
  volume: -19,
  options: {
    harmonicity: 2,
    modulationIndex: 45,
    oscillator: { type: "triangle" },
    modulation: { type: "square" },
    envelope: { attack: 0.02, decay: 1.8, sustain: 0.0, release: 4 },
    modulationEnvelope: { attack: 0.3, decay: 0.4, sustain: 0.0, release: 2 }
  }
}).connect(bellDelay2);

bellDelay2.connect(fxBus);

// --- VOICE B: Pad ---
const pad = new Tone.PolySynth(Tone.Synth, {
  maxPolyphony: 4,
  volume: -18,
  options: {
    oscillator: { type: "triangle" },
    envelope: { attack: 2.5, decay: 0.2, sustain: 0.9, release: 6.0 }
  }
});

const padFilter = new Tone.Filter({
  type: "lowpass",
  frequency: 550,
  rolloff: -24,
  Q: 0.7
});

const padChorus = new Tone.Chorus({
  frequency: 0.15,
  delayTime: 7,
  depth: 0.35,
  wet: 0.55
}).start();

pad.chain(padFilter, padChorus, fxBus);

// --- VOICE C: Bass ---
const bass = new Tone.MonoSynth({
  volume: -16,
  oscillator: { type: "triangle" },
  filter: { type: "lowpass", rolloff: -24, Q: 0.7 },
  envelope: {
    attack: 0.05,
    decay: 0.25,
    sustain: 0.35,
    release: 6
  },

  filterEnvelope: {
    attack: 0.01,
    decay: 0.35,
    sustain: 0.0,
    release: 1.5,
    baseFrequency: 80,
    octaves: 2.0
  }
});

const bassVibrato = new Tone.Vibrato({
  frequency: 0.12,
  depth: 0.02,
  wet: 0.35
});

const bassDrive = new Tone.Distortion({
  distortion: 0.1,
  oversample: "2x",
  wet: 0.2
});

bass.chain(bassVibrato, bassDrive, fxBus);

// --- NOISE WASH ("air") ---
// (Intentionally routed directly to Tone.Destination — leaving as-is)
const airNoise = new Tone.Noise("pink");
const airAmp = new Tone.Gain(0.0);

const airHP = new Tone.Filter({ type: "highpass", frequency: 600, rolloff: -12 });
const airLP = new Tone.Filter({ type: "lowpass", frequency: 2000, rolloff: -12 });

const airDucker = new Tone.Compressor({
  threshold: -26,
  ratio: 4,
  attack: 0.02,
  release: 0.6
});

const airAmpLFO = new Tone.LFO({ frequency: 0.01, min: 0.0005, max: 0.004 });
const airFilterLFO = new Tone.LFO({ frequency: 0.01, min: 600, max: 2200 });
const airTrim = new Tone.Gain(0.35);

airNoise.chain(airAmp, airTrim, airHP, airLP, airDucker, master);

// --- Helpers ---
const rng = (min, max) => min + Math.random() * (max - min);
const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];

const scale = ["C4","D4","Eb5","F4","G4","Ab4","Bb4","C5"];

let running = false;
let bellLoop = null;
let padLoop  = null;
let bassLoop = null;

let reverbReady = false;

async function start() {
  // Prevent accidental double-starts
  if (running) return;

  await Tone.start();

  airNoise.start();
  airAmpLFO.connect(airAmp.gain).start();
  airFilterLFO.connect(airLP.frequency).start();

  // Generate reverb impulse only once
  if (!reverbReady) {
    await reverb.generate();
    reverbReady = true;
  }

  Tone.Transport.bpm.value = 54;

  // Bell loop
  bellLoop = new Tone.Loop((time) => {
    if (!running) return;
    if (Math.random() < 0.25) return;

    const note = choose(scale);
    const vel = rng(0.2, 0.7);

    bell.set({ detune: rng(-6, 6) });
    bell.set({ modulationIndex: rng(6, 14) });

    bell.triggerAttackRelease(note, rng(0.1, 0.35), time, vel);

    if (Math.random() < 0.15) {
      bell.triggerAttackRelease(
        Tone.Frequency(note).transpose(12),
        0.1,
        time + 0.12,
        vel * 0.55
      );
    }
  }, "2n").start(0);

  // Pad loop
  const chordPool = [
    ["C3","Eb3","G3","Bb3"],
    ["Ab2","C3","Eb3","G3"],
    ["F2","C3","Eb3","Ab3"],
    ["Bb2","D3","F3","Ab3"],
  ];

  padLoop = new Tone.Loop((time) => {
    if (!running) return;

    const chord = choose(chordPool);
    padFilter.frequency.setValueAtTime(rng(350, 750), time);
    pad.triggerAttackRelease(chord, "2m", time, rng(0.15, 0.35));
  }, "2m").start(0);

  // Bass loop (now properly tracked so stop() can clean it up)
  bassLoop = new Tone.Loop((time) => {
    if (!running) return;

    const choices = ["C2", "C2", "Eb2", "G1", "Bb1"];
    const note = choices[Math.floor(Math.random() * choices.length)];

    bass.triggerAttackRelease(note, "2n", time, rng(0.25, 0.45));
  }, "1m").start(0);

  running = true;
  Tone.Transport.start();

  if (statusEl) statusEl.textContent = "running";
  if (startBtn) startBtn.disabled = true;
  if (stopBtn) stopBtn.disabled = false;
}

function stop() {
  running = false;

  Tone.Transport.stop();
  Tone.Transport.cancel(0);

  // Stop/dispose loops so they don't stack on next start()
  [bellLoop, padLoop, bassLoop].forEach((lp) => {
    if (!lp) return;
    lp.stop();
    lp.dispose();
  });
  bellLoop = padLoop = bassLoop = null;

  airNoise.stop();
  airAmpLFO.stop();
  airFilterLFO.stop();

  if (statusEl) statusEl.textContent = "stopped";
  if (startBtn) startBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;
}

// Only bind if those buttons exist on the page
if (startBtn) startBtn.addEventListener("click", start);
if (stopBtn)  stopBtn.addEventListener("click", stop);

function setMuted(m) {
  Tone.Destination.mute = m;
}

window.PlatesAudio = {
  start,
  stop,
  setMuted,
  isRunning: () => running
};

