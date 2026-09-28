// Piano-roll renderer + editor input for the Compose page.
//
// DOM layout (see PianoRoll.razor / app.css):
//   .piano-roll  (CSS grid: [key column | grid] x [ruler | grid])
//     .piano-roll-corner   .piano-roll-ruler  > canvas   (static viewport)
//     .piano-roll-keys     > canvas           (static viewport)
//     .piano-roll-scroll   (the only scroller) > .piano-roll-content > canvas (sticky)
//
// The GRID canvas contains ONLY the grid: its top-left pixel is cell (beat 0,
// top pitch). There is no key/ruler offset to subtract. The ruler and keys are
// separate viewport-sized canvases that redraw with the grid's scroll offset.
//
// COORDINATE CONVENTION: the renderer draws in CSS pixels (the 2D context is
// scaled by devicePixelRatio for crispness). eventToCanvasPixels() therefore
// returns CSS pixels too (it divides out devicePixelRatio), so event math and
// draw math share one unit.

const KEY_STRIP_WIDTH = 52; // must match --key-strip-width in app.css
const RULER_HEIGHT = 22; // must match --ruler-height in app.css

let active = null;

function read(node, fallback) {
  return node === undefined || node === null ? fallback : node;
}

function normalize(raw) {
  return {
    pitchMin: read(raw.pitchMin ?? raw.PitchMin, 48),
    pitchMax: read(raw.pitchMax ?? raw.PitchMax, 84),
    lengthBeats: read(raw.lengthBeats ?? raw.LengthBeats, 60),
    beatsPerBar: read(raw.beatsPerBar ?? raw.BeatsPerBar, 4),
    subdivisionsPerBeat: read(raw.subdivisionsPerBeat ?? raw.SubdivisionsPerBeat, 4),
    timeZoom: read(raw.timeZoom ?? raw.TimeZoom, 1),
    pitchZoom: read(raw.pitchZoom ?? raw.PitchZoom, 1),
    basePixelsPerBeat: read(raw.basePixelsPerBeat ?? raw.BasePixelsPerBeat, 288),
    basePixelsPerSemitone: read(raw.basePixelsPerSemitone ?? raw.BasePixelsPerSemitone, 42),
    playheadBeat: read(raw.playheadBeat ?? raw.PlayheadBeat, 0),
    debug: read(raw.debug ?? raw.Debug, false),
    notes: (raw.notes ?? raw.Notes ?? []).map((n) => ({
      beat: read(n.beat ?? n.Beat, 0),
      midi: read(n.midi ?? n.Midi, 60),
      duration: read(n.duration ?? n.Duration, 1),
      color: read(n.color ?? n.Color, "#00d9ff"),
      selected: read(n.selected ?? n.Selected, false),
      index: read(n.index ?? n.Index, -1),
      id: read(n.id ?? n.Id, ""),
      chosen: read(n.chosen ?? n.Chosen, false),
    })),
  };
}

