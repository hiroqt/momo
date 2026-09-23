import { StudySet, StudyItem, DifficultyLevel } from '../../types';
import type { StudyTrack } from '../../context/OnboardingContext';
import { localDb } from '../storage/localDb';

export interface StarterProfile {
  studyTrack: StudyTrack;
  highSchoolGrade?: string | null;
  collegeYear?: string | null;
  collegeCourse?: string | null;
}

type Card = { question: string; answer: string; explanation: string };
type Topic = { label: string; cards: Card[] };

const LEVEL_CARDS: Record<string, { foundation: Card; advanced: Card }> = {
  biology: {
    foundation: { question: 'What does the cell membrane control?', answer: 'What enters and leaves the cell.', explanation: 'The membrane forms a selective boundary around the cell.' },
    advanced: { question: 'Why does an enzyme lower activation energy?', answer: 'It stabilizes the transition state and offers a lower-energy reaction path.', explanation: 'The enzyme speeds a reaction without changing its overall energy difference.' },
  },
  nursing: {
    foundation: { question: 'What information belongs in a patient assessment?', answer: 'Reported symptoms and observed or measured findings.', explanation: 'Both subjective and objective information guide care.' },
    advanced: { question: 'Why must a change in a patient’s condition be reassessed after an intervention?', answer: 'To evaluate whether the intervention worked and whether the care plan needs changing.', explanation: 'Evaluation closes the nursing-process loop.' },
  },
  computing: {
    foundation: { question: 'What is a loop in a program?', answer: 'A structure that repeats instructions while a condition or count permits it.', explanation: 'Loops avoid writing the same instructions repeatedly.' },
    advanced: { question: 'When is a hash table lookup typically faster than scanning a list?', answer: 'When a suitable hash table gives average constant-time lookup instead of linear scanning.', explanation: 'Worst-case collisions and setup cost still matter.' },
  },
  accounting: {
    foundation: { question: 'What do liabilities represent?', answer: 'Present obligations owed by an entity.', explanation: 'They are one source of financing for assets.' },
    advanced: { question: 'Why can a profitable company still have cash-flow trouble?', answer: 'Revenue may be recorded before cash arrives, while obligations require payment now.', explanation: 'Accrual profit and cash timing differ.' },
  },
  engineering: {
    foundation: { question: 'What does equilibrium mean for forces on a stationary object?', answer: 'The net force is zero.', explanation: 'Balanced forces do not accelerate the object.' },
    advanced: { question: 'What is the difference between stress and strain?', answer: 'Stress is force per area; strain is relative deformation.', explanation: 'They relate through a material model such as Hooke’s law in the elastic range.' },
  },
  psychology: {
    foundation: { question: 'What is a stimulus?', answer: 'An event or change that can trigger a response.', explanation: 'Stimuli may come from inside or outside the body.' },
    advanced: { question: 'What makes a randomized controlled study stronger for causal inference?', answer: 'Random assignment reduces systematic differences between groups.', explanation: 'It helps isolate the effect of the intervention.' },
  },
  business: {
    foundation: { question: 'Who is a target customer?', answer: 'The group a product is designed to serve.', explanation: 'Knowing the group helps shape features and messaging.' },
    advanced: { question: 'What is contribution margin per unit?', answer: 'Selling price per unit minus variable cost per unit.', explanation: 'It shows how each sale contributes to fixed costs and profit.' },
  },
  law: {
    foundation: { question: 'What is a legal rule?', answer: 'A standard used to guide conduct or decide a dispute.', explanation: 'Its source and effect depend on the jurisdiction.' },
    advanced: { question: 'Why does jurisdiction matter when applying precedent?', answer: 'Courts in different jurisdictions may not be bound by the same decisions.', explanation: 'The issuing court’s authority affects the precedent’s weight.' },
  },
  math: {
    foundation: { question: 'How do you solve 2x + 3 = 11?', answer: 'Subtract 3 and divide by 2, so x = 4.', explanation: 'Use inverse operations and check by substitution.' },
    advanced: { question: 'What does the derivative of a function describe at a point?', answer: 'Its instantaneous rate of change at that point.', explanation: 'Geometrically, it is the slope of the tangent line when the derivative exists.' },
  },
  language: {
    foundation: { question: 'Why read a new word aloud?', answer: 'It links the written form to its pronunciation.', explanation: 'Using more than one cue can help recall.' },
    advanced: { question: 'How can you test whether you can use a new word, not just recognize it?', answer: 'Produce your own sentence with the word and check its meaning and grammar.', explanation: 'Production requires deeper retrieval than recognition.' },
  },
  study: {
    foundation: { question: 'What is a quick way to check what you remember?', answer: 'Close your notes and explain the idea in your own words.', explanation: 'This exposes gaps before a test.' },
    advanced: { question: 'How can you make practice more like an exam?', answer: 'Mix topics, use a time limit, and answer without looking at notes.', explanation: 'Retrieval under realistic conditions helps reveal weak areas.' },
  },
};

