import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import { TopNav } from "@/components/layout/TopNav";
import { TickerBar } from "@/components/market/TickerBar";
import { AppShell } from "@/components/layout/AppShell";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FinancePulse",
  description:
    "Real-time stock and cryptocurrency analysis platform with portfolio tracking, price alerts, and interactive charting.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrains.variable} ${outfit.variable} font-sans antialiased`}
      >
        <Providers>
          <div className="min-h-screen bg-background flex flex-col">
            <AppShell>
              <TopNav />
              <TickerBar />
              <div className="flex-1">{children}</div>
              <Footer />
            </AppShell>
          </div>
        </Providers>
      </body>
    </html>
  );
}
