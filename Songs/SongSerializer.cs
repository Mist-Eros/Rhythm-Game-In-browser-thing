using System.Text.Json;
using System.Text.Json.Serialization;

namespace RiffGame.Songs;

/// <summary>
/// JSON load/save for <see cref="Song"/>. camelCase on the wire, indented output.
/// Missing required members surface as <see cref="JsonException"/> with a JSON path.
/// </summary>
public static class SongSerializer
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static async Task<Song> LoadAsync(Stream stream)
    {
        var song = await JsonSerializer.DeserializeAsync<Song>(stream, Options)
            ?? throw new JsonException("Song JSON was empty.");
        SongValidation.Validate(song);
        return song;
    }

    /// <summary>Loads from a URL. Resolve relative URLs against the app base URI.</summary>
    public static async Task<Song> LoadFromUrlAsync(HttpClient http, string url)
    {
        using var response = await http.GetAsync(url);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync();
        return await LoadAsync(stream);
    }

    public static Task SaveAsync(Song song, Stream stream) =>
        JsonSerializer.SerializeAsync(stream, song, Options);

    /// <summary>Serializes to a string, for the future editor's save button.</summary>
    public static Task<string> ToJsonStringAsync(Song song) =>
        Task.FromResult(JsonSerializer.Serialize(song, Options));
}
