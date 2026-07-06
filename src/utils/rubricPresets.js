// ─── RUBRIC PRESETS ───────────────────────────────────────────────────────────
// Common Ron Paul Curriculum / classical assignment types. Picking one in the
// Grades composer does two things: it tags the saved grade with a meaningful
// `kind`, and it sends a short guidance string to /api/grade-work so the AI builds
// a rubric whose categories fit the assignment (an essay is judged on argument and
// style; a page of Ray's word problems on accuracy and method; a narration on
// faithful retelling — not on having a thesis).
//
// Deliberately, a preset only shapes the LENS. The AI still reads the actual work,
// picks the point values, and proposes the grade; the parent still reviews and can
// change everything — including the category weights and the type — before it saves.
// The preset never hard-codes a score.
//
// Each preset's `kind` MUST exist in KIND_OPTIONS (utils/constants.js), or the
// type dropdown in the proposed-grade editor would render blank.

export const RUBRIC_PRESETS = [
  {
    id: 'general',
    label: 'General',
    icon: '📄',
    kind: 'Assignment',
    titlePlaceholder: 'e.g. Essay: My Summer, or Chapter 4 Lab',
    blurb: '',                 // default — lets the AI choose a rubric from the subject alone
    assignmentType: '',        // empty → no special guidance is sent (current behavior)
    guidance: '',
  },
  {
    id: 'essay',
    label: 'Essay',
    icon: '📝',
    kind: 'Essay',
    titlePlaceholder: 'e.g. Essay: Why the Constitution Matters',
    blurb: 'Judged as a formal essay — argument, organization, and style carry the most weight.',
    assignmentType: 'a formal essay',
    guidance: 'Build the rubric around essay writing: Thesis & Ideas, Organization & Structure, Evidence & Support, Language & Style, and Conventions (grammar, spelling, punctuation). Give the most weight to thesis/ideas and organization. Judge how well the argument is developed and supported, not merely whether it is error-free.',
  },
  {
    id: 'narration',
    label: 'History narration',
    icon: '🏛️',
    kind: 'Narration',
    titlePlaceholder: 'e.g. Narration: The Fall of Rome',
    blurb: 'A retelling in the student’s own words — rewards accuracy and completeness, not a thesis.',
    assignmentType: 'a history narration — the student’s own retelling of what they read',
    guidance: 'This is a narration (a retelling in the student’s own words), not an argumentative essay. Build the rubric around: Understanding of the Material, Accuracy of Facts, Detail & Completeness, Organization & Sequence, and Conventions. Reward capturing the key people, events, and cause-and-effect in their own words. Do NOT penalize a plain, faithful retelling for lacking a thesis or persuasive stance.',
  },
  {
    id: 'word_problems',
    label: 'Math word problems',
    icon: '➗',
    kind: 'Problem Set',
    titlePlaceholder: 'e.g. Ray’s Arithmetic, Lesson 42',
    blurb: 'Math problem-solving — accuracy, method, and shown work matter; prose style does not.',
    assignmentType: 'a set of arithmetic / math word problems (for example, from Ray’s Arithmetic)',
    guidance: 'This is math problem-solving, not writing. Build the rubric around: Correct Answers (accuracy), Method & Setup (choosing the right operation and equation), Showing Work / Reasoning, and Neatness & Labeling (units, clear steps). Focus on whether the reasoning and final answers are correct; ignore prose style entirely. If the work is a photo, transcribe each problem and the student’s answer before grading.',
  },
  {
    id: 'copywork',
    label: 'Copywork / dictation',
    icon: '✍️',
    kind: 'Copywork',
    titlePlaceholder: 'e.g. Copywork: Psalm 23',
    blurb: 'Accuracy to the source and mechanics lead — spelling, punctuation, and neatness.',
    assignmentType: 'a copywork or dictation exercise',
    guidance: 'This is copywork/dictation, where faithful reproduction and mechanics matter most. Build the rubric around: Spelling Accuracy, Punctuation & Capitalization, Handwriting & Neatness, and Accuracy/Completeness to the passage. Emphasize conventions and faithful reproduction over originality — the goal is careful, correct copying, not creative expression.',
  },
  {
    id: 'lab',
    label: 'Science lab',
    icon: '🔬',
    kind: 'Lab',
    titlePlaceholder: 'e.g. Lab: Plant growth observation',
    blurb: 'A lab / observation write-up — careful, accurate observation and clear reasoning.',
    assignmentType: 'a science lab write-up or observation',
    guidance: 'This is a science observation / lab write-up. Build the rubric around: Understanding of the Concept, Accuracy of Observations, Use of Detail & Evidence, Organization & Clarity, and Conventions. Reward careful, accurate observation and clear cause-and-effect reasoning over polished prose.',
  },
  {
    id: 'comprehension',
    label: 'Reading comprehension',
    icon: '📖',
    kind: 'Comprehension',
    titlePlaceholder: 'e.g. Comprehension: Chapter 7 questions',
    blurb: 'Answers to questions about a reading — correctness, text evidence, and completeness.',
    assignmentType: 'answers to reading-comprehension questions about a text',
    guidance: 'These are answers to comprehension questions about a reading. Build the rubric around: Comprehension & Accuracy, Use of Text Evidence, Completeness (every part answered), and Clarity of Expression. Reward correct, well-supported answers drawn from the text; a short answer that is accurate and complete should score well.',
  },
];

export const getPreset = (id) => RUBRIC_PRESETS.find(p => p.id === id) || RUBRIC_PRESETS[0];
