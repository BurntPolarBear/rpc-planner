import { useState } from 'react';
import { ReportCard } from './ReportCard';
import { TODAY, calcStreak, getMon, shortDate, toDate, uid } from '../utils/dates';
import { Btn, C, card, inp, lbl } from '../utils/theme';
import { supabase } from '../utils/supabaseClient';
import { fileToGradeImage, dataUrlToBlob } from '../utils/image';


// ─── STUDENT TODAY ────────────────────────────────────────────────────────────
export function StudentToday({ db, stuId, setStu, mut, readOnly = false, onBack }) {
  const [screen, setScreen] = useState('day');
  if (!stuId) return <StudentPicker db={db} setStu={setStu} />;

  const student  = db.students.find(s => s.id === stuId);
  const gg       = db.gradeGroups.find(g => g.id === student?.gradeGroupId);
  const allSubs  = db.answers.filter(a => a.studentId === stuId);

  // Today's planned lessons
  const todayPlanKey = `${gg?.id}:${getMon(TODAY)}`;
  const todayLessons = db.plans[todayPlanKey]?.[TODAY] || [];
  const todaySubs    = allSubs.filter(a => a.date === TODAY);
  const approved     = todaySubs.filter(a => a.status === 'approved').length;

  // Carryover: past lessons (up to 14 days) that aren't done yet
  const carryover = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date(TODAY + 'T12:00:00');
    d.setDate(d.getDate() - i);
    const dateStr  = toDate(d);
    const pk       = `${gg?.id}:${getMon(dateStr)}`;
    const dayPlan  = db.plans[pk]?.[dateStr] || [];
    dayPlan.forEach(lesson => {
      const sub    = allSubs.find(a => a.date === dateStr && a.subjectId === lesson.subjectId);
      const isApproved   = sub?.status === 'approved';
      // "submitted & pending" means student did their part — don't nag them
      const isSubmitted  = sub?.status === 'pending' && sub?.answers?.some(a => a?.trim());
      if (!isApproved && !isSubmitted) {
        carryover.push({ ...lesson, originalDate: dateStr });
      }
    });
  }

  // Save answers — uses the lesson's original date so review stays consistent
  const save = (subjectId, lessonNum, answers, tasksDone, date = TODAY, extra = {}) => mut(d => {
    const ex = d.answers.find(a => a.studentId===stuId && a.date===date && a.subjectId===subjectId);
    if (ex) {
      ex.answers = answers;
      if (tasksDone !== undefined) ex.tasksDone = tasksDone;
      if (extra.photos) ex.photos = extra.photos;
      if (extra.aiGrade) ex.aiGrade = extra.aiGrade;
      if (ex.status !== 'needs_revision') ex.status = 'pending';
    }
    else d.answers.push({ id:uid(), studentId:stuId, date, subjectId, lessonNum, answers, tasksDone:tasksDone||[], status:'pending', parentNote:'',
      ...(extra.photos ? { photos: extra.photos } : {}), ...(extra.aiGrade ? { aiGrade: extra.aiGrade } : {}) });
  });

  // For question-free lessons — one tap marks it done, no review needed
  const complete = (subjectId, lessonNum, tasksDone, date = TODAY) => mut(d => {
    const ex = d.answers.find(a => a.studentId===stuId && a.date===date && a.subjectId===subjectId);
    if (ex) { ex.status = 'approved'; ex.tasksDone = tasksDone||[]; ex.parentNote = ''; }
    else d.answers.push({ id:uid(), studentId:stuId, date, subjectId, lessonNum, answers:[], tasksDone:tasksDone||[], status:'approved', parentNote:'' });
  });

  // Persist task checkmarks immediately without changing submission status —
  // creates a draft record if none exists yet, so checks survive a browser close
  const saveTasks = (subjectId, lessonNum, tasksDone, date = TODAY) => mut(d => {
    const ex = d.answers.find(a => a.studentId===stuId && a.date===date && a.subjectId===subjectId);
    if (ex) { ex.tasksDone = tasksDone; }
    else d.answers.push({ id:uid(), studentId:stuId, date, subjectId, lessonNum, answers:[], tasksDone, status:'draft', parentNote:'' });
  });

  const dow = new Date(TODAY + 'T12:00:00').getDay();
  const todayActivities = (db.activities || []).filter(a => a.studentId === stuId && (a.days||[]).includes(dow));

  const isActDone = id => (db.activityLogs||[]).some(l => l.activityId===id && l.studentId===stuId && l.date===TODAY);
  const toggleActivity = id => mut(d => {
    if (!d.activityLogs) d.activityLogs = [];
    const idx = d.activityLogs.findIndex(l => l.activityId===id && l.studentId===stuId && l.date===TODAY);
    if (idx >= 0) d.activityLogs.splice(idx, 1);
    else d.activityLogs.push({ activityId:id, studentId:stuId, date:TODAY });
  });
  const isWeekend = [0, 6].includes(dow);
  const totalPending = todayLessons.length + carryover.length;
  const streak = calcStreak(db.answers, stuId);

  if (screen === 'report') return <ReportCard student={student} db={db} kidView onBack={() => setScreen('day')} />;

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18, flexWrap:'wrap' }}>
        <Btn onClick={() => onBack ? onBack() : setStu(null)} style={{ background:'#E8EEF4', color:C.navy, padding:'8px 14px', fontSize:13 }}>← Back</Btn>
        <div style={{ width:54, height:54, borderRadius:16, background:'#FBF5E7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, flexShrink:0 }}>{student?.emoji}</div>
        <div style={{ flex:1, minWidth:150 }}>
          <div style={{ fontFamily:'Georgia,serif', fontSize:25, fontWeight:'bold', color:C.navy, lineHeight:1.15 }}>{student?.name}'s day</div>
          <div style={{ fontSize:13.5, color:C.muted }}>{shortDate(TODAY)} · {gg?.name}</div>
        </div>
        {streak >= 2 && (
          <div style={{ textAlign:'center', flexShrink:0, background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:12, padding:'8px 14px' }}>
            <div style={{ fontWeight:800, fontSize:22, color:'#EA580C', fontVariantNumeric:'tabular-nums' }}>🔥 {streak}</div>
            <div style={{ fontSize:10.5, color:'#9A3412', fontWeight:700 }}>day streak</div>
          </div>
        )}
        <Btn onClick={() => setScreen('report')} style={{ background:C.gold, color:'white', padding:'8px 14px', fontSize:13, flexShrink:0 }}>🎓 Report Card</Btn>
      </div>

      {/* Encouraging progress banner */}
      {todayLessons.length > 0 && (() => {
        const total = todayLessons.length;
        const allDone = approved === total && carryover.length === 0;
        const msg = allDone
          ? 'All done for today — amazing work! 🎉'
          : approved === 0
          ? "Let's get started — you've got this!"
          : `You're doing great — ${approved} of ${total} done`;
        return (
          <div style={{ background:'#FBF5E7', border:'1px solid #EBD9AE', borderRadius:14, padding:'13px 16px', marginBottom:22 }}>
            <div style={{ fontSize:14.5, fontWeight:700, color:C.navy, marginBottom:8 }}>{msg}</div>
            <div style={{ height:9, background:'#EADFC4', borderRadius:5, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${(approved/total)*100}%`, background: allDone ? C.green : C.gold, borderRadius:5, transition:'width .4s ease' }} />
            </div>
          </div>
        );
      })()}

      {/* Catch-up section */}
      {carryover.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:10, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18 }}>📋</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#92400E' }}>
                {carryover.length} lesson{carryover.length > 1 ? 's' : ''} to catch up on
              </div>
              <div style={{ fontSize:12, color:'#B45309' }}>These were scheduled on earlier days and still need to be completed.</div>
            </div>
          </div>
          {carryover.map(lesson => {
            const subj = gg?.subjects.find(s => s.id === lesson.subjectId);
            if (!subj) return null;
            const sub = allSubs.find(a => a.date === lesson.originalDate && a.subjectId === lesson.subjectId);
            return (
              <LessonCard
                key={`${lesson.originalDate}-${lesson.subjectId}`}
                subj={subj} lesson={lesson} submission={sub} readOnly={readOnly}
                fromDate={shortDate(lesson.originalDate)}
                onSave={(ans, doneT, extra) => save(lesson.subjectId, lesson.lessonNum, ans, doneT, lesson.originalDate, extra)}
                gradeLevel={gg?.name}
                onComplete={doneT => complete(lesson.subjectId, lesson.lessonNum, doneT, lesson.originalDate)}
                onTasksChange={doneT => saveTasks(lesson.subjectId, lesson.lessonNum, doneT, lesson.originalDate)}
              />
            );
          })}
        </div>
      )}

      {/* Today's lessons */}
      {isWeekend && todayLessons.length === 0 && carryover.length === 0 ? (
        <div style={{ ...card, textAlign:'center', padding:48, color:C.muted }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🎉</div>
          <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:4 }}>Enjoy the weekend!</div>
          <div style={{ fontSize:14 }}>No lessons today. See you Monday.</div>
        </div>
      ) : todayLessons.length === 0 && carryover.length === 0 ? (
        <div style={{ ...card, textAlign:'center', padding:48, color:C.muted }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📭</div>
          <div style={{ fontSize:15 }}>No lessons scheduled today.</div>
          <div style={{ fontSize:13, marginTop:4 }}>Ask a parent to set up today's plan.</div>
        </div>
      ) : todayLessons.length > 0 ? (
        <div>
          {carryover.length > 0 && (
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Today's lessons</div>
          )}
          {todayLessons.map(lesson => {
            const subj = gg?.subjects.find(s => s.id === lesson.subjectId);
            if (!subj) return null;
            const sub = todaySubs.find(a => a.subjectId === lesson.subjectId);
            return <LessonCard key={lesson.subjectId} subj={subj} lesson={lesson} submission={sub} readOnly={readOnly}
              onSave={(ans, doneT, extra) => save(lesson.subjectId, lesson.lessonNum, ans, doneT, TODAY, extra)}
              gradeLevel={gg?.name}
              onComplete={doneT => complete(lesson.subjectId, lesson.lessonNum, doneT)}
              onTasksChange={doneT => saveTasks(lesson.subjectId, lesson.lessonNum, doneT)}
            />;
          })}
        </div>
      ) : null}

      {/* Activities for today */}
      {todayActivities.length > 0 && (
        <div style={{ marginTop: todayLessons.length > 0 || carryover.length > 0 ? 24 : 0 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
            Today's Activities
          </div>
          {todayActivities.map(act => <ActivityCard key={act.id} activity={act} done={isActDone(act.id)} onToggle={readOnly ? undefined : () => toggleActivity(act.id)} />)}
        </div>
      )}
    </div>
  );
}


function StudentPicker({ db, setStu }) {
  // Count carryover lessons for a given student
  const countCarryover = (s, gg) => {
    let n = 0;
    for (let i = 1; i <= 14; i++) {
      const d = new Date(TODAY + 'T12:00:00'); d.setDate(d.getDate() - i);
      const dateStr = toDate(d);
      const pk = `${gg?.id}:${getMon(dateStr)}`;
      const dayPlan = db.plans[pk]?.[dateStr] || [];
      dayPlan.forEach(lesson => {
        const sub = db.answers.find(a => a.studentId===s.id && a.date===dateStr && a.subjectId===lesson.subjectId);
        const done = sub?.status==='approved' || (sub?.status==='pending' && sub?.answers?.some(a=>a?.trim()));
        if (!done) n++;
      });
    }
    return n;
  };

  return (
    <div>
      <div style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:'bold', color:C.navy, marginBottom:4 }}>Good morning! 👋</div>
      <div style={{ fontSize:14, color:C.muted, marginBottom:24 }}>{shortDate(TODAY)} — Who are you?</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:14 }}>
        {db.students.map(s => {
          const gg       = db.gradeGroups.find(g => g.id===s.gradeGroupId);
          const planKey  = `${gg?.id}:${getMon(TODAY)}`;
          const lessons  = db.plans[planKey]?.[TODAY] || [];
          const subs     = db.answers.filter(a => a.studentId===s.id && a.date===TODAY);
          const approved = subs.filter(a => a.status==='approved').length;
          const hasWork  = subs.some(a => a.answers?.some(x => x?.trim()));
          const catchUp  = countCarryover(s, gg);
          const todayDow = new Date(TODAY + 'T12:00:00').getDay();
          const todayActs = (db.activities||[]).filter(a => a.studentId===s.id && (a.days||[]).includes(todayDow));
          const streak = calcStreak(db.answers, s.id);
          return (
            <button key={s.id} onClick={() => setStu(s.id)} style={{
              ...card, border:'2px solid transparent', cursor:'pointer', textAlign:'left', padding:20, transition:'all .15s'
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor=C.gold; e.currentTarget.style.boxShadow='0 2px 6px rgba(15,30,48,0.08), 0 10px 28px rgba(15,30,48,0.10)'; e.currentTarget.style.transform='translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(26,46,74,0.06)'; e.currentTarget.style.boxShadow='0 1px 2px rgba(15,30,48,0.05), 0 4px 14px rgba(15,30,48,0.05)'; e.currentTarget.style.transform='translateY(0)'; }}
            >
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>{s.emoji}</div>
                {streak >= 2 && (
                  <div style={{ fontSize:13, fontWeight:800, color:'#EA580C', background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:8, padding:'3px 8px' }}>
                    🔥 {streak}
                  </div>
                )}
              </div>
              <div style={{ fontSize:17, fontWeight:700, color:C.navy }}>{s.name}</div>
              <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{gg?.name} · {s.family}</div>
              <div style={{ marginTop:10, fontSize:13 }}>
                {lessons.length===0 && catchUp===0
                  ? <span style={{ color:'#bbb' }}>No plan yet today</span>
                  : approved===lessons.length && catchUp===0
                  ? <span style={{ color:C.green, fontWeight:700 }}>✅ All done!</span>
                  : hasWork
                  ? <span style={{ color:C.yellow, fontWeight:700 }}>{approved}/{lessons.length} approved</span>
                  : <span style={{ color:C.muted }}>{lessons.length} lesson{lessons.length>1?'s':''} today</span>}
              </div>
              {catchUp > 0 && (
                <div style={{ marginTop:6, fontSize:12, color:'#92400E', fontWeight:600 }}>
                  📋 {catchUp} catch-up lesson{catchUp>1?'s':''}
                </div>
              )}
              {todayActs.length > 0 && (
                <div style={{ marginTop:6, fontSize:12, color:C.muted }}>
                  {todayActs.map(a => `${a.emoji||'📌'} ${a.name}`).join(' · ')}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}


// ─── ACTIVITY CARD ────────────────────────────────────────────────────────────
function ActivityCard({ activity: a, done, onToggle }) {
  return (
    <div style={{ ...card, borderLeft:`4px solid ${a.color||'#6B7280'}`, marginBottom:10, display:'flex', alignItems:'flex-start', gap:12, opacity: done ? 0.75 : 1, transition:'opacity .2s' }}>
      <span style={{ fontSize:26, lineHeight:1, marginTop:1 }}>{a.emoji||'📌'}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, fontSize:15, color: done ? C.muted : C.navy, textDecoration: done ? 'line-through' : 'none', transition:'color .2s' }}>
          {a.name}
        </div>
        {(a.time || a.location) && (
          <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
            {[a.time, a.location].filter(Boolean).join(' · ')}
          </div>
        )}
        {a.notes?.trim() && (
          <div style={{ fontSize:13, color:'#444', marginTop:6, lineHeight:1.5 }}>{a.notes}</div>
        )}
      </div>
      {onToggle && (
        <button onClick={onToggle} style={{
          width:36, height:36, borderRadius:'50%', border:`2px solid ${done ? C.green : C.border}`,
          background: done ? C.green : 'white', color: done ? 'white' : C.muted,
          fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          flexShrink:0, transition:'all .2s', marginTop:1,
        }}>
          {done ? '✓' : ''}
        </button>
      )}
    </div>
  );
}


// ─── LESSON CARD ──────────────────────────────────────────────────────────────
function LessonCard({ subj, lesson, submission, onSave, onComplete, onTasksChange, fromDate, readOnly = false, gradeLevel = '' }) {
  const taskList    = lesson.tasks || [];
  const hasQuestions = (lesson.questions||[]).length > 0;
  const hasTasks     = taskList.length > 0;

  const [open, setOpen]   = useState(
    (hasQuestions || hasTasks) && (!submission || submission.status === 'needs_revision' || submission.status === 'draft')
  );
  const [ans, setAns]     = useState(() => submission?.answers?.length ? submission.answers : (lesson.questions||[]).map(()=>''));
  const [doneT, setDoneT] = useState(() => {
    if (submission?.tasksDone?.length) return submission.tasksDone;
    return taskList.map(() => false);
  });
  const [flash, setFlash]   = useState(false);
  const [checkFlash, setCF] = useState(false);
  const [photos, setPhotos]     = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [grading, setGrading]   = useState(false);
  const [photoErr, setPhotoErr] = useState('');

  const status = submission?.status;
  const statusLabel = { approved:'✅ Approved', needs_revision:'↩ Needs revision', pending:'⏳ Awaiting review', draft:'📝 In progress' };
  const statusColor = { approved:C.green, needs_revision:C.red, pending:C.yellow, draft:C.muted };

  const tasksCompleted = doneT.filter(Boolean).length;
  const allTasksDone   = hasTasks && tasksCompleted === taskList.length;

  const toggleTask = (i) => {
    const next = [...doneT]; next[i] = !next[i]; setDoneT(next);
    // Task-only lesson with everything checked → auto-complete (which also saves tasks)
    if (!hasQuestions && next.every(Boolean)) {
      setTimeout(() => { onComplete(next); }, 300);
    } else if (onTasksChange) {
      // Otherwise persist the checkmarks immediately so they survive a browser close
      onTasksChange(next);
    }
  };

  const onPickPhotos = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 5 - photos.length);
    if (!files.length) return;
    setPhotoBusy(true); setPhotoErr('');
    let uid = null;
    try { const { data: { session } } = await supabase.auth.getSession(); uid = session?.user?.id; } catch { /* */ }
    if (!uid) { setPhotoErr('You appear signed out — reload and try again.'); setPhotoBusy(false); return; }
    const added = []; let lastErr = '';
    for (const file of files) {
      try {
        const img = await fileToGradeImage(file);
        const path = `${uid}/${lesson.subjectId}-${Date.now()}-${Math.random().toString(36).slice(2,7)}.jpg`;
        const blob = await dataUrlToBlob(img.preview);
        const { error } = await supabase.storage.from('work-photos').upload(path, blob, { contentType:'image/jpeg', upsert:false });
        if (error) lastErr = error.message || String(error);
        else added.push({ path, preview: img.preview, data: img.data, media_type: img.media_type });
      } catch (e) { lastErr = String(e?.message || e); }
    }
    if (added.length) setPhotos(prev => [...prev, ...added].slice(0, 5));
    if (!added.length && lastErr) setPhotoErr('Upload failed: ' + lastErr);
    setPhotoBusy(false);
  };

  const removePhoto = (i) => {
    const p = photos[i];
    if (p?.path) supabase.storage.from('work-photos').remove([p.path]);
    setPhotos(prev => prev.filter((_, idx) => idx !== i));
  };

  const doSubmit = async () => {
    let aiGrade = null;
    if (photos.length) {
      setGrading(true);
      try {
        const res = await fetch('/api/grade-work', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            subject: subj.name, gradeLevel, rigor: 'standard',
            title: `${subj.name} · Lesson ${lesson.lessonNum}`,
            images: photos.map(p => ({ media_type: p.media_type, data: p.data })),
          }),
        });
        const data = await res.json();
        if (res.ok && data.grade) aiGrade = data.grade;
      } catch { /* leave ungraded — parent can still grade */ }
      setGrading(false);
    }
    const extra = {};
    if (photos.length) { extra.photos = photos.map(p => p.path); if (aiGrade) extra.aiGrade = aiGrade; }
    onSave(ans, doneT, extra);
    setPhotos([]);
    setFlash(true); setTimeout(() => setFlash(false), 2000);
  };

  const handleComplete = (e) => {
    e.stopPropagation(); setCF(true);
    setTimeout(() => { onComplete(doneT); setCF(false); }, 400);
  };

  const canExpand = hasQuestions || hasTasks || lesson.notes?.trim() || (!readOnly && submission?.status !== 'approved');

  return (
    <div style={{ ...card, borderRadius:16, marginBottom:14 }}>
      {/* Header */}
      <div
        onClick={() => canExpand ? setOpen(o=>!o) : undefined}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor: canExpand ? 'pointer' : 'default', userSelect:'none' }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ width:44, height:44, borderRadius:12, background:subj.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>{subj.icon}</span>
          <div>
            <div style={{ fontWeight:700, fontSize:16, color:C.navy }}>{subj.name}</div>
            <div style={{ fontSize:12, color:C.muted }}>
              Lesson {lesson.lessonNum}
              {fromDate && <span style={{ marginLeft:6, color:C.yellow, fontWeight:600 }}>· from {fromDate}</span>}
              {hasTasks && !open && (
                <span style={{ marginLeft:6, color: allTasksDone ? C.green : C.muted, fontWeight:600 }}>
                  · {tasksCompleted}/{taskList.length} tasks
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {status && <span style={{ fontSize:12, fontWeight:700, color:statusColor[status] }}>{statusLabel[status]}</span>}
          {!readOnly && !hasQuestions && !hasTasks && status !== 'approved' && onComplete && (
            <button onClick={handleComplete} style={{
              border:'none', borderRadius:8, padding:'7px 16px', cursor:'pointer',
              fontSize:13, fontWeight:700,
              background: checkFlash ? C.green : '#E8F5E9', color: checkFlash ? 'white' : C.green,
              transition:'all .2s',
            }}>
              {checkFlash ? '✓ Done!' : '✓ Mark done'}
            </button>
          )}
          {canExpand && <span style={{ color:'#ccc', fontSize:12 }}>{open ? '▲' : '▼'}</span>}
        </div>
      </div>

      {/* Body */}
      {open && (
        <div style={{ marginTop:14, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
          {/* Revision note */}
          {status==='needs_revision' && submission?.parentNote && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:8, padding:'10px 14px', marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:800, color:C.red, marginBottom:3 }}>PARENT NOTE</div>
              <div style={{ fontSize:14 }}>{submission.parentNote}</div>
            </div>
          )}
          {/* Instructions */}
          {lesson.notes?.trim() && (
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:8, padding:'10px 14px', marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#1E40AF', letterSpacing:'0.06em', marginBottom:4 }}>INSTRUCTIONS</div>
              <div style={{ fontSize:14, color:'#1E3A5F', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{lesson.notes}</div>
            </div>
          )}
          {/* Task checklist */}
          {hasTasks && (
            <div style={{ marginBottom: hasQuestions ? 18 : 8 }}>
              <div style={lbl}>Tasks</div>
              {taskList.map((t, i) => (
                <button
                  key={i}
                  onClick={() => !readOnly && status !== 'approved' && toggleTask(i)}
                  disabled={readOnly || status === 'approved'}
                  style={{
                    display:'flex', alignItems:'center', gap:12, width:'100%',
                    background: doneT[i] ? '#F0FDF4' : '#FAFAFA',
                    border:`1px solid ${doneT[i] ? '#86EFAC' : C.border}`,
                    borderRadius:8, padding:'10px 12px', marginBottom:6,
                    cursor: (readOnly || status === 'approved') ? 'default' : 'pointer',
                    textAlign:'left', transition:'all .15s',
                  }}
                >
                  <div style={{
                    width:22, height:22, borderRadius:6, flexShrink:0,
                    border:`2px solid ${doneT[i] ? C.green : C.border}`,
                    background: doneT[i] ? C.green : 'white',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:13, color:'white', transition:'all .15s',
                  }}>
                    {doneT[i] ? '✓' : ''}
                  </div>
                  <span style={{ fontSize:14, color: doneT[i] ? C.muted : C.navy, textDecoration: doneT[i] ? 'line-through' : 'none', transition:'all .15s' }}>
                    {t}
                  </span>
                </button>
              ))}
            </div>
          )}
          {/* Questions */}
          {hasQuestions && lesson.questions.map((q, i) => (
            <div key={i} style={{ marginBottom:14 }}>
              <div style={lbl}>Question {i+1}</div>
              <div style={{ fontSize:14, fontWeight:500, color:'#333', marginBottom:8, lineHeight:1.5 }}>{q}</div>
              <textarea
                value={ans[i]||''}
                onChange={e => { const n=[...ans]; n[i]=e.target.value; setAns(n); }}
                disabled={status==='approved' || readOnly}
                placeholder="Write your answer here…"
                style={{ ...inp, width:'100%', resize:'vertical', minHeight:64 }}
              />
            </div>
          ))}
          {/* Photo of work */}
          {!readOnly && status !== 'approved' && (
            <div style={{ marginBottom:14 }}>
              <div style={lbl}>Photo of your work (optional)</div>
              {photos.length > 0 && (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                  {photos.map((p, i) => (
                    <div key={i} style={{ position:'relative' }}>
                      <img src={p.preview} alt={`work ${i+1}`} style={{ width:74, height:74, objectFit:'cover', borderRadius:10, border:`1px solid ${C.border}` }} />
                      <button onClick={() => removePhoto(i)} aria-label="Remove photo" style={{ position:'absolute', top:-7, right:-7, width:22, height:22, borderRadius:'50%', background:C.red, color:'white', border:'2px solid white', cursor:'pointer', fontSize:12, lineHeight:1 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length < 5 && (
                <label style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#EEF4FB', color:C.navy, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px', fontSize:13, fontWeight:600, cursor: photoBusy ? 'default' : 'pointer' }}>
                  {photoBusy ? 'Uploading…' : (photos.length ? '＋ Add another photo' : '📷 Add a photo of your work')}
                  <input type="file" accept="image/*" capture="environment" multiple disabled={photoBusy} onChange={e => onPickPhotos(e.target.files)} style={{ display:'none' }} />
                </label>
              )}
              {photoErr && <div style={{ color:C.red, fontSize:12.5, marginTop:8 }}>{photoErr}</div>}
            </div>
          )}

          {/* Submit */}
          {!readOnly && (hasQuestions || photos.length > 0) && status!=='approved' && (
            <button onClick={doSubmit} disabled={grading} style={{
              border:'none', borderRadius:8, padding:'11px 0', cursor: grading ? 'default' : 'pointer', fontSize:14,
              fontWeight:700, width:'100%', transition:'background .2s',
              background: flash ? C.green : C.navy, color:'white', opacity: grading ? 0.75 : 1,
            }}>
              {grading ? 'Grading your work…' : flash ? '✓ Submitted!' : (photos.length > 0 ? 'Submit work' : 'Submit answers')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
