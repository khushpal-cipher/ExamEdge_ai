import type { Metadata } from 'next';
import { IBM_Plex_Mono, Inter, Silkscreen, Source_Serif_4 } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';

// Mono theme: Inter for text, IBM Plex Mono for labels and numbers, Silkscreen (bitmap) for the students' retro
// headings, Source Serif 4 for long reading.
const ui = Inter({ subsets: ['latin'], variable: '--font-ui' });
const mono = IBM_Plex_Mono({ weight: ['400', '500'], subsets: ['latin'], variable: '--font-mono' });
const pixel = Silkscreen({ weight: '400', subsets: ['latin'], variable: '--font-pixel' });
const read = Source_Serif_4({ subsets: ['latin'], variable: '--font-read' });

export const metadata: Metadata = {
  title: { default: 'ExamEdge AI', template: '%s · ExamEdge AI' },
  description: 'AI learning platform for coaching institutes',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${mono.variable} ${pixel.variable} ${read.variable}`}>
      <body>{children}</body>
    </html>
  );
}
