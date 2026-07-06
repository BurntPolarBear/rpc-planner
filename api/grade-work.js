// Serverless function: grades a piece of student work against national
// grade-level standards. Accepts either typed/pasted text OR photos of
// handwritten work (Claude transcribes the handwriting, then grades it).
// Returns a rubric breakdown, a letter grade, and — most importantly for a
// homeschool family — an honest read on where this sits relative to typical
// students at that grade level. The API key stays server-side.
//
// This produces a PROPOSED grade. In the app, a parent reviews and can adjust
// it before it is ever saved to the report card the student sees.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI is not configured yet. Add ANTHROPIC_API_KEY in Vercel settings.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const subject    = (body?.subject || 'this subject').trim();
  const gradeLevel = (body?.gradeLevel || '').trim();
  const rigor      = body?.rigor === 'rigorous' ? 'rigorous' : 'standard';
  const title      = (body?.title || '').trim();
  const text       = (body?.text || '').trim();
  const images     = Array.isArray(body?.images) ? body.images.slice(0, 5) : [];
  // Optional assignment-type preset (from the Grades composer). Shapes which rubric
  // categories the AI builds; it never sets the score. Capped as untrusted input.
  const assignmentType = (body?.assignmentType || '').trim().slice(0, 200);
  const rubricGuidance = (body?.rubricGuidance || '').trim().slice(0, 900);

  const hasImages = images.length > 0;
  if (!hasImages && text.length < 30) {
    return res.status(400).json({ error: 'That looks too short to grade. Paste the full piece, pull it from the blog, or upload a clear photo.' });
  }

  const rigorLine = rigor === 'rigorous'
    ? `RIGOR: Measure this against the STRONGEST students in the country for ${gradeLevel || 'this grade'} — the level a top classical or advanced program (or a "Level 4 / Exceeds" state benchmark, or NAEP "Advanced") would expect. Do NOT lower expectations for age alone. Be encouraging but honest about gaps compared to elite performance.`
    : `RIGOR: Measure this against TYPICAL, solid grade-level expectations for ${gradeLevel || 'this grade'} nationally — what a good public or homeschool student at this grade is expected to do by year's end.`;

  const assignmentLine = assignmentType
    ? `ASSIGNMENT TYPE: This work is ${assignmentType}. ${rubricGuidance} Use rubric categories that fit this assignment type (adapt the generic examples below to match it), still sized so the "max" values sum to exactly 100. Judge the work by what matters for this kind of assignment.`
    : '';

  const transcribeLine = hasImages
    ? `The work is handwritten and provided as photo(s). FIRST, transcribe exactly what the student wrote, preserving their real spelling, punctuation, and paragraphing (do not silently correct errors — conventions are part of the grade). Put that in the "transcription" field. If parts are illegible, write [illegible] rather than guessing. THEN grade the transcribed work.`
    : '';

  const prompt = `You are an experienced teacher grading a homeschool student's work in ${subject}. Your job is to give the family an honest, useful grade AND a clear sense of where this work stands relative to other students at the same grade level across the country — homeschool families often lack that reference point.

${gradeLevel ? `Student's grade level: ${gradeLevel}.` : ''}
${rigorLine}
${transcribeLine}
${assignmentLine}

Build a rubric of 4 to 6 categories appropriate to ${subject} and to this grade level (for example, writing-style subjects: Ideas & Content, Organization, Evidence/Support, Language & Style, Conventions; content subjects like History or Science: Understanding of Content, Accuracy, Use of Evidence/Detail, Organization & Clarity, Conventions). Assign each category a "max" number of points; the max values across all categories MUST sum to exactly 100. Award earned "points" for each category with a specific one-sentence comment that cites something concrete from the work. The overall "score" MUST equal the sum of the earned points (0-100).

Also give:
- "benchmark": exactly one of "below", "approaching", "at", "above", "well_above" — where this work sits versus ${rigor === 'rigorous' ? 'the strongest students nationally' : 'typical students nationally'} at this grade level. Be honest; do not inflate.
- "benchmarkNote": one plain sentence explaining that placement.
- "letter": a letter grade (A, A-, B+, ... F) matching the score.
- "strengths": 2-3 concrete strengths.
- "improvements": 2-3 specific, actionable next steps.
- "summary": 1-2 warm sentences addressed TO the student, honest but encouraging.
- "teacherNote": 1-2 sentences addressed to the PARENT, giving context on how this compares to grade-level standards and what to watch for.

Grade fairly and encouragingly, but do not inflate — an inaccurate grade is not kind. ${gradeLevel ? `Judge against ${gradeLevel}, not an absolute adult standard.` : ''}

${hasImages ? '' : `--- STUDENT WORK ---\n${text}\n--- END ---`}

Respond with ONLY valid JSON, no markdown fences, in exactly this shape:
{
  "transcription": ${hasImages ? '"the faithful transcription here"' : 'null'},
  "letter": "B+",
  "score": 88,
  "benchmark": "at",
  "benchmarkNote": "...",
  "rubric": [
    {"name": "Ideas & Content", "points": 34, "max": 40, "comment": "..."},
    {"name": "Organization", "points": 26, "max": 30, "comment": "..."}
  ],
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "summary": "...",
  "teacherNote": "..."
}`;

  // Build the message content. For photos, prepend the image blocks.
  let content;
  if (hasImages) {
    const imageBlocks = images
      .filter(im => im && im.data)
      .map(im => ({
        type: 'image',
        source: { type: 'base64', media_type: im.media_type || 'image/jpeg', data: im.data },
      }));
    content = [...imageBlocks, { type: 'text', text: prompt }];
  } else {
    content = prompt;
  }

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2600,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      return res.status(502).json({ error: 'The AI service returned an error.', detail });
    }

    const data = await aiRes.json();
    let out = (data.content || []).map(b => b.text || '').join('').trim();
    out = out.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed;
    try { parsed = JSON.parse(out); }
    catch { return res.status(502).json({ error: 'The AI returned an unexpected format. Try again.' }); }

    return res.status(200).json({ grade: parsed });
  } catch (err) {
    return res.status(500).json({ error: 'Could not reach the AI service.', detail: String(err) });
  }
}
