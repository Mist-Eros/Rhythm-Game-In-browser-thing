using RiffGame.Songs;

namespace RiffGame.Game;

/// <summary>Maps an instrument to its piano-roll pitch range (MIDI note numbers).</summary>
public static class InstrumentLayout
{
    public static bool IsDrum(string instrument) =>
        instrument is InstrumentNames.Kick or InstrumentNames.Snare or InstrumentNames.Hihat;

    /// <summary>Inclusive MIDI range. Drums render as a single row and ignore this.</summary>
    public static (int Min, int Max) PitchRange(string instrument) => instrument switch
    {
        InstrumentNames.Bass => (36, 72),      // C2..C5
        InstrumentNames.Guitar => (36, 84),    // C2..C6
        InstrumentNames.Piano => (36, 96),     // C2..C7
        InstrumentNames.Musicbox => (60, 96),  // C4..C7
        _ => (48, 84),                          // C3..C6 fallback
    };
}
