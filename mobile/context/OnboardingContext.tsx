import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type StudyTrack = 'college' | 'med_nursing' | 'stem' | 'boards' | 'high_school' | 'general';
export type PreferredFormat = 'flashcards' | 'quiz' | 'exam' | 'summary' | 'all';

export interface UserOnboardingProfile {
  firstName?: string;
  lastName?: string;
  age?: number;
  highSchoolGrade?: string | null;
  collegeYear?: string | null;
  collegeCourse?: string | null;
  studyRemindersEnabled?: boolean;
}

export interface OnboardingState {
  isLoaded: boolean;
  hasCompletedWelcome: boolean;
  isGuestMode: boolean;
  studyTrack: StudyTrack;
  preferredFormat: PreferredFormat;
  preferredFormats: PreferredFormat[];
  dailyGoalMinutes: number;

  // Profile and Academic Calibration
  firstName: string;
  lastName: string;
  age: number;
  highSchoolGrade: string | null;
  collegeYear: string | null;
  collegeCourse: string | null;
  studyRemindersEnabled: boolean;

  // Contextual Coachmark Tips
  hasSeenFlashcardGestureTip: boolean;
  hasSeenSourceProvenanceTip: boolean;
  hasSeenQuizXpTip: boolean;

  // Milestones
  hasCompletedFirstSession: boolean;
  hasSeenCelebrationModal: boolean;
}

interface OnboardingContextType extends OnboardingState {
  completeWelcome: (
    track: StudyTrack,
    format: PreferredFormat | PreferredFormat[],
    goalMinutes: number,
    guest: boolean,
    profile?: UserOnboardingProfile
  ) => Promise<void>;
  markTipSeen: (tip: 'flashcardGesture' | 'sourceProvenance' | 'quizXp') => Promise<void>;
  markSessionCompleted: () => Promise<void>;
  dismissCelebration: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  setDailyGoal: (minutes: number) => Promise<void>;
}

const STORAGE_KEYS = {
  COMPLETED_WELCOME: '@momo_onboarding_completed',
  IS_GUEST_MODE: '@momo_is_guest_mode',
  STUDY_TRACK: '@momo_study_track',
  PREFERRED_FORMAT: '@momo_preferred_format',
  PREFERRED_FORMATS: '@momo_preferred_formats',
  DAILY_GOAL: '@momo_daily_goal',
  FIRST_NAME: '@momo_first_name',
  LAST_NAME: '@momo_last_name',
  USER_AGE: '@momo_user_age',
  HIGHSCHOOL_GRADE: '@momo_highschool_grade',
  COLLEGE_YEAR: '@momo_college_year',
  COLLEGE_COURSE: '@momo_college_course',
  STUDY_REMINDERS: '@momo_study_reminders',
  TIP_FLASHCARD: '@momo_tip_flashcard',
  TIP_PROVENANCE: '@momo_tip_provenance',
  TIP_QUIZ_XP: '@momo_tip_quiz_xp',
  FIRST_SESSION_DONE: '@momo_first_session_done',
  CELEBRATION_SEEN: '@momo_celebration_seen',
};

