'use client';

import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const asset = '/assets/';
const screens = '/screens/';
const googlePlayUrl = process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL;
const appStoreUrl = process.env.NEXT_PUBLIC_APP_STORE_URL;
const studyWords = ['brain gains!', 'one card at a time', 'aha moment!', 'from notes to knowledge', 'quiz time!', 'source powered', 'you’ve got this!', 'keep curious!'];
type ClickWord = { id: number; x: number; y: number; text: string };
type CallNote = { at: number; length: number; from: number; to: number };
const cartoonCalls: CallNote[][] = [
  [{ at: 0, length: 0.17, from: 330, to: 570 }, { at: 0.18, length: 0.19, from: 540, to: 295 }, { at: 0.42, length: 0.26, from: 310, to: 460 }],
  [{ at: 0, length: 0.13, from: 440, to: 650 }, { at: 0.14, length: 0.13, from: 500, to: 690 }, { at: 0.34, length: 0.3, from: 610, to: 285 }],
  [{ at: 0, length: 0.25, from: 260, to: 490 }, { at: 0.3, length: 0.14, from: 620, to: 420 }, { at: 0.47, length: 0.14, from: 620, to: 420 }, { at: 0.67, length: 0.2, from: 390, to: 520 }],
];

function playCartoonMonkeyCall(context: AudioContext, notes: CallNote[]) {
  const start = context.currentTime + 0.01;
  const master = context.createGain();
  master.gain.value = 0.18;
  master.connect(context.destination);
  notes.forEach(({ at, length, from, to }) => {
    const time = start + at;
    const voice = context.createOscillator();
    const overtone = context.createOscillator();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    voice.type = 'triangle';
    overtone.type = 'sine';
    voice.frequency.setValueAtTime(from, time);
    voice.frequency.exponentialRampToValueAtTime(to, time + length);
    overtone.frequency.setValueAtTime(from * 2, time);
    overtone.frequency.exponentialRampToValueAtTime(to * 2, time + length);
    filter.type = 'lowpass';
    filter.frequency.value = 1450;
    envelope.gain.setValueAtTime(0.001, time);
    envelope.gain.exponentialRampToValueAtTime(0.55, time + 0.035);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + length);
    voice.connect(filter);
    overtone.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    voice.start(time);
    overtone.start(time);
    voice.stop(time + length + 0.02);
    overtone.stop(time + length + 0.02);
  });
}

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="Momo home">
      <span className="brand-mark"><Image src={`${asset}momo_logo.png`} alt="" width={39} height={39} /></span>
      <span>momo<span className="brand-dot">.</span></span>
    </a>
  );
}

const steps = [
  { number: '01', title: 'Bring your material', copy: 'Upload a PDF, Word document, text file, or presentation. That’s Momo’s starting point.', art: 'upload' },
  { number: '02', title: 'Tell Momo your goal', copy: 'Pick a topic, question type, and difficulty. Momo builds a reviewer around what you need.', art: 'momo' },
  { number: '03', title: 'Study your way', copy: 'Practice with cards and questions, revisit your sources, and keep learning even offline.', art: 'study' },
] as const;

const faqs = [
  { question: 'What can I upload?', answer: 'Momo supports PDF, DOCX, TXT, and PPTX study materials. The app validates files before processing them.' },
  { question: 'Does Momo use information outside my notes?', answer: 'Momo is designed to create study content from your uploaded material. If the source does not provide enough evidence, Momo should say so.' },
  { question: 'Can I study without internet?', answer: 'Yes. Generated study sets can be saved for offline studying. Uploading and generating new material require a connection.' },
  { question: 'What happens to the original file?', answer: 'Original uploaded documents are temporary and are scheduled for deletion after three days. Generated study sets are kept separately so you can continue studying.' },
];

