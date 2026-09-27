using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
using RiffGame.Game;

namespace RiffGame.Interop;

/// <summary>
/// C# wrapper around wwwroot/js/pianoroll.js, which renders the editor grid on a canvas.
/// The module handles its own resize handling after init.
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
    /// Binds a canvas element (at scroller &gt; content &gt; canvas) and renders the grid.
    /// Wheel/keyboard zoom events are routed back to <paramref name="dotNet"/>.
    /// </summary>
    public async ValueTask InitAsync(ElementReference canvas, PianoRollConfig config, DotNetObjectReference<PianoRollCallbacks> dotNet)
        => await (await GetModuleAsync()).InvokeVoidAsync("init", canvas, config, dotNet);

    public async ValueTask UpdateAsync(PianoRollConfig config)
        => await (await GetModuleAsync()).InvokeVoidAsync("update", config);

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
