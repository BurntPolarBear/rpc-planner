// Standalone correctness check for src/utils/grades.js
//
// computeReportCard() and its helpers are now load-bearing for three surfaces:
// the Grades tab, the Progress tab, and the year-end Portfolio handed to
// evaluators. A subtle error in the weighted-average, benchmark-rounding, or
// school-year-filtering logic would be wrong in all three at once. This exercises
// that math against hand-computed expected values.
//
// grades.js imports theme.jsx (which contains JSX), so we bundle the REAL module
// with esbuild first — deps inlined, JSX transformed — and test the actual code,
// not a copy that could drift.
//
// Run from the repo root:  node scripts/test-grades.mjs
// Exits non-zero if any assertion fails.

import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ── Bundle the real module ────────────────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'grades-test-'));
const outfile = join(dir, 'grades.bundle.mjs');
await build({
  entryPoints: ['src/utils/grades.js'],
  bundle: true, format: 'esm', platform: 'node',
  outfile, logLevel: 'silent',
});
const G = await import(pathToFileURL(outfile).href);
const { pctToLetter, schoolYearOf, computeReportCard, CURRENT_SY, BENCH } = G;

// ── Tiny assertion harness ────────────────────────────────────────────────────
let pass = 0; const fails = [];
const eq = (name, got, want) => {
  if (got === want) pass++;
  else fails.push(`${name}\n     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`);
};
const approx = (name, got, want, eps = 1e-9) => {
  if (typeof got === 'number' && Math.abs(got - want) <= eps) pass++;
  else fails.push(`${name}\n     got:  ${got}\n     want: ~${want}`);
};
const ok = (name, cond) => { if (cond) pass++; else fails.push(name); };

const SY = '2025\u20132026';   // en-dash, matches schoolYearOf output
const PY = '2024\u20132025';

// Standard grade group: three subjects, one student in it.
const SUBJECTS = [
  { id: 'math', name: 'Math',    icon: '🔢', color: '#111', totalLessons: 180 },
  { id: 'hist', name: 'History', icon: '📜', color: '#222', totalLessons: 160 },
  { id: 'sci',  name: 'Science', icon: '🔬', color: '#333' }, // totalLessons omitted → default 180
];
const mk = ({ grades = [], answers = [] }) => ({
  students: [{ id: 's1', name: 'Test', emoji: '🧒', family: 'Fam', gradeGroupId: 'g1' }],
  gradeGroups: [{ id: 'g1', name: 'Grade 5', subjects: SUBJECTS }],
  grades: grades.map((x, i) => ({ id: `gr${i}`, studentId: 's1', schoolYear: SY, ...x })),
  answers: answers.map((x) => ({ studentId: 's1', status: 'approved', ...x })),
});
const subjOf = (rc, id) => rc.subjects.find((s) => s.subj.id === id);

// ── pctToLetter: boundary table ───────────────────────────────────────────────
[
  [100,'A'],[93,'A'],[92,'A-'],[90,'A-'],[89,'B+'],[87,'B+'],[86,'B'],[83,'B'],
  [82,'B-'],[80,'B-'],[79,'C+'],[77,'C+'],[76,'C'],[73,'C'],[72,'C-'],[70,'C-'],
  [69,'D+'],[67,'D+'],[66,'D'],[63,'D'],[62,'D-'],[60,'D-'],[59,'F'],[0,'F'],
].forEach(([p, l]) => eq(`pctToLetter(${p})`, pctToLetter(p), l));
// rounding at the .5 edges (JS rounds half up)
eq('pctToLetter(92.5) rounds to 93→A', pctToLetter(92.5), 'A');
eq('pctToLetter(89.5) rounds to 90→A-', pctToLetter(89.5), 'A-');
eq('pctToLetter(59.5) rounds to 60→D-', pctToLetter(59.5), 'D-');
eq('pctToLetter(59.4) rounds to 59→F',  pctToLetter(59.4), 'F');

