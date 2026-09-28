using Microsoft.JSInterop;

namespace RiffGame.Interop;

/// <summary>
/// All intents wwwroot/js/pianoroll.js can raise. Grouped so the callback class
/// does not need a 20-argument constructor.
/// </summary>
public sealed class PianoRollHandlers
{
    public required Func<string, int, Task> ZoomStep { get; init; }
    public required Func<Task> ZoomReset { get; init; }
    public required Func<double, int, Task> PlaceNote { get; init; }
    public required Func<int, double, int, Task> MoveNote { get; init; }
    public required Func<int, Task> DeleteNote { get; init; }
    public required Func<string[], Task> SelectNotes { get; init; }
    public required Func<string, Task> ToggleNote { get; init; }
    public required Func<Task> SelectAll { get; init; }
    public required Func<Task> ClearSelection { get; init; }
    public required Func<Task> SelectionDragStart { get; init; }
    public required Func<int, int, Task> SelectionDragUpdate { get; init; }
    public required Func<Task> SelectionDragEnd { get; init; }
    public required Func<int, int, Task> Nudge { get; init; }
    public required Func<Task> Undo { get; init; }
    public required Func<Task> Redo { get; init; }
    public required Func<Task> Copy { get; init; }
    public required Func<Task> Paste { get; init; }
    public required Func<Task> Cut { get; init; }
    public required Func<int, double, Task> ResizeNote { get; init; }
    public required Func<Task> ResizeEnd { get; init; }
    public required Func<int, Task> ResizeSelected { get; init; }
}

/// <summary>Receives editor intents from wwwroot/js/pianoroll.js via JS interop.</summary>
public sealed class PianoRollCallbacks
{
    private readonly PianoRollHandlers _h;

    public PianoRollCallbacks(PianoRollHandlers handlers) => _h = handlers;

    [JSInvokable] public Task OnZoomStep(string axis, int direction) => _h.ZoomStep(axis, direction);
    [JSInvokable] public Task OnZoomReset() => _h.ZoomReset();
    [JSInvokable] public Task OnPlaceNote(double beat, int midi) => _h.PlaceNote(beat, midi);
    [JSInvokable] public Task OnMoveNote(int index, double beat, int midi) => _h.MoveNote(index, beat, midi);
    [JSInvokable] public Task OnDeleteNote(int index) => _h.DeleteNote(index);
    [JSInvokable] public Task OnSelectNotes(string[] ids) => _h.SelectNotes(ids);
    [JSInvokable] public Task OnToggleNote(string id) => _h.ToggleNote(id);
    [JSInvokable] public Task OnSelectAll() => _h.SelectAll();
    [JSInvokable] public Task OnClearSelection() => _h.ClearSelection();
    [JSInvokable] public Task OnSelectionDragStart() => _h.SelectionDragStart();
    [JSInvokable] public Task OnSelectionDragUpdate(int beatSteps, int rowSteps) =>
        _h.SelectionDragUpdate(beatSteps, rowSteps);
    [JSInvokable] public Task OnSelectionDragEnd() => _h.SelectionDragEnd();
    [JSInvokable] public Task OnNudge(int beatSteps, int rowSteps) => _h.Nudge(beatSteps, rowSteps);
    [JSInvokable] public Task OnUndo() => _h.Undo();
    [JSInvokable] public Task OnRedo() => _h.Redo();
    [JSInvokable] public Task OnCopy() => _h.Copy();
    [JSInvokable] public Task OnPaste() => _h.Paste();
    [JSInvokable] public Task OnCut() => _h.Cut();
    [JSInvokable] public Task OnResizeNote(int index, double durationBeats) =>
        _h.ResizeNote(index, durationBeats);
    [JSInvokable] public Task OnResizeEnd() => _h.ResizeEnd();
    [JSInvokable] public Task OnResizeSelected(int steps) => _h.ResizeSelected(steps);
}
