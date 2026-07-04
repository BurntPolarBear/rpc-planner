
// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
export const C = {
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


export const card  = {
  background: C.surf,
  borderRadius: 14,
  border: '1px solid rgba(26,46,74,0.06)',
  boxShadow: '0 1px 2px rgba(15,30,48,0.05), 0 4px 14px rgba(15,30,48,0.05)',
  padding: 16,
};

export const Btn   = ({ style, ...p }) => <button style={{ border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer', fontSize:13, fontWeight:600, lineHeight:1.5, transition:'transform .12s ease, box-shadow .12s ease, background .12s ease, opacity .12s ease', ...style }} {...p} />;

export const inp   = { border:`1.5px solid ${C.border}`, borderRadius:8, padding:'8px 12px', fontSize:14, fontFamily:'inherit', background:'white', boxSizing:'border-box', transition:'border-color .12s ease, box-shadow .12s ease' };

export const lbl   = { display:'block', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:C.muted, marginBottom:4 };