function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function readColors() {
  return {
    bg: cssVar("--bg", "#0a0a12"),
    panel: cssVar("--bg-panel", "#14141f"),
    panel2: cssVar("--bg-panel-2", "#1a1a28"),
    border: cssVar("--border", "#22222f"),
    borderBright: cssVar("--border-bright", "#33334a"),
    textDim: cssVar("--text-dim", "#8888a0"),
    accent: cssVar("--accent", "#00d9ff"),
  };
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function noteName(midi) {
  return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

// Shared spacing values. The renderer and the hit-tester both use these.
function metrics() {
  const config = active.config;
  return {
    pixelsPerBeat: config.basePixelsPerBeat * config.timeZoom,
    pixelsPerSemitone: config.basePixelsPerSemitone * config.pitchZoom,
  };
}

const SHARP_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

function isSharpPitch(midi) {
  return SHARP_PITCH_CLASSES.has(((midi % 12) + 12) % 12);
}

// --- pitch geometry: the ONE source of truth for pitch <-> Y ------------------
// Rows are non-uniform: naturals are full height, sharps/flats are half height.
// A cumulative-offset table maps a MIDI pitch to its Y within the grid and back.

function buildRowGeometry() {
  const config = active.config;
  const full = config.basePixelsPerSemitone * config.pitchZoom;
  const rows = config.pitchMax - config.pitchMin + 1;
  const offsets = new Array(rows + 1);
  offsets[0] = 0;
  for (let i = 0; i < rows; i++) {
    const pitch = config.pitchMax - i;
    offsets[i + 1] = offsets[i] + (isSharpPitch(pitch) ? full * 0.5 : full);
  }
  return { offsets, rows, total: offsets[rows], full, half: full * 0.5 };
}

function geometry() {
  const config = active.config;
  const key = `${config.pitchZoom}|${config.pitchMin}|${config.pitchMax}|${config.basePixelsPerSemitone}`;
  if (!active.geom || active.geomKey !== key) {
    active.geom = buildRowGeometry();
    active.geomKey = key;
  }
  return active.geom;
}

/** Pixel offset from the top of the grid to a pitch's row. */
function pitchToY(midi) {
  const g = geometry();
  const i = active.config.pitchMax - midi;
  if (i <= 0) {
    return 0;
  }
  if (i >= g.rows) {
    return g.total;
  }
  return g.offsets[i];
}

/** Row height for a pitch (full for naturals, half for sharps). */
function pitchHeight(midi) {
  const g = geometry();
  return isSharpPitch(midi) ? g.half : g.full;
}

/** Pitch at a pixel offset from the top of the grid (linear scan over ~60 rows). */
function yToPitch(y) {
  const g = geometry();
  if (y <= 0) {
    return active.config.pitchMax;
  }
  if (y >= g.total) {
    return active.config.pitchMin;
  }
  let i = 0;
  while (i < g.rows - 1 && g.offsets[i + 1] <= y) {
    i++;
  }
  return active.config.pitchMax - i;
}

function clampMidi(midi) {
  const config = active.config;
  return Math.max(config.pitchMin, Math.min(config.pitchMax, midi));
}

function snapBeats() {
  return 1 / active.config.subdivisionsPerBeat;
}

function computeLayout() {
  const { scroller, config } = active;
  const vw = scroller.clientWidth;
  const vh = scroller.clientHeight;
  const g = geometry();
  const { pixelsPerBeat } = metrics();
  const stepWidth = pixelsPerBeat / config.subdivisionsPerBeat;
  const totalSteps = Math.max(1, Math.round(config.lengthBeats * config.subdivisionsPerBeat));
  const gridW = totalSteps * stepWidth;
  return {
    vw, vh, rows: g.rows, stepWidth, totalSteps, gridW, gridH: g.total, pixelsPerBeat,
  };
}

// --- canonical coordinate helpers -------------------------------------------

/**
 * MouseEvent -> canvas CSS-pixel coordinates.
 * Divides out devicePixelRatio so the result is in the same units the renderer
 * draws in (see coordinate convention note at top of file).
 */
function eventToCanvasPixels(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width === 0 ? 1 : canvas.width / rect.width;
  const scaleY = rect.height === 0 ? 1 : canvas.height / rect.height;
  const points = event.touches ? event.touches[0] : event;
  return {
    x: ((points.clientX - rect.left) * scaleX) / (window.devicePixelRatio || 1),
    y: ((points.clientY - rect.top) * scaleY) / (window.devicePixelRatio || 1),
  };
}

/** Snap a raw beat and map a grid Y to a snapped (beat, midi) cell. */
function pixelsToCell(x, y, pixelsPerBeat, snap) {
  const rawBeat = x / pixelsPerBeat;
  const maxBeat = Math.max(0, active.config.lengthBeats - snap);
  const snappedBeat = Math.max(0, Math.min(maxBeat, Math.floor(rawBeat / snap) * snap));
  return { beat: snappedBeat, midi: clampMidi(yToPitch(y)), rawBeat };
}

// --- canvas sizing -----------------------------------------------------------

function resizeCanvas(canvas, cssW, cssH) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.floor(cssW));
  const h = Math.max(1, Math.floor(cssH));
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  const bw = Math.max(1, Math.floor(w * dpr));
  const bh = Math.max(1, Math.floor(h * dpr));
  if (canvas.width !== bw) {
    canvas.width = bw;
  }
  if (canvas.height !== bh) {
    canvas.height = bh;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function applySizes() {
  const L = computeLayout();
  const contentW = Math.max(L.gridW, L.vw);
  const contentH = Math.max(L.gridH, L.vh);

  if (active.contentW !== contentW) {
    active.gridContent.style.width = contentW + "px";
    active.contentW = contentW;
  }
  if (active.contentH !== contentH) {
    active.gridContent.style.height = contentH + "px";
    active.contentH = contentH;
  }

  active.gridCtx = resizeCanvas(active.gridCanvas, L.vw, L.vh);
  active.rulerCtx = resizeCanvas(active.rulerCanvas, active.rulerHost.clientWidth, active.rulerHost.clientHeight);
  active.keysCtx = resizeCanvas(active.keysCanvas, active.keysHost.clientWidth, active.keysHost.clientHeight);

  return L;
}

// --- drawing -----------------------------------------------------------------

function roundRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
  }
}

