import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Sarcoma Investigative Research Network',
  description: 'Research project management platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 text-gray-900">
        {children}
      </body>
    </html>
  );
}