export function dedupeById<T extends { id: string }>(records: T[], label: string): T[] {
  const seen = new Map<string, T>();

  for (const record of records) {
    const existing = seen.get(record.id);
    if (existing === undefined) {
      seen.set(record.id, record);
      continue;
    }

    if (JSON.stringify(existing) !== JSON.stringify(record)) {
      console.warn(
        `[${label}] Duplicate id "${record.id}" with differing content; keeping the first occurrence.`
      );
    }
  }

  return [...seen.values()];
}
