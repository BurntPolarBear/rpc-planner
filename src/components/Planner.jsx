import { useState, useMemo } from 'react';
import { TODAY, addDays, getMon, shortDate, toDate, uid, weekDays, weekLabel } from '../utils/dates';
import { Btn, C, card, inp, lbl } from '../utils/theme';


// ─── PLANNER ─────────────────────────────────────────────────────────────────
export function Planner({ db, mut, weekMon, setWk, activeGG, setActiveGG }) {
  const [showQS, setQS]     = useState(false);
  const [showBulk, setBulk] = useState(false);
  const [showBreak, setBreak] = useState(false);
  const [selected, setSel]  = useState(null); // { date, subjectId }
  const gg      = db.gradeGroups.find(g => g.id===activeGG);
  const planKey = `${activeGG}:${weekMon}`;
  const days    = weekDays(weekMon);
  const students = db.students.filter(s => s.gradeGroupId===activeGG);
  const templates = db.templates || [];

  // Derived selected state
  const selLesson = selected
    ? (db.plans[planKey]?.[selected.date]||[]).find(l=>l.subjectId===selected.subjectId)
    : null;
  const selSubj = selected ? gg?.subjects.find(s=>s.id===selected.subjectId) : null;

  const handleSelect = (date, subjectId) => {
    const isSame = selected?.date===date && selected?.subjectId===subjectId;
    setSel(isSame ? null : { date, subjectId });
    if (!isSame) setQS(false);
  };

  const saveTemplate = tmpl => mut(d => {
    if (!d.templates) d.templates = [];
    d.templates.push({ id: uid(), createdAt: TODAY, ...tmpl });
  });

  const shiftWk = delta => {
    const d = new Date(weekMon+'T12:00:00'); d.setDate(d.getDate()+delta*7); setWk(toDate(d));
  };

  const maxForSubject = (d, sid) => {
    let max = 0;
    Object.values(d.plans).forEach(wk => Object.values(wk).forEach(ls => ls.forEach(l => { if(l.subjectId===sid && l.lessonNum>max) max=l.lessonNum; })));
    return max;
  };

  const copyLastWeek = () => {
    const prevMon  = (() => { const d=new Date(weekMon+'T12:00:00'); d.setDate(d.getDate()-7); return toDate(d); })();
    const prevKey  = `${activeGG}:${prevMon}`;
    const prevDays = weekDays(prevMon);
    mut(d => {
      const prev = d.plans[prevKey]||{};
      if(!d.plans[planKey]) d.plans[planKey]={};
      const maxBySub={}, counters={};
      Object.values(d.plans).forEach(wk=>Object.values(wk).forEach(ls=>ls.forEach(l=>{
        if(!maxBySub[l.subjectId]||l.lessonNum>maxBySub[l.subjectId]) maxBySub[l.subjectId]=l.lessonNum;
      })));
      days.forEach((day, i) => {
        const prevLessons = prev[prevDays[i]]||[];
        if(prevLessons.length>0 && !(d.plans[planKey][day]?.length)) {
          d.plans[planKey][day]=prevLessons.map(l => {
            counters[l.subjectId]=(counters[l.subjectId]||0)+1;
            const base=maxBySub[l.subjectId]||(gg?.subjects.find(s=>s.id===l.subjectId)?.startLesson-1)||0;
            return { subjectId:l.subjectId, lessonNum:base+counters[l.subjectId], questions:[], tasks:l.tasks||[] };
          });
        }
      });
    });
  };

  return (
    <div>
      {/* Grade tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {db.gradeGroups.map(g => (
          <Btn key={g.id} onClick={()=>setActiveGG(g.id)} style={{ background:activeGG===g.id?C.navy:'white', color:activeGG===g.id?'white':C.muted, border:`1px solid ${C.border}` }}>{g.name}</Btn>
        ))}
      </div>

      {/* Week nav */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <Btn onClick={()=>shiftWk(-1)} style={{ background:'white', border:`1px solid ${C.border}`, color:'#333', padding:'7px 12px' }}>←</Btn>
        <span style={{ fontWeight:700, color:C.navy, fontSize:14 }}>{weekLabel(weekMon)}</span>
        <Btn onClick={()=>shiftWk(1)} style={{ background:'white', border:`1px solid ${C.border}`, color:'#333', padding:'7px 12px' }}>→</Btn>
        <Btn onClick={()=>setWk(getMon(TODAY))} style={{ background:'white', border:`1px solid ${C.border}`, color:C.muted, fontSize:12 }}>This week</Btn>
        <div style={{ marginLeft:'auto', display:'flex', gap:8, flexWrap:'wrap' }}>
          <Btn onClick={copyLastWeek} style={{ background:'white', border:`1px solid ${C.border}`, color:'#333' }}>📋 Copy Last Week</Btn>
          <Btn onClick={()=>{ setQS(true); setBulk(false); setBreak(false); setSel(null); }} style={{ background:C.gold, color:'white' }}>⚡ Quick Schedule</Btn>
          <Btn onClick={()=>{ setBulk(true); setQS(false); setBreak(false); setSel(null); }} style={{ background:C.navy, color:'white' }}>📚 Plan Course</Btn>
          <Btn onClick={()=>{ setBreak(true); setQS(false); setBulk(false); setSel(null); }} style={{ background:'white', border:`1px solid ${C.border}`, color:'#333' }}>🏖 Take a Break</Btn>
        </div>
      </div>

      {/* Banner */}
      <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#1E40AF' }}>
        📌 One plan covers <strong>all students in {gg?.name}</strong>: {students.map(s=>s.name).join(' & ')} — plan once, done for both.
      </div>

      {/* Day grid */}
      <div style={{ overflowX:'auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, minmax(122px, 1fr))', gap:8, minWidth:880 }}>
          {days.map(date => (
            <DayColumn key={date} date={date} gg={gg} isToday={date===TODAY}
              lessons={db.plans[planKey]?.[date]||[]}
              selectedSubjectId={selected?.date===date ? selected?.subjectId : null}
              onSelect={sid => handleSelect(date, sid)}
              onAdd={sid => mut(d => {
                if(!d.plans[planKey]) d.plans[planKey]={};
                if(!d.plans[planKey][date]) d.plans[planKey][date]=[];
                if(!d.plans[planKey][date].find(l=>l.subjectId===sid)) {
                  const mx=maxForSubject(d,sid);
                  const startL=gg?.subjects.find(s=>s.id===sid)?.startLesson||1;
                  d.plans[planKey][date].push({subjectId:sid, lessonNum:mx>0?mx+1:startL, questions:[], tasks:[]});
                }
              })}
            />
          ))}
        </div>
      </div>

      {/* Full-width lesson editor — opens below the grid when a lesson is selected */}
      {selLesson && selSubj && (
        <LessonEditorPanel
          key={`${selected.date}-${selected.subjectId}`}
          lesson={selLesson}
          subj={selSubj}
          date={selected.date}
          templates={templates}
          onSaveTemplate={saveTemplate}
          onSave={changes => mut(d => {
            const l = d.plans[planKey]?.[selected.date]?.find(x=>x.subjectId===selected.subjectId);
            if(l) Object.assign(l, changes);
          })}
          onRemove={() => {
            mut(d => {
              if(d.plans[planKey]?.[selected.date])
                d.plans[planKey][selected.date] = d.plans[planKey][selected.date].filter(l=>l.subjectId!==selected.subjectId);
            });
            setSel(null);
          }}
          onClose={() => setSel(null)}
        />
      )}

      {showQS && <QuickSchedule gg={gg} db={db} planKey={planKey} days={days} mut={mut} onClose={()=>setQS(false)} />}
      {showBulk && <BulkPlanPanel gg={gg} db={db} activeGG={activeGG} startMon={weekMon} mut={mut} onClose={()=>setBulk(false)} onJump={setWk} />}
      {showBreak && <BreakPanel gg={gg} db={db} activeGG={activeGG} startMon={weekMon} mut={mut} onClose={()=>setBreak(false)} onJump={setWk} />}
    </div>
  );
}


// ─── DAY COLUMN ───────────────────────────────────────────────────────────────
function DayColumn({ date, gg, lessons, isToday, selectedSubjectId, onSelect, onAdd }) {
  const d = new Date(date+'T12:00:00');
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const notAdded = (gg?.subjects||[]).filter(s=>!lessons.find(l=>l.subjectId===s.id));

  const bg     = isToday ? '#FEFCE8' : isWeekend ? '#F8F8F8' : 'white';
  const border = isToday ? `2px solid ${C.gold}` : isWeekend ? `1px solid #E0E0E0` : `1px solid ${C.border}`;
  const dayColor = isToday ? C.gold : isWeekend ? '#A0A0A0' : C.navy;

  return (
    <div style={{ background:bg, border, borderRadius:12, padding:11, minHeight:160 }}>
      <div style={{ marginBottom:9, display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:12, color:dayColor }}>{d.toLocaleDateString('en-US',{weekday:'short'})}</div>
          <div style={{ fontSize:11, color:C.muted }}>{d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
        </div>
        {isWeekend && lessons.length===0 && <span style={{ fontSize:9, color:'#ccc' }}>optional</span>}
      </div>

      {lessons.map(lesson => {
        const subj = gg?.subjects.find(s=>s.id===lesson.subjectId);
        if(!subj) return null;
        const isSel = selectedSubjectId === lesson.subjectId;
        return (
          <div key={lesson.subjectId}
            onClick={()=>onSelect(lesson.subjectId)}
            style={{
              borderLeft:`3px solid ${subj.color}`, padding:'5px 7px', marginBottom:5,
              cursor:'pointer', borderRadius:'0 6px 6px 0',
              background: isSel ? subj.color+'1A' : 'transparent',
              outline: isSel ? `1.5px solid ${subj.color}60` : 'none',
              transition:'background .1s',
            }}
          >
            <div style={{ fontSize:11, fontWeight:700, color:'#333' }}>{subj.icon} {subj.name}</div>
            <div style={{ fontSize:10, color:C.muted }}>L{lesson.lessonNum}{lesson.tasks?.length ? ` · ${lesson.tasks.length}T` : ''} · {lesson.questions?.length||0}Q</div>
          </div>
        );
      })}

      {notAdded.length>0 && (
        <div style={{ marginTop:7, paddingTop:lessons.length?7:0, borderTop:lessons.length?`1px dashed ${C.border}`:'none' }}>
          <div style={{ fontSize:9, color:'#ccc', marginBottom:3 }}>ADD</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
            {notAdded.map(s=>(
              <button key={s.id} onClick={()=>onAdd(s.id)} title={`Add ${s.name}`}
                style={{ fontSize:13, background:'none', border:`1px dashed ${s.color}60`, borderRadius:5, cursor:'pointer', padding:'2px 5px', opacity:.65 }}>
                {s.icon}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── LESSON EDITOR PANEL ─────────────────────────────────────────────────────
function LessonEditorPanel({ lesson, subj, date, templates, onSaveTemplate, onSave, onRemove, onClose }) {
  const [num, setNum]     = useState(lesson.lessonNum);
  const [qt, setQt]       = useState((lesson.questions||[]).join('\n'));
  const [tt, setTt]       = useState((lesson.tasks||[]).join('\n'));
  const [notes, setNotes] = useState(lesson.notes||'');
  const [showTmpl, setST] = useState(false);
  const [showSave, setSV] = useState(false);
  const [tmplName, setTN] = useState(`${subj?.name||'Lesson'} questions`);
  const [flash, setFlash] = useState(false);
  const [tmplFlash, setTF]= useState(false);

  // AI question drafting
  const [showAI, setShowAI]   = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiCount, setAiCount] = useState(4);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const generateQuestions = async () => {
    if (!aiInput.trim()) { setAiError('Enter a lesson summary or topic first.'); return; }
    setAiLoading(true); setAiError(null);
    try {
      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ summary: aiInput, subject: subj?.name || '', count: aiCount }),
      });
      const data = await res.json();
      if (!res.ok) { setAiError(data.error || 'Something went wrong.'); setAiLoading(false); return; }
      const drafted = (data.questions || []).join('\n');
      // Append to existing questions if any, else fill
      setQt(prev => prev.trim() ? `${prev.trim()}\n${drafted}` : drafted);
      setShowAI(false); setAiInput('');
    } catch {
      setAiError('Could not reach the AI. Check your connection and try again.');
    }
    setAiLoading(false);
  };

  const questions = qt.split('\n').map(q=>q.trim()).filter(Boolean);
  const tasks     = tt.split('\n').map(t=>t.trim()).filter(Boolean);

  const handleSave = () => {
    onSave({ lessonNum:num, questions, tasks, notes });
    setFlash(true); setTimeout(()=>setFlash(false), 1800);
  };
  const handleSaveTmpl = () => {
    onSaveTemplate({ name:tmplName, hint:subj?.name||'', questions });
    setSV(false); setTF(true); setTimeout(()=>setTF(false), 2000);
  };

  const dayLabel = new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});

  return (
    <div style={{ ...card, marginTop:12, borderTop:`3px solid ${subj?.color||C.navy}`, padding:20 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:9, background:`${subj?.color}18`, border:`1.5px solid ${subj?.color}60`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{subj?.icon}</div>
          <div>
            <div style={{ fontWeight:700, fontSize:15, color:C.navy }}>{subj?.name}</div>
            <div style={{ fontSize:12, color:C.muted }}>{dayLabel}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:7, padding:'5px 12px', cursor:'pointer', fontSize:12, color:C.muted }}>✕ Close</button>
      </div>

      {/* Two-column layout (stacks on mobile via .lesson-editor-grid) */}
      <div className="lesson-editor-grid" style={{ display:'grid', gridTemplateColumns:'180px 1fr', gap:20 }}>
        {/* Left: controls */}
        <div>
          <label style={lbl}>Lesson #</label>
          <input type="number" value={num} onChange={e=>setNum(parseInt(e.target.value)||1)} style={{ ...inp, width:90, marginBottom:16 }} />

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <button onClick={()=>{setST(s=>!s);setSV(false);}} style={{
              fontSize:12, fontWeight:600, padding:'8px 12px', borderRadius:7, cursor:'pointer', textAlign:'left',
              border:`1px solid ${showTmpl ? C.navy : C.border}`,
              background: showTmpl ? C.navy : 'white', color: showTmpl ? 'white' : C.muted,
            }}>📋 {showTmpl ? 'Hide templates' : 'Use template'}</button>

            <button onClick={()=>{setSV(s=>!s);setST(false);}} style={{
              fontSize:12, fontWeight:600, padding:'8px 12px', borderRadius:7, cursor:'pointer', textAlign:'left',
              border:`1px solid ${showSave ? C.navy : C.border}`,
              background: tmplFlash ? C.green : showSave ? C.navy : 'white',
              color: tmplFlash || showSave ? 'white' : C.muted,
            }}>{tmplFlash ? '✓ Saved!' : '💾 Save as template'}</button>

            <button onClick={onRemove} style={{
              fontSize:12, fontWeight:600, padding:'8px 12px', borderRadius:7, cursor:'pointer', textAlign:'left',
              border:'1px solid #FECACA', background:'#FEF2F2', color:C.red,
            }}>✕ Remove lesson</button>
          </div>
        </div>

        {/* Right: questions + notes */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <label style={{ ...lbl, margin:0 }}>Questions — one per line</label>
            <button type="button" onClick={()=>{ setShowAI(v=>!v); setAiError(null); }} style={{
              background: showAI ? C.navy : '#EEF2FF', color: showAI ? 'white' : '#4338CA',
              border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:700, cursor:'pointer',
            }}>
              ✨ Draft with AI
            </button>
          </div>

          {showAI && (
            <div style={{ background:'#F5F3FF', border:'1px solid #DDD6FE', borderRadius:8, padding:12, marginBottom:12 }}>
              <label style={lbl}>Lesson summary or topic</label>
              <textarea value={aiInput} onChange={e=>setAiInput(e.target.value)}
                style={{ ...inp, width:'100%', minHeight:60, resize:'vertical', fontSize:13, display:'block', marginBottom:8 }}
                placeholder={"Paste a short summary of the lesson, or just the topic — e.g. 'The causes of the American Revolution: taxation without representation, the Boston Tea Party, and the Intolerable Acts.'"}
              />
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <label style={{ ...lbl, margin:0, whiteSpace:'nowrap' }}>How many</label>
                  <select value={aiCount} onChange={e=>setAiCount(parseInt(e.target.value))} style={{ ...inp, width:'auto', padding:'6px 8px' }}>
                    {[3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <button type="button" onClick={generateQuestions} disabled={aiLoading} style={{
                  background: aiLoading ? '#A5B4FC' : '#4F46E5', color:'white', border:'none', borderRadius:7,
                  padding:'8px 16px', fontSize:13, fontWeight:700, cursor: aiLoading ? 'default' : 'pointer',
                }}>
                  {aiLoading ? 'Drafting…' : '✨ Generate Questions'}
                </button>
                {qt.trim() && <span style={{ fontSize:11, color:C.muted }}>Adds to your existing questions</span>}
              </div>
              {aiError && <div style={{ marginTop:8, fontSize:12, color:C.red }}>{aiError}</div>}
            </div>
          )}

          <textarea value={qt} onChange={e=>setQt(e.target.value)}
            style={{ ...inp, width:'100%', minHeight:90, resize:'vertical', fontSize:13, display:'block', marginBottom:14 }}
            placeholder={"What was the main cause of...?\nWho was the key figure in...?\nDescribe the significance of..."}
          />
          <label style={lbl}>Tasks — one per line <span style={{ fontWeight:400, textTransform:'none', fontSize:11 }}>(student checks these off)</span></label>
          <textarea value={tt} onChange={e=>setTt(e.target.value)}
            style={{ ...inp, width:'100%', minHeight:64, resize:'vertical', fontSize:13, display:'block', marginBottom:14 }}
            placeholder={"Read pages 42–45\nWatch the lesson video\nComplete the worksheet"}
          />
          <label style={lbl}>Instructions for students <span style={{ fontWeight:400, textTransform:'none', fontSize:11 }}>(optional — not graded)</span></label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)}
            style={{ ...inp, width:'100%', minHeight:58, resize:'vertical', fontSize:13, display:'block' }}
            placeholder={"e.g. Watch the lesson video before answering. Use your textbook p.42–45."}
          />
        </div>
      </div>

      {/* Template picker — full width */}
      {showTmpl && (
        <div style={{ marginTop:14, background:'#F8F9FA', border:`1px solid ${C.border}`, borderRadius:9, padding:14 }}>
          <div style={{ fontSize:11, fontWeight:800, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Saved templates</div>
          {templates.length === 0 ? (
            <div style={{ fontSize:13, color:C.muted, padding:'8px 0' }}>No templates yet — type questions above and click 💾 Save as template.</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:8 }}>
              {templates.map(t => (
                <div key={t.id} style={{ background:'white', border:`1px solid ${C.border}`, borderRadius:8, padding:10 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:C.navy, marginBottom:2 }}>{t.name}</div>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>{t.questions.length}Q{t.hint?` · ${t.hint}`:''}</div>
                  <div style={{ fontSize:11, color:'#555', marginBottom:8, lineHeight:1.4 }}>{t.questions[0]?.slice(0,50)}{t.questions[0]?.length>50?'…':''}</div>
                  <button onClick={()=>{setQt(t.questions.join('\n'));setST(false);}} style={{ width:'100%', fontSize:12, fontWeight:700, padding:'6px 0', borderRadius:6, border:'none', background:C.navy, color:'white', cursor:'pointer' }}>
                    Use these questions
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save-as-template form — full width */}
      {showSave && (
        <div style={{ marginTop:14, background:'#F8F9FA', border:`1px solid ${C.border}`, borderRadius:9, padding:14 }}>
          <label style={lbl}>Template name</label>
          <div style={{ display:'flex', gap:8 }}>
            <input value={tmplName} onChange={e=>setTN(e.target.value)} style={{ ...inp, flex:1 }} autoFocus />
            <Btn onClick={handleSaveTmpl} style={{ background:C.green, color:'white', flexShrink:0 }}>Save</Btn>
            <Btn onClick={()=>setSV(false)} style={{ background:'#F0F4F8', color:C.muted, flexShrink:0 }}>Cancel</Btn>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${C.border}`, display:'flex', justifyContent:'flex-end' }}>
        <Btn onClick={handleSave} style={{ background:flash?C.green:C.navy, color:'white', padding:'9px 28px', fontSize:14, transition:'background .2s' }}>
          {flash ? '✓ Saved!' : 'Save lesson'}
        </Btn>
      </div>
    </div>
  );
}


// ─── QUICK SCHEDULE ───────────────────────────────────────────────────────────
function QuickSchedule({ gg, db, planKey, days, mut, onClose }) {
  const [cfg, setCfg] = useState(() => {
    const c = {};
    (gg?.subjects||[]).forEach(sub => {
      let max = 0;
      Object.values(db.plans).forEach(wk=>Object.values(wk).forEach(ls=>ls.forEach(l=>{ if(l.subjectId===sub.id&&l.lessonNum>max) max=l.lessonNum; })));
      c[sub.id] = { include:true, startLesson:max>0?max+1:(sub.startLesson||1), dayIdx:[0,1,2,3,4] };
    });
    return c;
  });

  const toggleDay = (sid, i) => setCfg(c => {
    const n=JSON.parse(JSON.stringify(c));
    const arr=n[sid].dayIdx;
    n[sid].dayIdx=arr.includes(i)?arr.filter(x=>x!==i):[...arr,i].sort((a,b)=>a-b);
    return n;
  });

  const apply = () => {
    mut(d => {
      if(!d.plans[planKey]) d.plans[planKey]={};
      (gg?.subjects||[]).forEach(sub => {
        const c=cfg[sub.id]; if(!c?.include) return;
        let n=c.startLesson;
        c.dayIdx.forEach(i => {
          const date=days[i];
          if(!d.plans[planKey][date]) d.plans[planKey][date]=[];
          if(!d.plans[planKey][date].find(l=>l.subjectId===sub.id)) d.plans[planKey][date].push({subjectId:sub.id,lessonNum:n,questions:[],tasks:[]});
          n++;
        });
      });
    });
    onClose();
  };

  return (
    <div style={{ background:'#F0F4F8', border:`1px solid ${C.border}`, borderRadius:12, padding:20, marginBottom:14 }}>
      <div style={{ fontFamily:'Georgia,serif', fontSize:18, fontWeight:'bold', color:C.navy, marginBottom:3 }}>⚡ Quick Schedule</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>{gg?.name} — Fill the whole week at once. Lesson numbers auto-increment day by day.</div>

      {(gg?.subjects||[]).map(sub => {
        const c=cfg[sub.id];
        return (
          <div key={sub.id} style={{ borderLeft:`3px solid ${sub.color}`, paddingLeft:12, marginBottom:16 }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginBottom:c.include?10:0 }}>
              <input type="checkbox" checked={c.include} onChange={e=>setCfg(cfg=>({...cfg,[sub.id]:{...cfg[sub.id],include:e.target.checked}}))} style={{ accentColor:sub.color, width:16, height:16 }} />
              <span style={{ fontWeight:700, fontSize:14 }}>{sub.icon} {sub.name}</span>
            </label>
            {c.include && (
              <div style={{ display:'flex', gap:16, alignItems:'flex-end', flexWrap:'wrap' }}>
                <div>
                  <label style={lbl}>Start at lesson</label>
                  <input type="number" value={c.startLesson}
                    onChange={e=>setCfg(cfg=>({...cfg,[sub.id]:{...cfg[sub.id],startLesson:parseInt(e.target.value)||1}}))}
                    style={{ ...inp, width:80 }}
                  />
                </div>
                <div>
                  <label style={lbl}>Days</label>
                  <div style={{ display:'flex', gap:4 }}>
                    {['M','T','W','Th','F','Sa','Su'].map((dl,i)=>(
                      <button key={i} onClick={()=>toggleDay(sub.id,i)} style={{
                        width:28, height:28, borderRadius:6, border:'none', cursor:'pointer', fontSize:11, fontWeight:700,
                        background:c.dayIdx.includes(i)?sub.color: i>=5 ? '#F0EDE8' : '#D1D9E0',
                        color:c.dayIdx.includes(i)?'white': i>=5 ? '#B0A89A' : C.muted,
                        transition:'all .1s'
                      }}>{dl}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display:'flex', gap:10, marginTop:8, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
        <Btn onClick={apply} style={{ background:C.navy, color:'white', flex:1, padding:'10px 0', fontSize:14 }}>Schedule Week</Btn>
        <Btn onClick={onClose} style={{ background:'#E8EEF4', color:C.muted }}>Cancel</Btn>
      </div>
    </div>
  );
}


// ─── BULK COURSE PLANNER ──────────────────────────────────────────────────────
function BulkPlanPanel({ gg, db, activeGG, startMon, mut, onClose, onJump }) {
  const DAY_LABELS = ['M','T','W','Th','F','Sa','Su']; // Monday-first, matches weekDays()

  const [startDate, setStartDate] = useState(startMon);
  const [mode, setMode]           = useState('weeks'); // 'weeks' | 'course'
  const [numWeeks, setNumWeeks]   = useState(12);
  const [result, setResult]       = useState(null); // { created, skipped, lastMon }

  const [cfg, setCfg] = useState(() => {
    const c = {};
    (gg?.subjects||[]).forEach(sub => {
      let max = 0;
      Object.values(db.plans).forEach(wk=>Object.values(wk).forEach(ls=>ls.forEach(l=>{ if(l.subjectId===sub.id&&l.lessonNum>max) max=l.lessonNum; })));
      c[sub.id] = { include:true, startLesson:max>0?max+1:(sub.startLesson||1), dayIdx:[0,1,2,3,4] };
    });
    return c;
  });

  const toggleDay = (sid, i) => setCfg(c => {
    const n = JSON.parse(JSON.stringify(c));
    const arr = n[sid].dayIdx;
    n[sid].dayIdx = arr.includes(i) ? arr.filter(x=>x!==i) : [...arr,i].sort((a,b)=>a-b);
    return n;
  });

  const setField = (sid, field, val) => setCfg(c => ({ ...c, [sid]: { ...c[sid], [field]: val } }));

  // Live preview of how many lessons each included subject will generate
  const preview = useMemo(() => {
    const startMonday = getMon(startDate);
    const weeksCap = mode === 'weeks' ? Math.min(Math.max(numWeeks,1), 52) : 52;
    let totalLessons = 0;
    const perSubject = {};

    (gg?.subjects||[]).forEach(sub => {
      const c = cfg[sub.id];
      if (!c?.include || c.dayIdx.length===0) { perSubject[sub.id]=0; return; }
      const total = sub.totalLessons ?? 180;
      let lessonNum = c.startLesson;
      let count = 0;
      for (let w=0; w<weeksCap; w++) {
        const mon = new Date(startMonday+'T12:00:00'); mon.setDate(mon.getDate()+w*7);
        const wkDays = weekDays(toDate(mon));
        for (const i of c.dayIdx) {
          const date = wkDays[i];
          if (date < startDate) continue;
          if (mode==='course' && lessonNum > total) break;
          count++; lessonNum++;
        }
        if (mode==='course' && lessonNum > total) break;
      }
      perSubject[sub.id] = count;
      totalLessons += count;
    });
    return { totalLessons, perSubject };
  }, [cfg, startDate, mode, numWeeks, gg]);

  const apply = () => {
    const startMonday = getMon(startDate);
    const weeksCap = mode === 'weeks' ? Math.min(Math.max(numWeeks,1), 52) : 52;
    let created = 0, skipped = 0, lastMon = startMonday;

    mut(d => {
      const counters = {};
      (gg?.subjects||[]).forEach(sub => { if (cfg[sub.id]?.include) counters[sub.id] = cfg[sub.id].startLesson; });

      for (let w=0; w<weeksCap; w++) {
        const monDate = new Date(startMonday+'T12:00:00'); monDate.setDate(monDate.getDate()+w*7);
        const mon = toDate(monDate);
        const wkKey = `${activeGG}:${mon}`;
        const wkDays = weekDays(mon);
        let anyRemaining = false;

        (gg?.subjects||[]).forEach(sub => {
          const c = cfg[sub.id];
          if (!c?.include || c.dayIdx.length===0) return;
          const total = sub.totalLessons ?? 180;
          c.dayIdx.forEach(i => {
            const date = wkDays[i];
            if (date < startDate) return;
            if (mode==='course' && counters[sub.id] > total) return;
            if (!d.plans[wkKey]) d.plans[wkKey] = {};
            if (!d.plans[wkKey][date]) d.plans[wkKey][date] = [];
            const exists = d.plans[wkKey][date].find(l => l.subjectId===sub.id);
            if (exists) { skipped++; return; }
            d.plans[wkKey][date].push({ subjectId:sub.id, lessonNum:counters[sub.id], questions:[], tasks:[] });
            counters[sub.id]++; created++;
            lastMon = mon;
          });
          if (mode==='course' && counters[sub.id] <= total) anyRemaining = true;
        });

        if (mode==='course' && !anyRemaining && w>0) break;
      }
    });

    setResult({ created, skipped, lastMon });
  };

  const anyIncluded = (gg?.subjects||[]).some(s => cfg[s.id]?.include && cfg[s.id]?.dayIdx.length>0);

  return (
    <div style={{ background:'#F0F4F8', border:`1px solid ${C.border}`, borderRadius:12, padding:20, marginBottom:14 }}>
      <div style={{ fontFamily:'Georgia,serif', fontSize:18, fontWeight:'bold', color:C.navy, marginBottom:3 }}>📚 Plan a Whole Course</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>
        {gg?.name} — Lay out lessons across many weeks at once. Numbers auto-increment across the span. Days that already have a lesson for a subject are skipped, so this is safe to run over existing plans.
      </div>

      {result ? (
        <div>
          <div style={{ background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:10, padding:'14px 16px', marginBottom:14 }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.green, marginBottom:4 }}>✅ Scheduled {result.created} lesson{result.created!==1?'s':''}!</div>
            <div style={{ fontSize:13, color:'#166534' }}>
              {result.skipped>0 && `${result.skipped} day(s) already had a lesson and were left untouched. `}
              The plan now runs through the week of {shortDate(result.lastMon)}.
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <Btn onClick={()=>{ onJump(result.lastMon); onClose(); }} style={{ background:C.navy, color:'white', flex:1 }}>Jump to last week →</Btn>
            <Btn onClick={onClose} style={{ background:'#E8EEF4', color:C.muted }}>Done</Btn>
          </div>
        </div>
      ) : (
        <>
          {/* Span controls */}
          <div style={{ background:'white', borderRadius:10, padding:14, marginBottom:16, border:`1px solid ${C.border}` }}>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-end', marginBottom:14 }}>
              <div>
                <label style={lbl}>Start date</label>
                <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} style={{ ...inp }} />
              </div>
            </div>
            <label style={lbl}>How far to schedule</label>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
              <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:14 }}>
                <input type="radio" checked={mode==='weeks'} onChange={()=>setMode('weeks')} style={{ accentColor:C.navy, width:16, height:16 }} />
                Next
                <input type="number" min={1} max={52} value={numWeeks} disabled={mode!=='weeks'}
                  onChange={e=>setNumWeeks(Math.min(Math.max(parseInt(e.target.value)||1,1),52))}
                  style={{ ...inp, width:64, opacity: mode==='weeks'?1:0.5 }} />
                weeks
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:14 }}>
                <input type="radio" checked={mode==='course'} onChange={()=>setMode('course')} style={{ accentColor:C.navy, width:16, height:16 }} />
                Through end of course <span style={{ color:C.muted, fontSize:12 }}>(uses each subject's Total)</span>
              </label>
            </div>
          </div>

          {/* Per-subject config */}
          {(gg?.subjects||[]).map(sub => {
            const c = cfg[sub.id];
            const cnt = preview.perSubject[sub.id] || 0;
            return (
              <div key={sub.id} style={{ borderLeft:`3px solid ${sub.color}`, paddingLeft:12, marginBottom:16 }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginBottom:c.include?10:0 }}>
                  <input type="checkbox" checked={c.include} onChange={e=>setField(sub.id,'include',e.target.checked)} style={{ accentColor:sub.color, width:16, height:16 }} />
                  <span style={{ fontWeight:700, fontSize:14 }}>{sub.icon} {sub.name}</span>
                  {c.include && <span style={{ fontSize:12, color:C.muted, marginLeft:'auto' }}>{cnt} lesson{cnt!==1?'s':''} · through L{(c.startLesson+cnt-1)>0?c.startLesson+cnt-1:c.startLesson}</span>}
                </label>
                {c.include && (
                  <div style={{ display:'flex', gap:16, alignItems:'flex-end', flexWrap:'wrap' }}>
                    <div>
                      <label style={lbl}>Start at lesson</label>
                      <input type="number" value={c.startLesson} onChange={e=>setField(sub.id,'startLesson',parseInt(e.target.value)||1)} style={{ ...inp, width:80 }} />
                    </div>
                    <div>
                      <label style={lbl}>Total in course</label>
                      <input type="number" value={sub.totalLessons ?? 180} disabled style={{ ...inp, width:80, opacity:0.6 }} />
                    </div>
                    <div>
                      <label style={lbl}>Days per week</label>
                      <div style={{ display:'flex', gap:4 }}>
                        {DAY_LABELS.map((dl,i)=>(
                          <button key={i} onClick={()=>toggleDay(sub.id,i)} style={{
                            width:28, height:28, borderRadius:6, border:'none', cursor:'pointer', fontSize:11, fontWeight:700,
                            background:c.dayIdx.includes(i)?sub.color: i>=5 ? '#F0EDE8' : '#D1D9E0',
                            color:c.dayIdx.includes(i)?'white': i>=5 ? '#B0A89A' : C.muted,
                          }}>{dl}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Summary + actions */}
          <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#1E40AF' }}>
            This will create <strong>{preview.totalLessons}</strong> lesson{preview.totalLessons!==1?'s':''} across your selected subjects.
            {mode==='course' && ' Scheduling continues until each subject reaches its course total.'}
          </div>

          <div style={{ display:'flex', gap:10, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
            <Btn onClick={apply} disabled={!anyIncluded || preview.totalLessons===0} style={{ background: anyIncluded && preview.totalLessons>0 ? C.navy : '#9CA3AF', color:'white', flex:1, padding:'10px 0', fontSize:14 }}>
              Schedule {preview.totalLessons} Lesson{preview.totalLessons!==1?'s':''}
            </Btn>
            <Btn onClick={onClose} style={{ background:'#E8EEF4', color:C.muted }}>Cancel</Btn>
          </div>
        </>
      )}
    </div>
  );
}


// ─── TAKE A BREAK (INSERT VACATION) ───────────────────────────────────────────
function BreakPanel({ gg, db, activeGG, startMon, mut, onClose, onJump }) {
  const [breakMon, setBreakMon] = useState(startMon);
  const [weeks, setWeeks]       = useState(1);
  const [applyAll, setApplyAll] = useState(true);
  const [result, setResult]     = useState(null);

  const breakMonday = getMon(breakMon); // normalize to that week's Monday

  // Preview how much will move
  const preview = useMemo(() => {
    const prefixes = applyAll ? db.gradeGroups.map(g=>g.id+':') : [activeGG+':'];
    let weeksAffected = 0, lessonsAffected = 0;
    prefixes.forEach(prefix => {
      Object.keys(db.plans).forEach(key => {
        if (!key.startsWith(prefix)) return;
        const monday = key.slice(prefix.length);
        if (monday >= breakMonday) {
          const wk = db.plans[key];
          const n = Object.values(wk).reduce((a,ls)=>a+ls.length,0);
          if (n>0) { weeksAffected++; lessonsAffected += n; }
        }
      });
    });
    return { weeksAffected, lessonsAffected };
  }, [db, breakMonday, applyAll, activeGG]);

  const apply = () => {
    const shiftDays = weeks * 7;
    const prefixes = applyAll ? db.gradeGroups.map(g=>g.id+':') : [activeGG+':'];
    let lessonsShifted = 0;

    mut(d => {
      prefixes.forEach(prefix => {
        const sources = Object.keys(d.plans).filter(k => k.startsWith(prefix) && k.slice(prefix.length) >= breakMonday);
        const moved = {};
        sources.forEach(key => {
          const monday = key.slice(prefix.length);
          const newKey = prefix + addDays(monday, shiftDays);
          const newWeek = {};
          Object.entries(d.plans[key]).forEach(([date, lessons]) => {
            newWeek[addDays(date, shiftDays)] = lessons;
            lessonsShifted += lessons.length;
          });
          moved[newKey] = newWeek;
        });
        sources.forEach(key => delete d.plans[key]);
        Object.entries(moved).forEach(([k, wk]) => { d.plans[k] = wk; });
      });
    });

    setResult({ lessonsShifted, resumeWeek: addDays(breakMonday, shiftDays) });
  };

  return (
    <div style={{ background:'#F0F4F8', border:`1px solid ${C.border}`, borderRadius:12, padding:20, marginBottom:14 }}>
      <div style={{ fontFamily:'Georgia,serif', fontSize:18, fontWeight:'bold', color:C.navy, marginBottom:3 }}>🏖 Take a Break</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>
        Going on vacation? Instead of deleting lessons (which leaves a gap in the sequence), insert a break — every lesson from that week onward slides later, so nothing is lost and the lesson order stays intact.
      </div>

      {result ? (
        <div>
          <div style={{ background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:10, padding:'14px 16px', marginBottom:14 }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.green, marginBottom:4 }}>✅ Break added!</div>
            <div style={{ fontSize:13, color:'#166534' }}>
              Moved {result.lessonsShifted} lesson{result.lessonsShifted!==1?'s':''} forward. Lessons now resume the week of {shortDate(result.resumeWeek)}.
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <Btn onClick={()=>{ onJump(getMon(result.resumeWeek)); onClose(); }} style={{ background:C.navy, color:'white', flex:1 }}>Jump to resume week →</Btn>
            <Btn onClick={onClose} style={{ background:'#E8EEF4', color:C.muted }}>Done</Btn>
          </div>
        </div>
      ) : (
        <>
          <div style={{ background:'white', borderRadius:10, padding:14, marginBottom:14, border:`1px solid ${C.border}` }}>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-end', marginBottom:14 }}>
              <div>
                <label style={lbl}>Break starts the week of</label>
                <input type="date" value={breakMon} onChange={e=>setBreakMon(e.target.value)} style={{ ...inp }} />
                <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>Week of {shortDate(breakMonday)}</div>
              </div>
              <div>
                <label style={lbl}>How many weeks off</label>
                <input type="number" min={1} max={12} value={weeks}
                  onChange={e=>setWeeks(Math.min(Math.max(parseInt(e.target.value)||1,1),12))}
                  style={{ ...inp, width:80 }} />
              </div>
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14 }}>
              <input type="checkbox" checked={applyAll} onChange={e=>setApplyAll(e.target.checked)} style={{ accentColor:C.navy, width:16, height:16 }} />
              Apply to all grade groups <span style={{ color:C.muted, fontSize:12 }}>(a family vacation affects everyone)</span>
            </label>
          </div>

          <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#9A3412' }}>
            {preview.lessonsAffected > 0
              ? <>This will move <strong>{preview.lessonsAffected} lesson{preview.lessonsAffected!==1?'s':''}</strong> across {preview.weeksAffected} week{preview.weeksAffected!==1?'s':''} forward by {weeks} week{weeks!==1?'s':''}. Already-recorded student work stays on its original date.</>
              : <>No planned lessons on or after that week{applyAll?'':' in this grade group'} — nothing to move yet.</>}
          </div>

          <div style={{ display:'flex', gap:10, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
            <Btn onClick={apply} disabled={preview.lessonsAffected===0} style={{ background: preview.lessonsAffected>0 ? C.navy : '#9CA3AF', color:'white', flex:1, padding:'10px 0', fontSize:14 }}>
              Insert {weeks}-Week Break
            </Btn>
            <Btn onClick={onClose} style={{ background:'#E8EEF4', color:C.muted }}>Cancel</Btn>
          </div>
        </>
      )}
    </div>
  );
}
