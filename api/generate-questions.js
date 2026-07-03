// Serverless function: generates comprehension questions via the Anthropic API.
// The API key stays server-side (never exposed to the browser).
// Set ANTHROPIC_API_KEY in Vercel → Project → Settings → Environment Variables.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AI is not configured yet. Add ANTHROPIC_API_KEY in Vercel settings.' });
  }

  // Vercel parses JSON bodies automatically, but guard just in case.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const summary = (body?.summary || '').trim();
  const subject = (body?.subject || '').trim();
  const count   = Math.min(Math.max(parseInt(body?.count) || 4, 1), 8);

  if (!summary) {
    return res.status(400).json({ error: 'Please enter a lesson summary or topic first.' });
  }

  const prompt = `You are helping a homeschool parent write comprehension questions for a lesson.

${subject ? `Subject: ${subject}\n` : ''}Lesson summary or topic:
${summary}

Write exactly ${count} clear comprehension questions a student should be able to answer after completing this lesson.

Rules:
- Output ONLY the questions, one per line
- No numbering, no bullet points, no preamble, no closing remarks
- Favor questions that test understanding and reasoning over simple recall
- Keep each question concise and age-appropriate for a homeschool student`;

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      return res.status(502).json({ error: 'The AI service returned an error.', detail });
    }

    const data = await aiRes.json();
    const text = (data.content || []).map(b => b.text || '').join('');

    const questions = text
      .split('\n')
      .map(line => line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
      .filter(Boolean);

    return res.status(200).json({ questions });
  } catch (err) {
    return res.status(500).json({ error: 'Could not reach the AI service.', detail: String(err) });
  }
}