const TOPICS: Record<string, Topic> = {
  biology: { label: 'Biology', cards: [
    { question: 'What is the main role of mitochondria in a cell?', answer: 'They produce most of the cell’s ATP through cellular respiration.', explanation: 'ATP supplies energy for many cellular processes.' },
    { question: 'What does DNA store?', answer: 'Hereditary instructions for building and maintaining an organism.', explanation: 'Genes are segments of DNA that carry information for functional products.' },
    { question: 'What is the difference between mitosis and meiosis?', answer: 'Mitosis produces two similar cells; meiosis produces four genetically varied cells with half the chromosome number.', explanation: 'Meiosis makes gametes, while mitosis supports growth and repair.' },
  ] },
  nursing: { label: 'Nursing', cards: [
    { question: 'What is the first step of the nursing process?', answer: 'Assessment.', explanation: 'Collecting patient information comes before diagnosis, planning, implementation, and evaluation.' },
    { question: 'What does a pulse oximeter estimate?', answer: 'Peripheral oxygen saturation (SpO₂).', explanation: 'It estimates the percentage of hemoglobin carrying oxygen; it does not directly measure ventilation.' },
    { question: 'Why are two patient identifiers used before giving medication?', answer: 'To confirm the medication is given to the intended patient.', explanation: 'Independent identifiers reduce wrong-patient errors.' },
  ] },
  computing: { label: 'Computer Science', cards: [
    { question: 'What does an algorithm describe?', answer: 'A finite sequence of steps for solving a problem.', explanation: 'An algorithm specifies the process, independent of a particular programming language.' },
    { question: 'What is the difference between a variable and a constant?', answer: 'A variable can change value; a constant is intended to keep the same value.', explanation: 'Both name values, but their mutability differs.' },
    { question: 'What does O(n) time mean?', answer: 'The work grows roughly in proportion to the input size n.', explanation: 'For example, checking every item in a list once takes linear time.' },
  ] },
  accounting: { label: 'Accounting', cards: [
    { question: 'What is the basic accounting equation?', answer: 'Assets = Liabilities + Equity.', explanation: 'The equation reflects how resources are financed.' },
    { question: 'What is an asset?', answer: 'A resource controlled by an entity that is expected to provide future economic benefit.', explanation: 'Cash and equipment are common examples.' },
    { question: 'What is the difference between revenue and profit?', answer: 'Revenue is income from operations; profit is what remains after expenses.', explanation: 'High revenue does not necessarily mean high profit.' },
  ] },
  engineering: { label: 'Engineering', cards: [
    { question: 'What does a free-body diagram show?', answer: 'All external forces acting on one isolated body.', explanation: 'It helps set up force-balance equations.' },
    { question: 'What is the SI unit of force?', answer: 'The newton (N).', explanation: 'One newton equals one kilogram meter per second squared.' },
    { question: 'What does conservation of energy state?', answer: 'Energy cannot be created or destroyed; it can be transferred or transformed.', explanation: 'Energy accounting is useful across mechanical, electrical, and thermal systems.' },
  ] },
  psychology: { label: 'Psychology', cards: [
    { question: 'What is classical conditioning?', answer: 'Learning an association between two stimuli.', explanation: 'A neutral stimulus can come to trigger a response after repeated pairing.' },
    { question: 'What does working memory do?', answer: 'Temporarily holds and manipulates information for a current task.', explanation: 'Mental arithmetic is one example of working memory in use.' },
    { question: 'Why does correlation alone not prove causation?', answer: 'A third factor or reverse direction may explain the relationship.', explanation: 'Controlled study design is needed to support a causal claim.' },
  ] },
  business: { label: 'Business', cards: [
    { question: 'What is a value proposition?', answer: 'A clear statement of the benefit a product offers to a target customer.', explanation: 'It connects a customer need to the offered solution.' },
    { question: 'What is the difference between fixed and variable costs?', answer: 'Fixed costs stay broadly constant over an activity range; variable costs change with output.', explanation: 'Rent is often fixed, while materials per unit are variable.' },
    { question: 'What does break-even mean?', answer: 'Total revenue equals total costs.', explanation: 'At break-even, there is neither profit nor loss.' },
  ] },
  law: { label: 'Law', cards: [
    { question: 'What is a precedent?', answer: 'An earlier court decision used as authority in a later case.', explanation: 'Its weight depends on the court and jurisdiction.' },
    { question: 'What is the purpose of due process?', answer: 'To require fair procedures before the government deprives a person of life, liberty, or property.', explanation: 'The details depend on the applicable legal system.' },
    { question: 'What is the difference between civil and criminal cases?', answer: 'Civil cases resolve private rights or duties; criminal cases address alleged offenses against the state.', explanation: 'They use different procedures and standards of proof.' },
  ] },
  math: { label: 'Mathematics', cards: [
    { question: 'What does the slope of a line measure?', answer: 'The change in y divided by the change in x.', explanation: 'Slope describes the rate of change.' },
    { question: 'What does a function assign to each input?', answer: 'Exactly one output.', explanation: 'Different inputs may share an output, but one input cannot have two outputs in a function.' },
    { question: 'How do you verify a solution to an equation?', answer: 'Substitute it back into the original equation.', explanation: 'Both sides should have the same value.' },
  ] },
  language: { label: 'Language Learning', cards: [
    { question: 'What is active recall when learning vocabulary?', answer: 'Trying to retrieve a word’s meaning from memory before checking.', explanation: 'Retrieval practice strengthens access to learned words.' },
    { question: 'Why practice words in sentences?', answer: 'Context helps connect meaning, grammar, and usage.', explanation: 'Isolated word lists provide fewer usage cues.' },
    { question: 'What is spaced practice?', answer: 'Reviewing material across multiple sessions separated in time.', explanation: 'It encourages longer-term retention.' },
  ] },
  study: { label: 'Study Skills', cards: [
    { question: 'What is active recall?', answer: 'Retrieving an answer from memory before checking notes.', explanation: 'Self-testing reveals what you can actually remember.' },
    { question: 'What is spaced repetition?', answer: 'Reviewing material at increasing intervals over time.', explanation: 'Spacing helps retain information longer than one long cram session.' },
    { question: 'What should you do after getting a practice question wrong?', answer: 'Check the explanation, identify the gap, and retry later.', explanation: 'Correcting errors and revisiting them strengthens understanding.' },
  ] },
};

