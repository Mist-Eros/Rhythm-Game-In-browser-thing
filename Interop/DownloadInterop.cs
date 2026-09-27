using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace RiffGame.Interop;

/// <summary>C# wrapper around wwwroot/js/download.js for triggering browser file downloads.</summary>
public sealed class DownloadInterop : IAsyncDisposable
{
    private readonly IJSRuntime _js;
    private readonly NavigationManager _nav;
    private IJSObjectReference? _module;
    private bool _disposed;

    public DownloadInterop(IJSRuntime js, NavigationManager nav)
    {
        _js = js;
        _nav = nav;
    }

    private async ValueTask<IJSObjectReference> GetModuleAsync()
        => _module ??= await _js.InvokeAsync<IJSObjectReference>(
            "import", new Uri(new Uri(_nav.BaseUri), "js/download.js").ToString());

    /// <summary>Triggers a browser download of <paramref name="content"/> as a text file.</summary>
    public async ValueTask DownloadTextAsync(string filename, string content)
        => await (await GetModuleAsync()).InvokeVoidAsync("downloadText", filename, content);

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
            await _module.DisposeAsync();
        }
        catch (JSDisconnectedException) { }
    }
}
