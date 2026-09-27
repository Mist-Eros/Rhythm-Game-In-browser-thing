namespace RiffGame.Game;

/// <summary>Structural config passed to wwwroot/js/pianoroll.js for rendering and hit-testing.</summary>
public sealed record PianoRollConfig(
    int PitchMin,
    int PitchMax,
    double LengthBeats,
    int BeatsPerBar,
    int SubdivisionsPerBeat,
    double TimeZoom,
    double PitchZoom,
    double BasePixelsPerBeat,
    double BasePixelsPerSemitone,
    double PlayheadBeat,
    IReadOnlyList<PianoRollNote> Notes,
    bool Debug);

/// <summary>
/// A note as seen by the renderer. <paramref name="Index"/> is the position within the
/// selected track's Notes list (used for hit-testing), or -1 for a ghost.
/// </summary>
public sealed record PianoRollNote(
    double Beat, int Midi, double Duration, string Color, bool Selected, int Index);

/// <summary>Left-click on empty grid: request to add a note at the snapped position.</summary>
public sealed record NotePlacement(double Beat, int Midi);

/// <summary>Drag update for an existing note, by index within the selected track.</summary>
public sealed record NoteMove(int Index, double Beat, int Midi);
