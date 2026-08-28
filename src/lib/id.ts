/**
 * Generates a locally-unique ID: timestamp (base36) + random suffix.
 * This is used as the SINGLE canonical identity for every event/person/
 * reminder/checklist-item in the app. Every screen (Dashboard, Calendar,
 * Tasks, Upcoming, Notifications, Search, Assistant) references records by
 * this id instead of holding its own copy — that is what guarantees one
 * logical event never appears as two records.
 */
export function generateId(prefix = ''): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${time}${rand}`;
}
