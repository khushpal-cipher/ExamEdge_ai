import type { Metadata } from 'next';
import { Lora, Poppins } from 'next/font/google';
import './globals.css';

const ui = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-ui' });
const read = Lora({ subsets: ['latin'], variable: '--font-read' });

export const metadata: Metadata = {
  title: 'ExamEdge AI',
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
