import { useState } from 'react';
import { KIND_OPTIONS } from '../utils/constants';
import { TODAY, shortDate, uid } from '../utils/dates';
import { BENCH, CURRENT_SY, gradeColor, pctToLetter, schoolYearOf } from '../utils/grades';
import { textStats } from '../utils/text';
import { Btn, C, card, inp, lbl } from '../utils/theme';
import { BenchBadge, ReportCard } from './ReportCard';


// ─── GRADES (parent) ──────────────────────────────────────────────────────────
export function GradesView({ db, mut }) {
  const [stuId, setStuId] = useState(db.students[0]?.id || '');
  const [tab, setTab] = useState('grade'); // grade | book | report
  const student = db.students.find(s => s.id === stuId);
  const gg = db.gradeGroups.find(g => g.id === student?.gradeGroupId);
  const gradeCount = (db.grades || []).filter(g => g.studentId === stuId).length;

  return (
    <div>
      <div style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:'bold', color:C.navy, marginBottom:4 }}>Grades</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>
        Grade work against grade-level standards and see where each student stands nationally. The AI proposes a grade — you review and adjust before it lands on the report card the kids see.
      </div>

      {/* Student selector */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {db.students.map(s => (
          <button key={s.id} onClick={()=>setStuId(s.id)} style={{
            ...inp, cursor:'pointer', fontWeight: stuId===s.id?700:400,
            background: stuId===s.id?C.navy:'white', color: stuId===s.id?'white':'#333',
            border:`1px solid ${stuId===s.id?C.navy:C.border}`, padding:'7px 14px', borderRadius:8,
          }}>{s.emoji} {s.name}</button>
        ))}
      </div>

      {/* Segmented control */}
      <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
        {[['grade','✏️ Grade Work'],['book',`📋 Gradebook${gradeCount?` (${gradeCount})`:''}`],['report','🎓 Report Card']].map(([id,label])=>(
          <Btn key={id} onClick={()=>setTab(id)} style={{ background:tab===id?C.gold:'white', color:tab===id?'white':C.muted, border:`1px solid ${tab===id?C.gold:C.border}` }}>{label}</Btn>
        ))}
      </div>

      {!student ? (
        <div style={{ ...card, color:C.muted }}>Add a student in Setup → Students first.</div>
      ) : (
        <>
          {/* Kept mounted so an unsaved AI proposal survives a peek at the Gradebook/Report Card */}
          <div style={{ display: tab==='grade' ? 'block' : 'none' }}>
            <GradeComposer key={student.id} db={db} mut={mut} student={student} gg={gg} onDone={()=>setTab('book')} />
          </div>
          {tab==='book'   && <GradebookList key={student.id} db={db} mut={mut} student={student} gg={gg} />}
          {tab==='report' && <ReportCard key={student.id} student={student} db={db} />}
        </>
      )}
    </div>
  );
}