function drawGrid(L, scrollLeft, scrollTop, colors) {
  const ctx = active.gridCtx;
  const config = active.config;
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, L.vw, L.vh);

  const g = geometry();
  for (let i = 0; i <= g.rows; i++) {
    const y = Math.round(g.offsets[i] - scrollTop) + 0.5;
    if (y < -1 || y > L.vh + 1) {
      continue;
    }
    const isC = i < g.rows && ((config.pitchMax - i) % 12 + 12) % 12 === 0;
    ctx.strokeStyle = isC ? colors.borderBright : colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(L.vw, y);
    ctx.stroke();
  }

  const stepsPerBeat = config.subdivisionsPerBeat;
  const stepsPerBar = stepsPerBeat * config.beatsPerBar;
  const firstStep = Math.max(0, Math.floor(scrollLeft / L.stepWidth));
  const lastStep = Math.min(L.totalSteps, Math.ceil((scrollLeft + L.vw) / L.stepWidth));

  for (let i = firstStep; i <= lastStep; i++) {
    const x = Math.round(i * L.stepWidth - scrollLeft) + 0.5;
    const isBar = i % stepsPerBar === 0;
    const isBeat = i % stepsPerBeat === 0;
    if (isBar) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1.5;
    } else if (isBeat) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.borderBright;
      ctx.lineWidth = 1;
    } else {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
    }
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, L.vh);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawNotes(L, scrollLeft, scrollTop);
  drawPlayhead(L, scrollLeft, colors);
  drawDebug(L, scrollLeft, scrollTop, colors);
  drawSelectionBand(colors);
}

// Rubber-band rectangle, drawn in viewport (canvas) space since the canvas is pinned.
function drawSelectionBand(colors) {
  const band = active.band;
  if (!band) {
    return;
  }
  const ctx = active.gridCtx;
  const x = Math.min(band.x0, band.x1);
  const y = Math.min(band.y0, band.y1);
  const w = Math.abs(band.x1 - band.x0);
  const h = Math.abs(band.y1 - band.y0);

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(x, y, w, h);
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.restore();
}

function noteRect(note, L, scrollLeft, scrollTop) {
  const x = note.beat * L.pixelsPerBeat - scrollLeft;
  const w = Math.max(4, note.duration * L.pixelsPerBeat);
  const y = pitchToY(note.midi) - scrollTop;
  const h = Math.max(2, pitchHeight(note.midi) - 1);
  return { x, y, w, h };
}

function drawNotes(L, scrollLeft, scrollTop) {
  const ctx = active.gridCtx;
  const config = active.config;
  const playhead = config.playheadBeat;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, L.vw, L.vh);
  ctx.clip();

  for (const note of config.notes) {
    const rect = noteRect(note, L, scrollLeft, scrollTop);
    if (rect.x > L.vw || rect.x + rect.w < 0 || rect.y + rect.h < 0 || rect.y > L.vh) {
      continue;
    }

    const isActive =
      note.selected && playhead !== null && playhead >= note.beat && playhead < note.beat + note.duration;

    if (note.selected) {
      ctx.globalAlpha = isActive ? 1.0 : 0.85;
      ctx.shadowColor = note.color;
      ctx.shadowBlur = isActive ? 16 : 8;
    } else {
      ctx.globalAlpha = 0.2;
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
    }

    ctx.fillStyle = note.color;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 3);
    ctx.fill();

    if (note.chosen) {
      // White ring keeps the instrument color readable while marking selection.
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      roundRect(ctx, rect.x - 1, rect.y - 1, rect.w + 2, rect.h + 2, 4);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawPlayhead(L, scrollLeft, colors) {
  const x = active.config.playheadBeat * L.pixelsPerBeat - scrollLeft;
  if (x < 0 || x > L.vw) {
    return;
  }
  const ctx = active.gridCtx;
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, L.vh);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawRuler(L, scrollLeft, colors) {
  const ctx = active.rulerCtx;
  const w = active.rulerHost.clientWidth;
  const h = active.rulerHost.clientHeight;
  ctx.fillStyle = colors.panel;
  ctx.fillRect(0, 0, w, h);

  const stepsPerBeat = active.config.subdivisionsPerBeat;
  const stepsPerBar = stepsPerBeat * active.config.beatsPerBar;
  const firstStep = Math.max(0, Math.floor(scrollLeft / L.stepWidth));
  const lastStep = Math.min(L.totalSteps, Math.ceil((scrollLeft + w) / L.stepWidth));

  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.textBaseline = "middle";

  for (let i = firstStep; i <= lastStep; i++) {
    const x = i * L.stepWidth - scrollLeft;
    const isBar = i % stepsPerBar === 0;
    const isBeat = i % stepsPerBeat === 0;
    if (isBar) {
      ctx.fillStyle = colors.accent;
      ctx.fillRect(Math.round(x), 2, 1, h - 4);
      ctx.fillText(String(i / stepsPerBar + 1), Math.round(x) + 4, h / 2);
    } else if (isBeat) {
      ctx.fillStyle = colors.borderBright;
      ctx.fillRect(Math.round(x), h - 7, 1, 5);
    }
  }

  ctx.strokeStyle = colors.borderBright;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h - 0.5);
  ctx.lineTo(w, h - 0.5);
  ctx.stroke();
}

