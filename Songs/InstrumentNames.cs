namespace RiffGame.Songs;

/// <summary>
/// Central list of instrument names understood by wwwroot/js/audio.js.
/// The editor, validator, and player all reference this so they stay in sync.
/// </summary>
public static class InstrumentNames
{
    public const string Kick = "kick";
    public const string Snare = "snare";
    public const string Hihat = "hihat";
    public const string Bass = "bass";
    public const string Guitar = "guitar";
    public const string Piano = "piano";
    public const string Musicbox = "musicbox";

    public static readonly IReadOnlyList<string> All =
        [Kick, Snare, Hihat, Bass, Guitar, Piano, Musicbox];

    public static bool IsValid(string? name) =>
        !string.IsNullOrWhiteSpace(name) && All.Contains(name);
}
