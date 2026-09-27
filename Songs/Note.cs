namespace RiffGame.Songs;

/// <summary>One note event in beats (song-relative).</summary>
public sealed record Note
{
    /// <summary>Position from song start, in beats.</summary>
    public double Beat { get; init; }

    /// <summary>Note name such as "C4" or "A#3".</summary>
    public string Pitch { get; init; } = "C4";

    /// <summary>0..1. Reserved for the audio layer; not yet applied by audio.js.</summary>
    public double Velocity { get; init; } = 1.0;

    /// <summary>Length in beats.</summary>
    public double Duration { get; init; } = 1.0;
}
