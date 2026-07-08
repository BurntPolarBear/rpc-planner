import { useState, useMemo } from 'react';
import { TODAY, uid, shortDate } from '../utils/dates';
import { CURRENT_SY, schoolYearOf } from '../utils/grades';
import { OTHER_SUBJECT, subjectInfo, studentHours, fmtHours } from '../utils/hours';
import { Btn, C, card, inp, lbl } from '../utils/theme';


// ─── HOURS VIEW (parent) ──────────────────────────────────────────────────────
// Logs instruction time per student, per subject, per day. Shows running totals
// (hours + days) and a per-subject breakdown for the selected school year — useful
// documentation for states/co-ops that ask for logged hours.
export function HoursView({ db, mut }) {
  const students = db.students || [];
  const [logStu, setLogStu]     = useState(students[0]?.id || '');
  const [subjectId, setSubject] = useState('');
  const [date, setDate]         = useState(TODAY);
  const [hours, setHours]       = useState('');
  const [note, setNote]         = useState('');
  const [err, setErr]           = useState('');
  const [flash, setFlash]       = useState(false);

  const years = useMemo(() => {
    const set = new Set((db.hourLogs || []).map(h => schoolYearOf(h.date)));
    set.add(CURRENT_SY);
    return Array.from(set).sort().reverse();
  }, [db.hourLogs]);
  const [sy, setSy] = useState(CURRENT_SY);

  const logStudent = students.find(s => s.id === logStu);
  const gg = db.gradeGroups.find(g => g.id === logStudent?.gradeGroupId);
  const subjectOptions = [...(gg?.subjects || []), OTHER_SUBJECT];

  const addLog = () => {
    const h = parseFloat(hours);
    if (!logStu) { setErr('Pick a student first.'); return; }
    if (!(h > 0)) { setErr('Enter a number of hours greater than 0.'); return; }
    setErr('');
    mut(d => {
      if (!d.hourLogs) d.hourLogs = [];
      d.hourLogs.push({
        id: uid(), studentId: logStu, subjectId: subjectId || OTHER_SUBJECT.id,
        date, hours: h, note: note.trim(),
      });
    });
    setHours(''); setNote('');
    setFlash(true); setTimeout(() => setFlash(false), 1500);
  };

  const removeLog = (id) => mut(d => { d.hourLogs = (d.hourLogs || []).filter(x => x.id !== id); });

  // Recent entries for the selected year, newest first.
  const yearLogs = (db.hourLogs || [])
    .filter(h => schoolYearOf(h.date) === sy)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div style={{ fontFamily:'Georgia,serif', fontSize:21, fontWeight:'bold', color:C.navy, marginBottom:4 }}>Hours</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>
        Log instruction time by subject. Totals below add up your logged hours and school days for the year — handy documentation if your state or co-op asks for hours.
      </div>

      {/* Log entry */}
      <div style={{ ...card, marginBottom:22 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:12 }}>Log time</div>
        <div className="lesson-editor-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          <div>
            <label style={lbl}>Student</label>
            <select value={logStu} onChange={e => { setLogStu(e.target.value); setSubject(''); }} style={{ ...inp, width:'100%' }}>
              {students.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Subject</label>
            <select value={subjectId} onChange={e => setSubject(e.target.value)} style={{ ...inp, width:'100%' }}>
              <option value="">Other</option>
              {(gg?.subjects || []).map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width:'100%' }} />
          </div>
          <div>
            <label style={lbl}>Hours</label>
            <input type="number" min="0" step="0.25" value={hours} onChange={e => setHours(e.target.value)}
              placeholder="e.g. 1.5" style={{ ...inp, width:'100%' }} />
          </div>
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={lbl}>Note (optional)</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="e.g. Fractions review + workbook" style={{ ...inp, width:'100%' }} />
        </div>
        {err && <div style={{ color:C.red, fontSize:13, marginBottom:10 }}>{err}</div>}
        <Btn onClick={addLog} style={{ background: flash ? C.green : C.navy, color:'white' }}>
          {flash ? '✓ Added' : '+ Add hours'}
        </Btn>
      </div>

      {/* Year selector */}
      {years.length > 1 && (
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <label style={{ ...lbl, marginBottom:0 }}>School year</label>
          <select value={sy} onChange={e => setSy(e.target.value)} style={{ ...inp, width:'auto' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}

      {/* Per-student totals */}
      {students.map(s => {
        const { totalHours, days, bySubject } = studentHours(db, s.id, sy);
        const subjIds = Object.keys(bySubject).sort((a, b) => bySubject[b] - bySubject[a]);
        return (
          <div key={s.id} style={{ ...card, marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: subjIds.length ? 14 : 0 }}>
              <span style={{ fontSize:24 }}>{s.emoji}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:15, color:C.navy }}>{s.name}</div>
                <div style={{ fontSize:12, color:C.muted }}>{sy}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontWeight:800, fontSize:20, color:C.navy, fontVariantNumeric:'tabular-nums' }}>{fmtHours(totalHours)} hrs</div>
                <div style={{ fontSize:11, color:C.muted }}>{days} day{days !== 1 ? 's' : ''} logged</div>
              </div>
            </div>
            {subjIds.length === 0 ? (
              <div style={{ fontSize:13, color:C.muted, fontStyle:'italic' }}>No hours logged yet this year.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {subjIds.map(sid => {
                  const info = subjectInfo(db, s, sid);
                  const pct = totalHours > 0 ? (bySubject[sid] / totalHours) * 100 : 0;
                  return (
                    <div key={sid}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:3 }}>
                        <span style={{ color:'#333' }}>{info.icon} {info.name}</span>
                        <span style={{ color:C.muted, fontVariantNumeric:'tabular-nums' }}>{fmtHours(bySubject[sid])} hrs</span>
                      </div>
                      <div style={{ height:6, background:'#E5E7EB', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:C.navy, borderRadius:3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Recent entries */}
      {yearLogs.length > 0 && (
        <div style={{ ...card }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:10 }}>Logged entries · {sy}</div>
          {yearLogs.map(h => {
            const s = students.find(x => x.id === h.studentId);
            const info = subjectInfo(db, s, h.subjectId);
            return (
              <div key={h.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #F0F0F0' }}>
                <div style={{ width:120, fontSize:12.5, color:C.navy, fontWeight:600, flexShrink:0 }}>{shortDate(h.date)}</div>
                <div style={{ flex:1, fontSize:13, color:'#444' }}>
                  {s?.emoji} {s?.name} · {info.icon} {info.name}
                  {h.note ? <span style={{ color:C.muted }}> — {h.note}</span> : null}
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:C.navy, fontVariantNumeric:'tabular-nums', flexShrink:0 }}>{fmtHours(h.hours)} hrs</div>
                <button onClick={() => removeLog(h.id)} title="Delete"
                  style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:15, flexShrink:0 }}>✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