function drawKeys(L, scrollTop, colors) {
  const ctx = active.keysCtx;
  const w = active.keysHost.clientWidth;
  const h = active.keysHost.clientHeight;
  if (w === 0 || h === 0) {
    return;
  }

  const config = active.config;
  const g = geometry();

  // Opaque base so nothing behind the column can show through.
  ctx.fillStyle = colors.panel;
  ctx.fillRect(0, 0, w, h);

  ctx.font = "9px 'JetBrains Mono', monospace";
  ctx.textBaseline = "middle";

  for (let i = 0; i < g.rows; i++) {
    const pitch = config.pitchMax - i;
    const rowTop = g.offsets[i] - scrollTop;
    const rowBottom = g.offsets[i + 1] - scrollTop;
    const rowH = rowBottom - rowTop;
    if (rowBottom < 0 || rowTop > h) {
      continue;
    }

    const hovered = active.hoverKey === pitch;

    // Full-height stripe for the row so boundaries read even when the key is short.
    ctx.fillStyle = isSharpPitch(pitch) ? colors.bg : colors.panel2;
    ctx.fillRect(0, rowTop, w, rowH);

    if (isSharpPitch(pitch)) {
      // Black key: same width as a white key (small horizontal inset), centered in
      // its (already half-height) row slot.
      const x = 3;
      const bw = w - 6;
      const y = rowTop + 1;
      const bh = Math.max(1, rowH - 2);

      ctx.fillStyle = hovered ? "#2a2a3c" : "#101018";
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = colors.borderBright;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, Math.max(1, bh - 1));

      ctx.fillStyle = "#f0f0f5";
      ctx.fillText(noteName(pitch), x + 4, rowTop + rowH / 2);
    } else {
      const height = Math.max(1, rowH - 1);

      ctx.fillStyle = hovered ? "#ffffff" : "#e0e0e6";
      ctx.fillRect(0, rowTop, w, height);
      ctx.strokeStyle = "#0a0a12";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, rowTop + 0.5, w - 1, Math.max(1, height - 1));

      ctx.fillStyle = "#101018";
      ctx.fillText(noteName(pitch), 4, rowTop + rowH / 2);
    }

    // Row separator.
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(rowTop) + 0.5);
    ctx.lineTo(w, Math.round(rowTop) + 0.5);
    ctx.stroke();
  }

  ctx.strokeStyle = colors.borderBright;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w - 0.5, 0);
  ctx.lineTo(w - 0.5, h);
  ctx.stroke();
}

function drawDebug(L, scrollLeft, scrollTop, colors) {
  const config = active.config;
  if (!config.debug || !active.lastPointer) {
    return;
  }
  const ctx = active.gridCtx;
  const { x, y } = active.lastPointer;
  const { pixelsPerBeat } = metrics();
  const snap = snapBeats();

  const cell = pixelsToCell(x + scrollLeft, y + scrollTop, pixelsPerBeat, snap);
  const cellX = cell.beat * pixelsPerBeat - scrollLeft;
  const cellY = pitchToY(cell.midi) - scrollTop;

  ctx.save();
  ctx.strokeStyle = "#ff2e63";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    Math.round(cellX) + 0.5,
    Math.round(cellY) + 0.5,
    Math.round(snap * pixelsPerBeat),
    Math.max(1, Math.round(pitchHeight(cell.midi))),
  );
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x + 10, y);
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x, y + 10);
  ctx.stroke();
  ctx.restore();
}