const screenPreviews = [
  { title: 'Meet Momo', detail: 'Your friendly study companion', file: 'momo-welcome.png', alt: 'Momo welcome screen with the study companion and getting started tips' },
  { title: 'Your home', detail: 'Pick up where you left off', file: 'momo-dashboard.png', alt: 'Momo dashboard showing a study streak, active reviewer, and library' },
  { title: 'Flashcards', detail: 'Practice active recall', file: 'momo-flashcards.png', alt: 'Momo flashcard screen with progress, a question, and an educational diagram' },
  { title: 'Study shop', detail: 'More ways to keep going', file: 'momo-shop.png', alt: 'Momo study shop with credits, lives, study XP, and a mascot preview' },
  { title: 'Momo AI', detail: 'Ask about your material', file: 'momo-ai.png', alt: 'Momo AI assistant welcome screen with study prompt suggestions' },
] as const;

function StoreButtons({ light = false }: { light?: boolean }) {
  const className = `button store-button ${light ? 'button-light' : 'button-primary'}`;
  return (
    <div className={`store-buttons ${light ? 'store-buttons-light' : ''}`}>
      {googlePlayUrl ? <a className={className} href={googlePlayUrl} target="_blank" rel="noopener noreferrer">Go to Google Play <span aria-hidden="true">↗</span></a> : <button className={`${className} store-button-pending`} type="button" disabled title="Google Play link coming soon">Go to Google Play <small>Coming soon</small></button>}
      {appStoreUrl ? <a className={`button store-button ${light ? 'button-light-outline' : 'button-secondary'}`} href={appStoreUrl} target="_blank" rel="noopener noreferrer">App Store <span aria-hidden="true">↗</span></a> : <button className={`button store-button store-button-pending ${light ? 'button-light-outline' : 'button-secondary'}`} type="button" disabled title="App Store link coming soon">App Store <small>Coming soon</small></button>}
    </div>
  );
}

function StepArt({ kind }: { kind: (typeof steps)[number]['art'] }) {
  if (kind === 'upload') return <div className="step-art step-art-upload" aria-hidden="true"><div className="paper paper-back" /><div className="paper paper-front"><span /><span /><span /><strong>PDF</strong></div><span className="art-plus">+</span></div>;
  if (kind === 'momo') return <div className="step-art step-art-momo" aria-hidden="true"><div className="art-circle" /><Image src={`${asset}document_momo.png`} alt="" width={220} height={220} sizes="220px" /><span className="little-star">✦</span></div>;
  return <div className="step-art step-art-study" aria-hidden="true"><div className="mini-flashcard"><small>FLASHCARD 01 / 12</small><strong>What is cellular respiration?</strong><span>Tap to reveal ↗</span></div><span className="art-check">✓</span></div>;
}

