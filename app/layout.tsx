import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PrismForge Studio – AI Image Editor',
  description:
    'PrismForge Studio combines AI-powered image remixing, intelligent background removal, and creative palettes for designers and web teams.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-night text-white">
        <div className="min-h-screen bg-gradient-to-br from-night via-[#111b33] to-[#0f1424]">
          {children}
        </div>
      </body>
    </html>
  );
}
