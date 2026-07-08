// Client data layer for the normalized `records` table. The app still works with
// one `db` object of the original shape; these helpers assemble that object from
// per-record rows and, on save, write only the rows that actually changed.
import { getMon } from './dates';

const EMPTY = () => ({
  gradeGroups: [], students: [], answers: [], templates: [], activities: [],
  activityLogs: [], writingSamples: [], grades: [], hourLogs: [], plans: {},
  settings: { parentPin: '' },
});

// Which key on a record supplies its student_id column (for RLS/scoping), by collection.
const STUDENT_ID = {
  students: r => r.id,
  answers: r => r.studentId,
  activities: r => r.studentId,
  writingSamples: r => r.studentId,
  grades: r => r.studentId,
  hourLogs: r => r.studentId,
};
const ARRAY_COLLECTIONS = ['gradeGroups','students','answers','templates','activities','writingSamples','grades','hourLogs'];
const logKey = (l) => `${l.activityId}:${l.studentId}:${l.date}`;

// Rebuild the db object from a flat list of { collection, id, data } rows.
export function assembleDb(rows) {
  const db = EMPTY();
  for (const r of rows || []) {
    const { collection, data } = r;
    if (collection === 'plans') {
      const { ggId, date, lessons } = data;
      const key = `${ggId}:${getMon(date)}`;
      (db.plans[key] ||= {})[date] = lessons;
    } else if (collection === 'settings') {
      db.settings = data;
    } else if (Array.isArray(db[collection])) {
      db[collection].push(data);
    }
  }
  return db;
}

export async function loadRecords(supabase) {
  const { data, error } = await supabase.from('records').select('collection,id,data');
  if (error) throw error;
  return assembleDb(data);
}

// Flatten the nested plans object to a map of `${ggId}:${date}` -> { ggId, date, lessons }.
function flattenPlans(plans) {
  const m = new Map();
  for (const planKey of Object.keys(plans || {})) {
    const ggId = planKey.split(':')[0];
    const days = plans[planKey] || {};
    for (const date of Object.keys(days)) m.set(`${ggId}:${date}`, { ggId, date, lessons: days[date] });
  }
  return m;
}

// Compare prev vs next db and persist only the differences.
export async function diffAndSync(supabase, prev, next) {
  const S = JSON.stringify;
  const upserts = [];
  const deletes = []; // { collection, id }

  const diffById = (coll) => {
    const sid = STUDENT_ID[coll];
    const pm = new Map((prev[coll] || []).map(x => [x.id, x]));
    const nm = new Map((next[coll] || []).map(x => [x.id, x]));
    for (const [id, val] of nm) {
      const p = pm.get(id);
      if (!p || S(p) !== S(val)) upserts.push({ collection: coll, id, student_id: sid ? sid(val) : null, data: val });
    }
    for (const id of pm.keys()) if (!nm.has(id)) deletes.push({ collection: coll, id });
  };
  ARRAY_COLLECTIONS.forEach(diffById);

  // activityLogs: synthesized composite id
  {
    const pm = new Map((prev.activityLogs || []).map(l => [logKey(l), l]));
    const nm = new Map((next.activityLogs || []).map(l => [logKey(l), l]));
    for (const [id, val] of nm) { const p = pm.get(id); if (!p || S(p) !== S(val)) upserts.push({ collection:'activityLogs', id, student_id: val.studentId, data: val }); }
    for (const id of pm.keys()) if (!nm.has(id)) deletes.push({ collection:'activityLogs', id });
  }

  // plans
  {
    const pm = flattenPlans(prev.plans);
    const nm = flattenPlans(next.plans);
    for (const [id, val] of nm) { const p = pm.get(id); if (!p || S(p) !== S(val)) upserts.push({ collection:'plans', id, student_id: null, data: val }); }
    for (const id of pm.keys()) if (!nm.has(id)) deletes.push({ collection:'plans', id });
  }

  // settings singleton
  if (S(prev.settings || {}) !== S(next.settings || {})) {
    upserts.push({ collection:'settings', id:'singleton', student_id: null, data: next.settings || { parentPin:'' } });
  }

  if (upserts.length) {
    const stamped = upserts.map(u => ({ ...u, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from('records').upsert(stamped);
    if (error) throw error;
  }
  const byColl = {};
  for (const d of deletes) (byColl[d.collection] ||= []).push(d.id);
  for (const coll of Object.keys(byColl)) {
    const { error } = await supabase.from('records').delete().eq('collection', coll).in('id', byColl[coll]);
    if (error) throw error;
  }
  return { upserts: upserts.length, deletes: deletes.length };
}
