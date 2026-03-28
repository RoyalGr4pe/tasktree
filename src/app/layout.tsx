import type { Metadata } from 'next';
import { TooltipProvider } from '@/components/ui/tooltip';
import ThemeProvider from '@/components/ThemeProvider';
import './globals.css';


export const metadata: Metadata = {
  title: 'TaskTree — Unlimited task hierarchy for monday.com',
  description: 'Visual tree view for deep task hierarchies on monday.com boards',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="font-sans">
      <body>
        <ThemeProvider />
        <TooltipProvider delayDuration={400}>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
