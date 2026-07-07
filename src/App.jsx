import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';
import { PinModal } from './components/PinModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StudentToday } from './components/StudentView';
import { INIT } from './utils/constants';
import { TODAY, getMon } from './utils/dates';
import { Btn, C } from './utils/theme';

// Parent-only tabs are code-split so students never download them and each tab's
// JS loads on first visit instead of up front. React.lazy expects a default
// export, so each named export is remapped to `default`. The two Overview
// wrappers point at the same module — Rollup emits one shared chunk for both.
const Overview     = lazy(() => import('./components/Overview').then(m => ({ default: m.Overview })));
const WeekOverview = lazy(() => import('./components/Overview').then(m => ({ default: m.WeekOverview })));
const Planner      = lazy(() => import('./components/Planner').then(m => ({ default: m.Planner })));
const Review       = lazy(() => import('./components/Review').then(m => ({ default: m.Review })));
const WritingView  = lazy(() => import('./components/Writing').then(m => ({ default: m.WritingView })));
const GradesView   = lazy(() => import('./components/Grades').then(m => ({ default: m.GradesView })));
const ProgressView = lazy(() => import('./components/Progress').then(m => ({ default: m.ProgressView })));
const RecordsView  = lazy(() => import('./components/Records').then(m => ({ default: m.RecordsView })));
const ExportView   = lazy(() => import('./components/Export').then(m => ({ default: m.ExportView })));
const Setup        = lazy(() => import('./components/Setup').then(m => ({ default: m.Setup })));

// Shown briefly while a code-split tab's chunk downloads.
function TabFallback() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'52px 0', color:C.muted, fontFamily:'Georgia, serif', fontSize:15 }}>
      Loading…
    </div>
  );
}

// Full-screen centered message (loading / gate states).
function Splash({ children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:C.bg, fontFamily:'Georgia, serif', fontSize:18, color:C.navy }}>
      {children}
    </div>
  );
}

