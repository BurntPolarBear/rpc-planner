import { useState } from 'react';
import { calcStreak, shortDate } from '../utils/dates';
import { BENCH, computeReportCard, gradeColor } from '../utils/grades';
import { Btn, C, card, inp } from '../utils/theme';


// ─── BENCHMARK BADGE ──────────────────────────────────────────────────────────
export function BenchBadge({ k, small }) {
  const b = BENCH[k];
  if (!b) return null;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5, background:`${b.color}14`,
      color:b.color, border:`1px solid ${b.color}44`, borderRadius:999,
      padding: small ? '2px 8px' : '4px 11px', fontSize: small ? 11 : 12, fontWeight:700, whiteSpace:'nowrap',
    }}>
      <span style={{ width:7, height:7, borderRadius:999, background:b.color, flexShrink:0 }} />
      {small ? b.short : b.label}
    </span>
  );
}


// ─── REPORT CARD (shared by parent Grades tab and the student's own view) ──────
export function ReportCard({ student, db, onBack, kidView = false }) {
  const [syState, setSy] = useState(null);
  const rc = computeReportCard(db, student.id, syState);
  const { years, subjects, graded, overallPct, overallLetter, gpa, standingKey, totalGraded, isCurrent, sy } = rc;
  const streak = calcStreak(db.answers, student.id);
  const finalLabel = isCurrent ? 'Grade so far' : 'Final grade';

  // A friendly one-line summary of where they stand.
  const standing = standingKey ? BENCH[standingKey] : null;
  const aboveSubjects = graded.filter(s => s.benchKey && BENCH[s.benchKey].level >= 4).map(s => s.subj.name);

  return (
    <div>
      <style>{`
        @media print {
          nav, header, .no-print { display: none !important; }
          .rc-card { break-inside: avoid; box-shadow: none !important; border: 1px solid #ccc !important; }
          body { background: #fff !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        {onBack && <Btn onClick={onBack} style={{ background:'#E8EEF4', color:C.navy, padding:'8px 14px', fontSize:13 }}>← Back</Btn>}
        <div style={{ flex:1 }} />
        {years.length > 1 && (
          <select value={sy} onChange={e=>setSy(e.target.value)} style={{ ...inp, width:'auto', fontSize:13 }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <Btn onClick={()=>window.print()} style={{ background:C.navy, color:'white', padding:'8px 14px', fontSize:13 }}>🖨 Print / PDF</Btn>
      </div>

      {/* Hero */}
      <div className="rc-card" style={{ ...card, borderRadius:16, marginBottom:16, textAlign:'center', background:C.navy, color:'white', padding:'28px 22px', border:'none' }}>
        <div style={{ fontSize:12, fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase', color:C.goldL, marginBottom:4 }}>Report Card</div>
        <div style={{ fontFamily:'Georgia,serif', fontSize:26, fontWeight:'bold' }}>{student.emoji} {student.name}</div>
        <div style={{ fontSize:13, color:'#B8C6D9', marginBottom:18 }}>{rc.gg?.name} · {sy} school year</div>

        {graded.length === 0 ? (
          <div style={{ fontSize:15, color:'#DCE5F0', padding:'12px 0' }}>
            No grades yet this year — your work will show up here as it gets graded. Keep it up! 🌟
          </div>
        ) : (
          <>
            <div style={{ display:'inline-flex', alignItems:'center', gap:16, flexWrap:'wrap', justifyContent:'center' }}>
              <div style={{ width:88, height:88, borderRadius:'50%', background:'white', color:C.navy, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 6px 20px rgba(0,0,0,0.25)' }}>
                <div style={{ fontFamily:'Georgia,serif', fontSize:34, fontWeight:'bold', lineHeight:1 }}>{overallLetter}</div>
                <div style={{ fontSize:12, color:C.muted, fontWeight:700 }}>{Math.round(overallPct)}%</div>
              </div>
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:12, color:'#9FB2C9', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>{finalLabel}</div>
                <div style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:'bold' }}>{overallLetter} · {Math.round(overallPct)}%</div>
                <div style={{ fontSize:12, color:'#B8C6D9' }}>GPA {gpa.toFixed(2)} · {graded.length} subject{graded.length!==1?'s':''} · {totalGraded} graded item{totalGraded!==1?'s':''}</div>
              </div>
            </div>
            {standing && (
              <div style={{ marginTop:16 }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:7, background:'rgba(255,255,255,0.12)', border:`1px solid ${standing.color}`, color:'white', borderRadius:999, padding:'6px 14px', fontSize:13, fontWeight:700 }}>
                  <span style={{ width:9, height:9, borderRadius:999, background:standing.color }} />
                  {standing.label}
                </span>
                <div style={{ fontSize:12.5, color:'#C9D6E6', marginTop:10, maxWidth:440, marginLeft:'auto', marginRight:'auto', lineHeight:1.5 }}>
                  {kidView ? 'Here\u2019s how your work compares to other students in your grade around the country.' : 'Averaged across graded subjects, relative to typical students at this grade level nationally.'}
                  {aboveSubjects.length > 0 && ` You\u2019re shining in ${aboveSubjects.join(' & ')}.`}
                </div>
              </div>
            )}
          </>
        )}

        {streak >= 2 && (
          <div style={{ marginTop:16, display:'inline-flex', gap:8, alignItems:'center', fontSize:13, color:'#FDBA74', fontWeight:700 }}>
            🔥 {streak}-day learning streak
          </div>
        )}
      </div>

      {/* Per-subject */}
      {subjects.filter(s => s.count > 0 || s.progressPct > 0).map(s => {
        const scores = s.grades.map(g => g.score ?? 0);
        const maxItem = 100;
        return (
          <div key={s.subj.id} className="rc-card" style={{ ...card, borderRadius:16, marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10, flexWrap:'wrap' }}>
              <span style={{ width:44, height:44, borderRadius:12, background:s.subj.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>{s.subj.icon}</span>
              <div style={{ flex:1, minWidth:120 }}>
                <div style={{ fontWeight:700, fontSize:16, color:C.navy }}>{s.subj.name}</div>
                <div style={{ fontSize:12, color:C.muted }}>
                  {s.count > 0 ? `${s.count} graded item${s.count!==1?'s':''}` : 'No grades yet'}
                  {s.highest > 0 && ` · through lesson ${s.highest}`}
                </div>
              </div>
              {s.count > 0 ? (
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  {s.benchKey && <BenchBadge k={s.benchKey} small />}
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:'bold', color:gradeColor(s.avg) }}>{s.letter}</div>
                    <div style={{ fontSize:11, color:C.muted, fontVariantNumeric:'tabular-nums' }}>{Math.round(s.avg)}%</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize:12, color:'#94A3B8', fontStyle:'italic' }}>ungraded</div>
              )}
            </div>

            {/* Course progress bar */}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.muted, marginBottom:3 }}>
              <span>Course progress</span>
              <span style={{ fontVariantNumeric:'tabular-nums' }}>{s.highest} / {s.total} lessons · {s.progressPct}%</span>
            </div>
            <div style={{ height:7, background:'#E5E7EB', borderRadius:4, overflow:'hidden', marginBottom: s.count>0 ? 12 : 0 }}>
              <div style={{ height:'100%', width:`${s.progressPct}%`, background:s.progressPct>=100?C.green:s.subj.color, borderRadius:4, transition:'width .5s ease' }} />
            </div>

            {/* Score trend + graded items */}
            {s.count > 0 && (
              <>
                {scores.length > 1 && (
                  <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:36, marginBottom:12 }}>
                    {scores.map((sc, i) => (
                      <div key={i} title={`${sc}%`} style={{ flex:1, maxWidth:24, height:`${Math.max(8,(sc/maxItem)*100)}%`, background:gradeColor(sc), borderRadius:'3px 3px 0 0', opacity:0.85 }} />
                    ))}
                  </div>
                )}
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8 }}>
                  {s.grades.slice().reverse().map(g => (
                    <div key={g.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 0', fontSize:13 }}>
                      <span style={{ flex:1, color:'#333' }}>{g.title || g.kind || 'Assignment'}</span>
                      <span style={{ fontSize:11, color:C.muted, whiteSpace:'nowrap' }}>{shortDate(g.date)}</span>
                      <span style={{ fontWeight:700, color:gradeColor(g.score ?? 0), width:34, textAlign:'right' }}>{g.letter}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}

      {!kidView && graded.length > 0 && (
        <div className="no-print" style={{ fontSize:12, color:C.muted, textAlign:'center', marginTop:8, lineHeight:1.6 }}>
          Grades are a running weighted average of each subject\u2019s graded work this year.
          "{isCurrent ? 'Grade so far' : 'Final grade'}" reflects everything graded {isCurrent ? 'to date' : 'that year'}.
        </div>
      )}
    </div>
  );
}
