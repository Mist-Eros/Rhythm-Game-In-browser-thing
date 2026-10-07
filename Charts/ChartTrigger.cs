namespace RiffGame.Charts;

/// <summary>One gameplay trigger. Lane is authoring-only; play re-randomizes lanes.</summary>
public sealed record ChartTrigger
{
    /// <summary>Time in beats from song start; a multiple of 1/128.</summary>
    public double Beat { get; init; }

    /// <summary>1..4. Authoring placeholder only.</summary>
    public int Lane { get; init; }

    /// <summary>tap | hold | left | right | up | down.</summary>
    public string Type { get; init; } = ChartTriggerTypes.Tap;

    /// <summary>Length in beats. Only set for "hold".</summary>
    public double? DurationBeats { get; init; }
}

public static class ChartTriggerTypes
{
    public const string Tap = "tap";
    public const string Hold = "hold";
    public const string Left = "left";
    public const string Right = "right";
    public const string Up = "up";
    public const string Down = "down";

    public static readonly IReadOnlyList<string> Directional = [Left, Up, Right, Down];

    public static readonly IReadOnlyList<string> All = [Tap, Hold, Left, Up, Right, Down];

    public static bool IsDirectional(string? type) => type is not null && Directional.Contains(type);

    /// <summary>Next direction clockwise (or counter-clockwise) through the 4 directions.</summary>
    public static string Rotate(string? type, bool counterClockwise)
    {
        var index = type is null ? -1 : Directional.ToList().IndexOf(type);
        if (index < 0)
        {
            return Left;
        }
        var count = Directional.Count;
        var next = counterClockwise ? (index - 1 + count) % count : (index + 1) % count;
        return Directional[next];
    }
}
