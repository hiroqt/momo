import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CreditsContextType {
  credits: number;
  xp: number;
  addCredits: (amount: number) => void;
  deductCredits: (amount: number) => boolean;
  addXP: (amount: number) => void;
  convertXPToCredits: (xpAmount: number, creditAmount: number) => boolean;
}

const CreditsContext = createContext<CreditsContextType | null>(null);

export const CreditsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [credits, setCredits] = useState(0);
  const [xp, setXp] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedCredits = await AsyncStorage.getItem('@user_credits');
        const storedXp = await AsyncStorage.getItem('@user_xp');
        
        if (storedCredits) {
          setCredits(parseInt(storedCredits, 10));
        } else {
          setCredits(50);
        }
        
        if (storedXp) {
          setXp(parseInt(storedXp, 10));
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

  return (
    <CreditsContext.Provider value={{ credits, xp, addCredits, deductCredits, addXP, convertXPToCredits }}>
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
