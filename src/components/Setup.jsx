import { useState, useRef } from 'react';
import { ACT_COLORS, DAY_LABELS } from '../utils/constants';
import { toDate, uid } from '../utils/dates';
import { Btn, C, card, inp, lbl } from '../utils/theme';


// ─── SETUP ────────────────────────────────────────────────────────────────────
export function Setup({ db, mut }) {
  const [tab, setTab] = useState('students');
  return (
    <div>
      <div style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:'bold', color:C.navy, marginBottom:16 }}>Settings</div>
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {[['students','👤 Students'],['courses','📚 Courses'],['templates','📋 Templates'],['activities','🏃 Activities'],['pin','🔒 Parent PIN'],['backup','💾 Backup']].map(([id,label])=>(
          <Btn key={id} onClick={()=>setTab(id)} style={{ background:tab===id?C.navy:'white', color:tab===id?'white':C.muted, border:`1px solid ${C.border}` }}>{label}</Btn>
        ))}
      </div>
      {tab==='students'   && <StudentsTab db={db} mut={mut} />}
      {tab==='courses'    && <CoursesTab db={db} mut={mut} />}
      {tab==='templates'  && <TemplatesTab db={db} mut={mut} />}
      {tab==='activities' && <ActivitiesTab db={db} mut={mut} />}
      {tab==='pin'        && <PinTab db={db} mut={mut} />}
      {tab==='backup'     && <BackupTab db={db} mut={mut} />}
    </div>
  );
}