function render() {
  if (!active) {
    return;
  }
  const L = applySizes();
  const colors = active.colors;
  const scrollLeft = active.scroller.scrollLeft;
  const scrollTop = active.scroller.scrollTop;

  drawGrid(L, scrollLeft, scrollTop, colors);
  drawRuler(L, scrollLeft, colors);
  drawKeys(L, scrollTop, colors);
}

// --- interaction -------------------------------------------------------------

function invoke(method, ...args) {
  if (!active || !active.dotNet) {
    return;
  }
  active.dotNet.invokeMethodAsync(method, ...args).catch(() => {});
}

function schedule() {
  if (!active || active.dirty) {
    return;
  }
  active.dirty = true;
  active.raf = requestAnimationFrame(() => {
    if (!active) {
      return;
    }
    active.dirty = false;
    render();
  });
}

function insideGrid(x, y, L) {
  return x >= 0 && y >= 0 && x <= L.vw && y <= L.vh;
}

// Only selected-track notes are interactive; ghosts are ignored.
function hitTest(x, y, L, scrollLeft, scrollTop) {
  const notes = active.config.notes;
  for (let i = notes.length - 1; i >= 0; i--) {
    const note = notes[i];
    if (!note.selected) {
      continue;
    }
    const rect = noteRect(note, L, scrollLeft, scrollTop);
    if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
      return note.index;
    }
  }
  return -1;
}

function noteByIndex(index) {
  return active.config.notes.find((n) => n.selected && n.index === index) || null;
}

const RESIZE_EDGE_PX = 6;

// True when the cursor is over the right edge of a note (duration resize hotspot).
function isNearRightEdge(x, rect) {
  return x >= rect.x + rect.w - RESIZE_EDGE_PX && x <= rect.x + rect.w + 2;
}

// Ids of selected-track notes whose rect overlaps the rubber band (partial counts).
function notesInBand(band, L) {
  const scrollLeft = active.scroller.scrollLeft;
  const scrollTop = active.scroller.scrollTop;
  const x0 = Math.min(band.x0, band.x1);
  const y0 = Math.min(band.y0, band.y1);
  const x1 = Math.max(band.x0, band.x1);
  const y1 = Math.max(band.y0, band.y1);

  const ids = [];
  for (const note of active.config.notes) {
    if (!note.selected) {
      continue;
    }
    const r = noteRect(note, L, scrollLeft, scrollTop);
    if (r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0) {
      ids.push(note.id);
    }
  }
  return ids;
}

function onPointerDown(event) {
  if (!active) {
    return;
  }
  const canvas = active.gridCanvas;
  const { x, y } = eventToCanvasPixels(canvas, event);
  active.lastPointer = { x, y };
  const L = computeLayout();
  const scrollLeft = active.scroller.scrollLeft;
  const scrollTop = active.scroller.scrollTop;

  if (event.button === 2) {
    const index = hitTest(x, y, L, scrollLeft, scrollTop);
    if (index >= 0) {
      event.preventDefault();
      invoke("OnDeleteNote", index);
    }
    return;
  }

  if (event.button !== 0) {
    return;
  }
  event.preventDefault();

  const index = hitTest(x, y, L, scrollLeft, scrollTop);

  // Right-edge hit starts a duration resize for that one note (before selection logic).
  if (index >= 0 && !event.shiftKey) {
    const note = noteByIndex(index);
    const rect = noteRect(note, L, scrollLeft, scrollTop);
    if (isNearRightEdge(x, rect)) {
      active.drag = {
        kind: "resize",
        pointerId: event.pointerId,
        index,
        noteBeat: note.beat,
      };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "col-resize";
      return;
    }
  }

  // Shift-click toggles membership; shift on empty space does nothing.
  if (event.shiftKey) {
    if (index >= 0) {
      const note = noteByIndex(index);
      if (note) {
        invoke("OnToggleNote", note.id);
      }
    }
    return;
  }

  if (index >= 0) {
    const note = noteByIndex(index);
    const { pixelsPerBeat } = metrics();
    const snap = snapBeats();

    // Clicking an unselected note selects only it; clicking a selected note keeps
    // the selection. Either way, begin dragging the whole selection.
    if (!note.chosen) {
      invoke("OnSelectNotes", [note.id]);
    }
    active.drag = {
      kind: "move",
      pointerId: event.pointerId,
      startBeat: Math.floor((x + scrollLeft) / pixelsPerBeat / snap) * snap,
      startY: y,
      startX: x,
      startMidi: yToPitch(y + scrollTop),
      moved: false,
    };
    // Hold to audition the pitch; cancelled if this turns into a drag.
    active.audition = note.midi;
    invoke("OnAuditionStart", note.midi);
    invoke("OnSelectionDragStart");
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "move";
    return;
  }

  // Empty space: clear selection and start a rubber band. A click with no movement
  // is treated as "place a note" on pointerup (see onPointerUp).
  invoke("OnClearSelection");
  active.band = { x0: x, y0: y, x1: x, y1: y };
  active.drag = { kind: "band", pointerId: event.pointerId, x0: x, y0: y, x1: x, y1: y };
  canvas.setPointerCapture(event.pointerId);
  schedule();
}

