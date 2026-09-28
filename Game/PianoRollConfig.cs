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
/// <paramref name="Id"/> is the note's stable id; <paramref name="Chosen"/> marks it
/// as part of the current multi-selection.
/// </summary>
public sealed record PianoRollNote(
    double Beat,
    int Midi,
    double Duration,
    string Color,
    bool Selected,
    int Index,
    string Id,
    bool Chosen);

/// <summary>A selection move, in grid steps (beats) and semitones, relative to originals.</summary>
public sealed record SelectionDelta(int BeatSteps, int RowSteps);

/// <summary>Live duration resize for one note (beats).</summary>
public sealed record NoteResize(int Index, double DurationBeats);

/// <summary>Left-click on empty grid: request to add a note at the snapped position.</summary>
public sealed record NotePlacement(double Beat, int Midi);

/// <summary>Drag update for an existing note, by index within the selected track.</summary>
public sealed record NoteMove(int Index, double Beat, int Midi);
