using Microsoft.JSInterop;

namespace RiffGame.Interop;

/// <summary>
/// Receives zoom intents from wwwroot/js/pianoroll.js (wheel / keyboard).
/// The owning component wires the delegates to its own state.
/// </summary>
public sealed class PianoRollCallbacks
{
    private readonly Func<string, int, Task> _onZoomStep;
    private readonly Func<Task> _onZoomReset;

    public PianoRollCallbacks(Func<string, int, Task> onZoomStep, Func<Task> onZoomReset)
    {
        _onZoomStep = onZoomStep;
        _onZoomReset = onZoomReset;
    }

    [JSInvokable]
    public Task OnZoomStep(string axis, int direction) => _onZoomStep(axis, direction);

    [JSInvokable]
    public Task OnZoomReset() => _onZoomReset();
}
