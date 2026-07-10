import { useState } from 'react';
import { schoolYearOf, letterToGpa, pctToLetter } from '../utils/grades';
import { Btn, C, card, inp } from '../utils/theme';

const fmtLongDate = (d = new Date()) => d.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
const syRange = (sy) => { const [a] = sy.split('–'); return `Aug ${a} – Jul ${Number(a)+1}`; };

// Derive a cumulative transcript from the student's saved grades. Each subject that
// has grades in a school year becomes a 1-credit, year-long course; grade is the
// weighted average of that subject's graded work that year.
function buildTranscript(db, student) {
  const subjMap = {};
  (db.gradeGroups || []).forEach(gg => (gg.subjects || []).forEach(s => { subjMap[s.id] = s; }));
  const grades = (db.grades || []).filter(g => g.studentId === student.id && (g.score != null));

  const byYear = {};
  grades.forEach(g => {
    const sy = g.schoolYear || schoolYearOf(g.date);
    (byYear[sy] = byYear[sy] || {});
    (byYear[sy][g.subjectId] = byYear[sy][g.subjectId] || []).push(g);
  });

  const yearRows = Object.keys(byYear).sort().map(sy => {
    const courses = Object.keys(byYear[sy]).map(subjId => {
      const gs = byYear[sy][subjId];
      const wSum = gs.reduce((s, g) => s + (g.weight ?? 1), 0) || 1;
      const avg = gs.reduce((s, g) => s + (g.score ?? 0) * (g.weight ?? 1), 0) / wSum;
      const letter = pctToLetter(avg);
      return { name: subjMap[subjId]?.name || subjId, icon: subjMap[subjId]?.icon || '', letter, avg, gpa: letterToGpa(letter), credits: 1 };
    }).sort((a, b) => a.name.localeCompare(b.name));
    const credits = courses.reduce((s, c) => s + c.credits, 0);
    const gpa = credits ? courses.reduce((s, c) => s + c.gpa * c.credits, 0) / credits : 0;
    return { sy, courses, credits, gpa };
  });

  const totalCredits = yearRows.reduce((s, y) => s + y.credits, 0);
  const cumGpa = totalCredits
    ? yearRows.reduce((s, y) => s + y.courses.reduce((ss, c) => ss + c.gpa * c.credits, 0), 0) / totalCredits
    : 0;
  return { yearRows, totalCredits, cumGpa };
}

