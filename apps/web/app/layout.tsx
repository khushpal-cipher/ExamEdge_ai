import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ExamEdge AI',
  description: 'AI learning platform for coaching institutes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
