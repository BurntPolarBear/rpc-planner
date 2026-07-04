import { useState } from 'react';
import { TODAY, getMon, shortDate } from '../utils/dates';
import { Btn, C, card, inp, lbl } from '../utils/theme';


// ─── REVIEW ───────────────────────────────────────────────────────────────────
export function Review({ db, mut }) {
  const [filterDate, setFD] = useState(TODAY);
  const [filterSt, setFS]   = useState('pending');

  const totalPending = db.answers.filter(a=>a.status==='pending'&&a.answers?.some(x=>x?.trim())).length;

  const subs = db.answers.filter(a => {
    if(a.status==='draft') return false; // in-progress task checks — nothing to review yet
    if(filterDate && a.date!==filterDate) return false;
    if(filterSt==='pending' && (!a.answers?.some(x=>x?.trim()) || a.status!=='pending')) return false;
    if(filterSt!=='pending' && filterSt!=='all' && a.status!==filterSt) return false;
    return true;
  }).sort((a,b) => b.date.localeCompare(a.date));

  const approve  = id => mut(d=>{ const a=d.answers.find(x=>x.id===id); if(a){a.status='approved';a.parentNote='';} });
  const revise   = (id, note) => mut(d=>{ const a=d.answers.find(x=>x.id===id); if(a){a.status='needs_revision';a.parentNote=note;} });

  return (
    <div>
      <div style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:'bold', color:C.navy, marginBottom:16 }}>Review Answers</div>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input type="date" value={filterDate} onChange={e=>setFD(e.target.value)} style={{ ...inp, width:'auto' }} />
        <select value={filterSt} onChange={e=>setFS(e.target.value)} style={{ ...inp, width:'auto' }}>
          <option value="pending">Awaiting review{totalPending>0?` (${totalPending})`:''}</option>
          <option value="approved">Approved</option>
          <option value="needs_revision">Needs revision</option>
          <option value="all">All submissions</option>
        </select>
      </div>

      {subs.length===0 ? (
        <div style={{ ...card, textAlign:'center', padding:48, color:C.muted }}>
          <div style={{ fontSize:36, marginBottom:12 }}>{filterSt==='pending'?'✅':'📭'}</div>
          <div style={{ fontSize:15 }}>{filterSt==='pending'?'All caught up! Nothing to review.':'No submissions found.'}</div>
        </div>
      ) : subs.map(sub => {
        const student = db.students.find(s=>s.id===sub.studentId);
        const gg      = db.gradeGroups.find(g=>g.id===student?.gradeGroupId);
        const subj    = gg?.subjects.find(s=>s.id===sub.subjectId);
        const wk      = getMon(sub.date);
        const pk      = `${gg?.id}:${wk}`;
        const lesson  = db.plans[pk]?.[sub.date]?.find(l=>l.subjectId===sub.subjectId);
        return <SubCard key={sub.id} sub={sub} student={student} subj={subj} lesson={lesson} questions={lesson?.questions||[]} onApprove={()=>approve(sub.id)} onRevise={note=>revise(sub.id,note)} />;
      })}
    </div>
  );
}


function SubCard({ sub, student, subj, lesson, questions, onApprove, onRevise }) {
  const [revNote, setRN] = useState(sub.parentNote||'');
  const [showRev, setSR] = useState(false);
  const bgMap    = { approved:'#F0FDF4', pending:'#FFFBEB', needs_revision:'#FEF2F2' };
  const brdMap   = { approved:'#86EFAC', pending:'#FDE68A', needs_revision:'#FCA5A5' };
  const labelMap = { approved:'✅ Approved', needs_revision:'↩ Revision requested', pending:'⏳ Pending' };
  const colorMap = { approved:C.green, needs_revision:C.red, pending:C.yellow };

  return (
    <div style={{ ...card, border:`1px solid ${brdMap[sub.status]||C.border}`, background:bgMap[sub.status]||'white', marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ fontSize:24 }}>{student?.emoji}</span>
          <div>
            <div style={{ fontWeight:700, color:C.navy, fontSize:15 }}>{student?.name}</div>
            <div style={{ fontSize:12, color:C.muted }}>{subj?.icon} {subj?.name} · Lesson {sub.lessonNum} · {shortDate(sub.date)}</div>
          </div>
        </div>
        <span style={{ fontSize:12, fontWeight:700, color:colorMap[sub.status] }}>{labelMap[sub.status]}</span>
      </div>

      {/* Task completion */}
      {(sub.tasksDone?.length > 0 || questions.length === 0) && lesson?.tasks?.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={lbl}>Tasks</div>
          {(lesson.tasks||[]).map((t, i) => {
            const done = sub.tasksDone?.[i];
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:`1px solid #F4F4F4` }}>
                <div style={{ width:18, height:18, borderRadius:4, flexShrink:0, background: done ? C.green : '#E5E7EB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'white' }}>
                  {done ? '✓' : ''}
                </div>
                <span style={{ fontSize:13, color: done ? C.muted : '#333', textDecoration: done ? 'line-through' : 'none' }}>{t}</span>
              </div>
            );
          })}
        </div>
      )}

      {sub.answers?.map((ans, i) => (
        <div key={i} style={{ marginBottom:12 }}>
          {questions[i] && <div style={{ fontSize:13, color:C.muted, fontStyle:'italic', marginBottom:4 }}>Q: {questions[i]}</div>}
          <div style={{ fontSize:14, background:'white', borderRadius:8, padding:'8px 12px', border:`1px solid ${C.border}`, color:ans?.trim()?'#333':'#ccc', fontStyle:ans?.trim()?'normal':'italic' }}>
            {ans?.trim()||'No answer provided'}
          </div>
        </div>
      ))}

      {sub.status!=='approved' && (
        <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
          <Btn onClick={onApprove} style={{ background:C.green, color:'white' }}>✅ Approve</Btn>
          <Btn onClick={()=>setSR(r=>!r)} style={{ background:'#FEE2E2', color:C.red }}>↩ Request Revision</Btn>
        </div>
      )}
      {showRev && (
        <div style={{ marginTop:12, borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
          <label style={lbl}>Note for {student?.name}</label>
          <textarea value={revNote} onChange={e=>setRN(e.target.value)}
            style={{ ...inp, width:'100%', minHeight:60, resize:'vertical' }}
            placeholder="Tell them what to fix or add more detail about…"
          />
          <Btn onClick={()=>{onRevise(revNote);setSR(false);}} style={{ background:C.red, color:'white', marginTop:8 }}>Send Back for Revision</Btn>
        </div>
      )}
    </div>
  );
}
