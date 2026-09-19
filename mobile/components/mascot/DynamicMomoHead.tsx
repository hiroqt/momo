import React from 'react';
import { Image, View } from 'react-native';
import { StudyQuote } from '../../lib/data/studyQuotes';

export interface DynamicMomoHeadProps {
  quote: StudyQuote;
  size?: number;
}

export function DynamicMomoHead({ quote, size = 120 }: DynamicMomoHeadProps) {
  let source;
  switch (quote.category) {
    case 'lock_in': source = require('../../assets/animations/focus_momo.png'); break;
    case 'real_talk': source = quote.vibe === 'funny' ? require('../../assets/animations/cool_momo.png') : require('../../assets/animations/thinking_momo.png'); break;
    case 'manifesting': source = require('../../assets/animations/cheer_momo.png'); break;
    case 'scholar_era': source = require('../../assets/animations/focus_momo.png'); break;
    case 'brain_gains': source = require('../../assets/animations/thumbs_up.png'); break;
    case 'boss_energy': source = require('../../assets/animations/cool_momo.png'); break;
    case 'dopamine_check': source = require('../../assets/animations/happy_momo.png'); break;
    default: source = require('../../assets/animations/thinking_momo.png'); break;
  }
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}
