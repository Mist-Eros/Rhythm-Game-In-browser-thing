namespace RiffGame.Game;

/// <summary>
/// Shared piano-roll pitch range, used for every instrument. There is no
/// per-instrument special-casing anywhere in the editor.
/// </summary>
public static class InstrumentLayout
{
    public const int PitchMinMidi = 36; // C2
    public const int PitchMaxMidi = 96; // C7
}
