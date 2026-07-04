import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ExportView } from './components/Export';
import { GradesView } from './components/Grades';
import { Overview, WeekOverview } from './components/Overview';
import { PinModal } from './components/PinModal';
import { Planner } from './components/Planner';
import { ProgressView } from './components/Progress';
import { RecordsView } from './components/Records';
import { Review } from './components/Review';
import { Setup } from './components/Setup';
import { StudentToday } from './components/StudentView';
import { WritingView } from './components/Writing';
import { INIT } from './utils/constants';
import { TODAY, getMon } from './utils/dates';
import { Btn, C } from './utils/theme';


// Single Supabase client for the whole app. Defined here (not a separate module)
// so bundlers keep the realtime client used for cross-browser live sync.
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

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
    ? [['today','📊 Today'], ['week','🗓 Week'], ['plan','📋 Plan'], ['review','✅ Review'], ['writing','✍️ Writing'], ['grades','🎓 Grades'], ['progress','📈 Progress'], ['records','📄 Records'], ['export','📤 Export'], ['setup','⚙️ Setup']]
    : [['today','📅 Today']];

  const goToPlan = (ggId) => { setPGG(ggId); setView('plan'); };

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
      <main className="app-main" style={{ maxWidth:960, margin:'0 auto', padding:'20px 16px' }}>
        {view==='today' && mode==='student' && <StudentToday db={db} stuId={stuId} setStu={setStu} mut={mut} />}
        {view==='today' && mode==='parent'  && <Overview db={db} />}
        {view==='week'  && mode==='parent'  && <WeekOverview db={db} weekMon={weekMon} setWk={setWk} onGoToPlan={goToPlan} />}
        {view==='plan'  && mode==='parent'  && <Planner db={db} mut={mut} weekMon={weekMon} setWk={setWk} activeGG={planGG} setActiveGG={setPGG} />}
        {view==='review'&& mode==='parent'  && <Review db={db} mut={mut} />}
        {view==='writing'&& mode==='parent'  && <WritingView db={db} mut={mut} />}
        {view==='grades'&& mode==='parent'  && <GradesView db={db} mut={mut} />}
        {view==='progress'&& mode==='parent'  && <ProgressView db={db} />}
        {view==='records'&& mode==='parent'  && <RecordsView db={db} />}
        {view==='export'&& mode==='parent'  && <ExportView db={db} weekMon={weekMon} setWk={setWk} />}
        {view==='setup' && <Setup db={db} mut={mut} />}
      </main>
    </div>
  );
}
