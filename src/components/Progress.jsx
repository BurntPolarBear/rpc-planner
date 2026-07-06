import { useMemo } from 'react';
import { shortDate } from '../utils/dates';
import { CURRENT_SY, computeReportCard, gradeColor } from '../utils/grades';
import { C, card } from '../utils/theme';
import { BenchBadge } from './ReportCard';


// ─── PROGRESS VIEW ────────────────────────────────────────────────────────────
export function ProgressView({ db }) {
  // For each student, compute per-subject course progress AND this year's grades.
  // computeReportCard already derives both (highest approved lesson + graded averages),
  // so Progress and the Report Card stay in lock-step from one source of truth.
  const rows = useMemo(() => db.students.map(student => {
    const rc = computeReportCard(db, student.id, CURRENT_SY);
    const overallProgress = rc.subjects.length
      ? Math.round(rc.subjects.reduce((s, x) => s + x.progressPct, 0) / rc.subjects.length)
      : 0;
    return { student, rc, overallProgress };
  }), [db]);

  return (
    <div>
      <div style={{ fontFamily:'Georgia,serif', fontSize:21, fontWeight:'bold', color:C.navy, marginBottom:4 }}>Course Progress</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>How far each student has gotten through their courses, alongside their grades so far this year.</div>

      {rows.map(({ student, rc, overallProgress }) => {
        const { subjects, overallLetter, overallPct, graded } = rc;
        return (
          <div key={student.id} style={{ ...card, marginBottom:18 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <span style={{ fontSize:28 }}>{student.emoji}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:16, color:C.navy }}>{student.name}</div>
                <div style={{ fontSize:12, color:C.muted }}>{student.family}</div>
              </div>

              {/* Overall grade so far (only once anything is graded) */}
              {graded.length > 0 && (
                <div style={{ textAlign:'right', paddingRight:14, marginRight:2, borderRight:`1px solid ${C.border}` }}>
                  <div style={{ fontFamily:'Georgia,serif', fontWeight:'bold', fontSize:22, color:gradeColor(overallPct) }}>{overallLetter}</div>
                  <div style={{ fontSize:11, color:C.muted, fontVariantNumeric:'tabular-nums' }}>grade · {Math.round(overallPct)}%</div>
                </div>
              )}

              {/* Overall lesson progress */}
              <div style={{ textAlign:'right' }}>
                <div style={{ fontWeight:800, fontSize:22, color: overallProgress>=100?C.green:C.navy, fontVariantNumeric:'tabular-nums' }}>{overallProgress}%</div>
                <div style={{ fontSize:11, color:C.muted }}>lessons</div>
              </div>
            </div>

            {subjects.map(s => {
              const { subj, highest, total, progressPct, count, letter, avg, benchKey } = s;
              const recent = count > 0 ? s.grades[s.grades.length - 1] : null;
              return (
                <div key={subj.id} style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:'#333' }}>{subj.icon} {subj.name}</span>
                    <span style={{ fontSize:12, color:C.muted, fontVariantNumeric:'tabular-nums' }}>
                      {highest > 0 ? `Lesson ${highest} of ${total}` : `Not started · ${total} lessons`}
                      <span style={{ marginLeft:8, fontWeight:700, color: progressPct>=100?C.green:subj.color }}>{progressPct}%</span>
                    </span>
                  </div>
                  <div style={{ height:8, background:'#E5E7EB', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${progressPct}%`, background: progressPct>=100 ? C.green : subj.color, borderRadius:4, transition:'width .5s ease' }} />
                  </div>

                  {/* Grade summary — this subject's standing + most recent graded item */}
                  {count > 0 ? (
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6, flexWrap:'wrap' }}>
                      <span style={{ fontSize:12.5, fontWeight:700, color:gradeColor(avg) }}>🎓 {letter} · {Math.round(avg)}%</span>
                      {benchKey && <BenchBadge k={benchKey} small />}
                      <span style={{ fontSize:11.5, color:C.muted }}>{count} graded</span>
                      {recent && (
                        <span style={{ fontSize:11.5, color:C.muted, marginLeft:'auto', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%' }}>
                          latest: {recent.title || recent.kind || 'item'} · {recent.letter} · {shortDate(recent.date)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize:11.5, color:'#94A3B8', marginTop:6, fontStyle:'italic' }}>No grades yet</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
