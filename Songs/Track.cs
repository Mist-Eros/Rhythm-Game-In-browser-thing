namespace RiffGame.Songs;

/// <summary>A single instrument line. <see cref="Instrument"/> must be in <see cref="InstrumentNames.All"/>.</summary>
public sealed record Track
{
    public required string Instrument { get; init; }
    public List<Note> Notes { get; init; } = [];
}
