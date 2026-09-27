// Tone.js wrapper exposed to C# via JS interop.
// Tone is loaded as a UMD global by index.html (js/lib/tone.js) before this module runs.

const getTone = () => {
  if (!globalThis.Tone) {
    throw new Error("Tone.js is not loaded. Expected global `Tone` from js/lib/tone.js.");
  }
  return globalThis.Tone;
};

let initialized = false;
let instances = {};

// One place to tweak every instrument. `pitched` decides whether a note name is
// passed to triggerAttackRelease (drums ignore it and trigger on a fixed sound).
const INSTRUMENTS = {
  kick: {
    pitched: false,
    create: (T) =>
      new T.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 6,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
      }).toDestination(),
  },
  snare: {
    pitched: false,
    create: (T) =>
      new T.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
      }).toDestination(),
  },
  hihat: {
    pitched: false,
    create: (T) =>
      new T.MetalSynth({
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
        envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
      }).toDestination(),
  },
  bass: {
    pitched: true,
    create: (T) =>
      new T.MonoSynth({
        oscillator: { type: "sawtooth" },
        filter: { Q: 2, type: "lowpass" },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.6 },
        filterEnvelope: {
          attack: 0.01,
          decay: 0.1,
          sustain: 0.3,
          release: 0.5,
          baseFrequency: 200,
          octaves: 2.6,
        },
      }).toDestination(),
  },
  guitar: {
    pitched: true,
    create: (T) =>
      new T.PluckSynth({ attackNoise: 1, dampening: 4000, resonance: 0.9 }).toDestination(),
  },
  piano: {
    pitched: true,
    create: (T) =>
      new T.FMSynth({
        harmonicity: 3,
        modulationIndex: 10,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.8, sustain: 0.05, release: 1.2 },
        modulation: { type: "square" },
        modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 },
      }).toDestination(),
  },
  musicbox: {
    pitched: true,
    create: (T) =>
      new T.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.5, sustain: 0.0, release: 0.5 },
      }).toDestination(),
  },
};

function buildInstruments() {
  const T = getTone();
  disposeInstruments();
  for (const [name, def] of Object.entries(INSTRUMENTS)) {
    instances[name] = def.create(T);
  }
}

function disposeInstruments() {
  for (const inst of Object.values(instances)) {
    if (inst && typeof inst.dispose === "function") {
      inst.dispose();
    }
  }
  instances = {};
}

/**
 * Resume or create the Tone.js audio context. Must be called from a user
 * gesture (click/tap) because browsers block audio otherwise.
 */
export async function init() {
  const T = getTone();
  if (!initialized) {
    await T.start();
    buildInstruments();
    initialized = true;
  }
  if (T.getContext().state !== "running") {
    await T.getContext().resume();
  }
}

/**
 * Play a single note. When `timeSec` is a number it is scheduled on the Tone
 * transport (absolute seconds, sample-accurate). When omitted/null the note
 * fires immediately, which is what audition buttons want.
 * Returns the Tone.Transport schedule id when scheduled, otherwise null.
 */
export function playInstrument(name, note = "C4", durationSec = 0.5, timeSec = null) {
  const T = getTone();
  const def = INSTRUMENTS[name];
  if (!def) {
    throw new Error(`Unknown instrument: ${name}`);
  }
  const inst = instances[name];
  if (!inst) {
    throw new Error("Audio not initialized. Call init() first.");
  }

  const trigger = (time) => {
    if (def.pitched) {
      inst.triggerAttackRelease(note, durationSec, time);
    } else {
      inst.triggerAttackRelease(durationSec, time);
    }
  };

  if (timeSec === null || timeSec === undefined) {
    trigger(T.now());
    return null;
  }
  return T.Transport.schedule((audioTime) => trigger(audioTime), timeSec);
}

export async function startTransport() {
  const T = getTone();
  T.Transport.start();
}

export async function stopTransport() {
  const T = getTone();
  T.Transport.stop();
}

export async function pauseTransport() {
  const T = getTone();
  T.Transport.pause();
}

export async function seekTransport(sec) {
  const T = getTone();
  T.Transport.seconds = sec;
}

/** Removes all scheduled transport events without stopping the transport. */
export async function clearScheduled() {
  const T = getTone();
  T.Transport.cancel();
}

/** Current Tone transport position in seconds. */
export function getTransportTimeSec() {
  return getTone().Transport.seconds;
}

export async function setBpm(bpm) {
  const T = getTone();
  T.Transport.bpm.value = bpm;
}

export async function dispose() {
  const T = getTone();
  T.Transport.cancel();
  T.Transport.stop();
  disposeInstruments();
  initialized = false;
}
