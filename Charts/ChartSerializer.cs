using System.Text.Json;
using System.Text.Json.Serialization;

namespace RiffGame.Charts;

/// <summary>JSON load/save for <see cref="Chart"/>. camelCase on the wire.</summary>
public static class ChartSerializer
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static async Task<Chart> LoadAsync(Stream stream)
        => await JsonSerializer.DeserializeAsync<Chart>(stream, Options)
           ?? throw new JsonException("Chart JSON was empty.");

    public static Task<string> ToJsonStringAsync(Chart chart)
        => Task.FromResult(JsonSerializer.Serialize(chart, Options));
}
