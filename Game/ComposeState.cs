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

/// <summary>Editor state for the Compose page. UI-only for now; no note editing yet.</summary>
public sealed class ComposeState
{
    public string SelectedInstrument { get; set; } = InstrumentNames.Piano;
    public double Bpm { get; set; } = 120;

    /// <summary>Grid subdivisions per beat (1=1/4, 2=1/8, 4=1/16, 8=1/32).</summary>
    public int SubdivisionsPerBeat { get; set; } = 4;

    public double CurrentTimeSec { get; set; }

    /// <summary>Fixed song length in beats; default is 60 beats (30s at 120 BPM).</summary>
    public double LengthBeats { get; set; } = 60;

    /// <summary>Horizontal spacing multiplier (time axis).</summary>
    public double TimeZoom { get; set; } = 1.0;

    /// <summary>Vertical spacing multiplier (pitch axis).</summary>
    public double PitchZoom { get; set; } = 1.0;

    public double LengthSeconds => TimingService.BeatsToSeconds(LengthBeats, Bpm);
}
