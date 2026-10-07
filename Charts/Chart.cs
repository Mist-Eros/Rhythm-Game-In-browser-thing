namespace RiffGame.Charts;

/// <summary>A gameplay chart for a song: a set of timed triggers.</summary>
public sealed record Chart
{
    public Guid Id { get; init; } = Guid.NewGuid();

    /// <summary>The id of the <c>Song</c> this chart plays against.</summary>
    public string SongId { get; init; } = "";

    public string Title { get; init; } = "New Chart";
    public string Difficulty { get; init; } = "Normal";

    public List<ChartTrigger> Triggers { get; init; } = [];
}
