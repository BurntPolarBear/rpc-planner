import { assembleDb, diffAndSync } from '../src/utils/recordsStore.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error('FAIL:', m); } };

// Mock supabase capturing writes
function mockSupabase() {
  const ops = { upserts: [], deletes: [] };
  return {
    ops,
    from() {
      return {
        upsert(rows) { ops.upserts.push(...rows); return Promise.resolve({ error: null }); },
        delete() { return { eq() { return { in(_c, ids) { ids.forEach(id => ops.deletes.push(id)); return Promise.resolve({ error: null }); } }; } }; },
      };
    },
  };
}

// --- assembleDb: plans reconstruct into nested {gg:weekMon:{date:[...]}} ---
const rows = [
  { collection:'students', id:'s1', data:{ id:'s1', name:'A', gradeGroupId:'g1' } },
  { collection:'gradeGroups', id:'g1', data:{ id:'g1', name:'G1', subjects:[] } },
  { collection:'plans', id:'g1:2026-07-08', data:{ ggId:'g1', date:'2026-07-08', lessons:[{subjectId:'m',lessonNum:5}] } },
  { collection:'answers', id:'a1', data:{ id:'a1', studentId:'s1', date:'2026-07-08', subjectId:'m' } },
  { collection:'settings', id:'singleton', data:{ parentPin:'1234' } },
];
const db = assembleDb(rows);
ok(db.students.length===1 && db.grades.length===0, 'assemble arrays');
ok(db.settings.parentPin==='1234', 'assemble settings');
const planKeys = Object.keys(db.plans);
ok(planKeys.length===1, 'one plan week key');
ok(db.plans[planKeys[0]]['2026-07-08']?.length===1, 'plan day reconstructed');

// --- diff: add an answer ---
async function run() {
  {
    const sb = mockSupabase();
    const prev = assembleDb(rows);
    const next = JSON.parse(JSON.stringify(prev));
    next.answers.push({ id:'a2', studentId:'s1', date:'2026-07-09', subjectId:'m' });
    await diffAndSync(sb, prev, next);
    ok(sb.ops.upserts.length===1 && sb.ops.upserts[0].id==='a2' && sb.ops.upserts[0].student_id==='s1', 'add answer -> 1 upsert w/ student_id');
    ok(sb.ops.deletes.length===0, 'add answer -> no deletes');
  }
  // --- diff: modify a plan day ---
  {
    const sb = mockSupabase();
    const prev = assembleDb(rows);
    const next = JSON.parse(JSON.stringify(prev));
    const k = Object.keys(next.plans)[0];
    next.plans[k]['2026-07-08'] = [{subjectId:'m',lessonNum:6}];
    await diffAndSync(sb, prev, next);
    ok(sb.ops.upserts.length===1 && sb.ops.upserts[0].collection==='plans', 'modify plan -> 1 plan upsert');
  }
  // --- diff: remove a student ---
  {
    const sb = mockSupabase();
    const prev = assembleDb(rows);
    const next = JSON.parse(JSON.stringify(prev));
    next.students = [];
    await diffAndSync(sb, prev, next);
    ok(sb.ops.deletes.includes('s1'), 'remove student -> delete s1');
  }
  // --- diff: settings change ---
  {
    const sb = mockSupabase();
    const prev = assembleDb(rows);
    const next = JSON.parse(JSON.stringify(prev));
    next.settings = { parentPin:'9999' };
    await diffAndSync(sb, prev, next);
    ok(sb.ops.upserts.some(u=>u.collection==='settings'), 'settings change -> settings upsert');
  }
  // --- diff: no change -> nothing written ---
  {
    const sb = mockSupabase();
    const prev = assembleDb(rows);
    const next = JSON.parse(JSON.stringify(prev));
    await diffAndSync(sb, prev, next);
    ok(sb.ops.upserts.length===0 && sb.ops.deletes.length===0, 'no change -> no writes');
  }
  console.log(`records-store logic: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}
run();
