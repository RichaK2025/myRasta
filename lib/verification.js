// The five axes verifiers can weigh in on (Trust Score). Legacy docs (from
// before granular verification existed, or before the safety/family-friendly
// axes existed) have none of these boolean fields — a missing field reads as
// true in every case, so both the overall score and the per-axis breakdown
// are meaningful immediately, with no migration of existing data.
export const VERIFY_AXES = ['road_condition_accurate', 'safety_accurate', 'scenic_accurate', 'family_friendly_accurate', 'tags_accurate'];

// Short labels for the Trust Score breakdown bars, in the same order as VERIFY_AXES.
export const VERIFY_AXIS_LABELS = {
  road_condition_accurate: 'Road Quality',
  safety_accurate: 'Safety',
  scenic_accurate: 'Scenic Value',
  family_friendly_accurate: 'Family Friendly',
  tags_accurate: 'Tags Accurate',
};

export function computeConfidence(docs) {
  if (docs.length === 0) return null;
  let trueCount = 0;
  for (const d of docs) {
    for (const key of VERIFY_AXES) {
      if (d[key] === undefined || d[key] === true) trueCount += 1;
    }
  }
  return Math.round((trueCount / (docs.length * VERIFY_AXES.length)) * 100);
}

// Per-axis approval percentage — powers the "Road Quality / Safety / Scenic
// Value / Family Friendly / Tags Accurate" breakdown in the Trust Score UI.
export function computeAxisScores(docs) {
  if (docs.length === 0) return null;
  const scores = {};
  for (const key of VERIFY_AXES) {
    const trueCount = docs.filter((d) => d[key] === undefined || d[key] === true).length;
    scores[key] = Math.round((trueCount / docs.length) * 100);
  }
  return scores;
}

export function withDefaultedAxes(doc) {
  const out = {};
  for (const key of VERIFY_AXES) out[key] = doc[key] === undefined ? true : doc[key];
  return out;
}
