// Serverless function: fetches posts from a student's WordPress blog.
// Runs server-side (no browser CORS limits). Handles all common setups:
//  - self-hosted WordPress            -> {site}/wp-json/wp/v2/posts
//  - free wordpress.com subdomains    -> {site}/wp-json/wp/v2/posts (also proxy)
//  - custom-domain wordpress.com      -> public-api.wordpress.com proxy
// Tries the direct endpoint first, then the WordPress.com proxy as a fallback.

function stripHtml(html = '') {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8216;/g, '\u2018')
    .replace(/&#8220;/g, '\u201C')
    .replace(/&#8221;/g, '\u201D')
    .replace(/&#8211;/g, '\u2013')
    .replace(/&#8212;/g, '\u2014')
    .replace(/&#8230;/g, '\u2026')
    .replace(/&#039;/g, '\u2019')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeBase(url) {
  let u = (url || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u.replace(/\/+$/, '').replace(/\/wp-json.*$/i, '');
}

function hostOf(base) {
  try { return new URL(base).host; } catch { return base.replace(/^https?:\/\//i, '').replace(/\/.*$/, ''); }
}

// Try a list of endpoint URLs in order; return the first that returns valid JSON.
async function tryEndpoints(urls) {
  let lastStatus = 0;
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      lastStatus = r.status;
      if (r.ok) {
        const data = await r.json();
        return { ok: true, data };
      }
    } catch { /* try next */ }
  }
  return { ok: false, status: lastStatus };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const base = normalizeBase(body?.blogUrl);
  const mode = body?.mode || 'list';
  const postId = body?.postId;
  const perPage = Math.min(Math.max(parseInt(body?.perPage) || 10, 1), 20);

  if (!base) return res.status(400).json({ error: 'Enter the blog address first.' });

  const host = hostOf(base);
  const fields = '_fields=id,date,link,title,content';

  try {
    let result;
    if (mode === 'single' && postId) {
      result = await tryEndpoints([
        `${base}/wp-json/wp/v2/posts/${encodeURIComponent(postId)}?${fields}`,
        `https://public-api.wordpress.com/wp/v2/sites/${host}/posts/${encodeURIComponent(postId)}?${fields}`,
      ]);
    } else {
      result = await tryEndpoints([
        `${base}/wp-json/wp/v2/posts?per_page=${perPage}&${fields}`,
        `https://public-api.wordpress.com/wp/v2/sites/${host}/posts?per_page=${perPage}&${fields}`,
      ]);
    }

    if (!result.ok) {
      return res.status(502).json({
        error: `Couldn't read posts from that blog (status ${result.status || 'no response'}). Double-check the address, or paste the text instead.`,
      });
    }

    const data = result.data;

    if (mode === 'single' && postId) {
      return res.status(200).json({ post: {
        id: data.id,
        title: stripHtml(data?.title?.rendered || ''),
        text: stripHtml(data?.content?.rendered || ''),
        date: data.date, link: data.link,
      }});
    }

    const posts = (Array.isArray(data) ? data : []).map(p => ({
      id: p.id,
      title: stripHtml(p?.title?.rendered || '(untitled)'),
      text: stripHtml(p?.content?.rendered || ''),
      date: p.date,
      link: p.link,
    }));
    return res.status(200).json({ posts });
  } catch (err) {
    return res.status(500).json({ error: 'Could not reach that blog. Check the address, or paste the text instead.', detail: String(err) });
  }
}
