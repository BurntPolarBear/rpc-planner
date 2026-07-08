import { schoolYearOf } from './grades';

// Time not tied to a specific course (field trips, reading, etc.).
export const OTHER_SUBJECT = { id: '__other', name: 'Other', icon: '📌' };

// Resolve a subject (from the student's grade group) by id, or the Other bucket.
export function subjectInfo(db, student, subjectId) {
  if (!subjectId || subjectId === OTHER_SUBJECT.id) return OTHER_SUBJECT;
  const gg = db.gradeGroups.find(g => g.id === student?.gradeGroupId);
  const s = gg?.subjects.find(x => x.id === subjectId);
  return s ? { id: s.id, name: s.name, icon: s.icon || '📘' } : OTHER_SUBJECT;
}

// Aggregate one student's logged hours for a given school year.
export function studentHours(db, studentId, sy) {
  const logs = (db.hourLogs || []).filter(h => h.studentId === studentId && schoolYearOf(h.date) === sy);
  const totalHours = logs.reduce((sum, h) => sum + (Number(h.hours) || 0), 0);
  const days = new Set(logs.map(h => h.date)).size;
  const bySubject = {}; // subjectId -> hours
  logs.forEach(h => {
    const k = h.subjectId || OTHER_SUBJECT.id;
    bySubject[k] = (bySubject[k] || 0) + (Number(h.hours) || 0);
  });
  return { logs, totalHours, days, bySubject };
}

// Round to at most 2 decimals for display.
export const fmtHours = (n) => (Math.round((Number(n) || 0) * 100) / 100).toString();
