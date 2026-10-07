using System.Text;
using System.Text.Json;
using RiffGame.Interop;
using RiffGame.Songs;

namespace RiffGame.Services;

/// <summary>Library list entry: enough to render a card without loading the full song.</summary>
public sealed record SongSummary(
    string Id, string Title, double Bpm, double LengthBeats, int BeatsPerBar, long UpdatedAt);

/// <summary>Persists songs in the browser's IndexedDB via <see cref="StorageInterop"/>.</summary>
public sealed class SongLibrary
{
    private const string SongStore = "songs";

    private readonly StorageInterop _storage;

    public SongLibrary(StorageInterop storage) => _storage = storage;

    /// <summary>Inserts or overwrites the song; returns its id.</summary>
    public async Task<string> SaveAsync(Song song)
    {
        await _storage.InitAsync();

        if (song.Id == Guid.Empty)
        {
            song = song with { Id = Guid.NewGuid() };
        }

        var lengthBeats = 0.0;
        foreach (var track in song.Tracks)
        {
            foreach (var note in track.Notes)
            {
                var end = note.Beat + note.Duration;
                if (end > lengthBeats)
                {
                    lengthBeats = end;
                }
            }
        }

        var id = song.Id.ToString();
        var json = await SongSerializer.ToJsonStringAsync(song);
        var record = new
        {
            id,
            title = song.Title,
            bpm = song.Bpm,
            lengthBeats,
            updatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            meta = new { bpm = song.Bpm, lengthBeats, beatsPerBar = song.BeatsPerBar },
            json,
        };

        await _storage.PutAsync(SongStore, record);
        return id;
    }

    public async Task<Song?> LoadAsync(string id)
    {
        await _storage.InitAsync();
        var json = await _storage.GetJsonAsync(SongStore, id);
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        var record = JsonSerializer.Deserialize<StoredSong>(json, SongSerializer.Options);
        if (record is null || string.IsNullOrWhiteSpace(record.Json))
        {
            return null;
        }

        await using var stream = new MemoryStream(Encoding.UTF8.GetBytes(record.Json));
        return await SongSerializer.LoadAsync(stream);
    }

    public async Task<List<SongSummary>> ListAsync()
    {
        await _storage.InitAsync();
        var json = await _storage.ListMetadataJsonAsync(SongStore);
        var items = JsonSerializer.Deserialize<List<StoredSummary>>(json, SongSerializer.Options) ?? [];

        return items
            .OrderByDescending(i => i.UpdatedAt)
            .Select(i => new SongSummary(
                i.Id,
                i.Title ?? "",
                i.Meta?.Bpm ?? 0,
                i.Meta?.LengthBeats ?? 0,
                i.Meta?.BeatsPerBar ?? 4,
                i.UpdatedAt))
            .ToList();
    }

    public async Task DeleteAsync(string id)
    {
        await _storage.InitAsync();
        await _storage.DeleteAsync(SongStore, id);
    }

    private sealed record StoredSong(
        string Id, string Title, double Bpm, double LengthBeats, long UpdatedAt, MetaDto? Meta, string Json);

    private sealed record StoredSummary(string Id, string? Title, long UpdatedAt, MetaDto? Meta);

    private sealed record MetaDto(double Bpm, double LengthBeats, int BeatsPerBar);
}
