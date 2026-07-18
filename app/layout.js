import './globals.css';
import Script from 'next/script';
import { Toaster } from 'sonner';
import { Providers } from './providers';

export const metadata = {
  title: 'Raasta — Real Routes by Real People',
  description: 'Record and share the exact routes you travel. Human-curated routes, shared instantly.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Raasta',
    description: 'Discover and share real local routes with the Raasta app.',
    type: 'website',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Raasta',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0a0a" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="antialiased bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 min-h-screen">
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        <Providers>
          {children}
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  );
}
