using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace RiffGame.Interop;

/// <summary>
/// C# wrapper around wwwroot/js/chartkeys.js: attaches/detaches a window keydown
/// listener while an editor route is active so shortcuts work regardless of focus.
/// </summary>
public sealed class KeyboardInterop : IAsyncDisposable
{
    private readonly IJSRuntime _js;
    private readonly NavigationManager _nav;
    private IJSObjectReference? _module;
    private bool _disposed;

    public KeyboardInterop(IJSRuntime js, NavigationManager nav)
    {
        _js = js;
        _nav = nav;
    }

    private async ValueTask<IJSObjectReference> GetModuleAsync()
        => _module ??= await _js.InvokeAsync<IJSObjectReference>(
            "import", new Uri(new Uri(_nav.BaseUri), "js/chartkeys.js").ToString());

    public async ValueTask AttachAsync(DotNetObjectReference<ChartKeyCallbacks> dotNet)
        => await (await GetModuleAsync()).InvokeVoidAsync("attach", dotNet);

    public async ValueTask DetachAsync()
    {
        if (_module is null)
        {
            return;
        }
        try
        {
            await _module.InvokeVoidAsync("detach");
        }
        catch (JSDisconnectedException) { }
    }

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
            await _module.InvokeVoidAsync("detach");
        }
        catch (JSDisconnectedException) { }

        try
        {
            await _module.DisposeAsync();
        }
        catch (JSDisconnectedException) { }
    }
}
