import { useState } from 'react';
import { toDate, weekDays, weekLabel } from '../utils/dates';
import { Btn, C, card, inp } from '../utils/theme';
import { PortfolioView } from './Portfolio';
import { TranscriptView } from './Transcript';


// ─── EXPORT HELPERS ───────────────────────────────────────────────────────────
function buildTextSummary(db, weekMon) {
  const days = weekDays(weekMon);
  let out = `RPC Homeschool — Week of ${weekLabel(weekMon)}\n${'═'.repeat(44)}\n\n`;
  db.gradeGroups.forEach(gg => {
    const students = db.students.filter(s => s.gradeGroupId === gg.id);
    const pk = `${gg.id}:${weekMon}`;
    out += `${gg.name.toUpperCase()} (${students.map(s=>s.name).join(' & ')})\n${'─'.repeat(44)}\n`;
    let hasAny = false;
    days.forEach(date => {
      const lessons = db.plans[pk]?.[date] || [];
      if (!lessons.length) return;
      hasAny = true;
      const d = new Date(date+'T12:00:00');
      out += `\n${d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}\n`;
      lessons.forEach(lesson => {
        const subj = gg.subjects.find(s=>s.id===lesson.subjectId);
        if (!subj) return;
        out += `  ${subj.icon} ${subj.name} — Lesson ${lesson.lessonNum}\n`;
        if (lesson.notes?.trim()) out += `     📌 ${lesson.notes}\n`;
        (lesson.questions||[]).forEach((q,i) => { out += `     Q${i+1}: ${q}\n`; });
      });
    });
    if (!hasAny) out += '  No lessons planned this week.\n';
    out += '\n';
  });
  return out;
}


function buildICS(db, weekMon) {
  const days = weekDays(weekMon);
  const events = [];
  db.gradeGroups.forEach(gg => {
    const students = db.students.filter(s=>s.gradeGroupId===gg.id);
    const pk = `${gg.id}:${weekMon}`;
    days.forEach(date => {
      const lessons = db.plans[pk]?.[date] || [];
      if (!lessons.length) return;
      const dtStart = date.replace(/-/g,'');
      // next day for DTEND
      const nextD = new Date(date+'T12:00:00'); nextD.setDate(nextD.getDate()+1);
      const dtEnd = toDate(nextD).replace(/-/g,'');
      lessons.forEach(lesson => {
        const subj = gg.subjects.find(s=>s.id===lesson.subjectId);
        if (!subj) return;
        const studentNames = students.map(s=>s.name).join(' & ');
        const descParts = [`Students: ${studentNames}`];
        if (lesson.notes?.trim()) descParts.push(`Instructions: ${lesson.notes.replace(/\n/g,'\\n')}`);
        if (lesson.questions?.length) {
          descParts.push(`Questions:\\n${lesson.questions.map((q,i)=>`${i+1}. ${q}`).join('\\n')}`);
        }
        events.push(
          `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${dtStart}\r\nDTEND;VALUE=DATE:${dtEnd}\r\n` +
          `SUMMARY:${subj.name} L${lesson.lessonNum} — ${gg.name}\r\n` +
          `DESCRIPTION:${descParts.join('\\n')}\r\nEND:VEVENT`
        );
      });
    });
  });
  // Add activities for each student for days in this week
  days.forEach(date => {
    const dow = new Date(date + 'T12:00:00').getDay();
    const dtStart = date.replace(/-/g,'');
    const nextD = new Date(date+'T12:00:00'); nextD.setDate(nextD.getDate()+1);
    const dtEnd = toDate(nextD).replace(/-/g,'');
    (db.activities||[]).forEach(act => {
      if (!(act.days||[]).includes(dow)) return;
      const student = db.students.find(s=>s.id===act.studentId);
      const desc = [student?.name, act.location, act.notes].filter(Boolean).join(' · ');
      const timeStr = act.time ? `\r\nDTSTART:${dtStart}T${act.time.replace(/[^0-9]/g,'').padStart(6,'0')}` : `\r\nDTSTART;VALUE=DATE:${dtStart}`;
      events.push(
        `BEGIN:VEVENT${timeStr}\r\nDTEND;VALUE=DATE:${dtEnd}\r\n` +
        `SUMMARY:${act.name} — ${student?.name||''}\r\n` +
        `DESCRIPTION:${desc}\r\nEND:VEVENT`
      );
    });
  });

  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//RPC Homeschool Planner//EN\r\nCALSCALE:GREGORIAN\r\n${events.join('\r\n')}\r\nEND:VCALENDAR`;
}


