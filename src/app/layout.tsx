import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from './Providers';

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QControl | Run your gaming business smarter",
  description: "Run your gaming business smarter with QControl.",
  openGraph: {
    title: "QControl | Run your gaming business smarter",
    description: "Run your gaming business smarter with QControl.",
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${hankenGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          id="pre-paint-script"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                // Hero Rotation Logic
                const variants = ["flagship", "unified", "visibility", "time-based", "journey", "promotions", "digital", "status", "remote", "automation"];
                let variantId = 'flagship';
                
                const urlParams = new URLSearchParams(window.location.search);
                const override = urlParams.get('h');
                
                if (override && variants.includes(override)) {
                  variantId = override;
                } else {
                  const now = Date.now();
                  const lastSeen = localStorage.getItem('qcontrol_lastSeen');
                  const sessionVariant = sessionStorage.getItem('heroVariant');
                  
                  // A new visit means: a new browser session OR more than 30 mins since lastSeen
                  const isNewVisit = !sessionVariant || (lastSeen && (now - parseInt(lastSeen, 10)) > 30 * 60 * 1000);
                  
                  if (!isNewVisit && sessionVariant) {
                    variantId = sessionVariant;
                  } else {
                    const hasVisited = localStorage.getItem('qcontrol_visited');
                    if (!hasVisited) {
                      variantId = 'flagship';
                      localStorage.setItem('qcontrol_visited', 'true');
                    } else {
                      let lastId = localStorage.getItem('lastVariantId');
                      let order = JSON.parse(localStorage.getItem('variantOrder') || '[]');
                      
                      if (order.length === 0) {
                        // Reshuffle but don't repeat the last one
                        order = [...variants].sort(() => Math.random() - 0.5);
                        if (order[0] === lastId && order.length > 1) {
                          order.push(order.shift());
                        }
                      }
                      
                      variantId = order.shift();
                      localStorage.setItem('variantOrder', JSON.stringify(order));
                    }
                    localStorage.setItem('lastVariantId', variantId);
                    sessionStorage.setItem('heroVariant', variantId);
                  }
                  localStorage.setItem('qcontrol_lastSeen', now.toString());
                }
                document.documentElement.setAttribute('data-hero-variant', variantId);
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg-primary text-text-primary transition-colors duration-200">
        <Providers />
        {children}
      </body>
    </html>
  );
}
