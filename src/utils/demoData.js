// Sample data for the public demo. Everything here is fictional. The demo runs
// entirely in the browser against this data — it never reads or writes the real
// database — so it's safe to show off publicly. Loaded lazily (only when the
// demo is opened) so it adds nothing to the normal app bundle.
import { TODAY, getMon, toDate, weekDays } from './dates';
import { schoolYearOf } from './grades';

const SY = schoolYearOf(TODAY);
const mon = getMon(TODAY);

// Weekdays over the last ~3 weeks, oldest→newest, for records/progress history.
function recentWeekdays(count) {
  const out = [];
  const d = new Date(TODAY + 'T12:00:00');
  while (out.length < count) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) out.unshift(toDate(d));
    d.setDate(d.getDate() - 1);
  }
  return out;
}
const history = recentWeekdays(12);

const GG = {
  id: 'dg1', name: 'Demo Class',
  subjects: [
    { id: 'dm', name: 'Mathematics', icon: '➗', color: '#2563EB', startLesson: 1, totalLessons: 180 },
    { id: 'de', name: 'English',     icon: '✏️', color: '#7C3AED', startLesson: 1, totalLessons: 180 },
    { id: 'dh', name: 'History',     icon: '🏛️', color: '#B45309', startLesson: 1, totalLessons: 180 },
    { id: 'ds', name: 'Science',     icon: '🔬', color: '#047857', startLesson: 1, totalLessons: 180 },
  ],
};

const STUDENTS = [
  { id: 'ada', name: 'Ada', gradeGroupId: 'dg1', family: 'Demo Family', emoji: '📚' },
  { id: 'sam', name: 'Sam', gradeGroupId: 'dg1', family: 'Demo Family', emoji: '🔬' },
];

// Per-student starting lesson numbers per subject (drives progress bars).
const START = {
  ada: { dm: 84, de: 78, dh: 61, ds: 70 },
  sam: { dm: 52, de: 66, dh: 58, ds: 49 },
};

// Build approved answers across the recent weekdays so Records + Progress fill in.
const answers = [];
let aid = 0;
STUDENTS.forEach(st => {
  history.forEach((date, i) => {
    GG.subjects.forEach((subj, si) => {
      // Not every subject every day — keep it realistic.
      if ((i + si) % 2 === 0) {
        answers.push({
          id: `da${aid++}`, studentId: st.id, date, subjectId: subj.id,
          lessonNum: START[st.id][subj.id] + Math.floor(i / 2) + si,
          answers: ['(sample answer)'], status: 'approved', parentNote: '',
        });
      }
    });
  });
});

// Today's plan (shows up in the parent Today / student Today views).
const plans = {};
const wk = weekDays(mon);
const dayPlan = {};
wk.slice(0, 5).forEach((date, i) => {
  dayPlan[date] = [
    { subjectId: 'dm', lessonNum: START.ada.dm + 6 + i, questions: ['What is a common denominator?', 'Add 3/4 + 1/6.'] },
    { subjectId: 'de', lessonNum: START.ada.de + 6 + i, questions: ['Name the main character and one trait.', 'What problem did they face?'] },
    { subjectId: 'dh', lessonNum: START.ada.dh + 6 + i, questions: ['Why did the settlers move west?'] },
  ];
});
plans[`dg1:${mon}`] = dayPlan;

const grades = [
  {
    id: 'dg_1', studentId: 'ada', subjectId: 'de', date: history[8], schoolYear: SY,
    title: 'Charlotte’s Web — Book Report', kind: 'Report', weight: 1, source: 'demo',
    score: 92, letter: 'A-', benchmark: 'above', benchmarkNote: 'Stronger organization than typical for the grade.',
    rubric: [
      { name: 'Ideas & Content', points: 37, max: 40, comment: 'Clear central theme about friendship.' },
      { name: 'Organization', points: 28, max: 30, comment: 'Logical beginning, middle, and end.' },
      { name: 'Conventions', points: 27, max: 30, comment: 'A few comma slips, otherwise clean.' },
    ],
    strengths: ['Vivid word choice', 'Strong topic sentences'],
    improvements: ['Watch comma splices', 'Add one more supporting detail per paragraph'],
    summary: 'A thoughtful, well-organized report — your voice really comes through, Ada!',
    teacherNote: 'Reading and writing are tracking above grade level; keep stretching vocabulary.',
    aiGenerated: true,
  },
  {
    id: 'dg_2', studentId: 'sam', subjectId: 'dm', date: history[6], schoolYear: SY,
    title: 'Fractions Quiz', kind: 'Quiz', weight: 1, source: 'demo',
    score: 84, letter: 'B', benchmark: 'at', benchmarkNote: 'Solid grasp of equivalent fractions for the grade.',
    rubric: [
      { name: 'Accuracy', points: 42, max: 50, comment: 'Missed two mixed-number conversions.' },
      { name: 'Shows Work', points: 42, max: 50, comment: 'Clear steps throughout.' },
    ],
    strengths: ['Neat, methodical work'],
    improvements: ['Practice converting mixed numbers'],
    summary: 'Nice steady work, Sam — a little more practice on mixed numbers and this is an A.',
    teacherNote: 'Right on grade level; mixed numbers are the growth edge.',
    aiGenerated: true,
  },
];

const writingSamples = [
  {
    id: 'dw_1', studentId: 'ada', date: history[9], title: 'My Trip to the Tide Pools',
    text: 'The tide pools were full of tiny worlds. I saw a green anemone that closed when I touched it, and a crab that scuttled sideways under a rock...',
    wordCount: 128, source: 'demo',
    analysis: {
      overall: 'A-',
      traits: [
        { name: 'Ideas & Content', score: 4, comment: 'Concrete, curious observations.' },
        { name: 'Organization', score: 4, comment: 'Moves clearly from pool to pool.' },
        { name: 'Voice', score: 4.5, comment: 'Genuine wonder comes through.' },
        { name: 'Word Choice', score: 4, comment: '“scuttled” is a great pick.' },
        { name: 'Sentence Fluency', score: 3.5, comment: 'Vary sentence openings a bit more.' },
        { name: 'Conventions', score: 4, comment: 'Clean punctuation.' },
      ],
      strengths: ['Sensory detail', 'Authentic voice'],
      improvements: ['Try a few shorter sentences for rhythm'],
      questions: ['What surprised you most at the tide pools?', 'Which creature would you want to learn more about?', 'How did you feel when the anemone closed?'],
      voice: null,
    },
  },
];

export const DEMO = {
  gradeGroups: [GG],
  students: STUDENTS,
  plans,
  answers,
  templates: [],
  activities: [
    { id: 'dac1', studentId: 'ada', name: 'Piano', emoji: '🎹', color: '#8B5CF6', days: [2, 4], time: '4:00 PM', location: 'Home', notes: '' },
    { id: 'dac2', studentId: 'sam', name: 'Soccer', emoji: '⚽', color: '#10B981', days: [1, 3], time: '5:30 PM', location: 'Field', notes: '' },
  ],
  activityLogs: [],
  writingSamples,
  grades,
  settings: { parentPin: '' }, // demo: parent mode open so everything is showable
};
