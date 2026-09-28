// Tone.js wrapper exposed to C# via JS interop.
// Tone is loaded as a UMD global by index.html (js/lib/tone.js) before this module runs.
//
// Drums (kick/snare/hihat) are monophonic Tone synths with short, fixed envelopes and
// no randomization, so a hit is deterministic for a given (note, duration, velocity,
// time). Melodic instruments are Tone.PolySynth so chords and overlapping notes
// (within a track or across tracks) all sound. The same trigger helper is used for
// audition and scheduled playback.

const getTone = () => {
  if (!globalThis.Tone) {
    throw new Error("Tone.js is not loaded. Expected global `Tone` from js/lib/tone.js.");
  }
  return globalThis.Tone;
};

let initialized = false;
let instances = {};

// One place to tweak every instrument.
// - `pitched`: whether the model's note name sets the synth pitch.
// - `trigger`: optional explicit call, for synths whose trigger signature differs.
// MembraneSynth/MetalSynth take (note, duration, time, velocity); NoiseSynth takes
// (duration, time, velocity). Drums pass a FIXED note so the model pitch is ignored,
// which keeps them deterministic and prevents duration-as-pitch mistakes.
const INSTRUMENTS = {
  kick: {
    pitched: false,
    create: (T) =>
      new T.MembraneSynth({
        pitchDecay: 0.03,
        octaves: 4,
        oscillator: { type: "sine" },
        // Monophonic; sustain 0 and a 20ms release so even 1/32 hits never overlap.
        envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.02 },
      }).toDestination(),
    trigger: (inst, note, durationSec, time, velocity) =>
      inst.triggerAttackRelease("C1", durationSec, time, velocity),
  },
  snare: {
    pitched: false,
    create: (T) =>
      new T.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.02 },
      }).toDestination(),
    trigger: (inst, note, durationSec, time, velocity) =>
      inst.triggerAttackRelease(durationSec, time, velocity),
  },
  hihat: {
    pitched: false,
    create: (T) =>
      new T.MetalSynth({
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
        envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.01 },
      }).toDestination(),
    trigger: (inst, note, durationSec, time, velocity) =>
      inst.triggerAttackRelease("C5", durationSec, time, velocity),
  },
  bass: {
    pitched: true,
    poly: true,
    create: (T) => {
      const synth = new T.PolySynth(T.MonoSynth).toDestination();
      synth.set({
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
      });
      synth.maxPolyphony = 32;
      return synth;
    },
  },
  guitar: {
    pitched: true,
    poly: true,
    // PolySynth only accepts Monophonic voices (Synth/FMSynth/AMSynth/MonoSynth/DuoSynth).
    // A short plucky Synth envelope approximates a guitar; PluckSynth is NOT Monophonic.
    create: (T) => {
      const synth = new T.PolySynth(T.Synth).toDestination();
      synth.set({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.3 },
      });
      synth.maxPolyphony = 32;
      return synth;
    },
  },
  piano: {
    pitched: true,
    poly: true,
    create: (T) => {
      const synth = new T.PolySynth(T.FMSynth).toDestination();
      synth.set({
        harmonicity: 3,
        modulationIndex: 10,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.8, sustain: 0.05, release: 1.2 },
        modulation: { type: "square" },
        modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 },
      });
      synth.maxPolyphony = 32;
      return synth;
    },
  },
  musicbox: {
    pitched: true,
    poly: true,
    create: (T) => {
      const synth = new T.PolySynth(T.Synth).toDestination();
      synth.set({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.5, sustain: 0.0, release: 0.5 },
      });
      synth.maxPolyphony = 32;
      return synth;
    },
  },
};

function buildInstruments() {
  const T = getTone();
  disposeInstruments();
  for (const [name, def] of Object.entries(INSTRUMENTS)) {
    // One bad instrument definition must not prevent the others from loading.
    try {
      instances[name] = def.create(T);
    } catch (error) {
      console.error(`Failed to create instrument "${name}":`, error);
    }
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

function clampVelocity(velocity) {
  return Number.isFinite(velocity) ? Math.max(0, Math.min(1, velocity)) : 1;
}

// The single trigger path. Audition and scheduled playback both call this.
function triggerInstrument(def, inst, note, durationSec, time, velocity) {
  if (def.trigger) {
    def.trigger(inst, note, durationSec, time, velocity);
  } else if (def.pitched) {
    inst.triggerAttackRelease(note, durationSec, time, velocity);
  } else {
    inst.triggerAttackRelease(durationSec, time, velocity);
  }
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
 * Play a single note. When `timeSec` is a number it is scheduled once on the Tone
 * transport (absolute seconds, sample-accurate). When omitted/null the note fires
 * immediately, which is what audition buttons want. `velocity` is 0..1 and is
 * applied linearly; it defaults to 1 for callers that don't supply one.
 * Returns the Tone.Transport schedule id when scheduled, otherwise null.
 */
export function playInstrument(name, note = "C4", durationSec = 0.5, timeSec = null, velocity = 1) {
  const T = getTone();
  const def = INSTRUMENTS[name];
  if (!def) {
    throw new Error(`Unknown instrument: ${name}`);
  }
  const inst = instances[name];
  if (!inst) {
    throw new Error("Audio not initialized. Call init() first.");
  }

  const vel = clampVelocity(velocity);
  const fire = (time) => triggerInstrument(def, inst, note, durationSec, time, vel);

  if (timeSec === null || timeSec === undefined) {
    fire(T.now());
    return null;
  }
  return T.Transport.scheduleOnce((audioTime) => fire(audioTime), timeSec);
}

/**
 * Attack a note and hold it (used for click-auditioning). Polyphonic instruments
 * sustain until stopNote(); drums fire a short one-shot since they don't sustain.
 */
export function startNote(name, pitch, velocity = 0.8) {
  const T = getTone();
  const def = INSTRUMENTS[name];
  const inst = instances[name];
  if (!def || !inst) {
    throw new Error(`Unknown or uninitialized instrument: ${name}`);
  }
  const vel = clampVelocity(velocity);
  if (def.poly) {
    inst.triggerAttack(pitch, T.now(), vel);
  } else if (def.trigger) {
    def.trigger(inst, pitch, 0.25, T.now(), vel);
  } else {
    inst.triggerAttackRelease(0.25, T.now(), vel);
  }
}

/** Release a held note started with startNote(). No-op for non-sustaining drums. */
export function stopNote(name, pitch) {
  const T = getTone();
  const def = INSTRUMENTS[name];
  const inst = instances[name];
  if (!def || !inst || !def.poly) {
    return;
  }
  inst.triggerRelease(pitch, T.now());
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
