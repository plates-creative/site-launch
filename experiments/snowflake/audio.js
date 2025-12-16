const statusEl = document.getElementById("status");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");

// --- FX BUS ---

const tapeChorus = new Tone.Chorus({
  frequency: 0.14,    // slow LFO rate
  delayTime: 12,      // ms
  depth: 0.45,        // intensity (0–1)
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
  feedback: 0.4,
  wet: 0.4
});

const limiter = new Tone.Limiter(-1);

const fxBus = new Tone.Gain(1);
    
fxBus.chain(tapeChorus, tapeVibrato, delay, reverb, limiter, Tone.Destination);


// --- VOICE A: Bell / Pluck (Rings-ish vibe via FM) ---
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


// --- VOICE B: Soft pad/bass (triangle + slow env) ---
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
    
// --- VOICE C: Deep bass (lightweight) ---
const bass = new Tone.MonoSynth({
  volume: -16,
  oscillator: { type: "triangle" }, // swap to "sine" for cleaner
  filter: {
    type: "lowpass",
    rolloff: -24,
    Q: 0.7
  },
  envelope: {
    attack: 0.05,
    decay: 0.25,
    sustain: 0.35,
    release: 5
  },
  filterEnvelope: {
    attack: 0.01,
    decay: 0.35,
    sustain: 0.0,
    release: 0.6,
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
const airNoise = new Tone.Noise("pink");
const airAmp = new Tone.Gain(0.0);       // start silent
    
const airHP = new Tone.Filter({
  type: "highpass",
  frequency: 600,
  rolloff: -12
});
    
const airLP = new Tone.Filter({
  type: "lowpass",
  frequency: 2000,
  rolloff: -12
});
    
const airDucker = new Tone.Compressor({
  threshold: -26,
  ratio: 4,
  attack: 0.02,
  release: 0.6
});

const airAmpLFO = new Tone.LFO({
  frequency: 0.01,
  min: 0.0005,
  max: 0.004
});

const airFilterLFO = new Tone.LFO({
  frequency: 0.01,
  min: 600,
  max: 2200
});
const airTrim = new Tone.Gain(0.35);

airNoise.chain(airAmp, airTrim, airHP, airLP, airDucker, Tone.Destination);

airTrim.gain.value = 0.55;

// --- Generative helpers ---
const rng = (min, max) => min + Math.random() * (max - min);
const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];

// C natural minor-ish
const scale = ["C4","D4","Eb5","F4","G4","Ab4","Bb4","C5"];
const bassNotes = ["C2","G2","Bb1","Ab1","F2","Eb2"];

let running = false;
let bellLoop, padLoop;

async function start() {
await Tone.start();
      
airNoise.start();
airAmpLFO.connect(airAmp.gain).start();
airFilterLFO.connect(airLP.frequency).start();

await reverb.generate(); // important for Tone.Reverb
Tone.Transport.bpm.value = 54;

// Bell Trigger
bellLoop = new Tone.Loop((time) => {
  if (!running) return;
  if (Math.random() < 0.25) return;

  const note = choose(scale);
  const vel = rng(0.2, 0.7);

  bell.set({ detune: rng(-6, 6) });

  // slightly vary brightness via modulation index
  bell.set({ modulationIndex: rng(6, 14) });

  bell.triggerAttackRelease(note, rng(0.1, 0.35), time, vel);

  // occasional octave shimmer
  if (Math.random() < 0.15) {
    bell.triggerAttackRelease(Tone.Frequency(note).transpose(12), 0.1, time + 0.12, vel * 0.55);
    }
  }, "2n").start(0);

// Pad: slow chord bed with small harmonic movement
const chordPool = [
  ["C3","Eb3","G3","Bb3"],     // Cm7
  ["Ab2","C3","Eb3","G3"],     // Abmaj7-ish
  ["F2","C3","Eb3","Ab3"],     // Fm(add)
  ["Bb2","D3","F3","Ab3"],     // Bb7sus-ish color
];

padLoop = new Tone.Loop((time) => {
  if (!running) return;

  const chord = choose(chordPool);

  // gentle filter drift
  padFilter.frequency.setValueAtTime(rng(350, 750), time);

  pad.triggerAttackRelease(chord, "2m", time, rng(0.15, 0.35));
}, "2m").start(0);

running = true;
Tone.Transport.start();

statusEl.textContent = "running";
startBtn.disabled = true;
stopBtn.disabled = false;
      
let bassLoop;

bassLoop = new Tone.Loop((time) => {
  if (!running) return;

  // Sparse, grounded pattern: mostly root, occasional 5th/7th color
  const choices = ["C2", "C2", "Eb2", "G1", "Bb1"]; // weighted toward root
  const note = choices[Math.floor(Math.random() * choices.length)];

  // slightly vary velocity and note length for life
  bass.triggerAttackRelease(note, "2n", time, rng(0.25, 0.45));
}, "1m").start(0);

    }

function stop() {
  running = false;
  Tone.Transport.stop();
  Tone.Transport.cancel(0);
  airNoise.stop();
  airAmpLFO.stop();
  airFilterLFO.stop();


  statusEl.textContent = "stopped";
  startBtn.disabled = false;
  stopBtn.disabled = true;
}

startBtn.addEventListener("click", start);
stopBtn.addEventListener("click", stop);