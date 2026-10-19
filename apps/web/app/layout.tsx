import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Source_Serif_4 } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';

// ADR-049: Plus Jakarta Sans for the interface, Source Serif 4 for page titles and long reading (notes, answers).
const ui = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-ui' });
const read = Source_Serif_4({ subsets: ['latin'], variable: '--font-read' });

export const metadata: Metadata = {
  title: { default: 'ExamEdge AI', template: '%s · ExamEdge AI' },
  description: 'AI learning platform for coaching institutes',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${read.variable}`}>
      <body>{children}</body>
    </html>
  );
}
