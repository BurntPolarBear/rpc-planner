import { Component } from 'react';
import { C, Btn } from '../utils/theme';

// Error boundary for the lazily-loaded tab area.
//
// Suspense handles the *loading* state of a code-split tab, but it has no path
// for *failure*. The most common failure here is a stale chunk: after a Vercel
// redeploy, a browser that has been open since before the deploy requests a
// chunk hash that no longer exists, the dynamic import rejects, and — with no
// boundary above it — React tears the whole app down to a blank white screen.
// A student mid-lesson would simply see nothing.
//
// This catches that (and any ordinary render error inside a tab) and shows a
// calm recovery card instead. Reloading re-fetches index.html and its fresh
// chunk URLs, which is the guaranteed fix for the stale-chunk case; "Try again"
// clears the boundary for a transient hiccup. In App.jsx the boundary is keyed
// on the active view, so simply switching tabs also gives a broken section a
// clean remount.
//
// Error boundaries must be class components — there is no Hook equivalent.

// Distinguish a dynamic-import / chunk-load failure (fixed by reloading) from an
// ordinary render error. Vite emits messages like "Failed to fetch dynamically
// imported module" or "error loading dynamically imported module"; browsers may
// also throw a ChunkLoadError or an "Importing a module script failed" message.
function isChunkError(err) {
  const msg = `${err?.name || ''} ${err?.message || ''}`;
  return /dynamically imported module|Loading chunk|ChunkLoadError|module script failed|Failed to fetch/i.test(msg);
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surfaces in the browser console for debugging; nothing is sent anywhere.
    console.error('A section failed to render:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunk = isChunkError(error);

    return (
      <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}>
        <div style={{
          maxWidth: 460,
          width: '100%',
          background: C.surf,
          borderRadius: 14,
          border: '1px solid rgba(26,46,74,0.06)',
          boxShadow: '0 1px 2px rgba(15,30,48,0.05), 0 4px 14px rgba(15,30,48,0.05)',
          padding: '28px 24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>{chunk ? '🔄' : '⚠️'}</div>

          <div style={{ fontFamily:'Georgia, serif', fontSize:19, fontWeight:'bold', color:C.navy, marginBottom:8 }}>
            {chunk ? 'A new version is ready' : 'This section hit a snag'}
          </div>

          <div style={{ fontSize:14, color:C.muted, lineHeight:1.6, marginBottom:20 }}>
            {chunk
              ? 'The planner was updated in the background, so this part needs a fresh load. Reload the page to pick up the newest version — your saved work is safe.'
              : 'Something in this section stopped working. Your saved data is safe. Try again, or reload the page.'}
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            <Btn
              onClick={() => window.location.reload()}
              style={{ background:C.navy, color:'white' }}
            >
              🔄 Reload page
            </Btn>
            <Btn
              onClick={() => this.setState({ error: null })}
              style={{ background:'#E8EEF4', color:C.muted }}
            >
              Try again
            </Btn>
          </div>
        </div>
      </div>
    );
  }
}