function PhoneMockup({
  children,
  className = '',
  glow = false,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={`phone-mockup-frame ${className}`}>
      <span className="phone-btn phone-btn-silent" aria-hidden="true" />
      <span className="phone-btn phone-btn-vol-up" aria-hidden="true" />
      <span className="phone-btn phone-btn-vol-down" aria-hidden="true" />
      <span className="phone-btn phone-btn-power" aria-hidden="true" />

      <div className="phone-chassis">
        <div className="phone-speaker" aria-hidden="true" />
        <div className="phone-island" aria-hidden="true">
          <span className="island-lens" />
          <span className="island-dot" />
        </div>
        <div className="phone-screen">
          {children}
          <div className="phone-sheen" aria-hidden="true" />
          <div className="phone-home-bar" aria-hidden="true" />
        </div>
      </div>
      {glow && <div className="phone-glow" aria-hidden="true" />}
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [waving, setWaving] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [clickWords, setClickWords] = useState<ClickWord[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const soundOnRef = useRef(true);
  const soundIndexRef = useRef(0);
  const lastSoundAtRef = useRef(0);
  const wordIdRef = useRef(0);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 110, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      void videoRef.current.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const timers = new Set<number>();
    const pointerStarts = new Map<number, { x: number; y: number }>();
    function rememberPointer(event: PointerEvent) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointerStarts.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    function addStudyWord(event: PointerEvent) {
      const start = pointerStarts.get(event.pointerId);
      pointerStarts.delete(event.pointerId);
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return;
      const soundToggle = event.target instanceof Element && event.target.closest('[data-sound-toggle]');
      if (soundOnRef.current && !soundToggle && window.AudioContext && performance.now() - lastSoundAtRef.current >= 300) {
        lastSoundAtRef.current = performance.now();
        const context = audioContextRef.current ?? new AudioContext();
        audioContextRef.current = context;
        if (context.state === 'suspended') void context.resume();
        playCartoonMonkeyCall(context, cartoonCalls[soundIndexRef.current % cartoonCalls.length]);
        soundIndexRef.current += 1;
      }
      const id = ++wordIdRef.current;
      const x = Math.max(100, Math.min(window.innerWidth - 100, event.clientX));
      const y = Math.max(36, Math.min(window.innerHeight - 36, event.clientY));
      setClickWords((words) => [...words.slice(-7), { id, x, y, text: studyWords[(id - 1) % studyWords.length] }]);
      const timer = window.setTimeout(() => {
        setClickWords((words) => words.filter((word) => word.id !== id));
        timers.delete(timer);
      }, 1100);
      timers.add(timer);
    }
    function forgetPointer(event: PointerEvent) {
      pointerStarts.delete(event.pointerId);
    }
    window.addEventListener('pointerdown', rememberPointer, { passive: true });
    window.addEventListener('pointerup', addStudyWord, { passive: true });
    window.addEventListener('pointercancel', forgetPointer);
    return () => {
      window.removeEventListener('pointerdown', rememberPointer);
      window.removeEventListener('pointerup', addStudyWord);
      window.removeEventListener('pointercancel', forgetPointer);
      timers.forEach(window.clearTimeout);
      if (audioContextRef.current) void audioContextRef.current.close();
    };
  }, []);

  function wave() {
    setWaving(true);
    window.setTimeout(() => setWaving(false), 650);
  }

  function toggleSound() {
    soundOnRef.current = !soundOnRef.current;
    setSoundOn(soundOnRef.current);
  }

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden="true" />
      <div className="click-words" aria-hidden="true"><AnimatePresence>{clickWords.map((word) => <motion.span key={word.id} className="click-word" style={{ left: word.x, top: word.y }} initial={reducedMotion ? false : { opacity: 0, y: 4, scale: 0.85 }} animate={{ opacity: 1, y: reducedMotion ? 0 : -22, scale: 1 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -38 }} transition={{ duration: reducedMotion ? 0 : 0.35 }}>{word.text}</motion.span>)}</AnimatePresence></div>
      <header className="site-header" id="top">
        <div className="header-inner shell flex items-center justify-between">
          <Brand />
          <nav className="desktop-nav" aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#features">What you can do</a><a href="#screens">Screen View</a><a href="#questions">Questions</a></nav>
          <a className="header-cta" href="#get-momo">Get Momo <span aria-hidden="true">↗</span></a>
          <button className={`menu-toggle ${menuOpen ? 'is-open' : ''}`} type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-controls="mobile-nav" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span /><span /></button>
        </div>
        <nav className="mobile-nav" id="mobile-nav" aria-label="Mobile navigation" hidden={!menuOpen} onClick={() => setMenuOpen(false)}><a href="#how-it-works">How it works</a><a href="#features">What you can do</a><a href="#screens">Screen View</a><a href="#questions">Questions</a><a href="#get-momo">Get Momo ↗</a></nav>
      </header>

      <main id="main">
        <section className="hero shell hero-split" aria-labelledby="hero-title">
          <div className="hero-content">
            <h1 id="hero-title">Big study energy.<br /><span>Little monkey magic.</span></h1>
            <p className="hero-copy">Meet Momo. Turn the material you already trust into flashcards, quizzes, and reviewers that make studying feel a little less overwhelming.</p>
            <div className="hero-actions"><StoreButtons /></div>
            <p className="hero-footnote"><span aria-hidden="true">✦</span> Built around your study material, not random answers from the internet.</p>
          </div>
          <div className="hero-visual">
            <PhoneMockup className="hero-screen-phone" glow>
              <Image src={`${screens}momo-dashboard.png`} alt="Actual Momo dashboard showing a reviewer, streak, and library" width={1080} height={2348} priority sizes="(max-width: 760px) 220px, 315px" />
            </PhoneMockup>
            <div className="hero-mascot-wrap"><motion.button className="mascot-button" type="button" aria-label="Wave to Momo" title="Wave to Momo" onClick={wave} animate={waving && !reducedMotion ? { rotate: [0, -4, 4, -2, 0], scale: [1, 1.04, 1] } : { rotate: 0, scale: 1 }} transition={{ duration: 0.6 }}><Image src={`${asset}momo-full-body-cutout.png`} alt="Full-body Momo waving with a yellow study notebook" width={1024} height={1536} priority sizes="(max-width: 760px) 190px, 330px" /></motion.button></div>
            <div className="hero-visual-hint"><span>Tap anywhere for a little Momo magic <span aria-hidden="true">✦</span></span><button className="sound-toggle" data-sound-toggle type="button" aria-label={soundOn ? 'Mute Momo sounds' : 'Unmute Momo sounds'} aria-pressed={!soundOn} onClick={toggleSound}>{soundOn ? 'Sound on' : 'Sound off'}</button></div>
          </div>
        </section>

        <section className="section intro shell" id="how-it-works" aria-labelledby="intro-title">
          <Reveal className="intro-heading"><h2 id="intro-title">From <em>“where do I start?”</em><br />to <span className="underline-swoop">“okay, I’ve got this.”</span></h2><p className="section-lead">Momo helps you do more with the notes you already have. Three little steps, a lot more clarity.</p></Reveal>
          <div className="steps-grid">{steps.map((step) => <Reveal className="step-card" key={step.number}><StepArt kind={step.art} /><div className="step-number">{step.number} <span /></div><h3>{step.title}</h3><p>{step.copy}</p></Reveal>)}</div>
        </section>

        <section className="formats-section" id="features" aria-labelledby="features-title"><div className="shell formats-shell"><Reveal className="formats-heading"><h2 id="features-title">Your material.<br /><em>Every study mood.</em></h2><p>Need a quick check, a deep review, or a practice run? Momo helps turn one source into the format that fits your day.</p></Reveal><div className="format-cards">
          <Reveal className="format-card format-card-flash"><span className="format-icon" aria-hidden="true">✦</span><div className="format-preview flash-preview" aria-hidden="true"><small>FLASHCARD</small><strong>One idea at a time.</strong><span>Flip. Remember. Repeat.</span></div><h3>Flashcards</h3><p>Make important ideas easier to revisit.</p></Reveal>
          <Reveal className="format-card format-card-quiz"><span className="format-icon" aria-hidden="true">☑</span><div className="format-preview quiz-preview" aria-hidden="true"><small>QUICK QUIZ</small><strong>Which answer makes sense?</strong><span className="quiz-option">A &nbsp; The one in your notes</span><span className="quiz-option selected">B &nbsp; You got this ✓</span></div><h3>Quizzes & exams</h3><p>Practice recalling, not just rereading.</p></Reveal>
          <Reveal className="format-card format-card-summary"><span className="format-icon" aria-hidden="true">✎</span><div className="format-preview summary-preview" aria-hidden="true"><small>STUDY SUMMARY</small><strong>The big picture, clearer.</strong><span /><span /><span /></div><h3>Summaries & answers</h3><p>Get to the key points in your own material.</p></Reveal>
          </div><Reveal className="format-note">And more: true or false, identification, fill in the blank, Q&amp;A, and topic explanations. <span aria-hidden="true">↗</span></Reveal></div></section>

        <section className="screens-section" id="screens" aria-labelledby="screens-title">
          <div className="shell screens-heading-shell">
            <Reveal className="screens-heading">
              <h2 id="screens-title">Take a look <em>inside Momo.</em></h2>
              <p>These are screens from the app, from your first hello to your next study session.</p>
            </Reveal>
          </div>
          <div className="screens-marquee-container" aria-label="Momo app screens preview">
            <div className="screens-marquee-track">
              <div className="screens-marquee-group" role="list">
                {screenPreviews.concat(screenPreviews).map((screen, idx) => (
                  <article className="screen-card" role="listitem" key={`g1-${screen.file}-${idx}`}>
                    <PhoneMockup className="screen-phone-mockup">
                      <Image
                        src={`${screens}${screen.file}`}
                        alt={screen.alt}
                        width={1080}
                        height={2348}
                        sizes="(max-width: 600px) 72vw, (max-width: 1000px) 34vw, 260px"
                      />
                    </PhoneMockup>
                    <h3>{screen.title}</h3>
                    <p>{screen.detail}</p>
                  </article>
                ))}
              </div>
              <div className="screens-marquee-group" aria-hidden="true">
                {screenPreviews.concat(screenPreviews).map((screen, idx) => (
                  <article className="screen-card" key={`g2-${screen.file}-${idx}`}>
                    <PhoneMockup className="screen-phone-mockup">
                      <Image
                        src={`${screens}${screen.file}`}
                        alt={screen.alt}
                        width={1080}
                        height={2348}
                        sizes="(max-width: 600px) 72vw, (max-width: 1000px) 34vw, 260px"
                      />
                    </PhoneMockup>
                    <h3>{screen.title}</h3>
                    <p>{screen.detail}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="promise-section shell" id="explorer" aria-labelledby="promise-title"><Reveal className="promise-visual"><PhoneMockup className="promise-video-phone" glow><video ref={videoRef} aria-label="Momo app preview video" autoPlay={!reducedMotion} muted loop playsInline controls preload="auto" poster={`${screens}momo-explorer-poster.png`}><source src="/media/momo-demo.webm" type="video/webm" /><source src="/media/momo-demo.mp4" type="video/mp4" />Your browser does not support embedded video.</video></PhoneMockup></Reveal><Reveal className="promise-copy"><h2 id="promise-title">No guesswork.<br /><em>Just your good stuff.</em></h2><p>Momo creates study material from the documents you provide and keeps source references where possible. If your material doesn’t cover something, Momo should tell you instead of making it up.</p><div className="promise-points"><div><span aria-hidden="true">✓</span> Grounded in your uploaded material</div><div><span aria-hidden="true">✓</span> Source references you can check</div><div><span aria-hidden="true">✓</span> Your finished study sets stay with you</div></div><StoreButtons /></Reveal></section>

        <section className="faq-section shell" id="questions" aria-labelledby="faq-title"><Reveal className="faq-intro"><h2 id="faq-title">Curious minds<br /><em>welcome.</em></h2><p>Here are a few things people ask about studying with Momo.</p></Reveal><Reveal className="faq-list">{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<span aria-hidden="true">+</span></summary><p>{faq.answer}</p></details>)}</Reveal></section>

        <section className="final-cta shell" id="get-momo" aria-labelledby="cta-title"><div className="final-inner"><h2>Your next <em>aha!</em><br />starts here.</h2><p>Momo is your friendly sidekick for turning notes into real progress.</p><StoreButtons light /></div></section>
      </main>
      <footer className="site-footer"><div className="shell footer-inner"><Brand /><p>Made for the moments when learning clicks.</p><nav aria-label="Footer navigation"><a href="#how-it-works">How it works</a><a href="#features">Features</a><a href="#screens">Screen View</a><a href="#questions">FAQ</a></nav><small>© {new Date().getFullYear()} Momo. Keep curious.</small></div></footer>
    </>
  );
}
