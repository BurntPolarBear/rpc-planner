import { useState } from 'react';
import { C } from '../utils/theme';


// ─── PIN MODAL ────────────────────────────────────────────────────────────────
export function PinModal({ correctPin, onSuccess, onCancel }) {
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
