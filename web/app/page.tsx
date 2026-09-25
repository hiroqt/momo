'use client';

import Image from 'next/image';
import Icon from './components/Icon';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import PhoneMockup from './components/PhoneMockup';
import MockupGallery from './components/MockupGallery';
import StudyAnywhere from './components/StudyAnywhere';
import StoreButtons from './components/StoreButtons';
import { MomoSounds } from '../lib/momo-sounds';
import { createMessagePicker } from '../lib/momo-click-messages';

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((mod) => mod.DotLottieReact),
  { ssr: false }
);

const asset = '/assets/';
const screens = '/screens/';
type ClickWord = { id: number; x: number; y: number; text: string };

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

function StepArt({ kind }: { kind: (typeof steps)[number]['art'] }) {
  const lottieLayout = { fit: 'contain' as const, align: [0.5, 0.5] as [number, number] };

  if (kind === 'upload') {
    return (
      <div className="step-art step-art-upload" aria-hidden="true">
        <span className="step-art-glow" />
        <DotLottieReact
          src="/lottie/Scanner Animation.lottie"
          loop
          autoplay
          speed={0.82}
          layout={lottieLayout}
          renderConfig={{ autoResize: true }}
          className="step-lottie step-lottie-upload"
        />
      </div>
    );
  }
  if (kind === 'momo') {
    return (
      <div className="step-art step-art-momo" aria-hidden="true">
        <span className="step-art-glow" />
        <DotLottieReact
          src="/lottie/Searching.lottie"
          loop
          autoplay
          speed={0.88}
          layout={lottieLayout}
          renderConfig={{ autoResize: true }}
          className="step-lottie step-lottie-momo"
        />
      </div>
    );
  }
  return (
    <div className="step-art step-art-study" aria-hidden="true">
      <span className="step-art-glow" />
      <DotLottieReact
        src="/lottie/Book.lottie"
        loop
        autoplay
        speed={0.9}
        layout={lottieLayout}
        renderConfig={{ autoResize: true }}
        className="step-lottie step-lottie-study"
      />
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [clickWords, setClickWords] = useState<ClickWord[]>([]);
  const soundsRef = useRef<MomoSounds | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const soundOnRef = useRef(true);
  const wordIdRef = useRef(0);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 110, damping: 30, restDelta: 0.001 });

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'assistant' | 'user'; content: string }>>([
    {
      role: 'assistant',
      content: "Hi, I’m Momo. Your notes called; they would like to become more than desktop decoration. Ask me about uploads, quizzes, or studying offline.",
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const chatRequestRef = useRef<AbortController | null>(null);
  useEffect(() => () => chatRequestRef.current?.abort(), []);

  const quickQuestions = [
    'Save my GPA pls',
    'Can I dump a 50-page PDF?',
    'Do you steal my notes?',
    'Does this work with zero Wi-Fi?',
  ];

  function playMomoCall() {
    void soundsRef.current?.play();
  }

  useEffect(() => {
    const sounds = new MomoSounds();
    sounds.setEnabled(soundOnRef.current);
    soundsRef.current = sounds;
    return () => {
      sounds.dispose();
      soundsRef.current = null;
    };
  }, []);

  async function sendMessage(textToSend?: string) {
    const text = (textToSend ?? inputVal).trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    const controller = new AbortController();
    chatRequestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 12000);

    setInputVal('');
    setChatError(null);
    const updatedMessages = [...chatMessages, { role: 'user' as const, content: text }];
    setChatMessages(updatedMessages);
    setIsSending(true);

    try {
      const res = await fetch('/api/momo-preview-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          history: chatMessages.slice(-24),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setChatError(data?.error || 'Momo is taking a quick breather. Please try again in a few moments.');
        return;
      }

      if (typeof data.reply !== 'string' || !data.reply.trim()) {
        setChatError('Momo lost the thread. Try asking again.');
        return;
      }
      const reply = data.reply.trim();
      if (chatMessages.some(item => item.role === 'assistant' && item.content.toLowerCase() === reply.toLowerCase())) {
        setChatError('We have covered that one. Ask about another Momo feature for something new.');
        return;
      }
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);

      if (soundOn) {
        playMomoCall();
      }
    } catch {
      setChatError('Could not reach Momo right now. Please try again!');
    } finally {
      window.clearTimeout(timeout);
      sendingRef.current = false;
      chatRequestRef.current = null;
      setIsSending(false);
    }
  }

  useEffect(() => {
    if (chatOpen && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isSending, chatOpen]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      void videoRef.current.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const timers = new Set<number>();
    const nextMessage = createMessagePicker();
    const pointerStarts = new Map<number, { x: number; y: number }>();
    function rememberPointer(event: PointerEvent) {
      if (!event.isPrimary || event.button !== 0) return;
      pointerStarts.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    function addStudyWord(event: PointerEvent) {
      const start = pointerStarts.get(event.pointerId);
      pointerStarts.delete(event.pointerId);
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return;
      const soundToggle = event.target instanceof Element && event.target.closest('[data-sound-toggle]');
      if (soundToggle) return;
      playMomoCall();
      const id = ++wordIdRef.current;
      const x = Math.max(100, Math.min(window.innerWidth - 100, event.clientX));
      const y = Math.max(36, Math.min(window.innerHeight - 36, event.clientY));
      const word = {
        id, x, y, text: nextMessage(),
      };
      setClickWords((words) => [...words.slice(-7), word]);
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
    };
  }, []);

  function toggleSound() {
    soundOnRef.current = !soundOnRef.current;
    setSoundOn(soundOnRef.current);
    soundsRef.current?.setEnabled(soundOnRef.current);
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
          <div className="header-actions">
            <button
              className="sound-toggle header-sound-toggle"
              data-sound-toggle
              type="button"
              aria-label={soundOn ? 'Mute Momo sounds' : 'Unmute Momo sounds'}
              aria-pressed={!soundOn}
              onClick={toggleSound}
              title={soundOn ? 'Sound is on - click to mute' : 'Sound is off - click to enable'}
            >
              {soundOn ? (
                <Icon name="volumeOn" size={15} />
              ) : (
                <Icon name="volumeOff" size={15} />
              )}
              <span>{soundOn ? 'Sound on' : 'Sound off'}</span>
            </button>
            <a className="header-cta" href="#get-momo">Get Momo <span className="header-cta-arrow" aria-hidden="true"><Icon name="arrowUpRight" size={18} /></span></a>
          </div>
          <button className={`menu-toggle ${menuOpen ? 'is-open' : ''}`} type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-controls="mobile-nav" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><Icon name={menuOpen ? 'close' : 'menu'} size={22} /></button>
        </div>
        <nav className="mobile-nav" id="mobile-nav" aria-label="Mobile navigation" hidden={!menuOpen} onClick={() => setMenuOpen(false)}><a href="#how-it-works">How it works</a><a href="#features">What you can do</a><a href="#screens">Screen View</a><a href="#questions">Questions</a><a href="#get-momo">Get Momo <Icon name="arrowUpRight" size={16} /></a></nav>
      </header>

      <main id="main">
        <section className="hero shell hero-split momo-hero" aria-labelledby="hero-title">
          <div className="hero-content">
            <h1 id="hero-title">Study smarter.<br /><span>Learn with Momo.</span></h1>
            <p className="hero-copy">Turn your notes into flashcards, quizzes, and clear summaries—with a study buddy by your side.</p>
            <StoreButtons className="hero-actions" />
          </div>
          <div className={`hero-visual ${chatOpen ? 'is-chat-open' : ''}`}>
            {chatOpen && (
              <div
                className="chat-backdrop"
                aria-hidden="true"
                onClick={() => setChatOpen(false)}
              />
            )}
            <PhoneMockup
              className={`hero-screen-phone ${chatOpen ? 'is-chat-mode' : ''}`}
              glow
            >
              <AnimatePresence mode="wait">
                {!chatOpen ? (
                  <motion.div
                    key="phone-dashboard"
                    className="phone-screen-inner"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22 }}
                  >
                    <Image
                      src={`${screens}momo-dashboard.png`}
                      alt="Actual Momo dashboard showing a reviewer, streak, and library"
                      width={1080}
                      height={2348}
                      priority
                      sizes="(max-width: 760px) 220px, 315px"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="phone-chat"
                    className="phone-chat-view"
                    role="dialog"
                    aria-label="Momo AI Chat Preview"
                    initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="phone-chat-header">
                      <div className="phone-chat-header-avatar">
                        <Image src={`${asset}momo_logo.png`} alt="" width={26} height={26} />
                        <span className="status-dot" aria-label="Online" />
                      </div>
                      <div className="phone-chat-header-info">
                        <div className="phone-chat-title-row">
                          <strong>Ask Momo</strong>
                          <span className="chat-live-badge">Preview</span>
                        </div>
                        <span>Your sarcastic study bestie</span>
                      </div>
                      <button
                        type="button"
                        className="phone-chat-close-btn"
                        aria-label="Close Momo chat"
                        title="Close chat"
                        onClick={() => setChatOpen(false)}
                      >
                        <Icon name="close" size={13} />
                      </button>
                    </div>

                    <div className="phone-chat-messages" ref={chatScrollRef} data-native-scroll role="log" aria-label="Conversation with Momo" aria-live="polite">
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
                          {msg.role === 'assistant' && (
                            <span className="msg-avatar-icon" aria-hidden="true">
                              <Image src={`${asset}momo_logo.png`} alt="" width={18} height={18} />
                            </span>
                          )}
                          <div className="msg-bubble">
                            <p>{msg.content}</p>
                          </div>
                        </div>
                      ))}
                      {isSending && (
                        <div className="chat-msg chat-msg-assistant">
                          <span className="msg-avatar-icon" aria-hidden="true">
                            <Image src={`${asset}momo_logo.png`} alt="" width={18} height={18} />
                          </span>
                          <div className="msg-bubble msg-typing">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                          </div>
                        </div>
                      )}
                      {chatError && (
                        <div className="chat-error-banner" role="alert">
                          <Icon name="alert" size={13} />
                          <span>{chatError}</span>
                        </div>
                      )}
                    </div>

                    <div className="phone-chat-chips">
                      {quickQuestions.filter(q => !chatMessages.some(message => message.role === 'user' && message.content === q)).slice(0, 2).map((q) => (
                        <button
                          key={q}
                          type="button"
                          className="chat-chip"
                          disabled={isSending}
                          onClick={() => sendMessage(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>

                    <form
                      className="phone-chat-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        sendMessage();
                      }}
                    >
                      <input
                        type="text"
                        className="phone-chat-input"
                        placeholder="Ask about Momo…"
                        aria-label="Your question about Momo"
                        value={inputVal}
                        maxLength={500}
                        onChange={(e) => setInputVal(e.target.value)}
                        disabled={isSending}
                      />
                      <button
                        type="submit"
                        className="phone-chat-send-btn"
                        aria-label="Send question"
                        disabled={!inputVal.trim() || isSending}
                      >
                        <Icon name="arrowUp" size={14} />
                      </button>
                    </form>
                    <div className="phone-chat-footer-note">
                      <span>Momo product preview · No uploads here</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </PhoneMockup>

            <div className="hero-mascot-wrap">
              <button
                className={`mascot-button ${chatOpen ? 'is-chat-active' : ''}`}
                type="button"
                aria-label={chatOpen ? "Close Momo study chat" : "Chat with Momo AI"}
                title={chatOpen ? "Close Momo chat" : "Tap to chat with Momo!"}
                onClick={() => {
                  setChatOpen((open) => !open);
                  if (!chatOpen && soundOn) {
                    playMomoCall();
                  }
                }}
              >
                <Image src={`${asset}momo-full-body-cutout.png`} alt="Momo holding a yellow study notebook" width={1024} height={1536} priority sizes="(max-width: 760px) 220px, 340px" />
              </button>
              {!chatOpen && <button type="button" className="mascot-chat-hint" onClick={() => setChatOpen(true)}>
                <Icon name="arrowTurnUp" size={26} />
                <span>Psst… tap me to chat.</span>
              </button>}
            </div>
          </div>
        </section>

        <section className="section intro shell" id="how-it-works" aria-labelledby="intro-title">
          <Reveal className="intro-heading"><h2 id="intro-title">From <em>“where do I start?”</em><br />to <span className="underline-swoop">“okay, I’ve got this.”</span></h2><p className="section-lead">Momo helps you do more with the notes you already have. Three little steps, a lot more clarity.</p></Reveal>
          <div className="steps-grid">{steps.map((step) => <Reveal className="step-card" key={step.number}><StepArt kind={step.art} /><div className="step-number">{step.number} <span /></div><h3>{step.title}</h3><p>{step.copy}</p></Reveal>)}</div>
        </section>

        <section className="formats-section" id="features" aria-labelledby="features-title"><div className="shell formats-shell"><Reveal className="formats-heading"><h2 id="features-title">Your material.<br /><em>Every study mood.</em></h2><p>Need a quick check, a deep review, or a practice run? Momo helps turn one source into the format that fits your day.</p></Reveal><div className="format-cards">
          <Reveal className="format-card format-card-flash"><span className="format-icon" aria-hidden="true"><Icon name="cards" size={22} /></span><div className="format-preview flash-preview" aria-hidden="true"><small>FLASHCARD</small><strong>One idea at a time.</strong><span>Flip. Remember. Repeat.</span></div><h3>Flashcards</h3><p>Make important ideas easier to revisit.</p></Reveal>
          <Reveal className="format-card format-card-quiz"><span className="format-icon" aria-hidden="true"><Icon name="quiz" size={22} /></span><div className="format-preview quiz-preview" aria-hidden="true"><small>QUICK QUIZ</small><strong>Which answer makes sense?</strong><span className="quiz-option">A &nbsp; The one in your notes</span><span className="quiz-option selected">B &nbsp; You got this <Icon name="check" size={13} /></span></div><h3>Quizzes & exams</h3><p>Practice recalling, not just rereading.</p></Reveal>
          <Reveal className="format-card format-card-summary"><span className="format-icon" aria-hidden="true"><Icon name="note" size={22} /></span><div className="format-preview summary-preview" aria-hidden="true"><small>STUDY SUMMARY</small><strong>The big picture, clearer.</strong><span /><span /><span /></div><h3>Summaries & answers</h3><p>Get to the key points in your own material.</p></Reveal>
          </div><Reveal className="format-note">And more: true or false, identification, fill in the blank, Q&amp;A, and topic explanations. <Icon name="arrowUpRight" size={18} /></Reveal></div></section>

        <section className="screens-section" id="screens" aria-labelledby="screens-title">
          <div className="shell screens-heading-shell">
            <Reveal className="screens-heading">
              <h2 id="screens-title">Take a look <em>inside Momo.</em></h2>
              <p>These are screens from the app, from your first hello to your next study session.</p>
            </Reveal>
          </div>
          <MockupGallery />
        </section>

        <section className="promise-section shell" id="explorer" aria-labelledby="promise-title"><Reveal className="promise-visual"><PhoneMockup className="promise-video-phone" glow><video ref={videoRef} aria-label="Momo app preview video" autoPlay={!reducedMotion} muted loop playsInline controls preload="auto" poster={`${screens}momo-explorer-poster.png`}><source src="/media/momo-demo.webm" type="video/webm" /><source src="/media/momo-demo.mp4" type="video/mp4" />Your browser does not support embedded video.</video></PhoneMockup></Reveal><Reveal className="promise-copy"><h2 id="promise-title">No guesswork.<br /><em>Just your good stuff.</em></h2><p>Momo creates study material from the documents you provide and keeps source references where possible. If your material doesn’t cover something, Momo should tell you instead of making it up.</p><div className="promise-points"><div><span aria-hidden="true"><Icon name="check" size={18} /></span> Grounded in your uploaded material</div><div><span aria-hidden="true"><Icon name="check" size={18} /></span> Source references you can check</div><div><span aria-hidden="true"><Icon name="check" size={18} /></span> Your finished study sets stay with you</div></div><StoreButtons /></Reveal></section>

        <section className="faq-section shell" id="questions" aria-labelledby="faq-title"><Reveal className="faq-intro"><h2 id="faq-title">Curious minds<br /><em>welcome.</em></h2><p>Here are a few things people ask about studying with Momo.</p></Reveal><Reveal className="faq-list">{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<span aria-hidden="true"><Icon name="add" size={18} /></span></summary><p>{faq.answer}</p></details>)}</Reveal></section>

        <StudyAnywhere><StoreButtons /></StudyAnywhere>
      </main>
      <footer className="site-footer"><div className="shell footer-inner"><Brand /><p>Made for the moments when learning clicks.</p><nav aria-label="Footer navigation"><a href="#how-it-works">How it works</a><a href="#features">Features</a><a href="#screens">Screen View</a><a href="#questions">FAQ</a></nav><small>© {new Date().getFullYear()} Momo. Keep curious.</small></div></footer>
    </>
  );
}
