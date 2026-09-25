'use client';

import Image from 'next/image';
import Icon from './Icon';
import { useState, type ReactNode } from 'react';
import styles from './StudyAnywhere.module.css';

export default function StudyAnywhere({ children }: { children: ReactNode }) {
  const [answerVisible, setAnswerVisible] = useState(false);

  return (
    <section className={styles.section} id="get-momo" aria-labelledby="cta-title">
      <div className={styles.inner}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>YOUR STUDY BUDDY. TO GO.</span>
          <h2 id="cta-title">Little breaks.<br /><em>Big brain energy.</em></h2>
          <p>Between classes. On the ride home. Curled up on the couch.<br className={styles.desktopBreak} /> Turn a little spare time into an “I’ve got this” with Momo.</p>
          <div className={styles.stores}>{children}</div>
          <a className={styles.previewLink} href="#screens">Meet your pocket study buddy <span aria-hidden="true"><Icon name="arrowUpRight" size={18} /></span></a>
        </div>

        <div className={styles.scene}>
          <div className={styles.orbit} aria-hidden="true" />
          <span className={`${styles.spark} ${styles.sparkLeft}`} aria-hidden="true"><Icon name="sparkle" size="1em" /></span>
          <span className={`${styles.spark} ${styles.sparkRight}`} aria-hidden="true"><Icon name="sparkle" size="1em" /></span>

          <div className={styles.notebook}>
            <span className={styles.tape} aria-hidden="true" />
            <small>THE NOTES YOU ALREADY HAVE</small>
            <strong>A little less<br /><mark>overwhelming.</mark></strong>
            <div className={styles.noteLines} aria-hidden="true"><span /><span /><span /></div>
            <span className={styles.noteFooter}>Your material. A fresh way to study.</span>
          </div>

          <div className={styles.mascot}>
            <span className={styles.speech}>Got five minutes? <b>Let’s make them count.</b></span>
            <div className={styles.mascotCrop}>
              <Image src="/assets/momo-cta-torso.png" alt="Momo holding a study notebook and giving a thumbs-up" width={1141} height={1379} sizes="(max-width: 760px) 320px, 390px" />
            </div>
          </div>

          <button className={`${styles.flashcard} ${answerVisible ? styles.revealed : ''}`} type="button" onClick={() => setAnswerVisible((visible) => !visible)} aria-pressed={answerVisible} aria-label={answerVisible ? 'Show sample flashcard question' : 'Reveal sample flashcard answer'}>
            <span className={styles.cardTop}>A TINY PRACTICE BREAK <span aria-hidden="true"><Icon name="sparkle" size="1em" /></span></span>
            <span className={styles.cardContent} aria-live="polite">
              <strong>{answerVisible ? 'Your next aha moment.' : 'What fits in your pocket and helps things click?'}</strong>
              {answerVisible && <span>With a little help from Momo.</span>}
            </span>
            <span className={styles.cardBottom}>{answerVisible ? 'One more look?' : 'Tap for a little aha!'} <span aria-hidden="true"><Icon name="refresh" size={18} /></span></span>
          </button>

          <span className={styles.offlineBadge}><Icon name="download" size={20} />Saved reviewers. Anywhere.</span>
          <span className={styles.stickyNote}>Less scrolling.<br /><b>More “ohhh, I get it.”</b><span aria-hidden="true"><Icon name="heart" size="1em" /></span></span>
        </div>

        <p className={styles.footnote}>Make it with Wi-Fi. Take it wherever.<span>Save your study sets before heading offline. Creating new ones needs a connection.</span></p>
      </div>
    </section>
  );
}
