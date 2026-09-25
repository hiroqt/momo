'use client';

import Image from 'next/image';
import Icon from './Icon';
import { useState } from 'react';
import PhoneMockup from './PhoneMockup';

const screenPreviews = [
  { title: 'Meet Momo', detail: 'Your friendly study companion', file: 'momo-welcome.png', alt: 'Momo welcome screen with the study companion and getting started tips' },
  { title: 'Your home', detail: 'Pick up where you left off', file: 'momo-dashboard.png', alt: 'Momo dashboard showing a study streak, active reviewer, and library' },
  { title: 'Flashcards', detail: 'Practice active recall', file: 'momo-flashcards.png', alt: 'Momo flashcard screen with progress, a question, and an educational diagram' },
  { title: 'Study shop', detail: 'More ways to keep going', file: 'momo-shop.png', alt: 'Momo study shop with credits, lives, study XP, and a mascot preview' },
  { title: 'Momo AI', detail: 'Ask about your material', file: 'momo-ai.png', alt: 'Momo AI assistant welcome screen with study prompt suggestions' },
] as const;

export default function MockupGallery() {
  const [selected, setSelected] = useState(1);
  const current = screenPreviews[selected];
  const previous = (selected + screenPreviews.length - 1) % screenPreviews.length;
  const next = (selected + 1) % screenPreviews.length;

  function phone(index: number, featured = false) {
    const screen = screenPreviews[index];
    return <PhoneMockup className={`showcase-phone ${featured ? 'showcase-phone-featured' : ''}`}>
      <Image src={`/screens/${screen.file}`} alt={featured ? screen.alt : ''} width={1080} height={2348} sizes="(max-width: 760px) 240px, 280px" />
    </PhoneMockup>;
  }
  return <div className="mockup-gallery shell" aria-label="Explore Momo app screens">
    <div className="mockup-selector" role="group" aria-label="Choose an app screen">
      {screenPreviews.map((screen, index) => <button key={screen.file} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)} aria-controls="selected-app-screen"><span aria-hidden="true">0{index + 1}</span>{screen.title}</button>)}
    </div>
    <div className="mockup-stage">
      <button className="mockup-side mockup-side-left" type="button" onClick={() => setSelected(previous)} aria-label={`Preview ${screenPreviews[previous].title}`}>
        {phone(previous)}<span>{screenPreviews[previous].title}</span>
      </button>
      <figure id="selected-app-screen" className="mockup-selected">
        {phone(selected, true)}
        <figcaption aria-live="polite"><span className="mockup-count">0{selected + 1} / 05</span><h3>{current.title}</h3><p>{current.detail}</p></figcaption>
      </figure>
      <button className="mockup-side mockup-side-right" type="button" onClick={() => setSelected(next)} aria-label={`Preview ${screenPreviews[next].title}`}>
        {phone(next)}<span>{screenPreviews[next].title}</span>
      </button>
    </div>
    <div className="mockup-controls" role="group" aria-label="Browse app screens">
      <button type="button" onClick={() => setSelected(previous)} aria-label="Previous app screen"><Icon name="arrowLeft" size={20} /></button>
      <span>Take a closer look</span>
      <button type="button" onClick={() => setSelected(next)} aria-label="Next app screen"><Icon name="arrowRight" size={20} /></button>
    </div>
  </div>;
}