function ActivitiesTab({ db, mut }) {
  const [stuId, setStuId] = useState(db.students[0]?.id || '');
  const activities = (db.activities||[]).filter(a => a.studentId === stuId);

  const addActivity = () => mut(d => {
    if (!d.activities) d.activities = [];
    d.activities.push({ id:uid(), studentId:stuId, name:'New Activity', emoji:'📌', color:ACT_COLORS[d.activities.length % ACT_COLORS.length], days:[], time:'', location:'', notes:'' });
  });

  const updateAct = (id, field, val) => mut(d => {
    const a = (d.activities||[]).find(x => x.id===id); if (a) a[field] = val;
  });

  const toggleDay = (id, dow) => mut(d => {
    const a = (d.activities||[]).find(x => x.id===id); if (!a) return;
    a.days = a.days.includes(dow) ? a.days.filter(x=>x!==dow) : [...a.days, dow].sort((x,y)=>x-y);
  });

  const deleteAct = id => mut(d => { d.activities = (d.activities||[]).filter(x=>x.id!==id); });

  return (
    <div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>
        Activities are per-student and repeat on the same days each week. They show up on each student's daily view.
      </div>

      {/* Student selector */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {db.students.map(s => (
          <button key={s.id} onClick={() => setStuId(s.id)} style={{
            ...inp, cursor:'pointer', fontWeight: stuId===s.id ? 700 : 400,
            background: stuId===s.id ? C.navy : 'white',
            color: stuId===s.id ? 'white' : C.text,
            border: `1px solid ${stuId===s.id ? C.navy : C.border}`,
            padding:'7px 14px', borderRadius:8,
          }}>
            {s.emoji} {s.name}
          </button>
        ))}
      </div>

      {activities.length === 0 && (
        <div style={{ ...card, textAlign:'center', padding:32, color:C.muted, marginBottom:14 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>🏃</div>
          <div style={{ fontSize:14 }}>No activities yet for this student.</div>
        </div>
      )}

      {activities.map(a => (
        <div key={a.id} style={{ ...card, marginBottom:14, borderLeft:`4px solid ${a.color}` }}>
          {/* Row 1: emoji, name, color swatches, delete */}
          <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:12, flexWrap:'wrap' }}>
            <input value={a.emoji} maxLength={2}
              onChange={e => updateAct(a.id,'emoji',e.target.value)}
              style={{ ...inp, width:46, textAlign:'center', fontSize:20, padding:5, flexShrink:0 }} />
            <input value={a.name}
              onChange={e => updateAct(a.id,'name',e.target.value)}
              style={{ ...inp, flex:1, minWidth:120, fontWeight:600 }}
              placeholder="Activity name" />
            <div style={{ display:'flex', gap:4, flexShrink:0 }}>
              {ACT_COLORS.map(c => (
                <button key={c} onClick={() => updateAct(a.id,'color',c)} style={{
                  width:20, height:20, borderRadius:'50%', background:c, border:`2px solid ${a.color===c ? '#333' : 'transparent'}`,
                  cursor:'pointer', flexShrink:0,
                }} />
              ))}
            </div>
            <button onClick={() => deleteAct(a.id)} style={{ ...inp, cursor:'pointer', color:C.red, background:'#FEF2F2', border:'1px solid #FCA5A5', padding:'5px 10px', flexShrink:0 }}>✕</button>
          </div>

          {/* Row 2: days */}
          <div style={{ marginBottom:12 }}>
            <label style={lbl}>Repeats on</label>
            <div style={{ display:'flex', gap:5 }}>
              {DAY_LABELS.map((dl, i) => (
                <button key={i} onClick={() => toggleDay(a.id, i)} style={{
                  width:34, height:34, borderRadius:7, border:'none', cursor:'pointer',
                  fontSize:12, fontWeight:700,
                  background: (a.days||[]).includes(i) ? a.color : '#F0F4F8',
                  color: (a.days||[]).includes(i) ? 'white' : C.muted,
                  transition:'all .1s',
                }}>{dl}</button>
              ))}
            </div>
          </div>

          {/* Row 3: time + location */}
          <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap' }}>
            <div style={{ flex:'0 0 130px' }}>
              <label style={lbl}>Time</label>
              <input value={a.time||''} onChange={e => updateAct(a.id,'time',e.target.value)}
                style={{ ...inp, width:'100%' }} placeholder="e.g. 4:00 PM" />
            </div>
            <div style={{ flex:1, minWidth:160 }}>
              <label style={lbl}>Location</label>
              <input value={a.location||''} onChange={e => updateAct(a.id,'location',e.target.value)}
                style={{ ...inp, width:'100%' }} placeholder="e.g. Community Park" />
            </div>
          </div>

          {/* Row 4: notes */}
          <div>
            <label style={lbl}>Notes for student</label>
            <input value={a.notes||''} onChange={e => updateAct(a.id,'notes',e.target.value)}
              style={{ ...inp, width:'100%' }} placeholder="e.g. Bring cleats and water bottle" />
          </div>
        </div>
      ))}

      <Btn onClick={addActivity} style={{ background:C.navy, color:'white' }}>+ Add Activity</Btn>
    </div>
  );
}


// ─── BACKUP TAB ───────────────────────────────────────────────────────────────
function BackupTab({ db, mut }) {
  const [msg, setMsg]   = useState(null);
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef(null);

  const stats = {
    students:   db.students?.length || 0,
    lessons:    Object.values(db.plans||{}).reduce((a,wk)=>a+Object.values(wk).reduce((b,ls)=>b+ls.length,0),0),
    answers:    db.answers?.length || 0,
    templates:  db.templates?.length || 0,
    activities: db.activities?.length || 0,
  };

  const download = () => {
    const payload = { ...db, _backupDate: new Date().toISOString(), _version: 1 };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `rpc-planner-backup-${toDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg({ type:'ok', text:'Backup downloaded. Keep it somewhere safe.' });
    setTimeout(()=>setMsg(null), 4000);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.gradeGroups || !Array.isArray(parsed.students)) {
          setMsg({ type:'err', text:'That file doesn\'t look like a valid planner backup.' });
          return;
        }
        // Strip backup metadata before restoring
        const { _backupDate, _version, ...clean } = parsed;
        mut(d => { Object.keys(d).forEach(k => delete d[k]); Object.assign(d, clean); });
        setMsg({ type:'ok', text:'Backup restored successfully! All data has been replaced.' });
        setConfirm(false);
        setTimeout(()=>setMsg(null), 5000);
      } catch {
        setMsg({ type:'err', text:'Couldn\'t read that file — is it a valid backup?' });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // allow re-selecting same file
  };

  return (
    <div style={{ maxWidth:520 }}>
      {/* Download */}
      <div style={{ ...card, marginBottom:16 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.navy, marginBottom:6 }}>Download a backup</div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:16, lineHeight:1.6 }}>
          Saves everything — students, courses, lesson plans, answers, templates, and activities — to a single file on your device. Do this before any big change, or every so often for peace of mind.
        </div>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:16, fontSize:12, color:C.muted }}>
          <span><strong style={{ color:C.navy }}>{stats.students}</strong> students</span>
          <span><strong style={{ color:C.navy }}>{stats.lessons}</strong> lessons</span>
          <span><strong style={{ color:C.navy }}>{stats.answers}</strong> submissions</span>
          <span><strong style={{ color:C.navy }}>{stats.templates}</strong> templates</span>
          <span><strong style={{ color:C.navy }}>{stats.activities}</strong> activities</span>
        </div>
        <Btn onClick={download} style={{ background:C.navy, color:'white', width:'100%', padding:'11px 0' }}>
          💾 Download Backup File
        </Btn>
      </div>

      {/* Restore */}
      <div style={{ ...card, border:`1px solid #FCA5A5` }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.navy, marginBottom:6 }}>Restore from a backup</div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:16, lineHeight:1.6 }}>
          Replaces <strong>all current data</strong> with the contents of a backup file. This affects both families since everyone shares the same database — use it carefully.
        </div>

        {!confirm ? (
          <Btn onClick={()=>setConfirm(true)} style={{ background:'#FEF2F2', color:C.red, border:'1px solid #FCA5A5', width:'100%', padding:'11px 0' }}>
            ↺ Restore from File…
          </Btn>
        ) : (
          <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:8, padding:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.red, marginBottom:10 }}>
              This will overwrite everything currently in the app. Are you sure?
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <Btn onClick={()=>fileRef.current?.click()} style={{ background:C.red, color:'white', flex:1 }}>
                Yes, choose backup file
              </Btn>
              <Btn onClick={()=>setConfirm(false)} style={{ background:'white', color:C.muted, border:`1px solid ${C.border}` }}>
                Cancel
              </Btn>
            </div>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} style={{ display:'none' }} />
          </div>
        )}
      </div>

      {msg && (
        <div style={{ marginTop:16, background: msg.type==='ok' ? '#F0FDF4' : '#FEF2F2', border:`1px solid ${msg.type==='ok' ? '#86EFAC' : '#FCA5A5'}`, borderRadius:8, padding:'10px 14px', fontSize:13, color: msg.type==='ok' ? C.green : C.red }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}


function PinTab({ db, mut }) {
  const current = db?.settings?.parentPin || '';
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [msg,  setMsg]  = useState(null); // { type: 'ok'|'err', text }

  const save = () => {
    if (pin1.length > 0 && pin1.length < 4) { setMsg({ type:'err', text:'PIN must be exactly 4 digits.' }); return; }
    if (pin1 !== pin2) { setMsg({ type:'err', text:'PINs don\'t match.' }); return; }
    if (pin1 && !/^\d{4}$/.test(pin1)) { setMsg({ type:'err', text:'PIN must be 4 numbers only.' }); return; }
    mut(d => { if (!d.settings) d.settings = {}; d.settings.parentPin = pin1; });
    setPin1(''); setPin2('');
    setMsg({ type:'ok', text: pin1 ? 'PIN saved! Parents will need it to switch modes.' : 'PIN removed. Anyone can switch to parent mode.' });
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <div style={{ maxWidth:420 }}>
      <div style={{ ...card, marginBottom:0 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.navy, marginBottom:6 }}>Parent Mode PIN</div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:20, lineHeight:1.6 }}>
          Set a 4-digit PIN so kids can't switch into parent mode. Leave both fields empty and save to remove the PIN.
        </div>

        {current && (
          <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:8, padding:'8px 14px', marginBottom:16, fontSize:13, color:'#1E40AF' }}>
            🔒 A PIN is currently set.
          </div>
        )}

        <div style={{ marginBottom:12 }}>
          <label style={lbl}>New PIN (4 digits)</label>
          <input
            type="password" inputMode="numeric" maxLength={4} value={pin1}
            onChange={e => setPin1(e.target.value.replace(/\D/g,'').slice(0,4))}
            placeholder="e.g. 1234"
            style={{ ...inp, width:'100%', fontSize:20, letterSpacing:8, textAlign:'center' }}
          />
        </div>
        <div style={{ marginBottom:18 }}>
          <label style={lbl}>Confirm PIN</label>
          <input
            type="password" inputMode="numeric" maxLength={4} value={pin2}
            onChange={e => setPin2(e.target.value.replace(/\D/g,'').slice(0,4))}
            placeholder="Re-enter PIN"
            style={{ ...inp, width:'100%', fontSize:20, letterSpacing:8, textAlign:'center' }}
          />
        </div>

        {msg && (
          <div style={{ background: msg.type==='ok' ? '#F0FDF4' : '#FEF2F2', border:`1px solid ${msg.type==='ok' ? '#86EFAC' : '#FCA5A5'}`, borderRadius:8, padding:'8px 14px', marginBottom:14, fontSize:13, color: msg.type==='ok' ? C.green : C.red }}>
            {msg.text}
          </div>
        )}

        <Btn onClick={save} style={{ background:C.navy, color:'white', width:'100%', padding:'10px 0' }}>
          Save PIN
        </Btn>
      </div>
    </div>
  );
}


