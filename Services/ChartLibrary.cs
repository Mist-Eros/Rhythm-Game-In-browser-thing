using System.Text;
using System.Text.Json;
using RiffGame.Charts;
using RiffGame.Interop;

namespace RiffGame.Services;

/// <summary>Library list entry for a chart.</summary>
public sealed record ChartSummary(
    string Id, string SongId, string Title, string Difficulty, int TriggerCount, long UpdatedAt);

/// <summary>Persists charts in the browser's IndexedDB via <see cref="StorageInterop"/>.</summary>
public sealed class ChartLibrary
{
    private const string ChartStore = "charts";

    private readonly StorageInterop _storage;

    public ChartLibrary(StorageInterop storage) => _storage = storage;

    /// <summary>Inserts or overwrites the chart; returns its id.</summary>
    public async Task<string> SaveAsync(Chart chart)
    {
        await _storage.InitAsync();

        if (chart.Id == Guid.Empty)
        {
            chart = chart with { Id = Guid.NewGuid() };
        }

        var id = chart.Id.ToString();
        var json = await ChartSerializer.ToJsonStringAsync(chart);
        var record = new
        {
            id,
            songId = chart.SongId,
            title = chart.Title,
            difficulty = chart.Difficulty,
            updatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            meta = new
            {
                songId = chart.SongId,
                difficulty = chart.Difficulty,
                triggerCount = chart.Triggers.Count,
            },
            json,
        };

        await _storage.PutAsync(ChartStore, record);
        return id;
    }

    public async Task<Chart?> LoadAsync(string id)
    {
        await _storage.InitAsync();
        var json = await _storage.GetJsonAsync(ChartStore, id);
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        var record = JsonSerializer.Deserialize<StoredChart>(json, ChartSerializer.Options);
        if (record is null || string.IsNullOrWhiteSpace(record.Json))
        {
            return null;
        }

        await using var stream = new MemoryStream(Encoding.UTF8.GetBytes(record.Json));
        return await ChartSerializer.LoadAsync(stream);
    }

    public async Task<List<ChartSummary>> ListAsync()
    {
        await _storage.InitAsync();
        var json = await _storage.ListMetadataJsonAsync(ChartStore);
        var items = JsonSerializer.Deserialize<List<StoredSummary>>(json, ChartSerializer.Options) ?? [];

        return items
            .OrderByDescending(i => i.UpdatedAt)
            .Select(i => new ChartSummary(
                i.Id,
                i.Meta?.SongId ?? "",
                i.Title ?? "",
                i.Meta?.Difficulty ?? "",
                i.Meta?.TriggerCount ?? 0,
                i.UpdatedAt))
            .ToList();
    }

    public async Task<List<ChartSummary>> ListBySongAsync(string songId)
        => (await ListAsync()).Where(c => c.SongId == songId).ToList();

    public async Task DeleteAsync(string id)
    {
        await _storage.InitAsync();
        await _storage.DeleteAsync(ChartStore, id);
    }

    private sealed record StoredChart(
        string Id, string SongId, string Title, string Difficulty, long UpdatedAt, MetaDto? Meta, string Json);

    private sealed record StoredSummary(string Id, string? Title, long UpdatedAt, MetaDto? Meta);

    private sealed record MetaDto(string? SongId, string? Difficulty, int TriggerCount);
}