export function getStarterTopic(profile: StarterProfile): Topic {
  const choice = (profile.studyTrack === 'high_school' ? '' : profile.collegeCourse || '').toLowerCase();
  const matches: [RegExp, string][] = [
    [/nurs|nclex|medical|medicine|health|pharma/, 'nursing'],
    [/computer|coding|software|information technology|\bit\b|tech/, 'computing'],
    [/account|cpa|finance/, 'accounting'],
    [/engineer|physics/, 'engineering'],
    [/psych/, 'psychology'],
    [/business|marketing|entrepreneur/, 'business'],
    [/law|bar exam/, 'law'],
    [/bio|science|stem/, 'biology'],
    [/math|algebra|calculus/, 'math'],
    [/language|spanish|english|french/, 'language'],
  ];
  const match = matches.find(([pattern]) => pattern.test(choice));
  if (match) return TOPICS[match[1]];
  const defaults: Record<StudyTrack, string> = {
    college: 'study', med_nursing: 'nursing', stem: 'engineering',
    boards: 'study', high_school: 'math', general: 'study',
  };
  return TOPICS[defaults[profile.studyTrack]];
}

export function buildSampleDeck(profile: StarterProfile): { set: StudySet; items: StudyItem[] } {
  const topic = getStarterTopic(profile);
  const level = profile.studyTrack === 'high_school'
    ? profile.highSchoolGrade || 'High School'
    : profile.collegeYear && ['college', 'med_nursing', 'stem'].includes(profile.studyTrack)
      ? profile.collegeYear
      : profile.studyTrack === 'boards' ? 'Board Review' : 'Starter';
  const topicLabel = profile.studyTrack !== 'high_school' && profile.collegeCourse?.trim() && topic.label === 'Study Skills'
    ? `${profile.collegeCourse.trim().slice(0, 60)} Study Skills`
    : topic.label;
  const key = `${profile.studyTrack}-${level}-${topicLabel}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = `sample-deck-${key}`;
  const now = new Date().toISOString();
  const difficulty: DifficultyLevel = profile.studyTrack === 'high_school' && ['Grade 9', 'Grade 10'].includes(level) ? 'easy' : 'medium';
  const isFoundation = profile.studyTrack === 'high_school'
    ? ['Grade 9', 'Grade 10'].includes(level)
    : level === '1st Year' || level === 'Starter';
  const levelCard = LEVEL_CARDS[Object.keys(TOPICS).find((key) => TOPICS[key] === topic) || 'study'];
  const cards = [...topic.cards, isFoundation ? levelCard.foundation : levelCard.advanced];
  const set: StudySet = {
    id, user_id: 'local_preview', title: `${topicLabel} • ${level} Preview`,
    description: 'Curated preview cards for your selected study path. Upload your own notes for source-grounded cards.',
    item_count: cards.length, generation_config: { question_types: ['flashcard'], preview: true },
    created_at: now, updated_at: now,
  };
  const items: StudyItem[] = cards.map((card, index) => ({
    id: `${id}-item-${index + 1}`, study_set_id: id, type: 'flashcard',
    question: card.question, answer: card.answer, explanation: card.explanation,
    difficulty, order_index: index, source_metadata: {}, created_at: now,
  }));
  return { set, items };
}

export async function seedSampleDeck(profile: StarterProfile): Promise<StudySet> {
  const { set, items } = buildSampleDeck(profile);
  await localDb.saveStudySet(set, items);
  return set;
}