function StudentsTab({ db, mut }) {
  return (
    <div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:14 }}>Edit names, emojis, grade level, and family. Changes apply immediately.</div>
      {db.students.map(s => (
        <div key={s.id} style={{ ...card, marginBottom:10 }}>
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <input value={s.emoji} maxLength={2} onChange={e=>mut(d=>{const x=d.students.find(x=>x.id===s.id);if(x)x.emoji=e.target.value;})}
              style={{ ...inp, width:50, textAlign:'center', fontSize:22, padding:5 }} />
            <input value={s.name} onChange={e=>mut(d=>{const x=d.students.find(x=>x.id===s.id);if(x)x.name=e.target.value;})}
              style={{ ...inp, flex:1, minWidth:100 }} placeholder="Name" />
            <select value={s.gradeGroupId} onChange={e=>mut(d=>{const x=d.students.find(x=>x.id===s.id);if(x)x.gradeGroupId=e.target.value;})}
              style={{ ...inp, width:'auto' }}>
              {db.gradeGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <input value={s.family} onChange={e=>mut(d=>{const x=d.students.find(x=>x.id===s.id);if(x)x.family=e.target.value;})}
              style={{ ...inp, width:120 }} placeholder="Family" />
            <Btn onClick={()=>mut(d=>{d.students=d.students.filter(x=>x.id!==s.id);})} style={{ background:'#FEE2E2', color:C.red, padding:'6px 10px' }}>✕</Btn>
          </div>
          <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
            <label style={{ ...lbl, margin:0, whiteSpace:'nowrap' }}>Blog</label>
            <input value={s.blogUrl||''} onChange={e=>mut(d=>{const x=d.students.find(x=>x.id===s.id);if(x)x.blogUrl=e.target.value;})}
              style={{ ...inp, flex:1, fontSize:13 }} placeholder="WordPress blog address (optional) — e.g. mychild.wordpress.com" />
          </div>
        </div>
      ))}
      <Btn onClick={()=>mut(d=>{d.students.push({id:uid(),name:'New Student',gradeGroupId:d.gradeGroups[0]?.id||'',family:'Family',emoji:'📝'});})}
        style={{ background:C.navy, color:'white' }}>+ Add Student</Btn>
    </div>
  );
}


