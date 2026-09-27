using System.Text.Json;

namespace RiffGame.Songs;

/// <summary>
/// Validates a deserialized <see cref="Song"/>. Failures are thrown as
/// <see cref="JsonException"/> with a JSON path so callers can locate bad data.
/// </summary>
public static class SongValidation
{
    public static void Validate(Song song)
    {
        if (string.IsNullOrWhiteSpace(song.Title))
        {
            throw Error("Title is required.", "$.title");
        }
        if (song.Bpm <= 0)
        {
            throw Error("Bpm must be greater than 0.", "$.bpm");
        }
        if (song.BeatsPerBar <= 0)
        {
            throw Error("BeatsPerBar must be greater than 0.", "$.beatsPerBar");
        }

        for (var t = 0; t < song.Tracks.Count; t++)
        {
            var track = song.Tracks[t];
            var trackPath = $"$.tracks[{t}]";

            if (!InstrumentNames.IsValid(track.Instrument))
            {
                throw Error(
                    $"Unknown instrument '{track.Instrument}'. Valid instruments: " +
                    $"{string.Join(", ", InstrumentNames.All)}.",
                    $"{trackPath}.instrument");
            }

            for (var n = 0; n < track.Notes.Count; n++)
            {
                var note = track.Notes[n];
                var notePath = $"{trackPath}.notes[{n}]";

                if (note.Beat < 0)
                {
                    throw Error("Beat must be >= 0.", $"{notePath}.beat");
                }
                if (note.Duration <= 0)
                {
                    throw Error("Duration must be greater than 0.", $"{notePath}.duration");
                }
            }
        }
    }

    private static JsonException Error(string message, string path) =>
        new(message, path, lineNumber: null, bytePositionInLine: null);
}
