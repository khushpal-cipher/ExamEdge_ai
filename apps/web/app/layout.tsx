import type { Metadata } from 'next';
import { Anton, Source_Serif_4, Space_Grotesk, Space_Mono } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';

// Space theme: Anton for big titles, Space Mono for labels, Space Grotesk for text, Source Serif 4 for long reading.
const display = Anton({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const mono = Space_Mono({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-mono' });
const ui = Space_Grotesk({ subsets: ['latin'], variable: '--font-ui' });
const read = Source_Serif_4({ subsets: ['latin'], variable: '--font-read' });

export const metadata: Metadata = {
  title: { default: 'ExamEdge AI', template: '%s · ExamEdge AI' },
  description: 'AI learning platform for coaching institutes',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${ui.variable} ${read.variable}`}>
      <body>{children}</body>
    </html>
  );
}
