using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace RiffGame.Interop;

/// <summary>
/// C# wrapper around wwwroot/js/storage.js (IndexedDB). Reads return JSON strings so
/// callers control (de)serialization.
/// </summary>
public sealed class StorageInterop : IAsyncDisposable
{
    private readonly IJSRuntime _js;
    private readonly NavigationManager _nav;
    private IJSObjectReference? _module;
    private bool _disposed;

    public StorageInterop(IJSRuntime js, NavigationManager nav)
    {
        _js = js;
        _nav = nav;
    }

    private async ValueTask<IJSObjectReference> GetModuleAsync()
        => _module ??= await _js.InvokeAsync<IJSObjectReference>(
            "import", new Uri(new Uri(_nav.BaseUri), "js/storage.js").ToString());

    public async ValueTask InitAsync()
        => await (await GetModuleAsync()).InvokeVoidAsync("init");

    public async ValueTask PutAsync(string store, object value)
        => await (await GetModuleAsync()).InvokeVoidAsync("put", store, value);

    /// <summary>Returns the stored record as JSON, or null if not found.</summary>
    public async ValueTask<string?> GetJsonAsync(string store, string id)
        => await (await GetModuleAsync()).InvokeAsync<string?>("getJson", store, id);

    public async ValueTask<string> GetAllJsonAsync(string store)
        => await (await GetModuleAsync()).InvokeAsync<string>("getAllJson", store);

    public async ValueTask<string> ListMetadataJsonAsync(string store)
        => await (await GetModuleAsync()).InvokeAsync<string>("listMetadataJson", store);

    public async ValueTask DeleteAsync(string store, string id)
        => await (await GetModuleAsync()).InvokeVoidAsync("remove", store, id);

    public async ValueTask ClearAsync(string store)
        => await (await GetModuleAsync()).InvokeVoidAsync("clear", store);

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
