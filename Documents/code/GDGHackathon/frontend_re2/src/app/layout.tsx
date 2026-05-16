import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { SiteFooter } from "@/components/layout/SiteFooter";
import "./globals.css";

const ibmSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ibm-plex",
  weight: ["400", "500", "600", "700"],
});

const ibmMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Lattice — Programme Intelligence Platform",
  description: "Enterprise Graph RAG networking and programme management",
  icons: {
    icon: "/lattice-mark.svg",
    apple: "/lattice-mark.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ibmSans.variable} ${ibmMono.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <AuthProvider>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}



