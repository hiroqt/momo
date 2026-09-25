import type { Metadata, Viewport } from 'next';
import './globals.css';
import BananaCursor from './components/BananaCursor';
import SmoothScroll from './components/SmoothScroll';
import 'lenis/dist/lenis.css';

export const metadata: Metadata = {
  title: 'Momo: Make your notes make sense',
  description: 'Meet Momo, your friendly study companion. Turn your own notes into source-grounded flashcards, practice questions, and reviewers you can take anywhere.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f8f9ff',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SmoothScroll />
        <BananaCursor />
        {children}
      </body>
    </html>
  );
}
