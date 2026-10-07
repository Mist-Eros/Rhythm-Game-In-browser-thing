// Window-level key listener for active editor routes. Routes keys to C# and lets
// C# decide whether to preventDefault (e.g. so R/B do not trigger browser actions).
// Ignored while a text field has focus.

let handler = null;
let target = null;

function onKeyDown(event) {
  const el = document.activeElement;
  const tag = el && el.tagName ? el.tagName : "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el && el.isContentEditable)) {
    return;
  }
  if (!target) {
    return;
  }
  target
    .invokeMethodAsync("OnGlobalKey", event.key, event.shiftKey)
    .then((handled) => {
      if (handled) {
        event.preventDefault();
      }
    })
    .catch(() => {});
}

export function attach(dotNetRef) {
  detach();
  target = dotNetRef;
  handler = onKeyDown;
  window.addEventListener("keydown", handler);
}

export function detach() {
  if (handler) {
    window.removeEventListener("keydown", handler);
  }
  handler = null;
  target = null;
}
