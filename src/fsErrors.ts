// tauri-plugin-fs rejects paths outside its scope with "forbidden path: <p>".
// The raw message doesn't say why or what to do, so callers append a
// localized hint (issue #221).
export function isForbiddenPathError(message: string): boolean {
  return /forbidden path/i.test(message);
}
