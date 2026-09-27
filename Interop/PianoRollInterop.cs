using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
using RiffGame.Game;

namespace RiffGame.Interop;

/// <summary>
/// C# wrapper around wwwroot/js/pianoroll.js, which renders and handles input for the
/// editor grid. The module handles its own resize/scroll handling after init.
/// </summary>
public sealed class PianoRollInterop : IAsyncDisposable
{
    private readonly IJSRuntime _js;
    private readonly NavigationManager _nav;
    private IJSObjectReference? _module;
    private bool _disposed;

    public PianoRollInterop(IJSRuntime js, NavigationManager nav)
    {
        _js = js;
        _nav = nav;
    }

    private async ValueTask<IJSObjectReference> GetModuleAsync()
        => _module ??= await _js.InvokeAsync<IJSObjectReference>(
            "import", new Uri(new Uri(_nav.BaseUri), "js/pianoroll.js").ToString());

    /// <summary>
    /// Binds the .piano-roll root element (whose child canvases are found by class)
    /// and renders the grid. Zoom and note-edit events route back to <paramref name="dotNet"/>.
    /// </summary>
    public async ValueTask InitAsync(ElementReference root, PianoRollConfig config, DotNetObjectReference<PianoRollCallbacks> dotNet)
        => await (await GetModuleAsync()).InvokeVoidAsync("init", root, config, dotNet);

    public async ValueTask UpdateAsync(PianoRollConfig config)
        => await (await GetModuleAsync()).InvokeVoidAsync("update", config);

    /// <summary>Cheap per-frame update of just the playhead position, without resending notes.</summary>
    public async ValueTask SetPlayheadAsync(double beat)
        => await (await GetModuleAsync()).InvokeVoidAsync("setPlayhead", beat);

    public async ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return;
        }
        _disposed = true;

        if (_module is null)
        {
            return;
        }

        try
        {
            await _module.InvokeVoidAsync("dispose");
        }
        catch (JSDisconnectedException) { }

        try
        {
            await _module.DisposeAsync();
        }
        catch (JSDisconnectedException) { }
    }
}