// ── schoolYearOf: Aug 1 → Jul 31 boundary ─────────────────────────────────────
eq('schoolYearOf 2025-08-01 (Aug starts new SY)', schoolYearOf('2025-08-01'), SY);
eq('schoolYearOf 2025-07-31 (Jul is prior SY)',   schoolYearOf('2025-07-31'), PY);
eq('schoolYearOf 2026-01-15 (Jan mid-SY)',        schoolYearOf('2026-01-15'), SY);
eq('schoolYearOf 2025-12-31 (Dec mid-SY)',        schoolYearOf('2025-12-31'), SY);

// ── S1: weighted average, letter, gpa ─────────────────────────────────────────
{
  const rc = computeReportCard(mk({ grades: [
    { subjectId:'math', date:'2025-09-01', score:100, weight:3 },
    { subjectId:'math', date:'2025-09-02', score:80,  weight:1 },
  ] }), 's1', SY);
  const m = subjOf(rc, 'math');           // (100*3 + 80*1) / 4 = 95
  approx('S1 math weighted avg = 95', m.avg, 95);
  eq('S1 math letter = A', m.letter, 'A');
  approx('S1 math gpa = 4.0', m.gpa, 4.0);
  eq('S1 math count = 2', m.count, 2);
}

// ── S2: missing weight defaults to 1 ──────────────────────────────────────────
{
  const rc = computeReportCard(mk({ grades: [
    { subjectId:'math', date:'2025-09-01', score:90 },            // no weight
    { subjectId:'math', date:'2025-09-02', score:70, weight:1 },
  ] }), 's1', SY);
  approx('S2 missing weight treated as 1 → avg 80', subjOf(rc,'math').avg, 80);
  eq('S2 letter = B-', subjOf(rc,'math').letter, 'B-');
}

// ── S3: missing score defaults to 0 ───────────────────────────────────────────
{
  const rc = computeReportCard(mk({ grades: [
    { subjectId:'math', date:'2025-09-01', score:100, weight:1 },
    { subjectId:'math', date:'2025-09-02', weight:1 },            // no score → 0
  ] }), 's1', SY);
  approx('S3 missing score treated as 0 → avg 50', subjOf(rc,'math').avg, 50);
  eq('S3 letter = F', subjOf(rc,'math').letter, 'F');
}

// ── S4: overall weights each SUBJECT equally, not each grade ───────────────────
{
  const grades = [
    ...[1,2,3,4,5].map(n => ({ subjectId:'math', date:`2025-09-0${n}`, score:90, weight:1 })), // avg 90
    { subjectId:'hist', date:'2025-09-01', score:80, weight:1 },                                 // avg 80
  ];
  const rc = computeReportCard(mk({ grades }), 's1', SY);
  approx('S4 math avg 90', subjOf(rc,'math').avg, 90);
  approx('S4 hist avg 80', subjOf(rc,'hist').avg, 80);
  // 5 math grades vs 1 hist grade, but overall is (90+80)/2 — subjects weigh equally
  approx('S4 overallPct = 85 (equal per-subject)', rc.overallPct, 85);
  eq('S4 overallLetter = B', rc.overallLetter, 'B');
  approx('S4 overall gpa = 3.2', rc.gpa, 3.2);   // (A-=3.7 + B-=2.7)/2
  eq('S4 graded length = 2', rc.graded.length, 2);
}

// ── S5: school-year filtering ─────────────────────────────────────────────────
{
  const db = mk({ grades: [
    { subjectId:'math', date:'2025-09-01', score:100, schoolYear: SY },
    { subjectId:'math', date:'2024-09-01', score:0,   schoolYear: PY },
  ] });
  const cur = computeReportCard(db, 's1', SY);
  approx('S5 current-year math avg = 100', subjOf(cur,'math').avg, 100);
  eq('S5 current-year totalGraded = 1', cur.totalGraded, 1);
  const prev = computeReportCard(db, 's1', PY);
  approx('S5 prior-year math avg = 0', subjOf(prev,'math').avg, 0);
  eq('S5 prior-year totalGraded = 1', prev.totalGraded, 1);
}

// ── S6: schoolYear falls back to date when field absent ───────────────────────
{
  const db = { ...mk({}), grades: [
    { id:'x', studentId:'s1', subjectId:'math', date:'2025-09-10', score:88 }, // no schoolYear
  ] };
  const rc = computeReportCard(db, 's1', SY);
  approx('S6 date-derived SY grade counted → avg 88', subjOf(rc,'math').avg, 88);
  eq('S6 totalGraded = 1', rc.totalGraded, 1);
}

