import { useState } from 'react';
import { TODAY, shortDate, uid } from '../utils/dates';
import { textStats } from '../utils/text';
import { Btn, C, card, inp, lbl } from '../utils/theme';


export function WritingView({ db, mut }) {
  const [stuId, setStuId]   = useState(db.students[0]?.id || '');
  const [title, setTitle]   = useState('');
  const [text, setText]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [analysis, setAnalysis] = useState(null); // fresh result being shown
  const [viewing, setViewing]   = useState(null);  // a saved sample being viewed

  // WordPress pulling
  const [pulling, setPulling] = useState(false);
  const [postList, setPostList] = useState(null);
  const [pullError, setPullError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  const student = db.students.find(s => s.id === stuId);
  const gg = db.gradeGroups.find(g => g.id === student?.gradeGroupId);
  const stats = textStats(text);
  const samples = (db.writingSamples || []).filter(w => w.studentId === stuId).sort((a,b)=>b.date.localeCompare(a.date));
  const baselineCount = samples.filter(s => s.baseline).length;

  const resetInput = () => { setTitle(''); setText(''); setAnalysis(null); setError(null); setPostList(null); setPullError(null); setViewing(null); setImportMsg(null); };

  const pullPosts = async () => {
    if (!student?.blogUrl) { setPullError('No blog address saved for this student. Add one in Setup → Students, or paste the text below.'); return; }
    setPulling(true); setPullError(null); setPostList(null);
    try {
      const res = await fetch('/api/fetch-posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ blogUrl: student.blogUrl, mode: 'list' }),
      });
      const data = await res.json();
      if (!res.ok) { setPullError(data.error || 'Could not fetch posts.'); setPulling(false); return; }
      setPostList(data.posts || []);
    } catch { setPullError('Could not reach the blog. Paste the text instead.'); }
    setPulling(false);
  };

  // Pull recent posts and store them as a voice baseline (text only, no grading).
  const importBaseline = async () => {
    if (!student?.blogUrl) { setPullError('No blog address saved for this student. Add one in Setup → Students first.'); return; }
    setImporting(true); setImportMsg(null); setPullError(null);
    try {
      const res = await fetch('/api/fetch-posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ blogUrl: student.blogUrl, mode: 'list', perPage: 10 }),
      });
      const data = await res.json();
      if (!res.ok) { setImportMsg({ type:'err', text: data.error || 'Could not fetch posts.' }); setImporting(false); return; }
      const posts = data.posts || [];
      let added = 0, skipped = 0;
      mut(d => {
        if (!d.writingSamples) d.writingSamples = [];
        posts.forEach(p => {
          const postDate = (p.date || TODAY).slice(0,10);
          const dup = d.writingSamples.some(w => w.studentId===stuId && w.title===p.title && w.date===postDate);
          if (dup || textStats(p.text).words < 20) { skipped++; return; }
          d.writingSamples.push({
            id: uid(), studentId: stuId, date: postDate,
            title: p.title || '(untitled)', text: (p.text||'').slice(0,6000),
            wordCount: textStats(p.text).words, source: 'wordpress', baseline: true, analysis: null,
          });
          added++;
        });
      });
      setImportMsg({ type:'ok', text: `Imported ${added} past post${added!==1?'s':''} as voice baseline${skipped>0?` (${skipped} skipped — already imported or too short)`:''}. The voice check will now work right away.` });
    } catch { setImportMsg({ type:'err', text:'Could not reach the blog. Check the address in Setup → Students.' }); }
    setImporting(false);
  };

  const choosePost = (p) => { setTitle(p.title || ''); setText(p.text || ''); setPostList(null); setAnalysis(null); setViewing(null); };

  const analyze = async () => {
    if (stats.words < 20) { setError('That looks too short to analyze — pull or paste the full post.'); return; }
    setLoading(true); setError(null); setViewing(null);
    try {
      const priorSamples = samples.slice(0, 3).map(s => (s.text || '').slice(0, 1500));
      const res = await fetch('/api/analyze-writing', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, gradeLevel: gg?.name || '', priorSamples }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Analysis failed.'); setLoading(false); return; }
      setAnalysis(data.analysis);
      // Save to history (bounded text length keeps the database compact)
      mut(d => {
        if (!d.writingSamples) d.writingSamples = [];
        d.writingSamples.push({
          id: uid(), studentId: stuId, date: TODAY,
          title: title || '(untitled)', text: text.slice(0, 6000),
          wordCount: stats.words, source: 'writing', analysis: data.analysis,
        });
      });
    } catch { setError('Could not reach the AI. Check your connection and try again.'); }
    setLoading(false);
  };

  const deleteSample = (id) => mut(d => { d.writingSamples = (d.writingSamples||[]).filter(w => w.id !== id); });

  const shown = viewing?.analysis || analysis;

  return (
    <div>
      <div style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:'bold', color:C.navy, marginBottom:4 }}>Writing Insight</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>Grade a post against grade-level expectations, get discussion questions, and see how it compares to the student's own past writing.</div>

      {/* Student selector */}
      <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
        {db.students.map(s => (
          <button key={s.id} onClick={()=>{ setStuId(s.id); resetInput(); }} style={{
            ...inp, cursor:'pointer', fontWeight: stuId===s.id?700:400,
            background: stuId===s.id?C.navy:'white', color: stuId===s.id?'white':'#333',
            border:`1px solid ${stuId===s.id?C.navy:C.border}`, padding:'7px 14px', borderRadius:8,
          }}>{s.emoji} {s.name}</button>
        ))}
      </div>

      {/* Input card */}
      <div style={{ ...card, marginBottom:18 }}>
        {/* WordPress pull */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:12, paddingBottom:12, borderBottom:`1px solid ${C.border}` }}>
          <Btn onClick={pullPosts} disabled={pulling} style={{ background: pulling?'#9CA3AF':C.navy, color:'white' }}>
            {pulling ? 'Fetching…' : '🌐 Pull a post to grade'}
          </Btn>
          <Btn onClick={importBaseline} disabled={importing} style={{ background: importing?'#9CA3AF':'white', border:`1px solid ${C.navy}`, color:C.navy }}>
            {importing ? 'Importing…' : '📥 Build voice baseline from blog'}
          </Btn>
          <span style={{ fontSize:12, color:C.muted }}>
            {student?.blogUrl ? `Blog: ${student.blogUrl}` : 'No blog saved — add one in Setup → Students, or paste below.'}
          </span>
        </div>
        {baselineCount > 0 && (
          <div style={{ fontSize:12, color:C.green, marginBottom:10 }}>🎙️ Voice baseline: {baselineCount} past post{baselineCount!==1?'s':''} on file.</div>
        )}
        {importMsg && (
          <div style={{ fontSize:12, color: importMsg.type==='ok'?C.green:C.red, marginBottom:10, background: importMsg.type==='ok'?'#F0FDF4':'#FEF2F2', border:`1px solid ${importMsg.type==='ok'?'#86EFAC':'#FCA5A5'}`, borderRadius:6, padding:'8px 10px' }}>
            {importMsg.text}
          </div>
        )}
        {pullError && <div style={{ fontSize:12, color:C.red, marginBottom:10 }}>{pullError}</div>}
        {postList && (
          <div style={{ marginBottom:12 }}>
            {postList.length === 0 ? <div style={{ fontSize:13, color:C.muted }}>No posts found on that blog.</div> :
              postList.map(p => (
                <button key={p.id} onClick={()=>choosePost(p)} style={{
                  display:'block', width:'100%', textAlign:'left', background:'#F8FAFC', border:`1px solid ${C.border}`,
                  borderRadius:8, padding:'8px 12px', marginBottom:6, cursor:'pointer',
                }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.navy }}>{p.title}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{p.date ? shortDate(p.date.slice(0,10)) : ''} · {textStats(p.text).words} words</div>
                </button>
              ))
            }
          </div>
        )}

        {/* Manual entry */}
        <label style={lbl}>Title</label>
        <input value={title} onChange={e=>setTitle(e.target.value)} style={{ ...inp, width:'100%', marginBottom:10 }} placeholder="Post title" />
        <label style={lbl}>The writing</label>
        <textarea value={text} onChange={e=>setText(e.target.value)} style={{ ...inp, width:'100%', minHeight:160, resize:'vertical', fontSize:14, display:'block' }} placeholder="Pull from WordPress above, or paste the student's post here." />

        <div style={{ display:'flex', gap:14, alignItems:'center', flexWrap:'wrap', marginTop:10 }}>
          <span style={{ fontSize:12, color:C.muted }}>📊 {stats.words} words · {stats.sentences} sentences · ~{stats.avg} words/sentence</span>
          <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
            {text && <Btn onClick={resetInput} style={{ background:'#E8EEF4', color:C.muted }}>Clear</Btn>}
            <Btn onClick={analyze} disabled={loading || stats.words<20} style={{ background: (loading||stats.words<20)?'#9CA3AF':C.gold, color:'white', fontWeight:700 }}>
              {loading ? 'Analyzing…' : '✨ Analyze Writing'}
            </Btn>
          </div>
        </div>
        {error && <div style={{ fontSize:13, color:C.red, marginTop:10 }}>{error}</div>}
      </div>

      {/* Results */}
      {shown && <AnalysisResult analysis={shown} title={viewing?.title || title} />}

      {/* History */}
      {samples.length > 0 && (
        <div style={{ marginTop:22 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>
            {student?.name}'s Writing History
          </div>
          {samples.map(s => {
            const graded = !!s.analysis;
            const openAnalysis = () => { if (graded) { setViewing(s); setAnalysis(null); window.scrollTo({top:0,behavior:'smooth'}); } };
            return (
              <div key={s.id} style={{ ...card, marginBottom:8, display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flex:1, cursor: graded?'pointer':'default' }} onClick={openAnalysis}>
                  <div style={{ fontSize:14, fontWeight:600, color:C.navy }}>{s.title}</div>
                  <div style={{ fontSize:12, color:C.muted }}>
                    {shortDate(s.date)} · {s.wordCount} words · {graded
                      ? <>Grade: <strong>{s.analysis?.overall || '—'}</strong></>
                      : <span style={{ color:C.green }}>🎙️ Voice baseline</span>}
                  </div>
                </div>
                {graded && <Btn onClick={openAnalysis} style={{ background:'#E8EEF4', color:C.navy, fontSize:12 }}>View</Btn>}
                <Btn onClick={()=>deleteSample(s.id)} style={{ background:'#FEE2E2', color:C.red, padding:'6px 10px' }}>✕</Btn>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function AnalysisResult({ analysis, title }) {
  const a = analysis || {};
  const traits = a.traits || [];
  const voiceColor = { consistent:C.green, somewhat_different:C.yellow, notably_different:C.red };
  const voiceLabel = { consistent:'Consistent with their usual writing', somewhat_different:'Somewhat different from their usual writing', notably_different:'Notably different from their usual writing' };

  return (
    <div>
      {/* Grade header */}
      <div style={{ ...card, marginBottom:14, display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ width:64, height:64, borderRadius:14, background:C.navy, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontSize:26, fontWeight:'bold', flexShrink:0 }}>
          {a.overall || '—'}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'Georgia,serif', fontSize:17, fontWeight:'bold', color:C.navy }}>{title || 'Writing assessment'}</div>
          <div style={{ fontSize:12, color:C.muted }}>Graded on the 6 Traits of Writing, for this student's grade level</div>
        </div>
      </div>

      {/* Traits */}
      <div style={{ ...card, marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:12 }}>The 6 Traits</div>
        {traits.map((t, i) => (
          <div key={i} style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#333' }}>{t.name}</span>
              <span style={{ fontSize:12, fontWeight:700, color:C.navy, fontVariantNumeric:'tabular-nums' }}>{t.score}/5</span>
            </div>
            <div style={{ height:7, background:'#E5E7EB', borderRadius:4, overflow:'hidden', marginBottom:4 }}>
              <div style={{ height:'100%', width:`${(Math.min(Math.max(t.score,0),5)/5)*100}%`, background: t.score>=4?C.green : t.score>=3?C.gold : C.red, borderRadius:4, transition:'width .5s ease' }} />
            </div>
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.5 }}>{t.comment}</div>
          </div>
        ))}
      </div>

      {/* Strengths + improvements */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12, marginBottom:14 }}>
        <div style={{ ...card, borderLeft:`4px solid ${C.green}` }}>
          <div style={{ fontSize:12, fontWeight:800, color:C.green, marginBottom:8, letterSpacing:'0.05em' }}>STRENGTHS</div>
          {(a.strengths||[]).map((s,i)=><div key={i} style={{ fontSize:13, color:'#333', marginBottom:6, lineHeight:1.5 }}>✓ {s}</div>)}
        </div>
        <div style={{ ...card, borderLeft:`4px solid ${C.gold}` }}>
          <div style={{ fontSize:12, fontWeight:800, color:C.yellow, marginBottom:8, letterSpacing:'0.05em' }}>WORK ON NEXT</div>
          {(a.improvements||[]).map((s,i)=><div key={i} style={{ fontSize:13, color:'#333', marginBottom:6, lineHeight:1.5 }}>→ {s}</div>)}
        </div>
      </div>

      {/* Voice check */}
      {a.voice && (
        <div style={{ ...card, marginBottom:14, borderLeft:`4px solid ${voiceColor[a.voice.assessment]||C.muted}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ fontSize:15 }}>🎙️</span>
            <span style={{ fontSize:14, fontWeight:700, color: voiceColor[a.voice.assessment]||C.navy }}>{voiceLabel[a.voice.assessment] || 'Voice check'}</span>
          </div>
          <div style={{ fontSize:13, color:'#333', lineHeight:1.6, marginBottom:8 }}>{a.voice.explanation}</div>
          <div style={{ fontSize:11, color:C.muted, fontStyle:'italic', background:'#F8FAFC', borderRadius:6, padding:'8px 10px' }}>
            This is a signal to consider, not a verdict — the best next step is a friendly conversation using the questions below, never an accusation.
          </div>
        </div>
      )}

      {/* Discussion questions */}
      {(a.questions||[]).length > 0 && (
        <div style={{ ...card, marginBottom:14, background:'#F5F3FF', border:'1px solid #DDD6FE' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#5B21B6', marginBottom:10 }}>💬 Questions to talk through together</div>
          {(a.questions||[]).map((q,i)=>(
            <div key={i} style={{ fontSize:14, color:'#333', marginBottom:8, lineHeight:1.5, display:'flex', gap:8 }}>
              <span style={{ color:'#7C3AED', fontWeight:700 }}>{i+1}.</span> {q}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
