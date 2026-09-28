using RiffGame.Songs;

namespace RiffGame.Game;

public sealed record SnapOption(int Subdivisions, string Label);

public static class SnapOptions
{
    public static readonly IReadOnlyList<SnapOption> All =
    [
        new(1, "1/4"),
        new(2, "1/8"),
        new(4, "1/16"),
        new(8, "1/32"),
    ];
}

/// <summary>Editor state for the Compose page: the working song plus view/transport state.</summary>
public sealed class ComposeState
{
    public Song WorkingSong { get; set; } = CreateEmpty();

    public string SelectedInstrument { get; set; } = InstrumentNames.Piano;
    public double CurrentBeat { get; set; }
    public bool IsPlaying { get; set; }

    /// <summary>Grid subdivisions per beat (1=1/4, 2=1/8, 4=1/16, 8=1/32).</summary>
    public int SubdivisionsPerBeat { get; set; } = 4;

    /// <summary>Fixed song length in beats; default is 60 beats (30s at 120 BPM).</summary>
    public double LengthBeats { get; set; } = 60;

    public double TimeZoom { get; set; } = 1.0;
    public double PitchZoom { get; set; } = 1.0;

    public double SnapBeats => 1.0 / SubdivisionsPerBeat;

    public double Bpm
    {
        get => WorkingSong.Bpm;
        set => WorkingSong = WorkingSong with { Bpm = value };
    }

    /// <summary>Ids of the currently selected notes (only on the selected track).</summary>
    public HashSet<Guid> SelectedNoteIds { get; } = [];

    public double LengthSeconds => TimingService.BeatsToSeconds(LengthBeats, Bpm);

    public Track CurrentTrack =>
        WorkingSong.Tracks.FirstOrDefault(t => t.Instrument == SelectedInstrument)
        ?? WorkingSong.Tracks[0];

    /// <summary>Replaces the working song, guaranteeing a track for every instrument.</summary>
    public void LoadSong(Song song)
    {
        foreach (var name in InstrumentNames.All)
        {
            if (song.Tracks.All(t => t.Instrument != name))
            {
                song.Tracks.Add(new Track { Instrument = name });
            }
        }

        // Normalize every note: clamp pitch into the shared piano-roll range (blank -> C4,
        // out-of-range e.g. an old "C1" -> C2) and ensure a stable Id for selection.
        foreach (var track in song.Tracks)
        {
            for (var i = 0; i < track.Notes.Count; i++)
            {
                var note = track.Notes[i];
                var midi = PitchMath.TryNameToMidi(note.Pitch, out var m) ? m : 60;
                var clamped = Math.Clamp(midi, InstrumentLayout.PitchMinMidi, InstrumentLayout.PitchMaxMidi);
                var pitch = PitchMath.MidiToName(clamped);
                var id = note.Id == Guid.Empty ? Guid.NewGuid() : note.Id;

                if (!string.Equals(note.Pitch, pitch, StringComparison.Ordinal) || id != note.Id)
                {
                    track.Notes[i] = note with { Pitch = pitch, Id = id };
                }
            }
        }

        WorkingSong = song;
        SelectedNoteIds.Clear();

        if (song.Tracks.All(t => t.Instrument != SelectedInstrument))
        {
            SelectedInstrument = InstrumentNames.All[0];
        }
        CurrentBeat = 0;
        IsPlaying = false;
    }

    public static Song CreateEmpty(string title = "Untitled")
    {
        var song = new Song { Title = title, Bpm = 120, BeatsPerBar = 4 };
        foreach (var name in InstrumentNames.All)
        {
            song.Tracks.Add(new Track { Instrument = name });
        }
        return song;
    }
}