// ── S7: benchmark averaging + round-half-up, subject and overall ──────────────
{
  const rc = computeReportCard(mk({ grades: [
    { subjectId:'math', date:'2025-09-01', score:90, benchmark:'at' },    // level 3
    { subjectId:'math', date:'2025-09-02', score:90, benchmark:'above' }, // level 4
    { subjectId:'hist', date:'2025-09-01', score:90, benchmark:'at' },    // level 3
  ] }), 's1', SY);
  // math: (3+4)/2 = 3.5 → round 4 → 'above'
  eq('S7 math benchKey = above (3.5 rounds up)', subjOf(rc,'math').benchKey, 'above');
  eq('S7 hist benchKey = at', subjOf(rc,'hist').benchKey, 'at');
  // overall standing: subject levels (above=4, at=3) → (4+3)/2 = 3.5 → 'above'
  eq('S7 standingKey = above', rc.standingKey, 'above');
}

// ── S8: unknown benchmark value is ignored, not crashed on ─────────────────────
{
  const rc = computeReportCard(mk({ grades: [
    { subjectId:'math', date:'2025-09-01', score:90, benchmark:'gibberish' },
  ] }), 's1', SY);
  eq('S8 unknown benchmark → benchKey null', subjOf(rc,'math').benchKey, null);
  eq('S8 subject still graded', subjOf(rc,'math').count, 1);
}

// ── S9: progress uses highest APPROVED lesson, caps at 100 ─────────────────────
{
  const rc = computeReportCard(mk({
    grades: [],
    answers: [
      { subjectId:'math', lessonNum:45, status:'approved' },
      { subjectId:'math', lessonNum:999, status:'submitted' }, // not approved → ignored
      { subjectId:'hist', lessonNum:200, status:'approved' },  // 200/160 > 100 → capped
    ],
  }), 's1', SY);
  eq('S9 math highest approved = 45', subjOf(rc,'math').highest, 45);
  eq('S9 math progress = 25%', subjOf(rc,'math').progressPct, 25);
  eq('S9 hist progress capped at 100%', subjOf(rc,'hist').progressPct, 100);
  eq('S9 sci default total = 180', subjOf(rc,'sci').total, 180);
  eq('S9 sci no answers → 0%', subjOf(rc,'sci').progressPct, 0);
}

// ── S10: student with no grades ───────────────────────────────────────────────
{
  const rc = computeReportCard(mk({ grades: [] }), 's1', SY);
  eq('S10 graded empty', rc.graded.length, 0);
  eq('S10 overallPct null', rc.overallPct, null);
  eq('S10 overallLetter null', rc.overallLetter, null);
  eq('S10 gpa null', rc.gpa, null);
  eq('S10 standingKey null', rc.standingKey, null);
  eq('S10 math avg null', subjOf(rc,'math').avg, null);
}

// ── S11: nonexistent student does not throw, degrades cleanly ──────────────────
{
  let threw = false, rc;
  try { rc = computeReportCard(mk({ grades: [] }), 'nobody', SY); } catch { threw = true; }
  ok('S11 no throw for unknown student', !threw);
  eq('S11 subjects empty', rc.subjects.length, 0);
  eq('S11 overallPct null', rc.overallPct, null);
}

// ── S12: CURRENT_SY / isCurrent / years always includes current ───────────────
{
  const rc = computeReportCard(mk({ grades: [
    { subjectId:'math', date:'2025-09-01', score:90 },
  ] }), 's1', CURRENT_SY);
  ok('S12 isCurrent true when sy = CURRENT_SY', rc.isCurrent === true);
  ok('S12 years includes CURRENT_SY', rc.years.includes(CURRENT_SY));
  const rcPast = computeReportCard(mk({ grades: [] }), 's1', PY);
  ok('S12 isCurrent reflects sy match', rcPast.isCurrent === (PY === CURRENT_SY));
}

// ── Report ────────────────────────────────────────────────────────────────────
console.log(`\ngrades.js correctness: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.log('\nFAILURES:');
  fails.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  process.exit(1);
}
console.log('All grade-math assertions hold. ✓\n');
