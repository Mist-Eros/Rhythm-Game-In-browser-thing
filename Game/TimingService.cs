namespace RiffGame.Game;

/// <summary>Single source of truth for beat/second conversions. No inline math elsewhere.</summary>
public static class TimingService
{
    public static double BeatsToSeconds(double beats, double bpm) => beats * 60.0 / bpm;

    public static double SecondsToBeats(double seconds, double bpm) => seconds * bpm / 60.0;
}
