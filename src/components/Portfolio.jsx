import { useMemo, useState } from 'react';
import { schoolYearOf, computeReportCard, gradeColor, BENCH } from '../utils/grades';
import { C } from '../utils/theme';
import { studentHours, subjectInfo, fmtHours } from '../utils/hours';

// ─── FULL-YEAR PORTFOLIO ──────────────────────────────────────────────────────
// A single consolidated year-end document — report card, course progress,
// attendance, and writing samples — built for state/co-op evaluations. Everything
// is print-first: the on-screen view is a faithful preview, and "Print / Save PDF"
// produces a clean, paper-formatted document with one student per page.
//
// Deliberately left OUT of the evaluation document: the AI "voice check" authorship
// signal and the internal discussion questions. Those are private parent-coaching
// tools; a portfolio handed to an outside evaluator should showcase the student's
// work and its constructive feedback, not internal flags.

const PF_SECTIONS = [
  ['report',   '🎓 Report Card & Grades'],
  ['progress', '📈 Course Progress'],
  ['work',     '📅 Attendance & Work'],
  ['hours',    '⏱ Logged Hours'],
  ['writing',  '✍️ Writing Portfolio'],
];

const fmtLongDate = (d = new Date()) =>
  d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// Turn a "2024–2025" school-year label into a friendly Aug–Jul span for the cover.
const syRangeLabel = (sy) => {
  const [a] = sy.split('\u2013');
  return `August ${a} \u2013 July ${Number(a) + 1}`;
};


export function PortfolioView({ db }) {
  const [stuId, setStuId]   = useState('all');
  const [sy, setSy]         = useState(null);            // null → resolved to newest available below
  const [sections, setSecs] = useState(() => ({ report: true, progress: true, work: true, hours: true, writing: true }));
  const [fullText, setFullText] = useState(true);

  // Every school year that appears anywhere in the data (grades, writing, or work),
  // newest first, always including the current one.
  const years = useMemo(() => {
    const set = new Set();
    (db.grades || []).forEach(g => set.add(g.schoolYear || schoolYearOf(g.date)));
    (db.writingSamples || []).forEach(w => set.add(schoolYearOf(w.date)));
    (db.answers || []).forEach(a => set.add(schoolYearOf(a.date)));
    (db.hourLogs || []).forEach(h => set.add(schoolYearOf(h.date)));
    set.add(schoolYearOf(new Date().toISOString().slice(0, 10)));
    return Array.from(set).sort().reverse();
  }, [db]);

  const activeSy = sy || years[0];
  const students = stuId === 'all' ? db.students : db.students.filter(s => s.id === stuId);
  const toggleSec = (k) => setSecs(s => ({ ...s, [k]: !s[k] }));
  const anySection = Object.values(sections).some(Boolean);

  return (
    <div>
      {/* Print rules — hide app chrome & controls, one student per page, keep color. */}
      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          nav, header, .no-print { display: none !important; }
          body { background: #fff !important; }
          .pf-doc { box-shadow: none !important; }
          .pf-student { break-before: page; }
          .pf-student:first-child { break-before: auto; }
          .pf-section, .pf-cover, .pf-wsample, .pf-row { break-inside: avoid; }
          .pf-doc * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* ── Controls (never printed) ─────────────────────────────────────────── */}
      <div className="no-print">
        <div style={{ fontFamily:'Georgia,serif', fontSize:21, fontWeight:'bold', color:C.navy, marginBottom:4 }}>Year-End Portfolio</div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>
          One consolidated document — grades, progress, attendance, and writing samples — formatted for a state or co-op year-end evaluation. Print it, or choose "Save as PDF" in the print dialog.
        </div>

        <div style={{ ...pfCard, marginBottom:18 }}>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-end', marginBottom:14 }}>
            <div>
              <label style={pfLbl}>Student</label>
              <select value={stuId} onChange={e=>setStuId(e.target.value)} style={{ ...pfInp, width:'auto' }}>
                <option value="all">All students (family binder)</option>
                {db.students.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={pfLbl}>School year</label>
              <select value={activeSy} onChange={e=>setSy(e.target.value)} style={{ ...pfInp, width:'auto' }}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <label style={pfLbl}>Include sections</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:6 }}>
            {PF_SECTIONS.map(([k, label]) => (
              <button key={k} onClick={()=>toggleSec(k)} style={{
                ...pfInp, cursor:'pointer', padding:'7px 13px', borderRadius:999, fontWeight: sections[k]?700:500,
                background: sections[k] ? C.navy : 'white', color: sections[k] ? 'white' : C.muted,
                border:`1px solid ${sections[k] ? C.navy : C.border}`,
              }}>{sections[k] ? '✓ ' : ''}{label}</button>
            ))}
          </div>
          {sections.writing && (
            <label style={{ display:'inline-flex', alignItems:'center', gap:8, fontSize:13, color:'#334155', marginTop:8, cursor:'pointer' }}>
              <input type="checkbox" checked={fullText} onChange={e=>setFullText(e.target.checked)} style={{ width:16, height:16, accentColor:C.navy }} />
              Include the full text of each writing sample
            </label>
          )}
        </div>

        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:20 }}>
          <button onClick={()=>window.print()} disabled={!anySection} style={{
            border:'none', borderRadius:8, padding:'9px 18px', cursor: anySection?'pointer':'not-allowed',
            fontSize:14, fontWeight:700, background: anySection ? C.navy : '#9CA3AF', color:'white',
          }}>🖨 Print / Save PDF</button>
          <span style={{ fontSize:12.5, color:C.muted }}>
            {students.length} student{students.length!==1?'s':''} · {activeSy}
          </span>
        </div>

        {!anySection && (
          <div style={{ background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#92400E', marginBottom:18 }}>
            Select at least one section to include.
          </div>
        )}

        <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:C.muted, margin:'4px 0 10px' }}>
          Preview
        </div>
      </div>

      {/* ── The document ─────────────────────────────────────────────────────── */}
      <div className="pf-doc" style={{ background:'white', borderRadius:14, border:`1px solid ${C.border}`, padding:'clamp(20px, 4vw, 40px)', boxShadow:'0 1px 2px rgba(15,30,48,0.05), 0 4px 14px rgba(15,30,48,0.05)' }}>
        {students.length === 0 ? (
          <div style={{ color:C.muted, fontSize:14 }}>No students yet — add one in Setup → Students first.</div>
        ) : (
          students.map(student => (
            <StudentPortfolio key={student.id} db={db} student={student} sy={activeSy} sections={sections} fullText={fullText} />
          ))
        )}
      </div>
    </div>
  );
}


