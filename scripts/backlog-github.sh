#!/usr/bin/env bash
# Creates GitHub milestones, labels and issues from scripts/backlog.ts.
# Generated from the SAME source as jira/backlog.csv so the trackers cannot drift.
#
#   ./scripts/backlog-github.sh <owner/repo>
set -euo pipefail
REPO="${1:?usage: backlog-github.sh <owner/repo>}"

NODE_OPTIONS=--disable-warning=ExperimentalWarning node - <<'JS' > /tmp/backlog.ndjson
const { EPICS, STORIES } = await import('./scripts/backlog.ts');
for (const s of STORIES) {
  const e = EPICS[s.epic];
  const reqs = s.reqs.length ? `\n\n**Requirements:** ${s.reqs.join(', ')} — see [docs/SRS.md](docs/SRS.md)` : '';
  process.stdout.write(JSON.stringify({
    title: s.summary,
    body: `${s.description}${reqs}\n\n---\n**Epic:** ${e.summary} · **Points:** ${s.points} · **Priority:** ${s.priority}`,
    labels: [e.label, `points:${s.points}`, `priority:${s.priority.toLowerCase()}`],
    milestone: s.sprint,
    done: !!s.done,
  }) + '\n');
}
JS

# Milestones
for m in "Sprint 0" "Sprint 1" "Sprint 2" "Sprint 3" "Backlog"; do
  gh api "repos/$REPO/milestones" -f title="$m" >/dev/null 2>&1 && echo "milestone: $m" || echo "milestone exists: $m"
done

# Labels
mk_label() { gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force >/dev/null 2>&1 && echo "label: $1"; }
mk_label "epic:foundation"   "1D4ED8" "Foundation & data layer"
mk_label "epic:dose-entry"   "15803D" "Dose entry"
mk_label "epic:stock"        "B45309" "Stock & catalog"
mk_label "epic:reports"      "6B21A8" "Reports"
mk_label "epic:backup"       "B91C1C" "Backup & restore"
mk_label "epic:corrections"  "0F766E" "Corrections & reconciliation"
mk_label "epic:delivery"     "9D174D" "Build & delivery"
mk_label "epic:docs"         "475569" "Documentation"
for p in 2 3 5 8 13; do mk_label "points:$p" "E5E7EB" "Story points: $p"; done
mk_label "priority:highest" "B91C1C" "Highest priority"
mk_label "priority:high"    "B45309" "High priority"
mk_label "priority:medium"  "1D4ED8" "Medium priority"
mk_label "priority:low"     "6B7280" "Low priority"

# Issues
while IFS= read -r line; do
  title=$(jq -r .title <<<"$line")
  body=$(jq -r .body <<<"$line")
  milestone=$(jq -r .milestone <<<"$line")
  labels=$(jq -r '.labels | join(",")' <<<"$line")
  done_flag=$(jq -r .done <<<"$line")

  url=$(gh issue create --repo "$REPO" --title "$title" --body "$body" \
        --label "$labels" --milestone "$milestone")
  num="${url##*/}"
  if [ "$done_flag" = "true" ]; then
    gh issue close "$num" --repo "$REPO" --reason completed \
      --comment "Delivered in the initial commit. Verified by the test suite referenced in the linked requirements." >/dev/null
    echo "closed  #$num  $title"
  else
    echo "open    #$num  $title"
  fi
done < /tmp/backlog.ndjson
