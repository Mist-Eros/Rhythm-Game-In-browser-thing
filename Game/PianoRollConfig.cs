namespace RiffGame.Game;

/// <summary>Structural config passed to wwwroot/js/pianoroll.js for rendering.</summary>
public sealed record PianoRollConfig(
    bool IsDrum,
    int PitchMin,
    int PitchMax,
    double LengthBeats,
    int BeatsPerBar,
    int SubdivisionsPerBeat,
    string AccentColor,
    double TimeZoom,
    double PitchZoom,
    double BasePixelsPerBeat,
    double BasePixelsPerSemitone);
