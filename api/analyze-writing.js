// Serverless function: analyzes a student's writing.
// Returns a grade-level-aware 6-Traits assessment, an optional voice-consistency
// signal (compared to the student's own prior writing), and discussion questions
// a parent can use to talk through the piece. The API key stays server-side.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI is not configured yet. Add ANTHROPIC_API_KEY in Vercel settings.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const text       = (body?.text || '').trim();
  const gradeLevel = (body?.gradeLevel || '').trim();
  const priorSamples = Array.isArray(body?.priorSamples) ? body.priorSamples.slice(0, 3) : [];

  if (!text || text.length < 40) {
    return res.status(400).json({ error: 'That looks too short to analyze. Paste or pull the full post.' });
  }

  const hasBaseline = priorSamples.length > 0;
  const priorBlock = hasBaseline
    ? `\n\nFor the VOICE check, here are excerpts from this same student's PAST writing (their normal baseline). Compare the new piece against these:\n${priorSamples.map((s, i) => `--- Past sample ${i + 1} ---\n${s}`).join('\n')}`
    : '';

  const prompt = `You are an experienced homeschool writing coach. Assess the student writing below.

${gradeLevel ? `The student's approximate grade level: ${gradeLevel}. Judge against expectations for THAT grade level, not an absolute standard.` : ''}

Grade using the 6 Traits of Writing. For each trait give a score from 1 to 5 (whole or half numbers) and a one-sentence comment that cites something specific from the text.

Also provide: an overall letter grade appropriate to the grade level, 2-3 concrete strengths, 2-3 specific things to work on next, and 3 discussion questions a parent can ask — questions a student who genuinely wrote and understood this piece could answer easily, phrased warmly (these are conversation starters, NOT a test).
${hasBaseline ? `\nFinally, a VOICE check: compare this piece to the student's past writing baseline provided below. Assess whether the vocabulary, sentence complexity, and style are consistent with their usual work. Return one of: "consistent", "somewhat_different", or "notably_different", with a brief neutral explanation of what specifically is similar or different. This is a SIGNAL for a human to weigh, never an accusation — phrase it neutrally.` : ''}
${priorBlock}

--- STUDENT WRITING TO ASSESS ---
${text}
--- END ---

Respond with ONLY valid JSON, no markdown, in exactly this shape:
{
  "overall": "B+",
  "traits": [
    {"name": "Ideas & Content", "score": 4, "comment": "..."},
    {"name": "Organization", "score": 3.5, "comment": "..."},
    {"name": "Voice", "score": 4, "comment": "..."},
    {"name": "Word Choice", "score": 3, "comment": "..."},
    {"name": "Sentence Fluency", "score": 4, "comment": "..."},
    {"name": "Conventions", "score": 3.5, "comment": "..."}
  ],
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "questions": ["...", "...", "..."],
  "voice": ${hasBaseline ? `{"assessment": "consistent", "explanation": "..."}` : `null`}
}`;

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 3072,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      return res.status(502).json({ error: 'The AI service returned an error.', detail });
    }

    const data = await aiRes.json();
    let out = (data.content || []).map(b => b.text || '').join('').trim();
    // Strip accidental code fences
    out = out.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed = null;
    try { parsed = JSON.parse(out); } catch { /* fall through to extraction */ }
    if (!parsed) {
      const first = out.indexOf('{'), last = out.lastIndexOf('}');
      if (first !== -1 && last > first) { try { parsed = JSON.parse(out.slice(first, last + 1)); } catch { /* */ } }
    }
    if (!parsed) return res.status(502).json({ error: 'The AI returned an unexpected format. Try again.' });

    return res.status(200).json({ analysis: parsed, hasBaseline });
  } catch (err) {
    return res.status(500).json({ error: 'Could not reach the AI service.', detail: String(err) });
  }
}
