namespace RiffGame.Services;

/// <summary>
/// Friendly write-gate for the song library.
///
/// This is a friendly gate, not real security — client-side code is always inspectable,
/// and the password below is visible to anyone who looks. It only discourages casual
/// overwrites. The unlocked flag is IN-MEMORY ONLY (never persisted), so closing the
/// tab re-locks. Loading, downloading, uploading, and editing are never gated.
/// </summary>
public sealed class LibraryAuth
{
    /// <summary>Change this one constant to change the password.</summary>
    public const string Password = "Fox0708<3";

    /// <summary>Session-scoped; resets on page reload because nothing is persisted.</summary>
    public bool IsUnlocked { get; private set; }

    /// <summary>Validates the password. On success, marks the session unlocked.</summary>
    public bool TryUnlock(string password)
    {
        if (password == Password)
        {
            IsUnlocked = true;
            return true;
        }
        return false;
    }
}
