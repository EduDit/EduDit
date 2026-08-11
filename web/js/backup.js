// Profile backup/restore: serializes a profile to a downloadable .json file
// and parses one back. `profile` is exported and re-imported exactly as
// storage.js already stores it — this never changes its shape, just adds a
// thin, versioned envelope so an import can be told apart from an
// unrelated JSON file and matched back to a name. Download/file-input
// wiring lives in settings.js; this module is pure serialize/parse/validate.

const EXPORT_MARKER = "ditdash_profile_export";
const EXPORT_VERSION = 1;

export function serializeProfile(name, profile) {
  return JSON.stringify({ [EXPORT_MARKER]: EXPORT_VERSION, name, profile }, null, 2);
}

// Returns { name, profile } on success. Throws an Error with a clear,
// user-facing message on anything malformed — never silently returns a
// partial/garbage result for a caller to write to storage unchecked.
export function parseImportedProfile(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error("That file isn't valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || parsed[EXPORT_MARKER] !== EXPORT_VERSION) {
    throw new Error("That doesn't look like a DitDash profile backup file.");
  }

  const { name, profile } = parsed;
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("That backup file is missing a profile name.");
  }
  if (!profile || typeof profile !== "object" || typeof profile.settings !== "object") {
    throw new Error("That backup file is missing profile data.");
  }

  return { name, profile };
}