function onPointerMove(event) {
  if (!active) {
    return;
  }
  const canvas = active.gridCanvas;
  const { x, y } = eventToCanvasPixels(canvas, event);
  active.lastPointer = { x, y };
  const L = computeLayout();
  const scrollLeft = active.scroller.scrollLeft;
  const scrollTop = active.scroller.scrollTop;

  if (active.drag && event.pointerId === active.drag.pointerId) {
    if (active.drag.kind === "band") {
      active.drag.x1 = x;
      active.drag.y1 = y;
      active.band = { x0: active.drag.x0, y0: active.drag.y0, x1: x, y1: y };
      schedule();
      return;
    }

    if (active.drag.kind === "move") {
      // Once the pointer moves past a small threshold this is a drag, not a click,
      // so cancel the audition.
      if (!active.drag.moved &&
          (Math.abs(x - active.drag.startX) > 4 || Math.abs(y - active.drag.startY) > 4)) {
        active.drag.moved = true;
        if (active.audition !== null) {
          invoke("OnAuditionStop", active.audition);
          active.audition = null;
        }
      }

      const { pixelsPerBeat } = metrics();
      const snap = snapBeats();
      const curBeat = Math.floor((x + scrollLeft) / pixelsPerBeat / snap) * snap;
      const beatSteps = Math.round((curBeat - active.drag.startBeat) / snap);
      // Non-uniform rows: map both Y positions to pitches and take the difference.
      const rowSteps = yToPitch(y + scrollTop) - active.drag.startMidi;
      invoke("OnSelectionDragUpdate", beatSteps, rowSteps);
      schedule();
      return;
    }

    if (active.drag.kind === "resize") {
      const { pixelsPerBeat } = metrics();
      const snap = snapBeats();
      const cursorBeat = (x + scrollLeft) / pixelsPerBeat;
      const duration = Math.max(1, Math.round((cursorBeat - active.drag.noteBeat) / snap)) * snap;
      invoke("OnResizeNote", active.drag.index, duration);
      schedule();
      return;
    }
  }

  const index = hitTest(x, y, L, scrollLeft, scrollTop);
  if (index >= 0) {
    const note = noteByIndex(index);
    const rect = noteRect(note, L, scrollLeft, scrollTop);
    canvas.style.cursor = isNearRightEdge(x, rect) ? "col-resize" : "move";
  } else {
    canvas.style.cursor = "crosshair";
  }
  if (active.config.debug) {
    schedule();
  }
}

function onPointerUp(event) {
  if (!active || !active.drag || event.pointerId !== active.drag.pointerId) {
    return;
  }
  const drag = active.drag;
  if (active.gridCanvas.hasPointerCapture && active.gridCanvas.hasPointerCapture(event.pointerId)) {
    active.gridCanvas.releasePointerCapture(event.pointerId);
  }
  active.drag = null;
  active.band = null;
  active.gridCanvas.style.cursor = "crosshair";

  if (active.audition !== null) {
    invoke("OnAuditionStop", active.audition);
    active.audition = null;
  }

  if (drag.kind === "move") {
    invoke("OnSelectionDragEnd");
    return;
  }

  if (drag.kind === "resize") {
    invoke("OnResizeEnd");
    return;
  }

  if (drag.kind === "band") {
    const moved = Math.abs(drag.x1 - drag.x0) > 3 || Math.abs(drag.y1 - drag.y0) > 3;
    if (moved) {
      invoke("OnSelectNotes", notesInBand(drag, computeLayout()));
    } else {
      // Plain click on empty grid: place a note for the selected instrument.
      const { pixelsPerBeat } = metrics();
      const cell = pixelsToCell(
        drag.x0 + active.scroller.scrollLeft,
        drag.y0 + active.scroller.scrollTop,
        pixelsPerBeat,
        snapBeats());
      invoke("OnPlaceNote", cell.beat, cell.midi);
    }
    schedule();
  }
}