function CoursesTab({ db, mut }) {
  return (
    <div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:14 }}>Set the starting lesson # and total lessons for each subject. Total feeds the progress bars on the Progress tab (RPC courses are typically 180).</div>
      {db.gradeGroups.map(gg => (
        <div key={gg.id} style={{ ...card, marginBottom:20 }}>
          <input value={gg.name} onChange={e=>mut(d=>{const g=d.gradeGroups.find(x=>x.id===gg.id);if(g)g.name=e.target.value;})}
            style={{ ...inp, fontWeight:700, fontSize:15, width:'100%', marginBottom:16 }} />
          {gg.subjects.map(sub => (
            <div key={sub.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
              <input value={sub.icon} maxLength={2}
                onChange={e=>mut(d=>{const g=d.gradeGroups.find(x=>x.id===gg.id);const s=g?.subjects.find(x=>x.id===sub.id);if(s)s.icon=e.target.value;})}
                style={{ ...inp, width:46, textAlign:'center', fontSize:20, padding:5 }} />
              <input value={sub.name}
                onChange={e=>mut(d=>{const g=d.gradeGroups.find(x=>x.id===gg.id);const s=g?.subjects.find(x=>x.id===sub.id);if(s)s.name=e.target.value;})}
                style={{ ...inp, flex:1, minWidth:120 }} placeholder="Subject name" />
              <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                <label style={{ ...lbl, margin:0, whiteSpace:'nowrap' }}>Start</label>
                <input type="number" min={1} value={sub.startLesson}
                  onChange={e=>mut(d=>{const g=d.gradeGroups.find(x=>x.id===gg.id);const s=g?.subjects.find(x=>x.id===sub.id);if(s)s.startLesson=parseInt(e.target.value)||1;})}
                  style={{ ...inp, width:60 }} />
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                <label style={{ ...lbl, margin:0, whiteSpace:'nowrap' }}>Total</label>
                <input type="number" min={1} value={sub.totalLessons ?? 180}
                  onChange={e=>mut(d=>{const g=d.gradeGroups.find(x=>x.id===gg.id);const s=g?.subjects.find(x=>x.id===sub.id);if(s)s.totalLessons=parseInt(e.target.value)||180;})}
                  style={{ ...inp, width:64 }} />
              </div>
              <Btn onClick={()=>mut(d=>{const g=d.gradeGroups.find(x=>x.id===gg.id);if(g)g.subjects=g.subjects.filter(s=>s.id!==sub.id);})}
                style={{ background:'#FEE2E2', color:C.red, padding:'6px 10px' }}>✕</Btn>
            </div>
          ))}
          <Btn onClick={()=>mut(d=>{const g=d.gradeGroups.find(x=>x.id===gg.id);if(g)g.subjects.push({id:uid(),name:'New Subject',icon:'📖',color:'#64748B',startLesson:1,totalLessons:180});})}
            style={{ background:'transparent', border:`1px dashed ${C.border}`, color:C.muted, marginTop:8 }}>+ Add Subject</Btn>
        </div>
      ))}
    </div>
  );
}