// ─── EXPORT VIEW ─────────────────────────────────────────────────────────────
// Two distinct kinds of hand-off document live here: the weekly plan (share with
// co-op parents / import to a calendar) and the full-year portfolio (a
// consolidated record for a state or co-op evaluation).
export function ExportView({ db, weekMon, setWk }) {
  const [mode, setMode] = useState('week'); // week | portfolio

  return (
    <div>
      {/* Segmented control — hidden on print so only the chosen document prints */}
      <div className="no-print" style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
        {[['week','📅 Weekly Plan'], ['portfolio','📚 Year-End Portfolio'], ['transcript','🎓 Transcript']].map(([id, label]) => (
          <Btn key={id} onClick={()=>setMode(id)} style={{
            background: mode===id ? C.gold : 'white', color: mode===id ? 'white' : C.muted,
            border:`1px solid ${mode===id ? C.gold : C.border}`,
          }}>{label}</Btn>
        ))}
      </div>

      {mode === 'week' && <WeeklyExport db={db} weekMon={weekMon} setWk={setWk} />}
      {mode === 'portfolio' && <PortfolioView db={db} />}
      {mode === 'transcript' && <TranscriptView db={db} />}
    </div>
  );
}


// ─── WEEKLY PLAN EXPORT ───────────────────────────────────────────────────────
function WeeklyExport({ db, weekMon, setWk }) {
  const [copied, setCopied] = useState(false);
  const summary = buildTextSummary(db, weekMon);
  const days    = weekDays(weekMon);
  const totalLessons = db.gradeGroups.reduce((acc, gg) => {
    const pk = `${gg.id}:${weekMon}`;
    return acc + days.reduce((a,d) => a + (db.plans[pk]?.[d]?.length||0), 0);
  }, 0);

  const shiftWk = delta => {
    const d = new Date(weekMon+'T12:00:00'); d.setDate(d.getDate()+delta*7); setWk(toDate(d));
  };

  const copyText = async () => {
    try { await navigator.clipboard.writeText(summary); setCopied(true); setTimeout(()=>setCopied(false),2500); }
    catch { /* fallback: select the textarea */ }
  };

  const downloadICS = () => {
    const ics  = buildICS(db, weekMon);
    const blob = new Blob([ics], { type:'text/calendar;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `rpc-week-${weekMon}.ics`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ fontFamily:'Georgia,serif', fontSize:21, fontWeight:'bold', color:C.navy, marginBottom:4 }}>Weekly Plan</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>Share the week's plan with co-op parents or import into your calendar.</div>

      {/* Week selector */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
        <Btn onClick={()=>shiftWk(-1)} style={{ background:'white', border:`1px solid ${C.border}`, color:'#333', padding:'6px 11px' }}>←</Btn>
        <span style={{ fontWeight:700, color:C.navy, fontSize:14, minWidth:140, textAlign:'center' }}>{weekLabel(weekMon)}</span>
        <Btn onClick={()=>shiftWk(1)} style={{ background:'white', border:`1px solid ${C.border}`, color:'#333', padding:'6px 11px' }}>→</Btn>
        <span style={{ fontSize:13, color:C.muted }}>{totalLessons} lesson{totalLessons!==1?'s':''} planned</span>
      </div>

      {/* Export options */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:14, marginBottom:22 }}>
        <div style={{ ...card, display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ fontSize:28 }}>📅</div>
          <div style={{ fontWeight:700, fontSize:15, color:C.navy }}>Calendar (.ics)</div>
          <div style={{ fontSize:13, color:C.muted, flex:1 }}>Import into Apple Calendar, Google Calendar, or Outlook. Each lesson becomes a day-long event with questions in the notes.</div>
          <Btn onClick={downloadICS} style={{ background:C.navy, color:'white', textAlign:'center' }}>Download .ics file</Btn>
        </div>
        <div style={{ ...card, display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ fontSize:28 }}>📋</div>
          <div style={{ fontWeight:700, fontSize:15, color:C.navy }}>Text Summary</div>
          <div style={{ fontSize:13, color:C.muted, flex:1 }}>Copy a plain-text weekly summary to paste into a message, email, or shared doc for the co-op.</div>
          <Btn onClick={copyText} style={{ background: copied ? C.green : C.navy, color:'white', textAlign:'center', transition:'background .2s' }}>
            {copied ? '✓ Copied to clipboard!' : 'Copy to clipboard'}
          </Btn>
        </div>
      </div>

      {/* Preview */}
      <div style={{ ...card, padding:0, overflow:'hidden' }}>
        <div style={{ background:'#F8F9FA', borderBottom:`1px solid ${C.border}`, padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em' }}>Preview — Week Summary</span>
        </div>
        <textarea
          readOnly value={summary}
          style={{ ...inp, width:'100%', minHeight:280, resize:'vertical', fontSize:12, fontFamily:'monospace', border:'none', borderRadius:0, background:'white', lineHeight:1.7, padding:16, boxSizing:'border-box', display:'block' }}
        />
      </div>
    </div>
  );
}
