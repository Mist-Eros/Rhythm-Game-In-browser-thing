using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace RiffGame.Interop;

/// <summary>
/// Thin C# wrapper around wwwroot/js/audio.js, which wraps Tone.js.
/// The ES module is imported lazily on first use. All timing comes from
/// Tone's transport clock; nothing here drives audio from C#.
/// </summary>
public sealed class AudioInterop : IAsyncDisposable
{
    private readonly IJSRuntime _js;
    private readonly NavigationManager _nav;
    private IJSObjectReference? _module;
    private bool _disposed;

    public AudioInterop(IJSRuntime js, NavigationManager nav)
    {
        _js = js;
        _nav = nav;
    }

    private async ValueTask<IJSObjectReference> GetModuleAsync()
        => _module ??= await _js.InvokeAsync<IJSObjectReference>(
            "import", new Uri(new Uri(_nav.BaseUri), "js/audio.js").ToString());

    /// <summary>
    /// Resumes or creates the Tone.js audio context. Call from a user gesture
    /// (click/tap); browsers block audio until then.
    /// </summary>
    public async ValueTask InitAsync()
        => await (await GetModuleAsync()).InvokeVoidAsync("init");

    /// <summary>
    /// Plays a single note on the named instrument. When <paramref name="timeSec"/>
    /// is supplied it is scheduled once on the Tone transport (absolute seconds,
    /// sample-accurate); when null the note fires immediately. <paramref name="velocity"/>
    /// is 0..1 and applied linearly by the synth envelope.
    /// </summary>
    public async ValueTask PlayInstrumentAsync(
        string name, string note, double durationSec, double? timeSec = null, double velocity = 1.0)
        => await (await GetModuleAsync()).InvokeVoidAsync(
            "playInstrument", name, note, durationSec, timeSec, velocity);

    public async ValueTask StartTransportAsync()
        => await (await GetModuleAsync()).InvokeVoidAsync("startTransport");

    public async ValueTask StopTransportAsync()
        => await (await GetModuleAsync()).InvokeVoidAsync("stopTransport");

    public async ValueTask PauseTransportAsync()
        => await (await GetModuleAsync()).InvokeVoidAsync("pauseTransport");

    public async ValueTask SeekTransportAsync(double sec)
        => await (await GetModuleAsync()).InvokeVoidAsync("seekTransport", sec);

    /// <summary>Removes all scheduled transport events without stopping playback.</summary>
    public async ValueTask ClearScheduledAsync()
        => await (await GetModuleAsync()).InvokeVoidAsync("clearScheduled");

    /// <summary>Current Tone transport position in seconds.</summary>
    public async ValueTask<double> GetTransportTimeSecAsync()
        => await (await GetModuleAsync()).InvokeAsync<double>("getTransportTimeSec");

    public async ValueTask SetBpmAsync(double bpm)
        => await (await GetModuleAsync()).InvokeVoidAsync("setBpm", bpm);

    /// <summary>Attacks and holds a note (click-audition). Drums fire a short one-shot.</summary>
    public async ValueTask StartNoteAsync(string name, string pitch, double velocity = 0.8)
        => await (await GetModuleAsync()).InvokeVoidAsync("startNote", name, pitch, velocity);

    /// <summary>Releases a note started with <see cref="StartNoteAsync"/>. No-op for drums.</summary>
    public async ValueTask StopNoteAsync(string name, string pitch)
        => await (await GetModuleAsync()).InvokeVoidAsync("stopNote", name, pitch);

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