// ─── ONE STUDENT'S PORTFOLIO ──────────────────────────────────────────────────
function StudentPortfolio({ db, student, sy, sections, fullText }) {
  const rc = computeReportCard(db, student.id, sy);
  const { gg, subjects, graded, overallPct, overallLetter, gpa, standingKey } = rc;

  // Attendance & completed work for this school year (approved submissions only).
  // `highestBySubject` scopes course progress to the selected year — so a past-year
  // portfolio shows where the student stood at the end of THAT year, not their
  // all-time high. (computeReportCard's own `highest` is year-agnostic on purpose,
  // since it powers the always-current Progress view; we deliberately don't use it.)
  const work = useMemo(() => {
    const ans = (db.answers || []).filter(a =>
      a.studentId === student.id && a.status === 'approved' && schoolYearOf(a.date) === sy);
    const days = new Set(ans.map(a => a.date)).size;
    const bySubject = {};
    const highestBySubject = {};
    ans.forEach(a => {
      bySubject[a.subjectId] = (bySubject[a.subjectId] || 0) + 1;
      if (a.lessonNum > (highestBySubject[a.subjectId] || 0)) highestBySubject[a.subjectId] = a.lessonNum;
    });
    return { days, lessons: ans.length, bySubject, highestBySubject };
  }, [db, student.id, sy]);

  // Writing samples for this school year, oldest first (chronological showcase).
  const samples = useMemo(() =>
    (db.writingSamples || [])
      .filter(w => w.studentId === student.id && schoolYearOf(w.date) === sy)
      .sort((a, b) => a.date.localeCompare(b.date)),
  [db, student.id, sy]);

  const standing = standingKey ? BENCH[standingKey] : null;

  return (
    <div className="pf-student">
      {/* Cover */}
      <div className="pf-cover" style={{ borderTop:`4px solid ${C.gold}`, paddingTop:22, marginBottom:26 }}>
        <div style={{ fontSize:12, fontWeight:800, letterSpacing:'0.18em', textTransform:'uppercase', color:C.gold, marginBottom:6 }}>
          Academic Portfolio
        </div>
        <div style={{ fontFamily:'Georgia,serif', fontSize:30, fontWeight:'bold', color:C.navy, lineHeight:1.15 }}>
          {student.emoji} {student.name}
        </div>
        <div style={{ fontSize:15, color:'#334155', marginTop:6 }}>
          {gg?.name}{student.family ? ` · ${student.family}` : ''}
        </div>
        <div style={{ fontSize:14, color:C.navy, fontWeight:700, marginTop:2 }}>
          {sy} School Year <span style={{ color:C.muted, fontWeight:400 }}>· {syRangeLabel(sy)}</span>
        </div>
        <div style={{ fontSize:12, color:C.muted, marginTop:14, borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
          Prepared {fmtLongDate()} · Ron Paul Curriculum
        </div>
      </div>

      {/* Report card & grades */}
      {sections.report && (
        <Section title="Report Card & Grades">
          {graded.length === 0 ? (
            <Empty>No grades were recorded for this school year.</Empty>
          ) : (
            <>
              <div style={{ display:'flex', gap:22, flexWrap:'wrap', alignItems:'center', marginBottom:16 }}>
                <Stat big value={`${overallLetter} · ${Math.round(overallPct)}%`} label="Overall grade" />
                <Stat value={gpa.toFixed(2)} label="GPA (4.0 scale)" />
                <Stat value={`${graded.length}`} label={`Graded subject${graded.length!==1?'s':''}`} />
                {standing && (
                  <div>
                    <div style={{ marginBottom:3 }}><StandingBadge k={standingKey} /></div>
                    <div style={pfStatLbl}>National standing</div>
                  </div>
                )}
              </div>

              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
                <thead>
                  <tr style={{ borderBottom:`2px solid ${C.navy}`, textAlign:'left' }}>
                    <th style={pfTh}>Subject</th>
                    <th style={{ ...pfTh, textAlign:'center' }}>Grade</th>
                    <th style={{ ...pfTh, textAlign:'center' }}>%</th>
                    <th style={pfTh}>Standing</th>
                    <th style={{ ...pfTh, textAlign:'center' }}>Items</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map(s => (
                    <tr key={s.subj.id} className="pf-row" style={{ borderBottom:`1px solid ${C.border}` }}>
                      <td style={pfTd}>{s.subj.icon} {s.subj.name}</td>
                      <td style={{ ...pfTd, textAlign:'center', fontWeight:700, color: s.count ? gradeColor(s.avg) : '#94A3B8' }}>
                        {s.count ? s.letter : '—'}
                      </td>
                      <td style={{ ...pfTd, textAlign:'center', fontVariantNumeric:'tabular-nums' }}>
                        {s.count ? `${Math.round(s.avg)}%` : ''}
                      </td>
                      <td style={pfTd}>{s.benchKey ? <StandingBadge k={s.benchKey} small /> : <span style={{ color:'#94A3B8' }}>—</span>}</td>
                      <td style={{ ...pfTd, textAlign:'center', color:C.muted }}>{s.count || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Note>Subject grades are a weighted average of that subject's graded work this year. Standing reflects the work relative to typical students at this grade level nationally.</Note>
            </>
          )}
        </Section>
      )}

      {/* Course progress */}
      {sections.progress && (
        <Section title="Course Progress">
          {subjects.length === 0 ? (
            <Empty>No subjects are set up for this grade.</Empty>
          ) : (
            <>
              {subjects.map(s => {
                const highest = work.highestBySubject[s.subj.id] || 0;
                const progressPct = s.total > 0 ? Math.min(100, Math.round((highest / s.total) * 100)) : 0;
                return (
                  <div key={s.subj.id} className="pf-row" style={{ marginBottom:13 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                      <span style={{ fontSize:13.5, fontWeight:600, color:'#333' }}>{s.subj.icon} {s.subj.name}</span>
                      <span style={{ fontSize:12.5, color:C.muted, fontVariantNumeric:'tabular-nums' }}>
                        {highest > 0 ? `Lesson ${highest} of ${s.total}` : `Not started · ${s.total} lessons`}
                        <span style={{ marginLeft:8, fontWeight:700, color: progressPct>=100?C.green:s.subj.color }}>{progressPct}%</span>
                      </span>
                    </div>
                    <Bar pct={progressPct} color={progressPct>=100 ? C.green : s.subj.color} />
                  </div>
                );
              })}
              <Note>Course progress is the highest lesson approved as complete in each subject during the {sy} school year, out of the course's total lessons.</Note>
            </>
          )}
        </Section>
      )}

      {/* Attendance & completed work */}
      {sections.work && (
        <Section title="Attendance & Completed Work">
          {work.lessons === 0 ? (
            <Empty>No completed work was recorded for this school year.</Empty>
          ) : (
            <>
              <div style={{ display:'flex', gap:22, flexWrap:'wrap', marginBottom:14 }}>
                <Stat big value={work.days} label={`School day${work.days!==1?'s':''} recorded`} />
                <Stat big value={work.lessons} label={`Lesson${work.lessons!==1?'s':''} completed`} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'4px 20px' }}>
                {(gg?.subjects || []).map(subj => {
                  const n = work.bySubject[subj.id] || 0;
                  return (
                    <div key={subj.id} className="pf-row" style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'4px 0', borderBottom:`1px solid #F0F0F0` }}>
                      <span style={{ color:'#333' }}>{subj.icon} {subj.name}</span>
                      <span style={{ color:C.muted, fontVariantNumeric:'tabular-nums' }}>{n} lesson{n!==1?'s':''}</span>
                    </div>
                  );
                })}
              </div>
              <Note>A "school day" is any date with at least one approved lesson. Counts cover the full {sy} school year (August through July).</Note>
            </>
          )}
        </Section>
      )}

      {/* Logged instruction hours */}
      {sections.hours && (
        <Section title="Logged Instruction Hours">
          {(() => {
            const hrs = studentHours(db, student.id, sy);
            const subjIds = Object.keys(hrs.bySubject).sort((a, b) => hrs.bySubject[b] - hrs.bySubject[a]);
            if (subjIds.length === 0) return <Empty>No hours were logged for this school year.</Empty>;
            return (
              <>
                <div style={{ display:'flex', gap:22, flexWrap:'wrap', marginBottom:14 }}>
                  <Stat big value={fmtHours(hrs.totalHours)} label="Total hours logged" />
                  <Stat big value={hrs.days} label={`Day${hrs.days!==1?'s':''} with logged time`} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'4px 20px' }}>
                  {subjIds.map(sid => {
                    const info = subjectInfo(db, student, sid);
                    return (
                      <div key={sid} className="pf-row" style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'4px 0', borderBottom:`1px solid #F0F0F0` }}>
                        <span style={{ color:'#333' }}>{info.icon} {info.name}</span>
                        <span style={{ color:C.muted, fontVariantNumeric:'tabular-nums' }}>{fmtHours(hrs.bySubject[sid])} hrs</span>
                      </div>
                    );
                  })}
                </div>
                <Note>Parent-logged instruction time by subject for the {sy} school year.</Note>
              </>
            );
          })()}
        </Section>
      )}

      {/* Writing portfolio */}
      {sections.writing && (
        <Section title="Writing Portfolio">
          {samples.length === 0 ? (
            <Empty>No writing samples were recorded for this school year.</Empty>
          ) : (
            <>
              <div style={{ fontSize:12.5, color:C.muted, marginBottom:14 }}>
                {samples.length} sample{samples.length!==1?'s':''}, in chronological order.
              </div>
              {samples.map(w => <WritingSample key={w.id} w={w} fullText={fullText} />)}
            </>
          )}
        </Section>
      )}

      {/* Footer */}
      <div style={{ marginTop:26, paddingTop:12, borderTop:`1px solid ${C.border}`, fontSize:11, color:C.muted, textAlign:'center', lineHeight:1.6 }}>
        {student.name} · {sy} · Generated by RPC Planner on {fmtLongDate()}.<br />
        This portfolio reflects work recorded in the family's RPC Planner homeschool system.
      </div>
    </div>
  );
}


