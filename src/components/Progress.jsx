import { useMemo } from 'react';
import { C, card } from '../utils/theme';


// ─── PROGRESS VIEW ────────────────────────────────────────────────────────────
export function ProgressView({ db }) {
  // For each student, compute per-subject progress based on highest approved lesson
  const studentProgress = useMemo(() => {
    return db.students.map(student => {
      const gg = db.gradeGroups.find(g => g.id === student.gradeGroupId);
      const subjects = (gg?.subjects || []).map(subj => {
        // Highest approved lesson number for this student + subject
        let highest = 0;
        db.answers.forEach(a => {
          if (a.studentId === student.id && a.subjectId === subj.id && a.status === 'approved' && a.lessonNum > highest) {
            highest = a.lessonNum;
          }
        });
        const total = subj.totalLessons ?? 180;
        const pct = total > 0 ? Math.min(100, Math.round((highest / total) * 100)) : 0;
        return { subj, highest, total, pct };
      });
      const overall = subjects.length
        ? Math.round(subjects.reduce((s, x) => s + x.pct, 0) / subjects.length)
        : 0;
      return { student, gg, subjects, overall };
    });
  }, [db]);

  return (
    <div>
      <div style={{ fontFamily:'Georgia,serif', fontSize:21, fontWeight:'bold', color:C.navy, marginBottom:4 }}>Course Progress</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>How far each student has gotten through their courses, based on approved lessons.</div>

      {studentProgress.map(({ student, subjects, overall }) => (
        <div key={student.id} style={{ ...card, marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <span style={{ fontSize:28 }}>{student.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:16, color:C.navy }}>{student.name}</div>
              <div style={{ fontSize:12, color:C.muted }}>{student.family}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontWeight:800, fontSize:22, color: overall>=100?C.green:C.navy, fontVariantNumeric:'tabular-nums' }}>{overall}%</div>
              <div style={{ fontSize:11, color:C.muted }}>overall</div>
            </div>
          </div>

          {subjects.map(({ subj, highest, total, pct }) => (
            <div key={subj.id} style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:600, color:'#333' }}>{subj.icon} {subj.name}</span>
                <span style={{ fontSize:12, color:C.muted, fontVariantNumeric:'tabular-nums' }}>
                  {highest > 0 ? `Lesson ${highest} of ${total}` : `Not started · ${total} lessons`}
                  <span style={{ marginLeft:8, fontWeight:700, color: pct>=100?C.green:subj.color }}>{pct}%</span>
                </span>
              </div>
              <div style={{ height:8, background:'#E5E7EB', borderRadius:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background: pct>=100 ? C.green : subj.color, borderRadius:4, transition:'width .5s ease' }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
