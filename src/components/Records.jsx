import { useState, useMemo } from 'react';
import { TODAY, toDate } from '../utils/dates';
import { Btn, C, card, inp, lbl } from '../utils/theme';


// ─── RECORDS VIEW ─────────────────────────────────────────────────────────────
export function RecordsView({ db }) {
  const [stuId, setStuId]   = useState('all');
  const [fromD, setFromD]   = useState(() => { const d=new Date(TODAY+'T12:00:00'); d.setDate(d.getDate()-30); return toDate(d); });
  const [toD, setToD]       = useState(TODAY);

  // Build a per-student, per-date record of approved work within the range
  const records = useMemo(() => {
    const inRange = (date) => date >= fromD && date <= toD;
    const students = stuId === 'all' ? db.students : db.students.filter(s => s.id === stuId);

    return students.map(student => {
      const gg = db.gradeGroups.find(g => g.id === student.gradeGroupId);
      // Group approved submissions by date
      const byDate = {};
      db.answers
        .filter(a => a.studentId === student.id && a.status === 'approved' && inRange(a.date))
        .forEach(a => {
          if (!byDate[a.date]) byDate[a.date] = [];
          const subj = gg?.subjects.find(s => s.id === a.subjectId);
          byDate[a.date].push({ subject: subj?.name || '—', icon: subj?.icon || '', lessonNum: a.lessonNum });
        });
      const dates = Object.keys(byDate).sort();
      const totalLessons = dates.reduce((sum, d) => sum + byDate[d].length, 0);
      return { student, gg, byDate, dates, daysCount: dates.length, totalLessons };
    });
  }, [db, stuId, fromD, toD]);

  const grandDays    = records.reduce((s,r) => s + r.daysCount, 0);
  const grandLessons = records.reduce((s,r) => s + r.totalLessons, 0);

  const setPreset = (days) => {
    const d = new Date(TODAY+'T12:00:00'); d.setDate(d.getDate()-days);
    setFromD(toDate(d)); setToD(TODAY);
  };

  const fmtDate = (ds) => new Date(ds+'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });

  return (
    <div>
      {/* Print styles — hide chrome, show only the records */}
      <style>{`
        @media print {
          nav, header, .no-print { display: none !important; }
          body { background: white !important; }
          .record-sheet { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, marginBottom:18 }}>
        <div>
          <div style={{ fontFamily:'Georgia,serif', fontSize:21, fontWeight:'bold', color:C.navy, marginBottom:2 }}>Work Records</div>
          <div style={{ fontSize:13, color:C.muted }}>Completed &amp; approved work — useful for attendance and progress documentation.</div>
        </div>
        <Btn onClick={() => window.print()} style={{ background:C.navy, color:'white' }}>🖨 Print / Save PDF</Btn>
      </div>

      {/* Controls */}
      <div className="no-print" style={{ ...card, marginBottom:20, display:'flex', gap:14, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div>
          <label style={lbl}>Student</label>
          <select value={stuId} onChange={e=>setStuId(e.target.value)} style={{ ...inp, width:'auto' }}>
            <option value="all">All students</option>
            {db.students.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>From</label>
          <input type="date" value={fromD} onChange={e=>setFromD(e.target.value)} style={{ ...inp }} />
        </div>
        <div>
          <label style={lbl}>To</label>
          <input type="date" value={toD} onChange={e=>setToD(e.target.value)} style={{ ...inp }} />
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <Btn onClick={()=>setPreset(7)}  style={{ background:'white', border:`1px solid ${C.border}`, color:C.muted, fontSize:12 }}>Last 7d</Btn>
          <Btn onClick={()=>setPreset(30)} style={{ background:'white', border:`1px solid ${C.border}`, color:C.muted, fontSize:12 }}>30d</Btn>
          <Btn onClick={()=>setPreset(90)} style={{ background:'white', border:`1px solid ${C.border}`, color:C.muted, fontSize:12 }}>90d</Btn>
        </div>
      </div>

      {/* Summary banner */}
      <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:14, color:'#1E40AF' }}>
        <strong>{grandDays}</strong> school day{grandDays!==1?'s':''} · <strong>{grandLessons}</strong> lesson{grandLessons!==1?'s':''} completed
        <span style={{ color:'#3B6FB5' }}> · {fmtDate(fromD)} – {fmtDate(toD)}</span>
      </div>

      {/* Per-student record sheets */}
      {records.map(rec => (
        <div key={rec.student.id} className="record-sheet" style={{ ...card, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, paddingBottom:12, borderBottom:`2px solid ${C.navy}` }}>
            <span style={{ fontSize:26 }}>{rec.student.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:16, color:C.navy }}>{rec.student.name}</div>
              <div style={{ fontSize:12, color:C.muted }}>{rec.gg?.name} · {rec.student.family}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontWeight:800, fontSize:18, color:C.navy, fontVariantNumeric:'tabular-nums' }}>{rec.daysCount} days</div>
              <div style={{ fontSize:11, color:C.muted }}>{rec.totalLessons} lessons</div>
            </div>
          </div>

          {rec.dates.length === 0 ? (
            <div style={{ fontSize:13, color:C.muted, fontStyle:'italic', padding:'8px 0' }}>No approved work in this date range.</div>
          ) : (
            rec.dates.map(date => (
              <div key={date} style={{ display:'flex', gap:12, padding:'8px 0', borderBottom:`1px solid #F0F0F0` }}>
                <div style={{ flexShrink:0, width:130, fontSize:13, fontWeight:600, color:C.navy }}>{fmtDate(date)}</div>
                <div style={{ flex:1, fontSize:13, color:'#444' }}>
                  {rec.byDate[date].map((l,i) => (
                    <span key={i} style={{ display:'inline-block', marginRight:14, marginBottom:2 }}>
                      {l.icon} {l.subject} <span style={{ color:C.muted }}>L{l.lessonNum}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
