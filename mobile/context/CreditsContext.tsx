import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CreditsContextType {
  credits: number;
  xp: number;
  hearts: number;
  addCredits: (amount: number) => void;
  deductCredits: (amount: number) => boolean;
  addXP: (amount: number) => void;
  convertXPToCredits: (xpAmount: number, creditAmount: number) => boolean;
  convertXPToHearts: (xpAmount: number, heartAmount: number) => boolean;
  deductHeart: () => boolean;
  addHeart: (amount: number) => void;
}

const CreditsContext = createContext<CreditsContextType | null>(null);

const HEARTS_RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_HEARTS = 15;

export const CreditsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [credits, setCredits] = useState(0);
  const [xp, setXp] = useState(0);
  const [hearts, setHearts] = useState(DEFAULT_HEARTS);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedCredits = await AsyncStorage.getItem('@user_credits');
        const storedXp = await AsyncStorage.getItem('@user_xp');
        const storedHearts = await AsyncStorage.getItem('@user_hearts');
        const storedHeartsReset = await AsyncStorage.getItem('@user_hearts_reset_time');
        
        if (storedCredits) {
          setCredits(parseInt(storedCredits, 10));
        } else {
          setCredits(50);
        }
        
        if (storedXp) {
          setXp(parseInt(storedXp, 10));
        }

        const now = Date.now();
        if (storedHeartsReset) {
          const resetTime = parseInt(storedHeartsReset, 10);
          if (now - resetTime >= HEARTS_RESET_INTERVAL) {
            // Reset after 24 hrs
            setHearts(DEFAULT_HEARTS);
            await AsyncStorage.multiSet([
              ['@user_hearts', DEFAULT_HEARTS.toString()],
              ['@user_hearts_reset_time', now.toString()]
            ]);
          } else if (storedHearts) {
            setHearts(parseInt(storedHearts, 10));
          }
        } else {
          // Initialize hearts
          setHearts(DEFAULT_HEARTS);
          await AsyncStorage.multiSet([
            ['@user_hearts', DEFAULT_HEARTS.toString()],
            ['@user_hearts_reset_time', now.toString()]
          ]);
        }
      } catch (err) {
        console.error('Failed to load data', err);
      }
    };
    loadData();
  }, []);

  const addCredits = async (amount: number) => {
    try {
      const newCredits = credits + amount;
      setCredits(newCredits);
      await AsyncStorage.setItem('@user_credits', newCredits.toString());
    } catch (err) {
      console.error('Failed to save credits', err);
    }
  };

  const deductCredits = (amount: number): boolean => {
    if (credits >= amount) {
      const newCredits = credits - amount;
      setCredits(newCredits);
      AsyncStorage.setItem('@user_credits', newCredits.toString()).catch(err => {
        console.error('Failed to save credits', err);
      });
      return true;
    }
    return false;
  };

  const addXP = async (amount: number) => {
    try {
      const newXp = xp + amount;
      setXp(newXp);
      await AsyncStorage.setItem('@user_xp', newXp.toString());
    } catch (err) {
      console.error('Failed to save xp', err);
    }
  };

  const convertXPToCredits = (xpAmount: number, creditAmount: number): boolean => {
    if (xp >= xpAmount) {
      const newXp = xp - xpAmount;
      const newCredits = credits + creditAmount;
      setXp(newXp);
      setCredits(newCredits);
      AsyncStorage.multiSet([
        ['@user_xp', newXp.toString()],
        ['@user_credits', newCredits.toString()]
      ]).catch(err => console.error('Failed to save converted data', err));
      return true;
    }
    return false;
  };

  const deductHeart = (): boolean => {
    if (hearts > 0) {
      const newHearts = hearts - 1;
      setHearts(newHearts);
      AsyncStorage.setItem('@user_hearts', newHearts.toString()).catch(err => {
        console.error('Failed to save hearts', err);
      });
      return true;
    }
    return false;
  };

  const addHeart = async (amount: number) => {
    try {
      const newHearts = hearts + amount;
      setHearts(newHearts);
      await AsyncStorage.setItem('@user_hearts', newHearts.toString());
    } catch (err) {
      console.error('Failed to save hearts', err);
    }
  };

  const convertXPToHearts = (xpAmount: number, heartAmount: number): boolean => {
    if (xp >= xpAmount) {
      const newXp = xp - xpAmount;
      const newHearts = hearts + heartAmount;
      setXp(newXp);
      setHearts(newHearts);
      AsyncStorage.multiSet([
        ['@user_xp', newXp.toString()],
        ['@user_hearts', newHearts.toString()]
      ]).catch(err => console.error('Failed to save converted data', err));
      return true;
    }
    return false;
  };

  return (
    <CreditsContext.Provider value={{ credits, xp, hearts, addCredits, deductCredits, addXP, convertXPToCredits, convertXPToHearts, deductHeart, addHeart }}>
      {children}
    </CreditsContext.Provider>
  );
};

export const useCredits = () => {
  const context = useContext(CreditsContext);
  if (!context) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
};
