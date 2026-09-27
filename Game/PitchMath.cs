namespace RiffGame.Game;

/// <summary>Converts between MIDI note numbers and names like "C4" / "A#3".</summary>
public static class PitchMath
{
    private static readonly string[] Names =
        ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    public static string MidiToName(int midi) =>
        Names[((midi % 12) + 12) % 12] + (midi / 12 - 1);

    public static bool TryNameToMidi(string? name, out int midi)
    {
        midi = 0;
        if (string.IsNullOrWhiteSpace(name))
        {
            return false;
        }

        var i = 0;
        var semitone = char.ToUpperInvariant(name[i++]) switch
        {
            'C' => 0,
            'D' => 2,
            'E' => 4,
            'F' => 5,
            'G' => 7,
            'A' => 9,
            'B' => 11,
            _ => -1,
        };
        if (semitone < 0)
        {
            return false;
        }

        var accidental = 0;
        if (i < name.Length && (name[i] == '#' || name[i] == 'b'))
        {
            accidental = name[i] == '#' ? 1 : -1;
            i++;
        }

        if (!int.TryParse(name[i..], out var octave))
        {
            return false;
        }

        midi = (octave + 1) * 12 + semitone + accidental;
        return true;
    }
}
