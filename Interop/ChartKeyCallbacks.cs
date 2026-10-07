using Microsoft.JSInterop;

namespace RiffGame.Interop;

/// <summary>Receives window keydown events from wwwroot/js/chartkeys.js.</summary>
public sealed class ChartKeyCallbacks
{
    private readonly Func<string, bool, Task<bool>> _onGlobalKey;

    public ChartKeyCallbacks(Func<string, bool, Task<bool>> onGlobalKey) => _onGlobalKey = onGlobalKey;

    /// <summary>Returns true when C# handled the key (caller will preventDefault).</summary>
    [JSInvokable]
    public Task<bool> OnGlobalKey(string key, bool shiftKey) => _onGlobalKey(key, shiftKey);
}
