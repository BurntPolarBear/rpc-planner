import { TODAY, getMon, shortDate, toDate, weekDays, weekLabel } from '../utils/dates';
import { Btn, C, card } from '../utils/theme';


// ─── PARENT OVERVIEW ──────────────────────────────────────────────────────────
export function Overview({ db, onReview }) {
  const pending = db.answers.filter(a => a.status==='pending' && a.answers?.some(x=>x?.trim())).length;
  const goReview = () => onReview?.();
  return (
    <div>
      <div style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:'bold', color:C.navy, marginBottom:4 }}>Today's Overview</div>
      <div style={{ fontSize:14, color:C.muted, marginBottom: pending>0?12:20 }}>{shortDate(TODAY)}</div>
      {pending>0 && (
        <div
          onClick={onReview ? goReview : undefined}
          role={onReview ? 'button' : undefined}
          tabIndex={onReview ? 0 : undefined}
          onKeyDown={onReview ? (e => { if (e.key==='Enter' || e.key===' ') { e.preventDefault(); goReview(); } }) : undefined}
          title={onReview ? 'Go to Review' : undefined}
          style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, padding:'10px 16px', marginBottom:20, cursor: onReview ? 'pointer' : 'default', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}
        >
          <span style={{ fontSize:13, fontWeight:700, color:'#92400E' }}>⏳ {pending} submission{pending>1?'s':''} waiting for your review</span>
          {onReview && <span style={{ fontSize:13, fontWeight:700, color:'#92400E', whiteSpace:'nowrap' }}>Review →</span>}
        </div>
      )}
      {db.gradeGroups.map(gg => {
        const students = db.students.filter(s => s.gradeGroupId===gg.id);
        const planKey  = `${gg.id}:${getMon(TODAY)}`;
        const lessons  = db.plans[planKey]?.[TODAY] || [];
        return (
          <div key={gg.id} style={{ marginBottom:28 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>{gg.name}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12 }}>
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
export function WeekOverview({ db, weekMon, setWk, onGoToPlan }) {
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