// --- piano keyboard column ---------------------------------------------------

function keyPitchAt(y, scrollTop) {
  const contentY = y + scrollTop;
  if (contentY < 0 || contentY >= geometry().total) {
    return null;
  }
  return yToPitch(contentY);
}

function keysPointerY(event) {
  const canvas = active.keysCanvas;
  const rect = canvas.getBoundingClientRect();
  const scaleY = rect.height === 0 ? 1 : canvas.height / rect.height;
  return ((event.clientY - rect.top) * scaleY) / (window.devicePixelRatio || 1);
}

function onKeysDown(event) {
  if (!active) {
    return;
  }
  const pitch = keyPitchAt(keysPointerY(event), active.scroller.scrollTop);
  if (pitch === null) {
    return;
  }
  event.preventDefault();
  active.hoverKey = pitch;
  active.keyAudition = pitch;
  invoke("OnAuditionStart", pitch);
  active.keysCanvas.setPointerCapture(event.pointerId);
  schedule();
}

function onKeysMove(event) {
  if (!active) {
    return;
  }
  const pitch = keyPitchAt(keysPointerY(event), active.scroller.scrollTop);

  // Glissando: while held, release the previous key and sound the new one.
  if (active.keyAudition !== null && event.buttons) {
    if (pitch !== null && pitch !== active.keyAudition) {
      invoke("OnAuditionStop", active.keyAudition);
      active.keyAudition = pitch;
      invoke("OnAuditionStart", pitch);
    }
    active.hoverKey = pitch;
    schedule();
    return;
  }

  if (pitch !== active.hoverKey) {
    active.hoverKey = pitch;
    schedule();
  }
}

function onKeysUp(event) {
  if (!active) {
    return;
  }
  if (active.keyAudition !== null) {
    invoke("OnAuditionStop", active.keyAudition);
    active.keyAudition = null;
  }
  if (active.keysCanvas.hasPointerCapture && active.keysCanvas.hasPointerCapture(event.pointerId)) {
    active.keysCanvas.releasePointerCapture(event.pointerId);
  }
  schedule();
}

function onKeysLeave() {
  if (!active || active.keyAudition !== null) {
    return;
  }
  active.hoverKey = null;
  schedule();
}

function teardown() {
  if (active && active.cleanup) {
    active.cleanup();
  }
  active = null;
}

/**
 * Binds the .piano-roll root (finding its grid/ruler/keys canvases) and starts
 * rendering. Zoom and note-edit events route back to C# via the DotNet reference.
 */