function GradeComposer({ db, mut, student, gg, onDone }) {
  const subjects = gg?.subjects || [];
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [rigor, setRigor] = useState('standard');
  const [src, setSrc]     = useState('paste'); // paste | blog | upload
  const [title, setTitle] = useState('');
  const [text, setText]   = useState('');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [proposal, setProposal] = useState(null);

  const [pulling, setPulling] = useState(false);
  const [postList, setPostList] = useState(null);
  const [pullError, setPullError] = useState(null);
  const [imgBusy, setImgBusy] = useState(false);

  const subject = subjects.find(s => s.id === subjectId);
  const stats = textStats(text);

  const reset = () => { setTitle(''); setText(''); setImages([]); setProposal(null); setError(null); setPostList(null); setPullError(null); };

  const pullPosts = async () => {
    if (!student?.blogUrl) { setPullError('No blog address saved for this student. Add one in Setup → Students, or paste the text instead.'); return; }
    setPulling(true); setPullError(null); setPostList(null);
    try {
      const res = await fetch('/api/fetch-posts', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ blogUrl: student.blogUrl, mode:'list' }) });
      const data = await res.json();
      if (!res.ok) { setPullError(data.error || 'Could not fetch posts.'); setPulling(false); return; }
      setPostList(data.posts || []);
    } catch { setPullError('Could not reach the blog. Paste the text instead.'); }
    setPulling(false);
  };
  const choosePost = (p) => { setTitle(p.title || ''); setText(p.text || ''); setPostList(null); setProposal(null); };

  const onFiles = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 5 - images.length);
    if (!files.length) return;
    setImgBusy(true); setError(null);
    const out = [];
    for (const f of files) { try { out.push(await fileToGradeImage(f)); } catch { /* skip */ } }
    setImages(prev => [...prev, ...out].slice(0, 5));
    setImgBusy(false);
  };

  const canGrade = src === 'upload' ? images.length > 0 : stats.words >= 5;

  const grade = async () => {
    setLoading(true); setError(null); setProposal(null);
    try {
      const payload = { subject: subject?.name || 'General', gradeLevel: gg?.name || '', rigor, title };
      if (src === 'upload') payload.images = images.map(im => ({ media_type: im.media_type, data: im.data }));
      else payload.text = text;
      const res = await fetch('/api/grade-work', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Grading failed.'); setLoading(false); return; }
      const g = data.grade || {};
      const rubric = Array.isArray(g.rubric) ? g.rubric : [];
      const pts = rubric.reduce((s, r) => s + (Number(r.points) || 0), 0);
      const score = Math.max(0, Math.min(100, Math.round(rubric.length ? pts : (Number(g.score) || 0))));
      setProposal({
        subjectId,
        title: title || (g.transcription ? 'Handwritten work' : 'Untitled'),
        kind: 'Assignment', weight: 1, score,
        benchmark: BENCH[g.benchmark] ? g.benchmark : null,
        benchmarkNote: g.benchmarkNote || '',
        rubric, strengths: g.strengths || [], improvements: g.improvements || [],
        summary: g.summary || '', teacherNote: g.teacherNote || '', parentNote: '',
        transcription: g.transcription || null,
        source: src === 'upload' ? 'upload' : (src === 'blog' ? 'wordpress' : 'paste'),
        rigor, gradeLevel: gg?.name || '',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch { setError('Could not reach the grader. Check your connection and try again.'); }
    setLoading(false);
  };

  const saveProposal = () => {
    const p = proposal;
    mut(d => {
      if (!d.grades) d.grades = [];
      d.grades.push({
        id: uid(), studentId: student.id, subjectId: p.subjectId, date: TODAY, schoolYear: CURRENT_SY,
        title: (p.title || '').trim() || 'Untitled', kind: p.kind, weight: Number(p.weight) || 1, source: p.source,
        score: p.score, letter: pctToLetter(p.score), benchmark: p.benchmark, benchmarkNote: p.benchmarkNote,
        rubric: p.rubric, strengths: p.strengths, improvements: p.improvements,
        summary: p.summary, teacherNote: p.teacherNote, parentNote: (p.parentNote || '').trim(),
        aiGenerated: true, rigor: p.rigor, gradeLevel: p.gradeLevel,
      });
    });
    reset();
    if (onDone) onDone();
  };

  const srcTabs = [['paste','📋 Paste'],['blog','🌐 From blog'],['upload','📷 Photo (handwritten)']];

  return (
    <div>
      {/* Setup row */}
      <div style={{ ...card, marginBottom:14 }}>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-end', marginBottom:14 }}>
          <div>
            <label style={lbl}>Subject</label>
            <select value={subjectId} onChange={e=>{ setSubjectId(e.target.value); setProposal(null); }} style={{ ...inp, width:'auto' }}>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Standard</label>
            <div style={{ display:'flex', gap:6 }}>
              {[['standard','Grade level'],['rigorous','Rigorous']].map(([id,label])=>(
                <button key={id} onClick={()=>setRigor(id)} style={{
                  ...inp, cursor:'pointer', padding:'8px 12px', fontWeight: rigor===id?700:400,
                  background: rigor===id?C.navy:'white', color: rigor===id?'white':'#333', border:`1px solid ${rigor===id?C.navy:C.border}`,
                }}>{label}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ fontSize:11.5, color:C.muted, marginBottom:14, lineHeight:1.5, background:'#F8FAFC', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 10px' }}>
          {rigor==='rigorous'
            ? '⚑ Rigorous: measured against the strongest students in the country for this grade — honest about gaps vs. elite performance.'
            : '✓ Grade level: measured against typical, solid expectations for this grade nationally.'}
        </div>

        {/* Source tabs */}
        <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
          {srcTabs.map(([id,label])=>(
            <button key={id} onClick={()=>{ setSrc(id); setProposal(null); }} style={{
              border:'none', background: src===id?`${C.gold}1A`:'transparent', color: src===id?C.gold:C.muted,
              fontWeight: src===id?700:600, fontSize:13, padding:'7px 12px', borderRadius:8, cursor:'pointer',
            }}>{label}</button>
          ))}
        </div>

        {/* Blog pull */}
        {src==='blog' && (
          <div style={{ marginBottom:12 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:8 }}>
              <Btn onClick={pullPosts} disabled={pulling} style={{ background: pulling?'#9CA3AF':C.navy, color:'white' }}>{pulling?'Fetching…':'🌐 Pull recent posts'}</Btn>
              <span style={{ fontSize:12, color:C.muted }}>{student?.blogUrl ? `Blog: ${student.blogUrl}` : 'No blog saved — add one in Setup → Students.'}</span>
            </div>
            {pullError && <div style={{ fontSize:12, color:C.red, marginBottom:8 }}>{pullError}</div>}
            {postList && (
              <div style={{ maxHeight:230, overflowY:'auto', border:`1px solid ${C.border}`, borderRadius:8, padding:8, marginBottom:8 }}>
                {postList.length===0 ? <div style={{ fontSize:13, color:C.muted, padding:8 }}>No posts found.</div> :
                  postList.map(p => (
                    <button key={p.id} onClick={()=>choosePost(p)} style={{ display:'block', width:'100%', textAlign:'left', background:'white', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', marginBottom:6, cursor:'pointer' }}>
                      <div style={{ fontSize:13, fontWeight:600, color:C.navy }}>{p.title}</div>
                      <div style={{ fontSize:11, color:C.muted }}>{p.date?shortDate(p.date.slice(0,10)):''} · {textStats(p.text).words} words</div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Photo upload */}
        {src==='upload' && (
          <div style={{ marginBottom:12 }}>
            <label style={{ ...inp, display:'inline-flex', alignItems:'center', gap:8, cursor:'pointer', background:C.navy, color:'white', border:'none', fontWeight:600 }}>
              {imgBusy ? 'Reading…' : (images.length ? '＋ Add more pages' : '📷 Choose photos')}
              <input type="file" accept="image/*" multiple onChange={e=>onFiles(e.target.files)} style={{ display:'none' }} />
            </label>
            <span style={{ fontSize:12, color:C.muted, marginLeft:10 }}>Up to 5 pages · read on-device & shrunk before grading</span>
            {images.length > 0 && (
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:10 }}>
                {images.map((im, i) => (
                  <div key={i} style={{ position:'relative' }}>
                    <img src={im.preview} alt={`page ${i+1}`} style={{ width:76, height:76, objectFit:'cover', borderRadius:8, border:`1px solid ${C.border}` }} />
                    <button onClick={()=>setImages(prev=>prev.filter((_,x)=>x!==i))} style={{ position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:999, border:'none', background:C.red, color:'white', fontSize:12, cursor:'pointer', lineHeight:1 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Title + text (paste/blog) */}
        <label style={lbl}>Title</label>
        <input value={title} onChange={e=>setTitle(e.target.value)} style={{ ...inp, width:'100%', marginBottom:10 }} placeholder="e.g. Essay: My Summer, or Chapter 4 Lab" />
        {src!=='upload' && (
          <>
            <label style={lbl}>The work</label>
            <textarea value={text} onChange={e=>setText(e.target.value)} style={{ ...inp, width:'100%', minHeight:150, resize:'vertical', fontSize:14, display:'block' }} placeholder="Paste the student's work here, or pull it from the blog above." />
            <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>📊 {stats.words} words · {stats.sentences} sentences</div>
          </>
        )}

        <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
          <Btn onClick={grade} disabled={loading || !canGrade} style={{ background:(loading||!canGrade)?'#9CA3AF':C.gold, color:'white', fontWeight:700 }}>
            {loading ? 'Grading…' : '🎓 Grade it'}
          </Btn>
          {(text || images.length>0 || proposal) && <Btn onClick={reset} style={{ background:'#E8EEF4', color:C.muted }}>Clear</Btn>}
        </div>
        {error && <div style={{ fontSize:13, color:C.red, marginTop:10 }}>{error}</div>}
      </div>

      {/* Proposed grade */}
      {proposal && (
        <ProposedGradeEditor proposal={proposal} setProposal={setProposal} onSave={saveProposal} onDiscard={()=>setProposal(null)} subjectName={subject?.name || ''} />
      )}

      {/* Manual entry */}
      <ManualGradeForm db={db} mut={mut} student={student} gg={gg} defaultSubjectId={subjectId} />
    </div>
  );
}


function ProposedGradeEditor({ proposal, setProposal, onSave, onDiscard, subjectName }) {
  const [showTx, setShowTx] = useState(false);
  const p = proposal;
  const set = (patch) => setProposal({ ...p, ...patch });
  const letter = pctToLetter(p.score);

  return (
    <div style={{ ...card, marginBottom:14, border:`2px solid ${C.gold}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
        <span style={{ fontSize:11, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.gold }}>Proposed grade — review before saving</span>
      </div>
      <div style={{ fontSize:12, color:C.muted, marginBottom:14, lineHeight:1.5 }}>
        This is an AI suggestion for {subjectName || 'this work'}. Adjust anything below — nothing is saved until you press <strong>Save to gradebook</strong>.
      </div>

      {/* Transcription for handwritten work */}
      {p.transcription && (
        <div style={{ marginBottom:14, background:'#F8FAFC', border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px' }}>
          <button onClick={()=>setShowTx(v=>!v)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, fontWeight:700, color:C.navy, padding:0 }}>
            {showTx ? '▾' : '▸'} Transcription from the photo{p.transcription.length>0?'':' (none)'} — check it read correctly
          </button>
          {showTx && <div style={{ fontSize:13, color:'#333', lineHeight:1.6, marginTop:8, whiteSpace:'pre-wrap' }}>{p.transcription}</div>}
        </div>
      )}

      {/* Score + benchmark */}
      <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'center', marginBottom:16 }}>
        <div style={{ width:64, height:64, borderRadius:14, background:gradeColor(p.score), color:'white', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <div style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:'bold', lineHeight:1 }}>{letter}</div>
        </div>
        <div>
          <label style={lbl}>Score (%)</label>
          <input type="number" min={0} max={100} value={p.score} onChange={e=>set({ score: Math.max(0, Math.min(100, parseInt(e.target.value)||0)) })} style={{ ...inp, width:90 }} />
        </div>
        <div>
          <label style={lbl}>Standing vs. grade level</label>
          <select value={p.benchmark || ''} onChange={e=>set({ benchmark: e.target.value || null })} style={{ ...inp, width:'auto' }}>
            <option value="">— none —</option>
            {Object.keys(BENCH).map(k => <option key={k} value={k}>{BENCH[k].label}</option>)}
          </select>
        </div>
      </div>
      {p.benchmarkNote && <div style={{ fontSize:13, color:'#333', lineHeight:1.5, marginBottom:14, marginTop:-6 }}>{p.benchmarkNote}</div>}

      {/* Rubric */}
      {p.rubric?.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:800, color:C.navy, marginBottom:10, textTransform:'uppercase', letterSpacing:'0.05em' }}>Rubric</div>
          {p.rubric.map((r,i)=>{
            const pct = r.max ? (Number(r.points)||0)/Number(r.max) : 0;
            return (
              <div key={i} style={{ marginBottom:11 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:3 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#333' }}>{r.name}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:C.navy, fontVariantNumeric:'tabular-nums' }}>{r.points}/{r.max}</span>
                </div>
                <div style={{ height:6, background:'#E5E7EB', borderRadius:4, overflow:'hidden', marginBottom:3 }}>
                  <div style={{ height:'100%', width:`${Math.min(100,pct*100)}%`, background: pct>=0.9?C.green:pct>=0.75?C.gold:C.red, borderRadius:4 }} />
                </div>
                <div style={{ fontSize:12, color:C.muted, lineHeight:1.5 }}>{r.comment}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Strengths / improvements */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12, marginBottom:16 }}>
        {p.strengths?.length>0 && (
          <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:12 }}>
            <div style={{ fontSize:11, fontWeight:800, color:C.green, marginBottom:6, letterSpacing:'0.05em' }}>STRENGTHS</div>
            {p.strengths.map((s,i)=><div key={i} style={{ fontSize:13, color:'#333', marginBottom:5, lineHeight:1.5 }}>✓ {s}</div>)}
          </div>
        )}
        {p.improvements?.length>0 && (
          <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, padding:12 }}>
            <div style={{ fontSize:11, fontWeight:800, color:C.yellow, marginBottom:6, letterSpacing:'0.05em' }}>WORK ON NEXT</div>
            {p.improvements.map((s,i)=><div key={i} style={{ fontSize:13, color:'#333', marginBottom:5, lineHeight:1.5 }}>→ {s}</div>)}
          </div>
        )}
      </div>

      {p.teacherNote && (
        <div style={{ fontSize:13, color:'#334155', lineHeight:1.6, marginBottom:16, background:'#F1F5F9', borderRadius:8, padding:'10px 12px' }}>
          <strong style={{ color:C.navy }}>For you:</strong> {p.teacherNote}
        </div>
      )}

      {/* Editable meta */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
        <div style={{ flex:'1 1 160px' }}>
          <label style={lbl}>Title</label>
          <input value={p.title} onChange={e=>set({ title: e.target.value })} style={{ ...inp, width:'100%' }} />
        </div>
        <div>
          <label style={lbl}>Type</label>
          <select value={p.kind} onChange={e=>set({ kind: e.target.value })} style={{ ...inp, width:'auto' }}>
            {KIND_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Weight</label>
          <input type="number" min={0} step={0.5} value={p.weight} onChange={e=>set({ weight: parseFloat(e.target.value)||1 })} style={{ ...inp, width:70 }} />
        </div>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={lbl}>Your note (optional)</label>
        <textarea value={p.parentNote} onChange={e=>set({ parentNote: e.target.value })} style={{ ...inp, width:'100%', minHeight:56, resize:'vertical' }} placeholder="Anything you want on record for this grade." />
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <Btn onClick={onSave} style={{ background:C.green, color:'white', fontWeight:700 }}>✓ Save to gradebook</Btn>
        <Btn onClick={onDiscard} style={{ background:'#FEE2E2', color:C.red }}>Discard</Btn>
      </div>
    </div>
  );
}


function ManualGradeForm({ db, mut, student, gg, defaultSubjectId }) {
  const [open, setOpen] = useState(false);
  const subjects = gg?.subjects || [];
  const [subjectId, setSubjectId] = useState(defaultSubjectId || subjects[0]?.id || '');
  const [title, setTitle] = useState('');
  const [kind, setKind]   = useState('Assignment');
  const [score, setScore] = useState(90);
  const [weight, setWeight] = useState(1);
  const [bench, setBench] = useState('');
  const [date, setDate]   = useState(TODAY);
  const [note, setNote]   = useState('');

  const save = () => {
    mut(d => {
      if (!d.grades) d.grades = [];
      d.grades.push({
        id: uid(), studentId: student.id, subjectId, date, schoolYear: schoolYearOf(date),
        title: title.trim() || kind, kind, weight: Number(weight)||1, source: 'manual',
        score: Math.max(0, Math.min(100, Math.round(score))), letter: pctToLetter(score),
        benchmark: bench || null, benchmarkNote: '', rubric: [], strengths: [], improvements: [],
        summary: '', teacherNote: '', parentNote: note.trim(), aiGenerated: false, rigor: null, gradeLevel: gg?.name || '',
      });
    });
    setTitle(''); setNote(''); setScore(90); setWeight(1); setBench(''); setOpen(false);
  };

  if (!open) return (
    <Btn onClick={()=>setOpen(true)} style={{ background:'white', border:`1px dashed ${C.border}`, color:C.muted, width:'100%' }}>＋ Add a grade manually (tests, math, work you graded yourself)</Btn>
  );

  return (
    <div style={{ ...card }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:12 }}>Add a grade manually</div>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
        <div style={{ flex:'1 1 150px' }}>
          <label style={lbl}>Subject</label>
          <select value={subjectId} onChange={e=>setSubjectId(e.target.value)} style={{ ...inp, width:'100%' }}>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
        </div>
        <div style={{ flex:'1 1 150px' }}>
          <label style={lbl}>Title</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} style={{ ...inp, width:'100%' }} placeholder="e.g. Ch. 5 Test" />
        </div>
      </div>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
        <div>
          <label style={lbl}>Type</label>
          <select value={kind} onChange={e=>setKind(e.target.value)} style={{ ...inp, width:'auto' }}>{KIND_OPTIONS.map(k=><option key={k} value={k}>{k}</option>)}</select>
        </div>
        <div>
          <label style={lbl}>Score (%)</label>
          <input type="number" min={0} max={100} value={score} onChange={e=>setScore(parseInt(e.target.value)||0)} style={{ ...inp, width:80 }} />
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:8, fontSize:13, fontWeight:700, color:gradeColor(score) }}>= {pctToLetter(score)}</div>
        <div>
          <label style={lbl}>Weight</label>
          <input type="number" min={0} step={0.5} value={weight} onChange={e=>setWeight(parseFloat(e.target.value)||1)} style={{ ...inp, width:70 }} />
        </div>
        <div>
          <label style={lbl}>Date</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ ...inp, width:'auto' }} />
        </div>
      </div>
      <div style={{ marginBottom:12 }}>
        <label style={lbl}>Standing vs. grade level (optional)</label>
        <select value={bench} onChange={e=>setBench(e.target.value)} style={{ ...inp, width:'auto' }}>
          <option value="">— none —</option>
          {Object.keys(BENCH).map(k => <option key={k} value={k}>{BENCH[k].label}</option>)}
        </select>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={lbl}>Note (optional)</label>
        <input value={note} onChange={e=>setNote(e.target.value)} style={{ ...inp, width:'100%' }} />
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <Btn onClick={save} style={{ background:C.green, color:'white', fontWeight:700 }}>✓ Save grade</Btn>
        <Btn onClick={()=>setOpen(false)} style={{ background:'#E8EEF4', color:C.muted }}>Cancel</Btn>
      </div>
    </div>
  );
}


function GradebookList({ db, mut, student, gg }) {
  const grades = (db.grades || []).filter(g => g.studentId === student.id);
  const subjects = gg?.subjects || [];

  if (grades.length === 0) {
    return <div style={{ ...card, color:C.muted, textAlign:'center', padding:32 }}>
      <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
      No grades yet for {student.name}. Grade some work or add one manually on the <strong>Grade Work</strong> tab.
    </div>;
  }

  return (
    <div>
      {subjects.map(subj => {
        const gs = grades.filter(g => g.subjectId === subj.id).sort((a,b)=>b.date.localeCompare(a.date));
        if (!gs.length) return null;
        const wSum = gs.reduce((s,g)=> s + (g.weight ?? 1), 0) || 1;
        const avg = gs.reduce((s,g)=> s + (g.score ?? 0)*(g.weight ?? 1), 0) / wSum;
        return (
          <div key={subj.id} style={{ marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:18 }}>{subj.icon}</span>
              <span style={{ fontSize:14, fontWeight:700, color:C.navy }}>{subj.name}</span>
              <span style={{ marginLeft:'auto', fontSize:13, fontWeight:700, color:gradeColor(avg) }}>{pctToLetter(avg)} · {Math.round(avg)}%</span>
            </div>
            {gs.map(g => <GradeRow key={g.id} g={g} mut={mut} />)}
          </div>
        );
      })}
    </div>
  );
}


function GradeRow({ g, mut }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [score, setScore] = useState(g.score);
  const [kind, setKind]   = useState(g.kind || 'Assignment');
  const [weight, setWeight] = useState(g.weight ?? 1);
  const [bench, setBench] = useState(g.benchmark || '');
  const [note, setNote]   = useState(g.parentNote || '');

  const save = () => {
    mut(d => {
      const x = (d.grades || []).find(y => y.id === g.id);
      if (x) {
        x.score = Math.max(0, Math.min(100, Math.round(score)));
        x.letter = pctToLetter(x.score);
        x.kind = kind; x.weight = Number(weight)||1; x.benchmark = bench || null; x.parentNote = note.trim();
      }
    });
    setEdit(false);
  };
  const del = () => { if (window.confirm('Delete this grade?')) mut(d => { d.grades = (d.grades||[]).filter(y => y.id !== g.id); }); };

  return (
    <div style={{ ...card, marginBottom:8, padding:0, overflow:'hidden' }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer', flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:120 }}>
          <div style={{ fontSize:14, fontWeight:600, color:C.navy }}>{g.title}</div>
          <div style={{ fontSize:11.5, color:C.muted }}>{shortDate(g.date)} · {g.kind}{g.weight && g.weight!==1?` · ×${g.weight}`:''}{g.aiGenerated?' · AI':''}{g.source==='upload'?' · 📷':''}</div>
        </div>
        {g.benchmark && <BenchBadge k={g.benchmark} small />}
        <div style={{ textAlign:'right', minWidth:44 }}>
          <div style={{ fontFamily:'Georgia,serif', fontSize:18, fontWeight:'bold', color:gradeColor(g.score ?? 0) }}>{g.letter}</div>
          <div style={{ fontSize:11, color:C.muted, fontVariantNumeric:'tabular-nums' }}>{g.score}%</div>
        </div>
        <span style={{ color:C.muted, fontSize:12 }}>{open?'▾':'▸'}</span>
      </div>

      {open && (
        <div style={{ padding:'0 14px 14px', borderTop:`1px solid ${C.border}` }}>
          {g.benchmarkNote && <div style={{ fontSize:13, color:'#333', lineHeight:1.5, margin:'12px 0' }}>{g.benchmarkNote}</div>}
          {g.rubric?.length > 0 && (
            <div style={{ margin:'12px 0' }}>
              {g.rubric.map((r,i)=>{
                const pct = r.max ? (Number(r.points)||0)/Number(r.max) : 0;
                return (
                  <div key={i} style={{ marginBottom:9 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5 }}>
                      <span style={{ fontWeight:600, color:'#333' }}>{r.name}</span>
                      <span style={{ fontWeight:700, color:C.navy, fontVariantNumeric:'tabular-nums' }}>{r.points}/{r.max}</span>
                    </div>
                    <div style={{ height:5, background:'#E5E7EB', borderRadius:3, overflow:'hidden', margin:'3px 0' }}>
                      <div style={{ height:'100%', width:`${Math.min(100,pct*100)}%`, background: pct>=0.9?C.green:pct>=0.75?C.gold:C.red }} />
                    </div>
                    <div style={{ fontSize:12, color:C.muted, lineHeight:1.4 }}>{r.comment}</div>
                  </div>
                );
              })}
            </div>
          )}
          {(g.strengths?.length>0 || g.improvements?.length>0) && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:10, margin:'12px 0' }}>
              {g.strengths?.length>0 && <div style={{ fontSize:12.5, color:'#333' }}><strong style={{ color:C.green }}>Strengths:</strong> {g.strengths.join('; ')}</div>}
              {g.improvements?.length>0 && <div style={{ fontSize:12.5, color:'#333' }}><strong style={{ color:C.yellow }}>Next:</strong> {g.improvements.join('; ')}</div>}
            </div>
          )}
          {g.parentNote && <div style={{ fontSize:12.5, color:'#334155', margin:'8px 0', fontStyle:'italic' }}>Note: {g.parentNote}</div>}

          {!edit ? (
            <div style={{ display:'flex', gap:8, marginTop:12 }}>
              <Btn onClick={()=>setEdit(true)} style={{ background:'#E8EEF4', color:C.navy, fontSize:12 }}>Edit</Btn>
              <Btn onClick={del} style={{ background:'#FEE2E2', color:C.red, fontSize:12 }}>Delete</Btn>
            </div>
          ) : (
            <div style={{ marginTop:12, background:'#F8FAFC', border:`1px solid ${C.border}`, borderRadius:8, padding:12 }}>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:10 }}>
                <div><label style={lbl}>Score (%)</label><input type="number" min={0} max={100} value={score} onChange={e=>setScore(parseInt(e.target.value)||0)} style={{ ...inp, width:80 }} /></div>
                <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:8, fontSize:13, fontWeight:700, color:gradeColor(score) }}>= {pctToLetter(score)}</div>
                <div><label style={lbl}>Type</label><select value={kind} onChange={e=>setKind(e.target.value)} style={{ ...inp, width:'auto' }}>{KIND_OPTIONS.map(k=><option key={k} value={k}>{k}</option>)}</select></div>
                <div><label style={lbl}>Weight</label><input type="number" min={0} step={0.5} value={weight} onChange={e=>setWeight(parseFloat(e.target.value)||1)} style={{ ...inp, width:70 }} /></div>
              </div>
              <div style={{ marginBottom:10 }}>
                <label style={lbl}>Standing</label>
                <select value={bench} onChange={e=>setBench(e.target.value)} style={{ ...inp, width:'auto' }}>
                  <option value="">— none —</option>
                  {Object.keys(BENCH).map(k => <option key={k} value={k}>{BENCH[k].label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:10 }}><label style={lbl}>Note</label><input value={note} onChange={e=>setNote(e.target.value)} style={{ ...inp, width:'100%' }} /></div>
              <div style={{ display:'flex', gap:8 }}>
                <Btn onClick={save} style={{ background:C.green, color:'white', fontSize:12 }}>Save</Btn>
                <Btn onClick={()=>setEdit(false)} style={{ background:'#E8EEF4', color:C.muted, fontSize:12 }}>Cancel</Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
