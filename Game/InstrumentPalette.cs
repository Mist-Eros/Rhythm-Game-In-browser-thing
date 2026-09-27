using RiffGame.Songs;

namespace RiffGame.Game;

/// <summary>UI accent colors per instrument. Mirrors the CSS custom properties.</summary>
public static class InstrumentPalette
{
    private static readonly IReadOnlyDictionary<string, string> Colors = new Dictionary<string, string>
    {
        [InstrumentNames.Kick] = "#ff2e63",
        [InstrumentNames.Snare] = "#ff8c42",
        [InstrumentNames.Hihat] = "#ffe66d",
        [InstrumentNames.Bass] = "#7b2cbf",
        [InstrumentNames.Guitar] = "#00d9ff",
        [InstrumentNames.Piano] = "#a0e7e5",
        [InstrumentNames.Musicbox] = "#f6c1ff",
    };

    public static string For(string instrument) =>
        Colors.TryGetValue(instrument, out var color) ? color : "#8888a0";
}
