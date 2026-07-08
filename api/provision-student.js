// Serverless function: creates or updates a student's login (name + passcode).
// Called by a signed-in PARENT from the Setup screen. Uses the Supabase service
// role key (server-side only) to create the auth account, and records the
// student_id <-> account mapping. The service key never reaches the browser.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Students authenticate with a derived internal email; no real email is ever used
// or sent (accounts are created pre-confirmed).
const emailFor = (username) => `${username}@students.rpcplanner.app`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY || !SUPABASE_URL) {
    return res.status(500).json({ error: 'Server is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY in Vercel settings.' });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Verify the caller is a signed-in, approved parent.
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Please sign in again.' });

  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  const callerEmail = caller?.user?.email?.toLowerCase();
  if (callerErr || !callerEmail) return res.status(401).json({ error: 'Please sign in again.' });

  const { data: member } = await admin
    .from('members').select('email').ilike('email', callerEmail).maybeSingle();
  if (!member) return res.status(403).json({ error: 'Only approved parents can create student logins.' });

  // 2) Validate input.
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const studentId = (body?.studentId || '').trim();
  const username  = (body?.username || '').trim().toLowerCase();
  const passcode  = (body?.passcode || '').trim();

  if (!studentId || !username || !passcode) {
    return res.status(400).json({ error: 'Student, username, and passcode are all required.' });
  }
  if (!/^[a-z0-9._-]{2,40}$/.test(username)) {
    return res.status(400).json({ error: 'Username can use only letters, numbers, dots, dashes, and underscores.' });
  }
  if (passcode.length < 4) {
    return res.status(400).json({ error: 'Passcode must be at least 4 characters.' });
  }

  const email = emailFor(username);
  const meta  = { student_id: studentId, username, role: 'student' };

  try {
    // 3) If this student already has a login, update it; otherwise create one.
    const { data: existing } = await admin
      .from('student_profiles').select('user_id').eq('student_id', studentId).maybeSingle();

    if (existing) {
      const { error: updErr } = await admin.auth.admin.updateUserById(existing.user_id, {
        email, password: passcode, email_confirm: true, user_metadata: meta,
      });
      if (updErr) return res.status(400).json({ error: `Could not update login: ${updErr.message}` });
      await admin.from('student_profiles').update({ username }).eq('user_id', existing.user_id);
      return res.status(200).json({ ok: true, username, updated: true });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password: passcode, email_confirm: true, user_metadata: meta,
    });
    if (createErr) {
      const msg = /registered|exists/i.test(createErr.message)
        ? 'That username is already taken. Pick a different one.'
        : `Could not create login: ${createErr.message}`;
      return res.status(400).json({ error: msg });
    }

    const { error: profErr } = await admin
      .from('student_profiles').insert({ user_id: created.user.id, student_id: studentId, username });
    if (profErr) return res.status(500).json({ error: `Login created but mapping failed: ${profErr.message}` });

    return res.status(200).json({ ok: true, username, created: true });
  } catch (err) {
    return res.status(500).json({ error: `Unexpected error: ${String(err)}` });
  }
}
