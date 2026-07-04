import { TODAY } from './dates';
import { C } from './theme';


// ─── GRADING HELPERS ──────────────────────────────────────────────────────────
// Standard US percentage → letter scale.
export const pctToLetter = (p) => {
  const n = Math.round(p);
  if (n >= 93) return 'A';   if (n >= 90) return 'A-';
  if (n >= 87) return 'B+';  if (n >= 83) return 'B';  if (n >= 80) return 'B-';
  if (n >= 77) return 'C+';  if (n >= 73) return 'C';  if (n >= 70) return 'C-';
  if (n >= 67) return 'D+';  if (n >= 63) return 'D';  if (n >= 60) return 'D-';
  return 'F';
};

const letterToGpa = (l) => ({
  'A':4.0,'A-':3.7,'B+':3.3,'B':3.0,'B-':2.7,'C+':2.3,'C':2.0,'C-':1.7,'D+':1.3,'D':1.0,'D-':0.7,'F':0.0,
}[l] ?? 0);

// A grade's color, from its percentage.
export const gradeColor = (p) => p >= 90 ? C.green : p >= 80 ? '#0891B2' : p >= 70 ? C.gold : p >= 60 ? C.yellow : C.red;


// School year runs Aug 1 → Jul 31. Returns e.g. "2025–2026".
export const schoolYearOf = (ds) => {
  const d = new Date(ds + 'T12:00:00');
  const y = d.getFullYear();
  const start = d.getMonth() >= 7 ? y : y - 1; // month 7 = August
  return `${start}\u2013${start + 1}`;
};

export const CURRENT_SY = schoolYearOf(TODAY);


// Benchmark placement (where the work stands vs peers nationally).
export const BENCH = {
  below:       { level:1, label:'Below grade level',      short:'Below',       color:C.red },
  approaching: { level:2, label:'Approaching grade level', short:'Approaching', color:C.yellow },
  at:          { level:3, label:'At grade level',          short:'At level',    color:C.green },
  above:       { level:4, label:'Above grade level',       short:'Above',       color:'#0E7490' },
  well_above:  { level:5, label:'Well above grade level',  short:'Well above',  color:'#6D28D9' },
};

const benchFromLevel = (lvl) => {
  const r = Math.max(1, Math.min(5, Math.round(lvl)));
  return ['below','approaching','at','above','well_above'][r - 1];
};


// Build a full report card for a student in a given school year.
export function computeReportCard(db, studentId, schoolYear) {
  const student = db.students.find(s => s.id === studentId);
  const gg = db.gradeGroups.find(g => g.id === student?.gradeGroupId);
  const all = (db.grades || []).filter(g => g.studentId === studentId);
  const years = Array.from(new Set(all.map(g => g.schoolYear || schoolYearOf(g.date)))).sort().reverse();
  if (!years.includes(CURRENT_SY)) years.unshift(CURRENT_SY);
  const sy = schoolYear || (years.includes(CURRENT_SY) ? CURRENT_SY : years[0]);
  const yearGrades = all.filter(g => (g.schoolYear || schoolYearOf(g.date)) === sy);

  const subjects = (gg?.subjects || []).map(subj => {
    const gs = yearGrades.filter(g => g.subjectId === subj.id).sort((a,b)=>a.date.localeCompare(b.date));
    let avg = null, letter = null, gpa = null, benchKey = null;
    if (gs.length) {
      const wSum = gs.reduce((s,g)=> s + (g.weight ?? 1), 0) || 1;
      avg = gs.reduce((s,g)=> s + (g.score ?? 0) * (g.weight ?? 1), 0) / wSum;
      letter = pctToLetter(avg);
      gpa = letterToGpa(letter);
      const withBench = gs.filter(g => g.benchmark && BENCH[g.benchmark]);
      if (withBench.length) {
        const bAvg = withBench.reduce((s,g)=> s + BENCH[g.benchmark].level, 0) / withBench.length;
        benchKey = benchFromLevel(bAvg);
      }
    }
    // Course progress (reuse the highest-approved-lesson logic from ProgressView)
    let highest = 0;
    (db.answers || []).forEach(a => {
      if (a.studentId === studentId && a.subjectId === subj.id && a.status === 'approved' && a.lessonNum > highest) highest = a.lessonNum;
    });
    const total = subj.totalLessons ?? 180;
    const progressPct = total > 0 ? Math.min(100, Math.round((highest / total) * 100)) : 0;
    return { subj, grades: gs, avg, letter, gpa, benchKey, count: gs.length, highest, total, progressPct };
  });

  const graded = subjects.filter(s => s.count > 0);
  let overallPct = null, overallLetter = null, gpa = null, standingKey = null;
  if (graded.length) {
    overallPct = graded.reduce((s,x)=> s + x.avg, 0) / graded.length;
    overallLetter = pctToLetter(overallPct);
    gpa = graded.reduce((s,x)=> s + (x.gpa ?? 0), 0) / graded.length;
    const withBench = graded.filter(s => s.benchKey);
    if (withBench.length) {
      const bAvg = withBench.reduce((s,x)=> s + BENCH[x.benchKey].level, 0) / withBench.length;
      standingKey = benchFromLevel(bAvg);
    }
  }
  const totalGraded = yearGrades.length;
  const isCurrent = sy === CURRENT_SY;
  return { student, gg, sy, years, subjects, graded, overallPct, overallLetter, gpa, standingKey, totalGraded, isCurrent };
}
