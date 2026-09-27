using RiffGame.Interop;
using RiffGame.Songs;

namespace RiffGame.Game;

/// <summary>
/// Schedules a <see cref="Song"/> on the Tone.js transport and drives playback.
/// All timing is delegated to Tone via <see cref="AudioInterop"/>; no C# timers.
/// </summary>
public sealed class SongPlayer
{
    private readonly AudioInterop _audio;

    public SongPlayer(AudioInterop audio, Song song)
    {
        _audio = audio;
        Song = song;
    }

    public Song Song { get; }

    /// <summary>Sets the tempo, clears any prior schedule, and starts from beat 0.</summary>
    public async Task StartAsync()
    {
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(Song.Bpm, 0);

        await _audio.SetBpmAsync(Song.Bpm);
        await _audio.ClearScheduledAsync();
        await _audio.SeekTransportAsync(0);

        foreach (var track in Song.Tracks)
        {
            foreach (var note in track.Notes)
            {
                var timeSec = TimingService.BeatsToSeconds(note.Beat, Song.Bpm);
                var durationSec = TimingService.BeatsToSeconds(note.Duration, Song.Bpm);
                await _audio.PlayInstrumentAsync(track.Instrument, note.Pitch, durationSec, timeSec);
            }
        }

        await _audio.StartTransportAsync();
    }

    /// <summary>Clears scheduled events and stops the transport.</summary>
    public async Task StopAsync()
    {
        await _audio.ClearScheduledAsync();
        await _audio.StopTransportAsync();
    }

    /// <summary>Moves the transport to the given beat position.</summary>
    public async Task SeekAsync(double beat)
    {
        await _audio.SeekTransportAsync(TimingService.BeatsToSeconds(beat, Song.Bpm));
    }
}