export function TranscriptView({ db }) {
  const [stuId, setStuId] = useState('all');
  const students = stuId === 'all' ? db.students : db.students.filter(s => s.id === stuId);

  return (
    <div>
      <style>{`
        @media print {
          @page { margin: 1.6cm; }
          nav, header, .no-print { display: none !important; }
          body { background: #fff !important; }
          .tr-doc { border: none !important; box-shadow: none !important; padding: 0 !important; }
          .tr-student { break-before: page; }
          .tr-student:first-child { break-before: auto; }
          .tr-year, .tr-row, .tr-sum { break-inside: avoid; }
          .tr-doc * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      <div className="no-print">
        <div style={{ fontFamily:'Georgia,serif', fontSize:21, fontWeight:'bold', color:C.navy, marginBottom:4 }}>Transcript</div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>
          A cumulative academic transcript with GPA and credits, drawn from saved grades. Each graded subject counts as a 1-credit, year-long course. Print it or save as PDF.
        </div>
        <div style={{ ...card, display:'flex', gap:14, flexWrap:'wrap', alignItems:'flex-end', marginBottom:16 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:C.muted, display:'block', marginBottom:4 }}>Student</label>
            <select value={stuId} onChange={e => setStuId(e.target.value)} style={{ ...inp, width:'auto' }}>
              <option value="all">All students</option>
              {db.students.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
            </select>
          </div>
          <Btn onClick={() => window.print()} style={{ background:C.navy, color:'white' }}>🖨 Print / Save PDF</Btn>
        </div>
        <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:C.muted, margin:'4px 0 10px' }}>Preview</div>
      </div>

      <div className="tr-doc" style={{ background:'white', borderRadius:14, border:`1px solid ${C.border}`, padding:'clamp(20px, 4vw, 40px)', boxShadow:'0 1px 2px rgba(15,30,48,0.05), 0 4px 14px rgba(15,30,48,0.05)' }}>
        {students.length === 0
          ? <div style={{ color:C.muted, fontSize:14 }}>No students yet — add one in Setup → Students.</div>
          : students.map(s => <StudentTranscript key={s.id} db={db} student={s} />)}
      </div>
    </div>
  );
}

function StudentTranscript({ db, student }) {
  const { yearRows, totalCredits, cumGpa } = buildTranscript(db, student);
  const gg = db.gradeGroups.find(g => g.id === student.gradeGroupId);

  return (
    <div className="tr-student">
      {/* Masthead */}
      <div style={{ textAlign:'center', borderBottom:`3px solid ${C.gold}`, paddingBottom:16, marginBottom:20 }}>
        <div style={{ fontSize:11.5, fontWeight:800, letterSpacing:'0.22em', textTransform:'uppercase', color:C.gold }}>Official Transcript</div>
        <div style={{ fontFamily:'Georgia,serif', fontSize:26, fontWeight:'bold', color:C.navy, marginTop:6 }}>{student.name}</div>
        <div style={{ fontSize:13.5, color:'#334155', marginTop:4 }}>
          {gg?.name}{student.family ? ` · ${student.family}` : ''} · Ron Paul Curriculum
        </div>
      </div>

      {yearRows.length === 0 ? (
        <div style={{ color:C.muted, fontSize:13.5, fontStyle:'italic', padding:'8px 0' }}>No grades recorded yet — graded coursework will appear here.</div>
      ) : (
        <>
          {yearRows.map(y => (
            <div key={y.sy} className="tr-year" style={{ marginBottom:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', borderBottom:`1.5px solid ${C.navy}`, paddingBottom:5, marginBottom:6 }}>
                <span style={{ fontFamily:'Georgia,serif', fontSize:15.5, fontWeight:'bold', color:C.navy }}>{y.sy}</span>
                <span style={{ fontSize:12, color:C.muted }}>{syRange(y.sy)}</span>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
                <thead>
                  <tr style={{ textAlign:'left', color:C.muted, fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                    <th style={{ padding:'4px 0', fontWeight:700 }}>Course</th>
                    <th style={{ padding:'4px 8px', textAlign:'center', fontWeight:700 }}>Grade</th>
                    <th style={{ padding:'4px 8px', textAlign:'center', fontWeight:700 }}>%</th>
                    <th style={{ padding:'4px 0', textAlign:'right', fontWeight:700 }}>Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {y.courses.map((c, i) => (
                    <tr key={i} className="tr-row" style={{ borderBottom:'1px solid #F0F0F0' }}>
                      <td style={{ padding:'6px 0', color:'#222' }}>{c.icon} {c.name}</td>
                      <td style={{ padding:'6px 8px', textAlign:'center', fontWeight:700, color:C.navy }}>{c.letter}</td>
                      <td style={{ padding:'6px 8px', textAlign:'center', color:C.muted, fontVariantNumeric:'tabular-nums' }}>{Math.round(c.avg)}</td>
                      <td style={{ padding:'6px 0', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{c.credits.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:20, fontSize:12.5, color:C.navy, fontWeight:700, marginTop:6 }}>
                <span>Year GPA: <span style={{ fontVariantNumeric:'tabular-nums' }}>{y.gpa.toFixed(2)}</span></span>
                <span>Credits: <span style={{ fontVariantNumeric:'tabular-nums' }}>{y.credits.toFixed(1)}</span></span>
              </div>
            </div>
          ))}

          {/* Cumulative summary */}
          <div className="tr-sum" style={{ display:'flex', gap:16, flexWrap:'wrap', background:'#F6F8FB', border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 18px', marginTop:8 }}>
            <div style={{ flex:1, minWidth:140 }}>
              <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:C.muted }}>Cumulative GPA</div>
              <div style={{ fontFamily:'Georgia,serif', fontSize:28, fontWeight:'bold', color:C.navy, lineHeight:1.1 }}>{cumGpa.toFixed(2)}</div>
              <div style={{ fontSize:11.5, color:C.muted }}>4.0 unweighted scale</div>
            </div>
            <div style={{ flex:1, minWidth:140 }}>
              <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:C.muted }}>Total Credits</div>
              <div style={{ fontFamily:'Georgia,serif', fontSize:28, fontWeight:'bold', color:C.navy, lineHeight:1.1 }}>{totalCredits.toFixed(1)}</div>
              <div style={{ fontSize:11.5, color:C.muted }}>1 credit per year-long course</div>
            </div>
          </div>
        </>
      )}

      {/* GPA scale + signature */}
      <div style={{ marginTop:18, display:'flex', justifyContent:'space-between', gap:16, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div style={{ fontSize:11, color:C.muted, lineHeight:1.6 }}>
          <div style={{ fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>GPA scale</div>
          A 4.0 · A- 3.7 · B+ 3.3 · B 3.0 · B- 2.7 · C+ 2.3 · C 2.0 · C- 1.7 · D 1.0 · F 0.0
        </div>
        <div style={{ textAlign:'right', fontSize:12, color:C.muted }}>
          <div style={{ borderTop:`1px solid ${C.navy}`, width:200, marginLeft:'auto', paddingTop:4 }}>Parent / Administrator signature</div>
          <div style={{ marginTop:6 }}>Issued {fmtLongDate()}</div>
        </div>
      </div>
    </div>
  );
}
