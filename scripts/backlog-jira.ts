/**
 * Emits jira/backlog.csv from scripts/backlog.ts.
 *
 * Import via: Jira Settings -> System -> External System Import -> CSV.
 * Map "Epic Link" to the epic field, and "Sprint" to the sprint field. Jira
 * creates the sprints named in that column if they do not exist.
 */
import { EPICS, STORIES } from './backlog.ts';

const HEADERS = [
  'Issue Type', 'Summary', 'Description', 'Epic Name', 'Epic Link',
  'Sprint', 'Story Points', 'Priority', 'Labels', 'Status',
];

/**
 * Jira's CSV importer is unreliable with embedded newlines inside quoted
 * fields, so descriptions are flattened to a single line. Losing a paragraph
 * break is a fair trade for an import that actually works.
 */
function flatten(s: string): string {
  return s.replace(/\s*\n+\s*/g, ' ').trim();
}

function cell(v: string | number | undefined): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const rows: (string | number)[][] = [];

// Epics first, so the Epic Link values in the story rows resolve on import.
for (const e of Object.values(EPICS)) {
  rows.push(['Epic', e.summary, flatten(`Epic: ${e.summary}`), e.summary, '', '', '', 'High', e.label, 'To Do']);
}

for (const s of STORIES) {
  const epic = EPICS[s.epic];
  const reqs = s.reqs.length ? ` Requirements: ${s.reqs.join(', ')} (see docs/SRS.md).` : '';
  rows.push([
    'Story',
    s.summary,
    flatten(s.description + reqs),
    '',
    epic.summary,
    s.sprint === 'Backlog' ? '' : s.sprint,
    s.points,
    s.priority,
    epic.label,
    s.done ? 'Done' : 'To Do',
  ]);
}

console.log([HEADERS, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n');
