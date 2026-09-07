import type { Metadata, Viewport } from 'next';
import { Rubik, Assistant } from 'next/font/google';
import './globals.css';
import { CapiFab } from '@/components/CapiFab';
import { MenuFab } from '@/components/MenuFab';

const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-rubik',
  display: 'swap',
});
const assistant = Assistant({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-assistant',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'QuestLearn',
  description: 'מסע למידה יומי עם קפי',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'QuestLearn', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#FF2A85',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // Resize the layout when the on-screen keyboard opens, so chat/type-in inputs
  // stay visible and messages don't get pushed out of view.
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} ${assistant.variable}`}>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('ql_theme');" +
              "if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);" +
              "var s=localStorage.getItem('ql_textscale');" +
              "if(s==='112%'||s==='125%')document.documentElement.style.fontSize=s;}catch(e){}})();",
          }}
        />
        {children}
        <MenuFab />
        <CapiFab />
      </body>
    </html>
  );
}
