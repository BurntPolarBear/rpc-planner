// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────
export const INIT = {
  gradeGroups: [
    {
      id: 'gg1', name: '4th Grade',
      subjects: [
        { id: 'g1s1', name: 'Mathematics', icon: '➗', color: '#2563EB', startLesson: 1 },
        { id: 'g1s2', name: 'English',     icon: '✏️',  color: '#7C3AED', startLesson: 1 },
        { id: 'g1s3', name: 'History',     icon: '🏛️', color: '#B45309', startLesson: 1 },
        { id: 'g1s4', name: 'Science',     icon: '🔬', color: '#047857', startLesson: 1 },
      ]
    },
    {
      id: 'gg2', name: '6th Grade',
      subjects: [
        { id: 'g2s1', name: 'Mathematics', icon: '➗', color: '#2563EB', startLesson: 1 },
        { id: 'g2s2', name: 'English',     icon: '✏️',  color: '#7C3AED', startLesson: 1 },
        { id: 'g2s3', name: 'History',     icon: '🏛️', color: '#B45309', startLesson: 1 },
        { id: 'g2s4', name: 'Science',     icon: '🔬', color: '#047857', startLesson: 1 },
        { id: 'g2s5', name: 'Government',  icon: '⚖️', color: '#B91C1C', startLesson: 1 },
      ]
    }
  ],
  students: [
    { id: 'st1', name: 'Child 1', gradeGroupId: 'gg1', family: 'Family A', emoji: '📚' },
    { id: 'st2', name: 'Child 2', gradeGroupId: 'gg1', family: 'Family B', emoji: '✏️' },
    { id: 'st3', name: 'Child 3', gradeGroupId: 'gg2', family: 'Family A', emoji: '🔬' },
    { id: 'st4', name: 'Child 4', gradeGroupId: 'gg2', family: 'Family B', emoji: '📖' },
  ],
  plans: {},      // { 'gg1:2026-06-23': { '2026-06-23': [{subjectId, lessonNum, questions}] } }
  answers: [],    // { id, studentId, date, subjectId, lessonNum, answers[], status, parentNote }
  templates: [],  // { id, name, hint, questions[] }
  activities: [], // { id, studentId, name, emoji, color, days:[0-6 JS dow], time:'', location:'', notes:'' }
  activityLogs: [], // { activityId, studentId, date } — one entry = done for that day
  writingSamples: [], // { id, studentId, date, title, text, wordCount, source, analysis:{ traits, overall, strengths, improvements, voice, questions } }
  grades: [],     // { id, studentId, subjectId, date, schoolYear, title, kind, weight, source, score, letter, benchmark, benchmarkNote, rubric:[{name,points,max,comment}], strengths[], improvements[], summary, teacherNote, parentNote, aiGenerated, rigor, gradeLevel }
  hourLogs: [],   // { id, studentId, subjectId, date, hours, note } — per-subject instruction time (parent-only; never in a student's slice)
  settings: { parentPin: '' }, // empty = no PIN required
};

export const KIND_OPTIONS = ['Assignment','Essay','Report','Project','Quiz','Test','Lab','Narration','Problem Set','Copywork','Comprehension'];

// Downscale a photo in the browser and return base64 (keeps serverless payloads small).
async function fileToGradeImage(file, maxEdge = 1500, quality = 0.72) {
  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('read failed'));
    fr.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('decode failed'));
    im.src = dataUrl;
  });
  let { width, height } = img;
  if (Math.max(width, height) > maxEdge) {
    const scale = maxEdge / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); // flatten transparency
  ctx.drawImage(img, 0, 0, width, height);
  const out = canvas.toDataURL('image/jpeg', quality);
  return { media_type: 'image/jpeg', data: out.split(',')[1], preview: out };
}


// ─── ACTIVITIES TAB ───────────────────────────────────────────────────────────
export const ACT_COLORS = ['#EF4444','#F97316','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#14B8A6'];

export const DAY_LABELS = ['Su','M','T','W','Th','F','Sa']; // index = JS getDay()
