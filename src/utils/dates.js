
// ─── UTILITIES ────────────────────────────────────────────────────────────────
export const toDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;


export const TODAY = toDate();


export const getMon = (ds) => {
  const d = new Date(ds + 'T12:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return toDate(d);
};


export const weekDays = (mon) =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon + 'T12:00:00');
    d.setDate(d.getDate() + i);
    return toDate(d);
  });


export const addDays = (ds, n) => {
  const d = new Date(ds + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toDate(d);
};


export const shortDate = (ds) =>
  new Date(ds + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });


export const weekLabel = (mon) => {
  const days = weekDays(mon);
  const fmt = (ds) => new Date(ds + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(days[0])} – ${fmt(days[6])}`;
};


export const uid = () => Math.random().toString(36).slice(2, 9);


// Count consecutive school days (Mon–Fri) up to today where the student had
// at least one approved lesson. Weekends are skipped, not streak-breaking.
export const calcStreak = (answers, studentId) => {
  const approvedDates = new Set(
    answers.filter(a => a.studentId === studentId && a.status === 'approved').map(a => a.date)
  );
  let streak = 0;
  const d = new Date(TODAY + 'T12:00:00');
  // If today has no approved work yet, start counting from the most recent prior school day
  // so an in-progress today doesn't show a broken streak.
  if (!approvedDates.has(toDate(d))) {
    d.setDate(d.getDate() - 1);
  }
  // Walk backwards up to 200 days
  for (let i = 0; i < 200; i++) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) { d.setDate(d.getDate() - 1); continue; } // skip weekends
    if (approvedDates.has(toDate(d))) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
};
