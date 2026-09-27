// Piano-roll grid renderer for the Compose page.
// Draws only the visible viewport of a large virtual canvas: a sticky <canvas>
// sized to the scroll container, with drawing offset by scrollLeft/scrollTop.
// A pinned top ruler and left key column stay fixed; the grid scrolls under them.
// Non-interactive (no note editing). Config comes from Interop/PianoRollInterop.cs.

const KEY_STRIP_WIDTH = 52;
const RULER_HEIGHT = 22;

let active = null;

function read(node, fallback) {
  return node === undefined || node === null ? fallback : node;
}

function normalize(raw) {
  return {
    isDrum: read(raw.isDrum ?? raw.IsDrum, false),
    pitchMin: read(raw.pitchMin ?? raw.PitchMin, 48),
    pitchMax: read(raw.pitchMax ?? raw.PitchMax, 84),
    lengthBeats: read(raw.lengthBeats ?? raw.LengthBeats, 60),
    beatsPerBar: read(raw.beatsPerBar ?? raw.BeatsPerBar, 4),
    subdivisionsPerBeat: read(raw.subdivisionsPerBeat ?? raw.SubdivisionsPerBeat, 4),
    accentColor: read(raw.accentColor ?? raw.AccentColor, "#00d9ff"),
    timeZoom: read(raw.timeZoom ?? raw.TimeZoom, 1),
    pitchZoom: read(raw.pitchZoom ?? raw.PitchZoom, 1),
    basePixelsPerBeat: read(raw.basePixelsPerBeat ?? raw.BasePixelsPerBeat, 288),
    basePixelsPerSemitone: read(raw.basePixelsPerSemitone ?? raw.BasePixelsPerSemitone, 42),
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
  };
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteName(midi) {
  return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

function computeLayout() {
  const { scroller, config } = active;
  const vw = scroller.clientWidth;
  const vh = scroller.clientHeight;
  const gridX = config.isDrum ? 0 : KEY_STRIP_WIDTH;
  const gridTop = RULER_HEIGHT;
  const rows = config.pitchMax - config.pitchMin + 1;
  const rowHeight = config.basePixelsPerSemitone * config.pitchZoom;
  const stepWidth = (config.basePixelsPerBeat * config.timeZoom) / config.subdivisionsPerBeat;
  const totalSteps = Math.max(1, Math.round(config.lengthBeats * config.subdivisionsPerBeat));
  const gridW = totalSteps * stepWidth;
  return { vw, vh, gridX, gridTop, rows, rowHeight, stepWidth, totalSteps, gridW };
}

function applySizes() {
  const { canvas, content, config } = active;
  const L = computeLayout();

  const contentW = Math.max(L.gridX + L.gridW, L.vw);
  const contentH = config.isDrum
    ? L.vh
    : Math.max(L.gridTop + L.rows * L.rowHeight, L.vh);

  if (active.contentW !== contentW) {
    content.style.width = contentW + "px";
    active.contentW = contentW;
  }
  if (active.contentH !== contentH) {
    content.style.height = contentH + "px";
    active.contentH = contentH;
  }

  const dpr = window.devicePixelRatio || 1;
  const backingW = Math.max(1, Math.floor(L.vw * dpr));
  const backingH = Math.max(1, Math.floor(L.vh * dpr));

  if (canvas.width !== backingW) {
    canvas.style.width = L.vw + "px";
    canvas.width = backingW;
  }
  if (canvas.height !== backingH) {
    canvas.style.height = L.vh + "px";
    canvas.height = backingH;
  }

  return { L, dpr };
}

function drawKeyStrip(ctx, firstRow, lastRow, scrollTop, L, colors) {
  const top = L.gridTop;
  ctx.fillStyle = colors.panel;
  ctx.fillRect(0, top, KEY_STRIP_WIDTH, L.vh - top);

  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.textBaseline = "middle";

  for (let r = firstRow; r <= lastRow; r++) {
    const pitch = active.config.pitchMax - r;
    const y = top + r * L.rowHeight - scrollTop;
    const isC = ((pitch % 12) + 12) % 12 === 0;

    ctx.fillStyle = isC ? colors.panel2 : colors.bg;
    ctx.fillRect(0, y, KEY_STRIP_WIDTH - 1, Math.max(1, L.rowHeight - 1));

    if (isC || L.rowHeight >= 16) {
      ctx.fillStyle = isC ? colors.borderBright : colors.textDim;
      ctx.fillText(noteName(pitch), 4, y + L.rowHeight / 2);
    }
  }

  ctx.strokeStyle = colors.borderBright;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(KEY_STRIP_WIDTH - 0.5, top);
  ctx.lineTo(KEY_STRIP_WIDTH - 0.5, L.vh);
  ctx.stroke();
}

function drawRuler(ctx, L, scrollLeft, colors) {
  ctx.fillStyle = colors.panel;
  ctx.fillRect(0, 0, L.vw, RULER_HEIGHT);

  const stepsPerBeat = active.config.subdivisionsPerBeat;
  const stepsPerBar = stepsPerBeat * active.config.beatsPerBar;

  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.textBaseline = "middle";

  const firstStep = Math.max(0, Math.floor((scrollLeft - L.gridX) / L.stepWidth));
  const lastStep = Math.min(L.totalSteps, Math.ceil((scrollLeft + L.vw - L.gridX) / L.stepWidth));
  const clipX = L.gridX;

  for (let i = firstStep; i <= lastStep; i++) {
    const x = L.gridX + i * L.stepWidth - scrollLeft;
    if (x < clipX) {
      continue;
    }
    const isBar = i % stepsPerBar === 0;
    const isBeat = i % stepsPerBeat === 0;

    if (isBar) {
      ctx.fillStyle = active.config.accentColor;
      ctx.fillRect(Math.round(x), 2, 1, RULER_HEIGHT - 4);
      ctx.fillText(String(i / stepsPerBar + 1), Math.round(x) + 4, RULER_HEIGHT / 2);
    } else if (isBeat) {
      ctx.fillStyle = colors.borderBright;
      ctx.fillRect(Math.round(x), RULER_HEIGHT - 7, 1, 5);
    }
  }

  // Corner above the key column, then the ruler's bottom border.
  ctx.fillStyle = colors.panel2;
  ctx.fillRect(0, 0, clipX, RULER_HEIGHT);

  ctx.strokeStyle = colors.borderBright;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, RULER_HEIGHT - 0.5);
  ctx.lineTo(L.vw, RULER_HEIGHT - 0.5);
  ctx.stroke();
}

function render() {
  if (!active) {
    return;
  }
  const { canvas, scroller, config, colors } = active;
  const { L, dpr } = applySizes();

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, L.vw, L.vh);

  const scrollLeft = scroller.scrollLeft;
  const scrollTop = scroller.scrollTop;

  // Visible pitch rows (melodic only).
  let firstRow = 0;
  let lastRow = 0;
  if (!config.isDrum) {
    firstRow = Math.max(0, Math.floor((scrollTop - L.gridTop) / L.rowHeight));
    lastRow = Math.min(L.rows - 1, Math.floor((scrollTop + L.vh) / L.rowHeight));

    for (let r = firstRow; r <= lastRow; r++) {
      const pitch = config.pitchMax - r;
      const y = Math.round(L.gridTop + r * L.rowHeight - scrollTop) + 0.5;
      const isC = ((pitch % 12) + 12) % 12 === 0;
      ctx.strokeStyle = isC ? colors.borderBright : colors.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(L.gridX, y);
      ctx.lineTo(L.vw, y);
      ctx.stroke();
    }
  }

  // Visible time steps.
  const stepsPerBeat = config.subdivisionsPerBeat;
  const stepsPerBar = stepsPerBeat * config.beatsPerBar;
  const firstStep = Math.max(0, Math.floor((scrollLeft - L.gridX) / L.stepWidth));
  const lastStep = Math.min(L.totalSteps, Math.ceil((scrollLeft + L.vw - L.gridX) / L.stepWidth));

  for (let i = firstStep; i <= lastStep; i++) {
    const x = Math.round(L.gridX + i * L.stepWidth - scrollLeft) + 0.5;
    const isBar = i % stepsPerBar === 0;
    const isBeat = i % stepsPerBeat === 0;

    if (isBar) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = config.accentColor;
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
    ctx.moveTo(x, L.gridTop);
    ctx.lineTo(x, L.vh);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (!config.isDrum) {
    drawKeyStrip(ctx, firstRow, lastRow, scrollTop, L, colors);
  } else {
    ctx.fillStyle = colors.textDim;
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textBaseline = "top";
    ctx.fillText("percussion", 8, RULER_HEIGHT + 8);
  }

  drawRuler(ctx, L, scrollLeft, colors);
}

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

function teardown() {
  if (active && active.cleanup) {
    active.cleanup();
  }
  active = null;
}

/**
 * Binds a canvas (expected at scroller > content > canvas) and starts rendering.
 * Wheel/keyboard zoom changes are routed back to C# via the supplied DotNet reference.
 */
export function init(canvas, rawConfig, dotNet) {
  teardown();

  const content = canvas.parentElement;
  const scroller = content.parentElement;

  active = {
    canvas,
    content,
    scroller,
    config: normalize(rawConfig),
    colors: readColors(),
    dotNet,
    dirty: false,
    raf: 0,
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
      return; // Plain wheel keeps normal scrolling.
    }
    event.preventDefault();
    invoke("OnZoomStep", axis, event.deltaY < 0 ? 1 : -1);
  };

  const onKey = (event) => {
    switch (event.key) {
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

  const observer = new ResizeObserver(() => schedule());
  observer.observe(scroller);

  scroller.addEventListener("scroll", onScroll, { passive: true });
  scroller.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);

  active.cleanup = () => {
    scroller.removeEventListener("scroll", onScroll);
    scroller.removeEventListener("wheel", onWheel);
    window.removeEventListener("keydown", onKey);
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
  schedule();
}

export function dispose() {
  teardown();
}