export function init(root, rawConfig, dotNet) {
  teardown();

  const scroller = root.querySelector(".piano-roll-scroll");
  const gridContent = scroller.querySelector(".piano-roll-content");
  const gridCanvas = scroller.querySelector("canvas");
  const rulerHost = root.querySelector(".piano-roll-ruler");
  const rulerCanvas = rulerHost.querySelector("canvas");
  const keysHost = root.querySelector(".piano-roll-keys");
  const keysCanvas = keysHost.querySelector("canvas");

  active = {
    root,
    scroller,
    gridContent,
    gridCanvas,
    rulerHost,
    rulerCanvas,
    keysHost,
    keysCanvas,
    gridCtx: null,
    rulerCtx: null,
    keysCtx: null,
    config: normalize(rawConfig),
    colors: readColors(),
    dotNet,
    dirty: false,
    raf: 0,
    drag: null,
    band: null,
    audition: null,
    hoverKey: null,
    keyAudition: null,
    lastPointer: null,
    cleanup: null,
  };

  const onScroll = () => schedule();

  const onWheel = (event) => {
    let axis = null;
    if (event.ctrlKey) {
      axis = "time";
    } else if (event.altKey) {
      axis = "pitch";
    } else if (event.shiftKey) {
      axis = "both";
    }
    if (!axis) {
      return;
    }
    event.preventDefault();
    invoke("OnZoomStep", axis, event.deltaY < 0 ? 1 : -1);
  };

  const onKey = (event) => {
    // Never hijack keys while typing in a form control.
    const focused = document.activeElement;
    const tag = focused && focused.tagName ? focused.tagName : "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" ||
        (focused && focused.isContentEditable)) {
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      invoke("OnDeleteSelected");
      event.preventDefault();
      return;
    }

    if (event.key === " " || event.code === "Space") {
      invoke("OnTogglePlay");
      event.preventDefault();
      return;
    }

    if (event.key === "Escape") {
      invoke("OnClearSelection");
      event.preventDefault();
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        invoke("OnUndo");
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        invoke("OnRedo");
      } else if (key === "c") {
        invoke("OnCopy");
      } else if (key === "x") {
        invoke("OnCut");
      } else if (key === "v") {
        invoke("OnPaste");
      } else if (key === "a") {
        invoke("OnSelectAll");
      } else {
        return;
      }
      event.preventDefault();
      return;
    }

    switch (event.key) {
      // , / . shorten / lengthen the single selected note by one snap step.
      case ",":
        invoke("OnResizeSelected", -1);
        break;
      case ".":
        invoke("OnResizeSelected", 1);
        break;
      // Arrow keys nudge the selection: left/right one snap step, up/down a semitone.
      case "ArrowLeft":
        invoke("OnNudge", -1, 0);
        break;
      case "ArrowRight":
        invoke("OnNudge", 1, 0);
        break;
      case "ArrowUp":
        invoke("OnNudge", 0, 1);
        break;
      case "ArrowDown":
        invoke("OnNudge", 0, -1);
        break;
      case "-":
      case "_":
        invoke("OnZoomStep", "time", -1);
        break;
      case "=":
      case "+":
        invoke("OnZoomStep", "time", 1);
        break;
      case "[":
      case "{":
        invoke("OnZoomStep", "pitch", -1);
        break;
      case "]":
      case "}":
        invoke("OnZoomStep", "pitch", 1);
        break;
      case "0":
        invoke("OnZoomReset");
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const onContextMenu = (event) => event.preventDefault();
  const onResize = () => schedule();

  const observer = new ResizeObserver(onResize);
  observer.observe(root);
  observer.observe(scroller);

  scroller.addEventListener("scroll", onScroll, { passive: true });
  scroller.addEventListener("wheel", onWheel, { passive: false });
  gridCanvas.addEventListener("pointerdown", onPointerDown);
  gridCanvas.addEventListener("pointermove", onPointerMove);
  gridCanvas.addEventListener("pointerup", onPointerUp);
  gridCanvas.addEventListener("pointercancel", onPointerUp);
  gridCanvas.addEventListener("contextmenu", onContextMenu);
  keysCanvas.style.cursor = "pointer";
  keysCanvas.addEventListener("pointerdown", onKeysDown);
  keysCanvas.addEventListener("pointermove", onKeysMove);
  keysCanvas.addEventListener("pointerup", onKeysUp);
  keysCanvas.addEventListener("pointercancel", onKeysUp);
  keysCanvas.addEventListener("pointerleave", onKeysLeave);
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);

  active.cleanup = () => {
    scroller.removeEventListener("scroll", onScroll);
    scroller.removeEventListener("wheel", onWheel);
    gridCanvas.removeEventListener("pointerdown", onPointerDown);
    gridCanvas.removeEventListener("pointermove", onPointerMove);
    gridCanvas.removeEventListener("pointerup", onPointerUp);
    gridCanvas.removeEventListener("pointercancel", onPointerUp);
    gridCanvas.removeEventListener("contextmenu", onContextMenu);
    keysCanvas.removeEventListener("pointerdown", onKeysDown);
    keysCanvas.removeEventListener("pointermove", onKeysMove);
    keysCanvas.removeEventListener("pointerup", onKeysUp);
    keysCanvas.removeEventListener("pointercancel", onKeysUp);
    keysCanvas.removeEventListener("pointerleave", onKeysLeave);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
    observer.disconnect();
    if (active && active.raf) {
      cancelAnimationFrame(active.raf);
    }
  };

  render();
}

export function update(rawConfig) {
  if (!active) {
    return;
  }
  active.config = normalize(rawConfig);
  active.colors = readColors();
  // Do NOT clear active.drag: C# re-renders on every drag update and the drag
  // index stays valid because note order is stable while dragging.
  schedule();
}

export function setPlayhead(beat) {
  if (!active) {
    return;
  }
  active.config.playheadBeat = beat;
  schedule();
}

/** Toggle the coordinate debug overlay (crosshair + target cell outline). */
export function setDebugCoordinates(enabled) {
  if (!active) {
    return;
  }
  active.config.debug = !!enabled;
  schedule();
}

export function dispose() {
  teardown();
}
