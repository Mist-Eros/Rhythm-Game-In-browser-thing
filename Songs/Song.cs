namespace RiffGame.Songs;

/// <summary>
/// Top-level song document: metadata plus one track per instrument.
/// Serialized camelCase by <see cref="SongSerializer"/>.
/// </summary>
public sealed record Song
{
    public required string Title { get; init; }
    public double Bpm { get; init; } = 120;
    public int BeatsPerBar { get; init; } = 4;

    /// <summary>Calibration offset in milliseconds. Not used for scheduling yet.</summary>
    public double OffsetMs { get; init; }

    public List<Track> Tracks { get; init; } = [];
}