// ─── ONE WRITING SAMPLE ───────────────────────────────────────────────────────
function WritingSample({ w, fullText }) {
  const a = w.analysis;
  const traits = a?.traits || [];
  return (
    <div className="pf-wsample" style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:16, marginBottom:14 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap', marginBottom:2 }}>
        <span style={{ fontFamily:'Georgia,serif', fontSize:16, fontWeight:'bold', color:C.navy }}>{w.title || '(untitled)'}</span>
        {a?.overall && (
          <span style={{ fontSize:12.5, fontWeight:700, color:C.navy, background:'#EEF2F6', borderRadius:6, padding:'2px 9px' }}>
            Grade: {a.overall}
          </span>
        )}
        {!a && <span style={{ fontSize:11.5, color:C.green, fontWeight:600 }}>Writing sample on file</span>}
      </div>
      <div style={{ fontSize:11.5, color:C.muted, marginBottom:a ? 12 : 10 }}>
        {new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}
        {' · '}{w.wordCount || 0} words
        {w.source === 'wordpress' ? ' · from blog' : ''}
      </div>

      {/* Trait scores — the assessed skills, compact */}
      {traits.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'6px 18px', marginBottom:12 }}>
          {traits.map((t, i) => (
            <div key={i}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                <span style={{ color:'#333' }}>{t.name}</span>
                <span style={{ fontWeight:700, color:C.navy, fontVariantNumeric:'tabular-nums' }}>{t.score}/5</span>
              </div>
              <Bar pct={(Math.min(Math.max(t.score,0),5)/5)*100} color={t.score>=4?C.green:t.score>=3?C.gold:C.red} thin />
            </div>
          ))}
        </div>
      )}

      {/* Constructive feedback only — strengths & growth areas */}
      {(a?.strengths?.length > 0 || a?.improvements?.length > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12, marginBottom: fullText ? 12 : 0 }}>
          {a?.strengths?.length > 0 && (
            <div style={{ fontSize:12.5, color:'#333', lineHeight:1.5 }}>
              <strong style={{ color:C.green }}>Strengths:</strong> {a.strengths.join('; ')}
            </div>
          )}
          {a?.improvements?.length > 0 && (
            <div style={{ fontSize:12.5, color:'#333', lineHeight:1.5 }}>
              <strong style={{ color:C.yellow }}>Growth areas:</strong> {a.improvements.join('; ')}
            </div>
          )}
        </div>
      )}

      {/* The student's actual writing */}
      {fullText && w.text && (
        <div style={{ marginTop:12, borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
          <div style={pfStatLbl}>Sample</div>
          <div style={{ fontFamily:'Georgia,serif', fontSize:13, color:'#1F2937', lineHeight:1.65, whiteSpace:'pre-wrap', marginTop:6 }}>
            {w.text}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── SMALL SHARED PIECES ──────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="pf-section" style={{ marginBottom:24 }}>
      <div style={{ fontFamily:'Georgia,serif', fontSize:17, fontWeight:'bold', color:C.navy, borderBottom:`2px solid ${C.gold}`, paddingBottom:6, marginBottom:14 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Stat({ value, label, big }) {
  return (
    <div>
      <div style={{ fontFamily:'Georgia,serif', fontWeight:'bold', color:C.navy, fontSize: big ? 26 : 20, lineHeight:1.1 }}>{value}</div>
      <div style={pfStatLbl}>{label}</div>
    </div>
  );
}

function StandingBadge({ k, small }) {
  const b = BENCH[k];
  if (!b) return null;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5, background:`${b.color}14`,
      color:b.color, border:`1px solid ${b.color}55`, borderRadius:999,
      padding: small ? '2px 8px' : '3px 11px', fontSize: small ? 11 : 12, fontWeight:700, whiteSpace:'nowrap',
    }}>
      <span style={{ width:7, height:7, borderRadius:999, background:b.color, flexShrink:0 }} />
      {small ? b.short : b.label}
    </span>
  );
}

function Bar({ pct, color, thin }) {
  return (
    <div style={{ height: thin ? 5 : 7, background:'#E5E7EB', borderRadius:4, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${Math.min(100, Math.max(0, pct))}%`, background:color, borderRadius:4 }} />
    </div>
  );
}

function Empty({ children }) {
  return <div style={{ fontSize:13, color:C.muted, fontStyle:'italic', padding:'4px 0' }}>{children}</div>;
}

function Note({ children }) {
  return <div style={{ fontSize:11, color:C.muted, marginTop:12, lineHeight:1.5 }}>{children}</div>;
}

// Local style tokens (kept in-file so the document renders identically wherever it's imported).
const pfCard   = { background:'white', borderRadius:14, border:'1px solid rgba(26,46,74,0.06)', boxShadow:'0 1px 2px rgba(15,30,48,0.05), 0 4px 14px rgba(15,30,48,0.05)', padding:16 };
const pfInp    = { border:`1.5px solid ${C.border}`, borderRadius:8, padding:'8px 12px', fontSize:14, fontFamily:'inherit', background:'white', boxSizing:'border-box' };
const pfLbl    = { display:'block', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:C.muted, marginBottom:4 };
const pfStatLbl= { fontSize:11, color:C.muted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:2 };
const pfTh     = { padding:'8px 6px', fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.05em', color:C.muted };
const pfTd     = { padding:'9px 6px', color:'#333' };
