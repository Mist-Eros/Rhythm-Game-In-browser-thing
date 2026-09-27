namespace RiffGame.Game;

/// <summary>Base pixel spacing at zoom 1.0, shared with wwwroot/js/pianoroll.js.</summary>
public static class PianoRollMetrics
{
    public const double BasePixelsPerBeat = 288;
    public const double BasePixelsPerSemitone = 42;
}

public static class ZoomLevels
{
    public const double Min = 0.25;
    public const double Max = 4.0;
    public const double Step = 0.25;

    public static double Clamp(double value) => Math.Clamp(value, Min, Max);

    public static double StepBy(double current, int direction) =>
        Clamp(current + direction * Step);
}

/// <summary>New time/pitch zoom values proposed by wheel or keyboard input.</summary>
public sealed record ZoomChange(double Time, double Pitch);
