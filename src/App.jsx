import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const toDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const TODAY = toDate();

const getMon = (ds) => {
  const d = new Date(ds + 'T12:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return toDate(d);
};

const weekDays = (mon) =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon + 'T12:00:00');
    d.setDate(d.getDate() + i);
    return toDate(d);
  });

const shortDate = (ds) =>
  new Date(ds + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const weekLabel = (mon) => {
  const days = weekDays(mon);
  const fmt = (ds) => new Date(ds + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(days[0])} – ${fmt(days[6])}`;
};

const uid = () => Math.random().toString(36).slice(2, 9);

// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────
const INIT = {
  gradeGroups: [
    {
      id: 'gg1', name: '4th Grade',
      subjects: [
        { id: 'g1s1', name: 'Mathematics', icon: '➗', color: '#2563EB', startLesson: 1 },
        { id: 'g1s2', name: 'English',     icon: '✏️',  color: '#7C3AED', startLesson: 1 },
        { id: 'g1s3', name: 'History',     icon: '🏛️', color: '#B45309', startLesson: 1 },
        { id: 'g1s4', name: 'Science',     icon: '🔬', color: '#047857', startLesson: 1 },
      ]
    },
    {
      id: 'gg2', name: '6th Grade',
      subjects: [
        { id: 'g2s1', name: 'Mathematics', icon: '➗', color: '#2563EB', startLesson: 1 },
        { id: 'g2s2', name: 'English',     icon: '✏️',  color: '#7C3AED', startLesson: 1 },
        { id: 'g2s3', name: 'History',     icon: '🏛️', color: '#B45309', startLesson: 1 },
        { id: 'g2s4', name: 'Science',     icon: '🔬', color: '#047857', startLesson: 1 },
        { id: 'g2s5', name: 'Government',  icon: '⚖️', color: '#B91C1C', startLesson: 1 },
      ]
    }
  ],
  students: [
    { id: 'st1', name: 'Child 1', gradeGroupId: 'gg1', family: 'Family A', emoji: '📚' },
    { id: 'st2', name: 'Child 2', gradeGroupId: 'gg1', family: 'Family B', emoji: '✏️' },
    { id: 'st3', name: 'Child 3', gradeGroupId: 'gg2', family: 'Family A', emoji: '🔬' },
    { id: 'st4', name: 'Child 4', gradeGroupId: 'gg2', family: 'Family B', emoji: '📖' },
  ],
  plans: {},      // { 'gg1:2026-06-23': { '2026-06-23': [{subjectId, lessonNum, questions}] } }
  answers: [],    // { id, studentId, date, subjectId, lessonNum, answers[], status, parentNote }
  templates: [],  // { id, name, hint, questions[] }
  activities: [], // { id, studentId, name, emoji, color, days:[0-6 JS dow], time:'', location:'', notes:'' }
  activityLogs: [], // { activityId, studentId, date } — one entry = done for that day
  settings: { parentPin: '' }, // empty = no PIN required
};

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  navy:   '#1A2E4A',
  navyD:  '#0F1E30',
  gold:   '#D4920A',
  goldL:  '#F59E0B',
  green:  '#047857',
  red:    '#B91C1C',
  yellow: '#B45309',
  border: '#D1D9E0',
  muted:  '#5E7085',
  bg:     '#EEF2F6',
  surf:   '#FFFFFF',
};

const card  = { background: C.surf, borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 16 };
const Btn   = ({ style, ...p }) => <button style={{ border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer', fontSize:13, fontWeight:600, lineHeight:1.5, ...style }} {...p} />;
const inp   = { border:`1.5px solid ${C.border}`, borderRadius:8, padding:'8px 12px', fontSize:14, fontFamily:'inherit', background:'white', boxSizing:'border-box' };
const lbl   = { display:'block', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:C.muted, marginBottom:4 };

// ─── ROOT ────────────────────────────────────────────────────────────────────
export default function App() {
  const [db, setDb]       = useState(null);
  const [view, setView]   = useState('today');
  const [mode, setMode]   = useState('student');
  const [stuId, setStu]   = useState(null);
  const [weekMon, setWk]  = useState(() => getMon(TODAY));
  const [planGG, setPGG]  = useState(INIT.gradeGroups[0].id);
  const [showPin, setShowPin] = useState(false);

  const handleModeToggle = () => {
    if (mode === 'student') {
      const pin = db?.settings?.parentPin;
      if (pin) { setShowPin(true); }
      else { setMode('parent'); setView('today'); }
    } else {
      setMode('student'); setView('today'); setStu(null);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_data')
        .select('content')
        .eq('id', 1)
        .single();
      if (data?.content?.gradeGroups) setDb(data.content);
      else setDb(INIT);
    } catch {
      setDb(INIT);
    }
  }, []);

  // Track our own writes so realtime echoes of them don't clobber newer local state
  const pendingWrites = useRef(0);

  useEffect(() => {
    loadData();

    // Fallback: refresh when tab regains focus
    const handleVisibility = () => { if (!document.hidden) loadData(); };
    document.addEventListener('visibilitychange', handleVisibility);

    // Realtime: any change another browser makes shows up here within seconds
    const channel = supabase
      .channel('app_data_changes')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_data', filter: 'id=eq.1' },
        (payload) => {
          // Ignore echoes of our own in-flight writes
          if (pendingWrites.current > 0) return;
          if (payload.new?.content?.gradeGroups) setDb(payload.new.content);
        }
      )
      .subscribe();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const mut = fn => setDb(prev => {
    const next = JSON.parse(JSON.stringify(prev));
    fn(next);
    pendingWrites.current += 1;
    supabase
      .from('app_data')
      .upsert({ id: 1, content: next })
      .then(() => { pendingWrites.current = Math.max(0, pendingWrites.current - 1); })
      .catch(err => { pendingWrites.current = Math.max(0, pendingWrites.current - 1); console.error(err); });
    return next;
  });

  if (!db) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:C.bg, fontFamily:'Georgia, serif', fontSize:18, color:C.navy }}>
      Loading your planner…
    </div>
  );

  const navItems = mode === 'parent'
    ? [['today','📊 Today'], ['week','🗓 Week'], ['plan','📋 Plan'], ['review','✅ Review'], ['export','📤 Export'], ['setup','⚙️ Setup']]
    : [['today','📅 Today']];

  const goToPlan = (ggId) => { setPGG(ggId); setView('plan'); };

  return (
    <div style={{ fontFamily:'system-ui,-apple-system,sans-serif', minHeight:'100vh', background:C.bg }}>
      {/* Header */}
      <header style={{ background:C.navy, height:56, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px' }}>
        <span style={{ fontFamily:'Georgia,serif', fontSize:18, color:'white', fontWeight:'bold', letterSpacing:'-0.3px' }}>
          📋 RPC Planner
        </span>
        <Btn
          onClick={handleModeToggle}
          style={{ background: mode==='parent' ? C.gold : 'rgba(255,255,255,0.15)', color:'white', padding:'6px 14px' }}
        >
          {mode==='parent' ? '👨‍👩‍👧 Parent Mode' : '🔒 Parent Mode'}
        </Btn>
      </header>

      {showPin && (
        <PinModal
          correctPin={db?.settings?.parentPin}
          onSuccess={() => { setShowPin(false); setMode('parent'); setView('today'); }}
          onCancel={() => setShowPin(false)}
        />
      )}

      {/* Nav */}
      <nav style={{ background:'white', borderBottom:`1px solid ${C.border}`, display:'flex', overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
        {navItems.map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} style={{
            background:'none', border:'none', padding:'11px 12px', cursor:'pointer',
            fontSize:12, fontWeight: view===id ? 700 : 500,
            color: view===id ? C.gold : C.muted,
            borderBottom:`3px solid ${view===id ? C.gold : 'transparent'}`,
            whiteSpace:'nowrap', flexShrink:0,
          }}>{label}</button>
        ))}
      </nav>

      {/* Main */}
      <main style={{ maxWidth:960, margin:'0 auto', padding:'20px 16px' }}>
        {view==='today' && mode==='student' && <StudentToday db={db} stuId={stuId} setStu={setStu} mut={mut} />}
        {view==='today' && mode==='parent'  && <Overview db={db} />}
        {view==='week'  && mode==='parent'  && <WeekOverview db={db} weekMon={weekMon} setWk={setWk} onGoToPlan={goToPlan} />}
        {view==='plan'  && mode==='parent'  && <Planner db={db} mut={mut} weekMon={weekMon} setWk={setWk} activeGG={planGG} setActiveGG={setPGG} />}
        {view==='review'&& mode==='parent'  && <Review db={db} mut={mut} />}
        {view==='export'&& mode==='parent'  && <ExportView db={db} weekMon={weekMon} setWk={setWk} />}
        {view==='setup' && <Setup db={db} mut={mut} />}
      </main>
    </div>
  );
}

// ─── PIN MODAL ────────────────────────────────────────────────────────────────
function PinModal({ correctPin, onSuccess, onCancel }) {
  const [digits, setDigits] = useState([]);
  const [shake, setShake]   = useState(false);

  const addDigit = (d) => {
    if (digits.length >= 4) return;
    const next = [...digits, d];
    setDigits(next);
    if (next.length === 4) {
      if (next.join('') === correctPin) {
        onSuccess();
      } else {
        setShake(true);
        setTimeout(() => { setDigits([]); setShake(false); }, 600);
      }
    }
  };

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'white', borderRadius:20, padding:'32px 28px', width:280, textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ fontFamily:'Georgia,serif', fontSize:20, fontWeight:'bold', color:C.navy, marginBottom:6 }}>
          🔒 Parent Mode
        </div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:24 }}>Enter your PIN</div>

        {/* Dot indicators */}
        <div style={{
          display:'flex', justifyContent:'center', gap:12, marginBottom:28,
          animation: shake ? 'shake 0.5s ease' : 'none',
        }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width:14, height:14, borderRadius:'50%',
              background: digits.length > i ? C.navy : '#E2E8F0',
              border: `2px solid ${digits.length > i ? C.navy : C.border}`,
              transition: 'background .15s',
            }} />
          ))}
        </div>

        {/* Keypad */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10, marginBottom:20 }}>
          {keys.map((k, i) => (
            k === '' ? <div key={i} /> :
            k === '⌫' ? (
              <button key={i} onClick={() => setDigits(d => d.slice(0,-1))} style={{
                height:56, borderRadius:12, border:`1px solid ${C.border}`,
                background:'#F8FAFC', cursor:'pointer', fontSize:20, color:C.muted,
                fontFamily:'inherit',
              }}>⌫</button>
            ) : (
              <button key={i} onClick={() => addDigit(k)} style={{
                height:56, borderRadius:12, border:`1px solid ${C.border}`,
                background:'white', cursor:'pointer', fontSize:22, fontWeight:600,
                color:C.navy, fontFamily:'inherit',
                boxShadow:'0 1px 3px rgba(0,0,0,0.06)',
              }}>{k}</button>
            )
          ))}
        </div>

        <button onClick={onCancel} style={{ fontSize:13, color:C.muted, background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
          Cancel
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

// ─── STUDENT TODAY ────────────────────────────────────────────────────────────
function StudentToday({ db, stuId, setStu, mut }) {
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
  const save = (subjectId, lessonNum, answers, tasksDone, date = TODAY) => mut(d => {
    const ex = d.answers.find(a => a.studentId===stuId && a.date===date && a.subjectId===subjectId);
    if (ex) {
      ex.answers = answers;
      if (tasksDone !== undefined) ex.tasksDone = tasksDone;
      if (ex.status !== 'needs_revision') ex.status = 'pending';
    }
    else d.answers.push({ id:uid(), studentId:stuId, date, subjectId, lessonNum, answers, tasksDone:tasksDone||[], status:'pending', parentNote:'' });
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

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <Btn onClick={() => setStu(null)} style={{ background:'#E8EEF4', color:C.navy, padding:'6px 12px', fontSize:12 }}>← Back</Btn>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'Georgia,serif', fontSize:21, fontWeight:'bold', color:C.navy }}>{student?.emoji} {student?.name}'s Day</div>
          <div style={{ fontSize:13, color:C.muted }}>{shortDate(TODAY)} · {gg?.name}</div>
        </div>
        {totalPending > 0 && (
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontWeight:800, fontSize:22, color: approved===todayLessons.length && carryover.length===0 ? C.green : C.navy, fontVariantNumeric:'tabular-nums' }}>
              {approved}/{todayLessons.length}
            </div>
            <div style={{ fontSize:11, color:C.muted }}>today approved</div>
          </div>
        )}
      </div>

      {/* Today's progress bar */}
      {todayLessons.length > 0 && (
        <div style={{ height:6, background:'#D1D9E0', borderRadius:3, marginBottom:20, overflow:'hidden' }}>
          <div style={{ height:'100%', background:C.green, width:`${(approved/todayLessons.length)*100}%`, borderRadius:3, transition:'width .4s ease' }} />
        </div>
      )}

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
                subj={subj} lesson={lesson} submission={sub}
                fromDate={shortDate(lesson.originalDate)}
                onSave={(ans, doneT) => save(lesson.subjectId, lesson.lessonNum, ans, doneT, lesson.originalDate)}
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
            return <LessonCard key={lesson.subjectId} subj={subj} lesson={lesson} submission={sub}
              onSave={(ans, doneT) => save(lesson.subjectId, lesson.lessonNum, ans, doneT)}
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
          {todayActivities.map(act => <ActivityCard key={act.id} activity={act} done={isActDone(act.id)} onToggle={() => toggleActivity(act.id)} />)}
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
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
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
          return (
            <button key={s.id} onClick={() => setStu(s.id)} style={{
              ...card, border:'2px solid transparent', cursor:'pointer', textAlign:'left', padding:20, transition:'all .15s'
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor=C.gold; e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.08)'; }}
            >
              <div style={{ fontSize:36, marginBottom:10 }}>{s.emoji}</div>
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
function LessonCard({ subj, lesson, submission, onSave, onComplete, onTasksChange, fromDate }) {
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

  const save = () => { onSave(ans, doneT); setFlash(true); setTimeout(() => setFlash(false), 2000); };

  const handleComplete = (e) => {
    e.stopPropagation(); setCF(true);
    setTimeout(() => { onComplete(doneT); setCF(false); }, 400);
  };

  const canExpand = hasQuestions || hasTasks || lesson.notes?.trim();

  return (
    <div style={{ ...card, borderLeft:`4px solid ${subj.color}`, marginBottom:12 }}>
      {/* Header */}
      <div
        onClick={() => canExpand ? setOpen(o=>!o) : undefined}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor: canExpand ? 'pointer' : 'default', userSelect:'none' }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:22 }}>{subj.icon}</span>
          <div>
            <div style={{ fontWeight:700, fontSize:15, color:C.navy }}>{subj.name}</div>
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
          {!hasQuestions && !hasTasks && status !== 'approved' && onComplete && (
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
                  onClick={() => status !== 'approved' && toggleTask(i)}
                  disabled={status === 'approved'}
                  style={{
                    display:'flex', alignItems:'center', gap:12, width:'100%',
                    background: doneT[i] ? '#F0FDF4' : '#FAFAFA',
                    border:`1px solid ${doneT[i] ? '#86EFAC' : C.border}`,
                    borderRadius:8, padding:'10px 12px', marginBottom:6,
                    cursor: status === 'approved' ? 'default' : 'pointer',
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
                disabled={status==='approved'}
                placeholder="Write your answer here…"
                style={{ ...inp, width:'100%', resize:'vertical', minHeight:64 }}
              />
            </div>
          ))}
          {/* Submit */}
          {hasQuestions && status!=='approved' && (
            <button onClick={save} style={{
              border:'none', borderRadius:8, padding:'10px 0', cursor:'pointer', fontSize:14,
              fontWeight:700, width:'100%', transition:'background .2s',
              background: flash ? C.green : C.navy, color:'white'
            }}>
              {flash ? '✓ Saved!' : 'Submit Answers'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PARENT OVERVIEW ──────────────────────────────────────────────────────────
function Overview({ db }) {
  const pending = db.answers.filter(a => a.status==='pending' && a.answers?.some(x=>x?.trim())).length;
  return (
    <div>
      <div style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:'bold', color:C.navy, marginBottom:4 }}>Today's Overview</div>
      <div style={{ fontSize:14, color:C.muted, marginBottom: pending>0?12:20 }}>{shortDate(TODAY)}</div>
      {pending>0 && (
        <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, padding:'10px 16px', marginBottom:20 }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#92400E' }}>⏳ {pending} submission{pending>1?'s':''} waiting for your review</span>
        </div>
      )}
      {db.gradeGroups.map(gg => {
        const students = db.students.filter(s => s.gradeGroupId===gg.id);
        const planKey  = `${gg.id}:${getMon(TODAY)}`;
        const lessons  = db.plans[planKey]?.[TODAY] || [];
        return (
          <div key={gg.id} style={{ marginBottom:28 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>{gg.name}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {students.map(st => {
                const subs     = db.answers.filter(a => a.studentId===st.id && a.date===TODAY);
                const approved = subs.filter(a => a.status==='approved').length;
                const revise   = subs.filter(a => a.status==='needs_revision').length;
                return (
                  <div key={st.id} style={card}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                      <span style={{ fontSize:26 }}>{st.emoji}</span>
                      <div>
                        <div style={{ fontWeight:700, color:C.navy, fontSize:15 }}>{st.name}</div>
                        <div style={{ fontSize:12, color:C.muted }}>{st.family}</div>
                      </div>
                    </div>
                    {lessons.length===0
                      ? <div style={{ fontSize:12, color:'#ccc' }}>No plan set today</div>
                      : <>
                          <div style={{ height:5, background:'#D1D9E0', borderRadius:3, marginBottom:10, overflow:'hidden' }}>
                            <div style={{ height:'100%', background:C.green, width:`${(approved/lessons.length)*100}%`, borderRadius:3, transition:'width .4s' }} />
                          </div>
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                            {lessons.map(lesson => {
                              const subj = gg.subjects.find(s=>s.id===lesson.subjectId);
                              const sub  = subs.find(a=>a.subjectId===lesson.subjectId);
                              const dot  = !sub || !sub.answers?.some(x=>x?.trim()) ? C.border
                                : sub.status==='approved' ? C.green
                                : sub.status==='needs_revision' ? C.red : C.yellow;
                              return (
                                <span key={lesson.subjectId} title={`${subj?.name} L${lesson.lessonNum}`} style={{ display:'flex', alignItems:'center', gap:3, fontSize:13 }}>
                                  <span style={{ width:9, height:9, borderRadius:'50%', background:dot, display:'inline-block', flexShrink:0 }}/>
                                  {subj?.icon}
                                </span>
                              );
                            })}
                          </div>
                          <div style={{ fontSize:12, color:C.muted }}>
                            {approved}/{lessons.length} approved{revise>0 && <span style={{ color:C.red }}> · {revise} need revision</span>}
                          </div>
                        </>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── WEEK OVERVIEW ────────────────────────────────────────────────────────────
function WeekOverview({ db, weekMon, setWk, onGoToPlan }) {
  const days = weekDays(weekMon);

  const shiftWk = delta => {
    const d = new Date(weekMon + 'T12:00:00');
    d.setDate(d.getDate() + delta * 7);
    setWk(toDate(d));
  };

  // Pending count across the whole week
  const weekAnswers = db.answers.filter(a => days.includes(a.date));
  const weekPending = weekAnswers.filter(a => a.status === 'pending' && a.answers?.some(x => x?.trim())).length;

  return (
    <div>
      {/* Header + week nav */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontFamily:'Georgia,serif', fontSize:21, fontWeight:'bold', color:C.navy, marginBottom:2 }}>Week at a Glance</div>
          <div style={{ fontSize:13, color:C.muted }}>All students · {weekLabel(weekMon)}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Btn onClick={() => shiftWk(-1)} style={{ background:'white', border:`1px solid ${C.border}`, color:'#333', padding:'6px 11px' }}>←</Btn>
          <span style={{ fontWeight:600, fontSize:13, color:C.navy, minWidth:130, textAlign:'center' }}>{weekLabel(weekMon)}</span>
          <Btn onClick={() => shiftWk(1)}  style={{ background:'white', border:`1px solid ${C.border}`, color:'#333', padding:'6px 11px' }}>→</Btn>
          <Btn onClick={() => setWk(getMon(TODAY))} style={{ background:'white', border:`1px solid ${C.border}`, color:C.muted, fontSize:12 }}>This week</Btn>
        </div>
      </div>

      {weekPending > 0 && (
        <div style={{ background:'#FFFBEB', border:`1px solid #FDE68A`, borderRadius:10, padding:'9px 14px', marginBottom:16, fontSize:13, fontWeight:600, color:'#92400E' }}>
          ⏳ {weekPending} submission{weekPending > 1 ? 's' : ''} awaiting review this week
        </div>
      )}

      {/* Grade group blocks */}
      {db.gradeGroups.map(gg => {
        const students = db.students.filter(s => s.gradeGroupId === gg.id);
        const planKey  = `${gg.id}:${weekMon}`;

        return (
          <div key={gg.id} style={{ marginBottom:28 }}>
            {/* Grade label */}
            <div style={{ fontSize:11, fontWeight:800, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>
              {gg.name}
            </div>

            {/* Scrollable grid wrapper */}
            <div style={{ overflowX:'auto' }}>
              <div style={{ minWidth:680 }}>

                {/* Column headers */}
                <div style={{ display:'grid', gridTemplateColumns:'110px repeat(7, 1fr)', gap:5, marginBottom:5 }}>
                  <div />
                  {days.map(day => {
                    const d   = new Date(day + 'T12:00:00');
                    const dow = d.getDay();
                    const isWknd  = dow === 0 || dow === 6;
                    const isTdy   = day === TODAY;
                    return (
                      <div key={day} style={{ textAlign:'center', padding:'4px 0' }}>
                        <div style={{ fontSize:11, fontWeight:700, color: isTdy ? C.gold : isWknd ? '#B0AEAD' : C.navy }}>
                          {d.toLocaleDateString('en-US', { weekday:'short' })}
                        </div>
                        <div style={{ fontSize:10, color: isTdy ? C.gold : C.muted }}>
                          {d.toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Student rows */}
                {students.map(student => {
                  const stuAnswers = db.answers.filter(a => a.studentId === student.id);
                  return (
                    <div key={student.id} style={{ display:'grid', gridTemplateColumns:'110px repeat(7, 1fr)', gap:5, marginBottom:5 }}>
                      {/* Student label */}
                      <div style={{ display:'flex', alignItems:'center', gap:6, paddingRight:6 }}>
                        <span style={{ fontSize:18 }}>{student.emoji}</span>
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color:C.navy, lineHeight:1.2 }}>{student.name}</div>
                          <div style={{ fontSize:10, color:C.muted }}>{student.family}</div>
                        </div>
                      </div>

                      {/* Day cells */}
                      {days.map(day => {
                        const dayPlan  = db.plans[planKey]?.[day] || [];
                        const daySubs  = stuAnswers.filter(a => a.date === day);
                        const dow      = new Date(day + 'T12:00:00').getDay();
                        const isWknd   = dow === 0 || dow === 6;
                        const isTdy    = day === TODAY;

                        if (dayPlan.length === 0) {
                          return (
                            <div key={day} style={{ borderRadius:8, background: isWknd ? '#F4F4F4' : '#F8F9FA', border:`1px solid #EEEEEE`, minHeight:52 }} />
                          );
                        }

                        const approved = daySubs.filter(a => a.status === 'approved').length;
                        const total    = dayPlan.length;
                        const pct      = total > 0 ? (approved / total) * 100 : 0;

                        return (
                          <div key={day} style={{
                            borderRadius:8,
                            background: isTdy ? '#FFFBEB' : 'white',
                            border:`1px solid ${isTdy ? C.gold : C.border}`,
                            padding:'5px 6px',
                            minHeight:52,
                          }}>
                            {/* Subject pills — click to go to plan */}
                            {dayPlan.map(lesson => {
                              const subj    = gg.subjects.find(s => s.id === lesson.subjectId);
                              if (!subj) return null;
                              const sub     = daySubs.find(a => a.subjectId === lesson.subjectId);
                              const hasWork = sub?.answers?.some(a => a?.trim());
                              const st      = sub?.status;
                              const pillBg  = !sub || !hasWork ? '#F3F4F6'
                                : st === 'approved'       ? '#D1FAE5'
                                : st === 'needs_revision' ? '#FEE2E2'
                                : '#FEF3C7';
                              const statusIcon = st === 'approved' ? ' ✓' : st === 'needs_revision' ? ' ↩' : hasWork ? ' …' : '';
                              return (
                                <div key={lesson.subjectId}
                                  onClick={() => onGoToPlan(gg.id)}
                                  title={`${subj.name} — Lesson ${lesson.lessonNum}`}
                                  style={{
                                    display:'flex', alignItems:'center', gap:3,
                                    padding:'2px 5px', marginBottom:2, borderRadius:4,
                                    background:pillBg, border:`1px solid ${subj.color}50`,
                                    cursor:'pointer', fontSize:10, fontWeight:600,
                                    whiteSpace:'nowrap', overflow:'hidden',
                                  }}
                                >
                                  <span style={{ fontSize:11 }}>{subj.icon}</span>
                                  <span style={{ color:C.navy, overflow:'hidden', textOverflow:'ellipsis' }}>{subj.name.slice(0,5)}</span>
                                  <span style={{ color:C.muted, fontWeight:400 }}>L{lesson.lessonNum}{statusIcon}</span>
                                </div>
                              );
                            })}
                            {/* Mini progress bar */}
                            <div style={{ height:2, background:'#E5E7EB', borderRadius:2, overflow:'hidden', marginTop:3 }}>
                              <div style={{ height:'100%', background: pct === 100 ? C.green : C.gold, width:`${pct}%`, borderRadius:2, transition:'width .3s' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div style={{ ...card, padding:'10px 16px', display:'flex', gap:20, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em' }}>Legend</span>
        {[
          ['#E5E7EB', '#9CA3AF', 'Not started'],
          ['#FEF3C7', C.yellow,  'Submitted'],
          ['#D1FAE5', C.green,   'Approved'],
          ['#FEE2E2', C.red,     'Needs revision'],
        ].map(([bg, border, label]) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:C.muted }}>
            <div style={{ width:16, height:16, borderRadius:3, background:bg, border:`1.5px solid ${border}` }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PLANNER ─────────────────────────────────────────────────────────────────
function Planner({ db, mut, weekMon, setWk, activeGG, setActiveGG }) {
  const [showQS, setQS]     = useState(false);
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
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <Btn onClick={copyLastWeek} style={{ background:'white', border:`1px solid ${C.border}`, color:'#333' }}>📋 Copy Last Week</Btn>
          <Btn onClick={()=>{ setQS(true); setSel(null); }} style={{ background:C.gold, color:'white' }}>⚡ Quick Schedule</Btn>
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

      {/* Two-column layout */}
      <div style={{ display:'grid', gridTemplateColumns:'180px 1fr', gap:20 }}>
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
          <label style={lbl}>Questions — one per line</label>
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

// ─── REVIEW ───────────────────────────────────────────────────────────────────
function Review({ db, mut }) {
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

// ─── SETUP ────────────────────────────────────────────────────────────────────
function Setup({ db, mut }) {
  const [tab, setTab] = useState('students');
  return (
    <div>
      <div style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:'bold', color:C.navy, marginBottom:16 }}>Settings</div>
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {[['students','👤 Students'],['courses','📚 Courses'],['templates','📋 Templates'],['activities','🏃 Activities'],['pin','🔒 Parent PIN']].map(([id,label])=>(
          <Btn key={id} onClick={()=>setTab(id)} style={{ background:tab===id?C.navy:'white', color:tab===id?'white':C.muted, border:`1px solid ${C.border}` }}>{label}</Btn>
        ))}
      </div>
      {tab==='students'   && <StudentsTab db={db} mut={mut} />}
      {tab==='courses'    && <CoursesTab db={db} mut={mut} />}
      {tab==='templates'  && <TemplatesTab db={db} mut={mut} />}
      {tab==='activities' && <ActivitiesTab db={db} mut={mut} />}
      {tab==='pin'        && <PinTab db={db} mut={mut} />}
    </div>
  );
}

// ─── ACTIVITIES TAB ───────────────────────────────────────────────────────────
const ACT_COLORS = ['#EF4444','#F97316','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#14B8A6'];
const DAY_LABELS = ['Su','M','T','W','Th','F','Sa']; // index = JS getDay()

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
        <div key={s.id} style={{ ...card, display:'flex', gap:10, alignItems:'center', marginBottom:10, flexWrap:'wrap' }}>
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
      ))}
      <Btn onClick={()=>mut(d=>{d.students.push({id:uid(),name:'New Student',gradeGroupId:d.gradeGroups[0]?.id||'',family:'Family',emoji:'📝'});})}
        style={{ background:C.navy, color:'white' }}>+ Add Student</Btn>
    </div>
  );
}

function CoursesTab({ db, mut }) {
  return (
    <div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:14 }}>Set the starting lesson # for each subject — the planner uses this when auto-numbering new lessons.</div>
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
                style={{ ...inp, flex:1 }} placeholder="Subject name" />
              <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                <label style={{ ...lbl, margin:0, whiteSpace:'nowrap' }}>Start L.</label>
                <input type="number" min={1} value={sub.startLesson}
                  onChange={e=>mut(d=>{const g=d.gradeGroups.find(x=>x.id===gg.id);const s=g?.subjects.find(x=>x.id===sub.id);if(s)s.startLesson=parseInt(e.target.value)||1;})}
                  style={{ ...inp, width:70 }} />
              </div>
              <Btn onClick={()=>mut(d=>{const g=d.gradeGroups.find(x=>x.id===gg.id);if(g)g.subjects=g.subjects.filter(s=>s.id!==sub.id);})}
                style={{ background:'#FEE2E2', color:C.red, padding:'6px 10px' }}>✕</Btn>
            </div>
          ))}
          <Btn onClick={()=>mut(d=>{const g=d.gradeGroups.find(x=>x.id===gg.id);if(g)g.subjects.push({id:uid(),name:'New Subject',icon:'📖',color:'#64748B',startLesson:1});})}
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
function ExportView({ db, weekMon, setWk }) {
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
      <div style={{ fontFamily:'Georgia,serif', fontSize:21, fontWeight:'bold', color:C.navy, marginBottom:4 }}>Export</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>Share the week's plan with co-op parents or import into your calendar.</div>

      {/* Week selector */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
        <Btn onClick={()=>shiftWk(-1)} style={{ background:'white', border:`1px solid ${C.border}`, color:'#333', padding:'6px 11px' }}>←</Btn>
        <span style={{ fontWeight:700, color:C.navy, fontSize:14, minWidth:140, textAlign:'center' }}>{weekLabel(weekMon)}</span>
        <Btn onClick={()=>shiftWk(1)} style={{ background:'white', border:`1px solid ${C.border}`, color:'#333', padding:'6px 11px' }}>→</Btn>
        <span style={{ fontSize:13, color:C.muted }}>{totalLessons} lesson{totalLessons!==1?'s':''} planned</span>
      </div>

      {/* Export options */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:22 }}>
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
