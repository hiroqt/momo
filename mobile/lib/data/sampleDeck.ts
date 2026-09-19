import { StudySet, StudyItem } from '../../types';
import { localDb } from '../storage/localDb';

export const SAMPLE_STUDY_SET_ID = 'sample-deck-biology-101';

export const SAMPLE_STUDY_SET: StudySet = {
  id: SAMPLE_STUDY_SET_ID,
  user_id: 'guest_or_new_user',
  title: 'Biology 101: Cellular Respiration & ATP',
  description: 'Grounded starter reviewer on glycolysis, the citric acid cycle, and oxidative phosphorylation.',
  item_count: 6,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const SAMPLE_STUDY_ITEMS: StudyItem[] = [
  {
    id: 'sample-item-1',
    study_set_id: SAMPLE_STUDY_SET_ID,
    type: 'multiple_choice',
    question: 'Where does glycolysis occur within a eukaryotic cell?',
    answer: 'Cytoplasm (Cytosol)',
    options: [
      'Cytoplasm (Cytosol)',
      'Mitochondrial matrix',
      'Inner mitochondrial membrane',
      'Nucleus',
    ],
    explanation:
      'Glycolysis is an anaerobic pathway taking place exclusively in the cytoplasm, breaking down 1 glucose molecule into 2 pyruvates.',
    difficulty: 'easy',
    order_index: 0,
    source_metadata: {
      document_name: 'Campbell_Biology_Ch9.pdf',
      page: 164,
      section: '9.2 Glycolysis harvests chemical energy',
      snippet: 'Glycolysis occurs in the cytosol and begins the degradation process by breaking glucose into two molecules of pyruvate.',
    },
    created_at: new Date().toISOString(),
  },
  {
    id: 'sample-item-2',
    study_set_id: SAMPLE_STUDY_SET_ID,
    type: 'flashcard',
    question: 'What is the net ATP yield per glucose molecule produced solely by glycolysis?',
    answer: 'Net 2 ATP (4 ATP produced minus 2 ATP consumed in the energy investment phase).',
    explanation:
      'The investment phase uses 2 ATP; the payoff phase synthesizes 4 ATP via substrate-level phosphorylation, yielding a net gain of 2 ATP.',
    difficulty: 'medium',
    order_index: 1,
    source_metadata: {
      document_name: 'Campbell_Biology_Ch9.pdf',
      page: 166,
      section: 'Energy Investment and Payoff',
      snippet: 'Net yield from glycolysis per glucose molecule is 2 ATP plus 2 NADH.',
    },
    created_at: new Date().toISOString(),
  },
  {
    id: 'sample-item-3',
    study_set_id: SAMPLE_STUDY_SET_ID,
    type: 'multiple_choice',
    question: 'Which enzyme complex couples the flow of protons (H+) down their electrochemical gradient to the synthesis of ATP?',
    answer: 'ATP Synthase',
    options: [
      'ATP Synthase',
      'Cytochrome c oxidase',
      'Hexokinase',
      'Phosphofructokinase',
    ],
    explanation:
      'ATP Synthase operates like a molecular turbine powered by chemiosmosis during oxidative phosphorylation to generate ATP.',
    difficulty: 'hard',
    order_index: 2,
    source_metadata: {
      document_name: 'Campbell_Biology_Ch9.pdf',
      page: 172,
      section: 'Chemiosmosis: The Energy-Coupling Mechanism',
      snippet: 'ATP synthase is the enzyme that actually makes ATP from ADP and inorganic phosphate.',
    },
    created_at: new Date().toISOString(),
  },
  {
    id: 'sample-item-4',
    study_set_id: SAMPLE_STUDY_SET_ID,
    type: 'flashcard',
    question: 'What is the final electron acceptor in the aerobic electron transport chain?',
    answer: 'Molecular Oxygen (O2), which combines with protons to form H2O.',
    explanation:
      'Without oxygen to accept low-energy electrons, electrons back up through the complexes, stalling ATP synthesis.',
    difficulty: 'medium',
    order_index: 3,
    source_metadata: {
      document_name: 'Campbell_Biology_Ch9.pdf',
      page: 170,
      section: 'The Pathway of Electron Transport',
      snippet: 'Each oxygen atom also picks up a pair of hydrogen ions from the aqueous solution, neutralizing the -2 charge of the added electrons and forming water.',
    },
    created_at: new Date().toISOString(),
  },
  {
    id: 'sample-item-5',
    study_set_id: SAMPLE_STUDY_SET_ID,
    type: 'multiple_choice',
    question: 'How many carbon atoms from the original glucose molecule are released as CO2 during one full turn of the Citric Acid (Krebs) Cycle?',
    answer: '2 carbon atoms (as 2 CO2)',
    options: [
      '2 carbon atoms (as 2 CO2)',
      '4 carbon atoms (as 4 CO2)',
      '1 carbon atom',
      '6 carbon atoms',
    ],
    explanation:
      'Per acetyl-CoA entering the cycle, 2 carbons are oxidized to 2 CO2. (Per original glucose, 2 acetyl groups enter, totaling 4 CO2 in the cycle).',
    difficulty: 'hard',
    order_index: 4,
    source_metadata: {
      document_name: 'Campbell_Biology_Ch9.pdf',
      page: 168,
      section: '9.3 The Citric Acid Cycle',
      snippet: 'For each acetyl group entering the cycle, 3 NAD+ are reduced to NADH, 1 FAD is reduced to FADH2, and 2 CO2 are released.',
    },
    created_at: new Date().toISOString(),
  },
  {
    id: 'sample-item-6',
    study_set_id: SAMPLE_STUDY_SET_ID,
    type: 'flashcard',
    question: 'What is the primary role of NADH and FADH2 in cellular respiration?',
    answer: 'They act as high-energy electron shuttles that donate electrons to the Electron Transport Chain.',
    explanation:
      'Their oxidation drives the proton pumps across the inner mitochondrial membrane, establishing the proton gradient for ATP synthase.',
    difficulty: 'easy',
    order_index: 5,
    source_metadata: {
      document_name: 'Campbell_Biology_Ch9.pdf',
      page: 169,
      section: 'Oxidative Phosphorylation',
      snippet: 'NADH and FADH2 shuttle high-energy electrons extracted from food to an electron transport chain built into the inner mitochondrial membrane.',
    },
    created_at: new Date().toISOString(),
  },
];

/**
 * Ensures the sample study set is loaded into the local SQLite database.
 */
export async function seedSampleDeck(): Promise<StudySet> {
  await localDb.saveStudySet(SAMPLE_STUDY_SET, SAMPLE_STUDY_ITEMS);
  return SAMPLE_STUDY_SET;
}
