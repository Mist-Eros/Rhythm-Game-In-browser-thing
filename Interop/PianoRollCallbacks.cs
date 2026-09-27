using Microsoft.JSInterop;

namespace RiffGame.Interop;

/// <summary>
/// Receives editor intents from wwwroot/js/pianoroll.js (zoom, note place/move/delete).
/// The owning component wires the delegates to its own state.
/// </summary>
public sealed class PianoRollCallbacks
{
    private readonly Func<string, int, Task> _onZoomStep;
    private readonly Func<Task> _onZoomReset;
    private readonly Func<double, int, Task> _onPlaceNote;
    private readonly Func<int, double, int, Task> _onMoveNote;
    private readonly Func<int, Task> _onDeleteNote;

    public PianoRollCallbacks(
        Func<string, int, Task> onZoomStep,
        Func<Task> onZoomReset,
        Func<double, int, Task> onPlaceNote,
        Func<int, double, int, Task> onMoveNote,
        Func<int, Task> onDeleteNote)
    {
        _onZoomStep = onZoomStep;
        _onZoomReset = onZoomReset;
        _onPlaceNote = onPlaceNote;
        _onMoveNote = onMoveNote;
        _onDeleteNote = onDeleteNote;
    }

    [JSInvokable]
    public Task OnZoomStep(string axis, int direction) => _onZoomStep(axis, direction);

    [JSInvokable]
    public Task OnZoomReset() => _onZoomReset();

    [JSInvokable]
    public Task OnPlaceNote(double beat, int midi) => _onPlaceNote(beat, midi);

    [JSInvokable]
    public Task OnMoveNote(int index, double beat, int midi) => _onMoveNote(index, beat, midi);

    [JSInvokable]
    public Task OnDeleteNote(int index) => _onDeleteNote(index);
}