// ─── TEMPLATES TAB ────────────────────────────────────────────────────────────
function TemplatesTab({ db, mut }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEN]         = useState('');
  const [editQt, setEQ]           = useState('');
  const templates = db.templates || [];

  const startEdit = t => {
    setEditingId(t.id);
    setEN(t.name);
    setEQ(t.questions.join('\n'));
  };

  const saveEdit = id => {
    mut(d => {
      const t = (d.templates||[]).find(x => x.id === id);
      if (t) { t.name = editName; t.questions = editQt.split('\n').map(q=>q.trim()).filter(Boolean); }
    });
    setEditingId(null);
  };

  return (
    <div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:14 }}>
        Save question sets here to reuse across any lesson. When editing a lesson in the planner, click 📋 Templates to apply one.
      </div>

      {templates.length === 0 ? (
        <div style={{ ...card, textAlign:'center', padding:40, color:C.muted }}>
          <div style={{ fontSize:28, marginBottom:10 }}>📋</div>
          <div style={{ fontSize:14, marginBottom:4 }}>No templates yet.</div>
          <div style={{ fontSize:13 }}>Open any lesson in the planner, type questions, and click 💾 Save to create your first template.</div>
        </div>
      ) : (
        templates.map(t => (
          <div key={t.id} style={{ ...card, marginBottom:12 }}>
            {editingId === t.id ? (
              /* Edit mode */
              <div>
                <div style={{ marginBottom:8 }}>
                  <label style={lbl}>Template name</label>
                  <input value={editName} onChange={e=>setEN(e.target.value)} style={{ ...inp, width:'100%' }} autoFocus />
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={lbl}>Questions — one per line</label>
                  <textarea value={editQt} onChange={e=>setEQ(e.target.value)}
                    style={{ ...inp, width:'100%', minHeight:96, resize:'vertical', fontSize:12, display:'block' }} />
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <Btn onClick={()=>saveEdit(t.id)} style={{ background:C.navy, color:'white', fontSize:12 }}>Save changes</Btn>
                  <Btn onClick={()=>setEditingId(null)} style={{ background:'#F0F4F8', color:C.muted, fontSize:12 }}>Cancel</Btn>
                </div>
              </div>
            ) : (
              /* Display mode */
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, color:C.navy }}>{t.name}</div>
                    <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                      {t.questions.length} question{t.questions.length !== 1 ? 's' : ''}
                      {t.hint ? ` · ${t.hint}` : ''}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <Btn onClick={()=>startEdit(t)} style={{ background:'#F0F4F8', color:C.navy, fontSize:12, padding:'5px 11px' }}>Edit</Btn>
                    <Btn onClick={()=>mut(d=>{d.templates=(d.templates||[]).filter(x=>x.id!==t.id);})}
                      style={{ background:'#FEE2E2', color:C.red, fontSize:12, padding:'5px 11px' }}>Delete</Btn>
                  </div>
                </div>
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8 }}>
                  {t.questions.map((q, i) => (
                    <div key={i} style={{ fontSize:12, color:'#444', padding:'3px 0', borderBottom: i < t.questions.length-1 ? `1px solid #F4F4F4` : 'none' }}>
                      <span style={{ color:C.muted, marginRight:8, fontVariantNumeric:'tabular-nums' }}>{i+1}.</span>{q}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))
      )}

      <Btn
        onClick={() => mut(d => { if(!d.templates) d.templates=[]; const id=uid(); d.templates.push({id, name:'New template', hint:'', questions:['Question 1','Question 2','Question 3']}); setEditingId(id); setEN('New template'); setEQ('Question 1\nQuestion 2\nQuestion 3'); })}
        style={{ background:C.navy, color:'white', marginTop:4 }}
      >+ New Template</Btn>
    </div>
  );
}