const defaultState: OnboardingState = {
  isLoaded: false,
  hasCompletedWelcome: false,
  isGuestMode: false,
  studyTrack: 'college',
  preferredFormat: 'all',
  preferredFormats: ['all', 'flashcards', 'quiz', 'exam', 'summary'],
  dailyGoalMinutes: 20,
  firstName: '',
  lastName: '',
  age: 13,
  highSchoolGrade: null,
  collegeYear: null,
  collegeCourse: null,
  studyRemindersEnabled: false,
  hasSeenFlashcardGestureTip: false,
  hasSeenSourceProvenanceTip: false,
  hasSeenQuizXpTip: false,
  hasCompletedFirstSession: false,
  hasSeenCelebrationModal: false,
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<OnboardingState>(defaultState);

  useEffect(() => {
    const loadState = async () => {
      try {
        const [
          completedWelcome,
          isGuest,
          track,
          format,
          formatsRaw,
          goal,
          firstName,
          lastName,
          userAge,
          hsGrade,
          colYear,
          colCourse,
          reminders,
          tipFlashcard,
          tipProvenance,
          tipQuiz,
          firstDone,
          celebrationSeen,
        ] = await AsyncStorage.multiGet([
          STORAGE_KEYS.COMPLETED_WELCOME,
          STORAGE_KEYS.IS_GUEST_MODE,
          STORAGE_KEYS.STUDY_TRACK,
          STORAGE_KEYS.PREFERRED_FORMAT,
          STORAGE_KEYS.PREFERRED_FORMATS,
          STORAGE_KEYS.DAILY_GOAL,
          STORAGE_KEYS.FIRST_NAME,
          STORAGE_KEYS.LAST_NAME,
          STORAGE_KEYS.USER_AGE,
          STORAGE_KEYS.HIGHSCHOOL_GRADE,
          STORAGE_KEYS.COLLEGE_YEAR,
          STORAGE_KEYS.COLLEGE_COURSE,
          STORAGE_KEYS.STUDY_REMINDERS,
          STORAGE_KEYS.TIP_FLASHCARD,
          STORAGE_KEYS.TIP_PROVENANCE,
          STORAGE_KEYS.TIP_QUIZ_XP,
          STORAGE_KEYS.FIRST_SESSION_DONE,
          STORAGE_KEYS.CELEBRATION_SEEN,
        ]);

        let parsedFormats: PreferredFormat[] = defaultState.preferredFormats;
        if (formatsRaw[1]) {
          try {
            parsedFormats = JSON.parse(formatsRaw[1]);
          } catch {
            parsedFormats = [(format[1] as PreferredFormat) || 'flashcards'];
          }
        }

        setState({
          isLoaded: true,
          hasCompletedWelcome: completedWelcome[1] === 'true',
          isGuestMode: isGuest[1] === 'true',
          studyTrack: (track[1] as StudyTrack) || 'college',
          preferredFormat: (format[1] as PreferredFormat) || 'all',
          preferredFormats: parsedFormats,
          dailyGoalMinutes: goal[1] ? parseInt(goal[1], 10) : 20,
          firstName: firstName[1] || '',
          lastName: lastName[1] || '',
          age: userAge[1] ? parseInt(userAge[1], 10) : 13,
          highSchoolGrade: hsGrade[1] || null,
          collegeYear: colYear[1] || null,
          collegeCourse: colCourse[1] || null,
          studyRemindersEnabled: reminders[1] === 'true',
          hasSeenFlashcardGestureTip: tipFlashcard[1] === 'true',
          hasSeenSourceProvenanceTip: tipProvenance[1] === 'true',
          hasSeenQuizXpTip: tipQuiz[1] === 'true',
          hasCompletedFirstSession: firstDone[1] === 'true',
          hasSeenCelebrationModal: celebrationSeen[1] === 'true',
        });
      } catch (err) {
        console.warn('Failed to load onboarding state:', err);
        setState((prev) => ({ ...prev, isLoaded: true }));
      }
    };

    loadState();
  }, []);

  const completeWelcome = async (
    track: StudyTrack,
    format: PreferredFormat | PreferredFormat[],
    goalMinutes: number,
    guest: boolean,
    profile?: UserOnboardingProfile
  ) => {
    try {
      const formatArray: PreferredFormat[] = Array.isArray(format) ? format : [format];
      const primaryFormat: PreferredFormat = formatArray.includes('all')
        ? 'all'
        : (formatArray[0] || 'flashcards');

      const fName = profile?.firstName ?? state.firstName;
      const lName = profile?.lastName ?? state.lastName;
      const uAge = profile?.age ?? state.age;
      const hsG = profile?.highSchoolGrade !== undefined ? profile.highSchoolGrade : state.highSchoolGrade;
      const cY = profile?.collegeYear !== undefined ? profile.collegeYear : state.collegeYear;
      const cC = profile?.collegeCourse !== undefined ? profile.collegeCourse : state.collegeCourse;
      const sR = profile?.studyRemindersEnabled !== undefined ? profile.studyRemindersEnabled : state.studyRemindersEnabled;

      const pairs: [string, string][] = [
        [STORAGE_KEYS.COMPLETED_WELCOME, 'true'],
        [STORAGE_KEYS.IS_GUEST_MODE, guest ? 'true' : 'false'],
        [STORAGE_KEYS.STUDY_TRACK, track],
        [STORAGE_KEYS.PREFERRED_FORMAT, primaryFormat],
        [STORAGE_KEYS.PREFERRED_FORMATS, JSON.stringify(formatArray)],
        [STORAGE_KEYS.DAILY_GOAL, goalMinutes.toString()],
        [STORAGE_KEYS.FIRST_NAME, fName],
        [STORAGE_KEYS.LAST_NAME, lName],
        [STORAGE_KEYS.USER_AGE, uAge.toString()],
        [STORAGE_KEYS.HIGHSCHOOL_GRADE, hsG || ''],
        [STORAGE_KEYS.COLLEGE_YEAR, cY || ''],
        [STORAGE_KEYS.COLLEGE_COURSE, cC || ''],
        [STORAGE_KEYS.STUDY_REMINDERS, sR ? 'true' : 'false'],
      ];

      await AsyncStorage.multiSet(pairs);

      setState((prev) => ({
        ...prev,
        hasCompletedWelcome: true,
        isGuestMode: guest,
        studyTrack: track,
        preferredFormat: primaryFormat,
        preferredFormats: formatArray,
        dailyGoalMinutes: goalMinutes,
        firstName: fName,
        lastName: lName,
        age: uAge,
        highSchoolGrade: hsG,
        collegeYear: cY,
        collegeCourse: cC,
        studyRemindersEnabled: sR,
      }));
    } catch (err) {
      console.error('Failed to save welcome completion', err);
      throw err;
    }
  };

  const markTipSeen = async (tip: 'flashcardGesture' | 'sourceProvenance' | 'quizXp') => {
    try {
      let key = STORAGE_KEYS.TIP_FLASHCARD;
      let stateKey: keyof OnboardingState = 'hasSeenFlashcardGestureTip';

      if (tip === 'sourceProvenance') {
        key = STORAGE_KEYS.TIP_PROVENANCE;
        stateKey = 'hasSeenSourceProvenanceTip';
      } else if (tip === 'quizXp') {
        key = STORAGE_KEYS.TIP_QUIZ_XP;
        stateKey = 'hasSeenQuizXpTip';
      }

      await AsyncStorage.setItem(key, 'true');
      setState((prev) => ({ ...prev, [stateKey]: true }));
    } catch (err) {
      console.warn('Failed to mark tip seen:', err);
    }
  };

  const markSessionCompleted = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.FIRST_SESSION_DONE, 'true');
      setState((prev) => ({
        ...prev,
        hasCompletedFirstSession: true,
      }));
    } catch (err) {
      console.warn('Failed to mark session complete:', err);
    }
  };

  const dismissCelebration = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CELEBRATION_SEEN, 'true');
      setState((prev) => ({ ...prev, hasSeenCelebrationModal: true }));
    } catch (err) {
      console.warn('Failed to dismiss celebration:', err);
    }
  };

  const setDailyGoal = async (minutes: number) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DAILY_GOAL, minutes.toString());
      setState((prev) => ({ ...prev, dailyGoalMinutes: minutes }));
    } catch (err) {
      console.warn('Failed to update daily goal:', err);
    }
  };

  const resetOnboarding = async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.COMPLETED_WELCOME,
        STORAGE_KEYS.IS_GUEST_MODE,
        STORAGE_KEYS.STUDY_TRACK,
        STORAGE_KEYS.PREFERRED_FORMAT,
        STORAGE_KEYS.PREFERRED_FORMATS,
        STORAGE_KEYS.DAILY_GOAL,
        STORAGE_KEYS.FIRST_NAME,
        STORAGE_KEYS.LAST_NAME,
        STORAGE_KEYS.USER_AGE,
        STORAGE_KEYS.HIGHSCHOOL_GRADE,
        STORAGE_KEYS.COLLEGE_YEAR,
        STORAGE_KEYS.COLLEGE_COURSE,
        STORAGE_KEYS.STUDY_REMINDERS,
        STORAGE_KEYS.TIP_FLASHCARD,
        STORAGE_KEYS.TIP_PROVENANCE,
        STORAGE_KEYS.TIP_QUIZ_XP,
        STORAGE_KEYS.FIRST_SESSION_DONE,
        STORAGE_KEYS.CELEBRATION_SEEN,
      ]);

      setState({
        ...defaultState,
        isLoaded: true,
      });
    } catch (err) {
      console.error('Failed to reset onboarding:', err);
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        ...state,
        completeWelcome,
        markTipSeen,
        markSessionCompleted,
        dismissCelebration,
        resetOnboarding,
        setDailyGoal,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = React.use(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