// Single Supabase client for the whole app. Defined here (not a separate module)
// so bundlers keep the realtime client used for cross-browser live sync.
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── LOGIN ───────────────────────────────────────────────────────────────────
// Passwordless sign-in: the parent enters their email and receives a one-time
// magic link. Clicking it returns them here already signed in (supabase-js reads
// the token from the URL automatically). No passwords are stored anywhere.
function Login() {
  const [email, setEmail]   = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [msg, setMsg]       = useState('');

  const send = async (e) => {
    e.preventDefault();
    const addr = email.trim();
    if (!addr) return;
    setStatus('sending'); setMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) { setStatus('error'); setMsg(error.message); }
    else setStatus('sent');
  };

  return (
    <div style={{ minHeight:'100vh', background:C.navy, display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'system-ui,-apple-system,sans-serif' }}>
      <div style={{ background:'white', borderRadius:16, padding:'34px 30px', width:'100%', maxWidth:380, boxShadow:'0 12px 40px rgba(0,0,0,0.3)', borderTop:`4px solid ${C.gold}` }}>
        <div style={{ fontFamily:'Georgia,serif', fontSize:24, color:C.navy, fontWeight:'bold', textAlign:'center', marginBottom:6 }}>
          📋 RPC Planner
        </div>
        <div style={{ textAlign:'center', color:C.muted, fontSize:14, marginBottom:24 }}>
          Sign in to your family's planner
        </div>

        {status === 'sent' ? (
          <div style={{ textAlign:'center', color:C.navy, fontSize:15, lineHeight:1.5 }}>
            <div style={{ fontSize:34, marginBottom:10 }}>📬</div>
            Check your email — we sent a sign-in link to<br /><strong>{email.trim()}</strong>.
            <div style={{ color:C.muted, fontSize:13, marginTop:14 }}>
              Open it on this device and you'll be signed in. The link expires shortly.
            </div>
            <button onClick={() => { setStatus('idle'); setEmail(''); }} style={{ marginTop:18, background:'none', border:'none', color:C.gold, fontSize:13, fontWeight:700, cursor:'pointer' }}>
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={send}>
            <label style={{ display:'block', fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:C.muted, marginBottom:6 }}>
              Email address
            </label>
            <input
              type="email" required autoFocus value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:8, padding:'11px 13px', fontSize:15, fontFamily:'inherit', boxSizing:'border-box', marginBottom:14 }}
            />
            <button
              type="submit" disabled={status === 'sending'}
              style={{ width:'100%', background:C.navy, color:'white', border:'none', borderRadius:8, padding:'12px', fontSize:15, fontWeight:700, cursor: status==='sending' ? 'default' : 'pointer', opacity: status==='sending' ? 0.7 : 1 }}
            >
              {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </button>
            {status === 'error' && (
              <div style={{ marginTop:12, color:C.red, fontSize:13, textAlign:'center' }}>{msg || 'Something went wrong. Try again.'}</div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

// ─── NO ACCESS ───────────────────────────────────────────────────────────────
// Shown when someone signs in with an email that isn't on the approved list.
function NoAccess({ email, onSignOut }) {
  return (
    <div style={{ minHeight:'100vh', background:C.navy, display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'system-ui,-apple-system,sans-serif' }}>
      <div style={{ background:'white', borderRadius:16, padding:'34px 30px', width:'100%', maxWidth:400, boxShadow:'0 12px 40px rgba(0,0,0,0.3)', borderTop:`4px solid ${C.gold}`, textAlign:'center' }}>
        <div style={{ fontSize:34, marginBottom:10 }}>🔑</div>
        <div style={{ fontFamily:'Georgia,serif', fontSize:20, color:C.navy, fontWeight:'bold', marginBottom:8 }}>
          You're signed in, but not approved yet
        </div>
        <div style={{ color:C.muted, fontSize:14, lineHeight:1.5 }}>
          <strong>{email}</strong> isn't on this planner's approved list. Ask the
          organizer to add your email, then sign in again.
        </div>
        <button onClick={onSignOut} style={{ marginTop:20, background:C.navy, color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─── ROOT ────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession]   = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [db, setDb]       = useState(null);
  const [view, setView]   = useState('today');
  const [mode, setMode]   = useState('student');
  const [stuId, setStu]   = useState(null);
  const [weekMon, setWk]  = useState(() => getMon(TODAY));
  const [planGG, setPGG]  = useState(INIT.gradeGroups[0].id);
  const [showPin, setShowPin] = useState(false);
  // Prefill payload for the Grades composer when jumping straight from Review.
  const [gradePrefill, setGradePrefill] = useState(null);
  const [access, setAccess] = useState('checking'); // checking | ok | denied

  // Auth bootstrap: read any existing session, then listen for sign-in/out
  // (also fires when a magic link is opened and the session is established).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;

  const handleModeToggle = () => {
    if (mode === 'student') {
      const pin = db?.settings?.parentPin;
      if (pin) { setShowPin(true); }
      else { setMode('parent'); setView('today'); }
    } else {
      setMode('student'); setView('today'); setStu(null);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setDb(null); setAccess('checking'); setMode('student'); setView('today'); setStu(null);
  };

  const loadData = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from('shared_data')
        .select('content')
        .eq('id', 1)
        .maybeSingle();
      if (data?.content?.gradeGroups) {
        setDb(data.content); setAccess('ok');
      } else {
        // No row visible. Either the shared planner is not set up yet, or this
        // signed-in email is not on the approved list (RLS hides the row).
        // The seed below succeeds only for an approved member.
        const { error: seedErr } = await supabase
          .from('shared_data').upsert({ id: 1, content: INIT });
        if (seedErr) setAccess('denied');
        else { setDb(INIT); setAccess('ok'); }
      }
    } catch {
      setAccess('denied');
    }
  }, [userId]);

  // Track our own writes so realtime echoes of them don't clobber newer local state
  const pendingWrites = useRef(0);

  useEffect(() => {
    if (!userId) { setDb(null); setAccess('checking'); return; }
    loadData();

    // Fallback: refresh when tab regains focus
    const handleVisibility = () => { if (!document.hidden) loadData(); };
    document.addEventListener('visibilitychange', handleVisibility);

    // Realtime: changes to THIS account's row (from another device) show up here.
    const channel = supabase
      .channel('shared_data_changes')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'shared_data', filter: 'id=eq.1' },
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
  }, [userId, loadData]);

  const mut = fn => setDb(prev => {
    const next = JSON.parse(JSON.stringify(prev));
    fn(next);
    pendingWrites.current += 1;
    supabase
      .from('shared_data')
      .upsert({ id: 1, content: next, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) console.error(error);
        pendingWrites.current = Math.max(0, pendingWrites.current - 1);
      });
    return next;
  });

  // ── Gates ──
  if (!authReady) return <Splash>Loading…</Splash>;
  if (!session)   return <Login />;
  if (access === 'denied') return <NoAccess email={session.user?.email} onSignOut={signOut} />;
  if (!db)        return <Splash>Loading your planner…</Splash>;

  const navItems = mode === 'parent'
    ? [['today','📊 Today'], ['week','🗓 Week'], ['plan','📋 Plan'], ['review','✅ Review'], ['writing','✍️ Writing'], ['grades','🎓 Grades'], ['progress','📈 Progress'], ['records','📄 Records'], ['export','📤 Export'], ['setup','⚙️ Setup']]
    : [['today','📅 Today']];

  const goToPlan = (ggId) => { setPGG(ggId); setView('plan'); };
  // Review → Grades: carry the submission's student/subject/work into the composer.
  const goToGrade = (payload) => { setGradePrefill({ ...payload, token: Date.now() }); setView('grades'); };

  return (
    <div style={{ fontFamily:'system-ui,-apple-system,sans-serif', minHeight:'100vh', background:C.bg }}>
      {/* Global responsive rules */}
      <style>{`
        * { box-sizing: border-box; }
        body {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        /* Gold focus ring — visible keyboard focus + a polished touch */
        input:focus, textarea:focus, select:focus {
          outline: none;
          border-color: ${C.gold} !important;
          box-shadow: 0 0 0 3px rgba(212,146,10,0.15);
        }
        button:focus-visible {
          outline: 2px solid ${C.gold};
          outline-offset: 2px;
        }
        /* Subtle tactility on buttons */
        button:not(:disabled):hover { filter: brightness(1.03); }
        button:not(:disabled):active { transform: translateY(1px); }
        @media (max-width: 560px) {
          .lesson-editor-grid { grid-template-columns: 1fr !important; }
          .app-main { padding: 14px 12px !important; }
          .app-header-title { font-size: 16px !important; }
        }
        @media (max-width: 400px) {
          .app-main { padding: 12px 9px !important; }
        }
        /* Respect users who prefer less motion */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
      {/* Header */}
      <header style={{ background:C.navy, height:56, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', borderBottom:`2px solid ${C.gold}`, boxShadow:'0 2px 10px rgba(15,30,48,0.12)', position:'relative', zIndex:2 }}>
        <span className="app-header-title" style={{ fontFamily:'Georgia,serif', fontSize:18, color:'white', fontWeight:'bold', letterSpacing:'-0.3px' }}>
          📋 RPC Planner
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Btn
            onClick={handleModeToggle}
            style={{ background: mode==='parent' ? C.gold : 'rgba(255,255,255,0.15)', color:'white', padding:'6px 14px' }}
          >
            {mode==='parent' ? '👨‍👩‍👧 Parent Mode' : '🔒 Parent Mode'}
          </Btn>
          {mode==='parent' && (
            <Btn
              onClick={signOut}
              title="Sign out"
              style={{ background:'rgba(255,255,255,0.15)', color:'white', padding:'6px 12px' }}
            >
              Sign out
            </Btn>
          )}
        </div>
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
      <main className="app-main" style={{ maxWidth:960, margin:'0 auto', padding:'20px 16px' }}>
        {/* key={view}: gives each tab its own boundary, so a section that throws
            can be escaped just by switching tabs — the new view remounts clean. */}
        <ErrorBoundary key={view}>
          <Suspense fallback={<TabFallback />}>
            {view==='today' && mode==='student' && <StudentToday db={db} stuId={stuId} setStu={setStu} mut={mut} />}
            {view==='today' && mode==='parent'  && <Overview db={db} onReview={() => setView('review')} />}
            {view==='week'  && mode==='parent'  && <WeekOverview db={db} weekMon={weekMon} setWk={setWk} onGoToPlan={goToPlan} />}
            {view==='plan'  && mode==='parent'  && <Planner db={db} mut={mut} weekMon={weekMon} setWk={setWk} activeGG={planGG} setActiveGG={setPGG} />}
            {view==='review'&& mode==='parent'  && <Review db={db} mut={mut} onGradeThis={goToGrade} />}
            {view==='writing'&& mode==='parent'  && <WritingView db={db} mut={mut} />}
            {view==='grades'&& mode==='parent'  && <GradesView db={db} mut={mut} prefill={gradePrefill} onPrefillConsumed={()=>setGradePrefill(null)} />}
            {view==='progress'&& mode==='parent'  && <ProgressView db={db} />}
            {view==='records'&& mode==='parent'  && <RecordsView db={db} />}
            {view==='export'&& mode==='parent'  && <ExportView db={db} weekMon={weekMon} setWk={setWk} />}
            {view==='setup' && <Setup db={db} mut={mut} />}
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
