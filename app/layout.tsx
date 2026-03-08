import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope, Source_Serif_4 } from "next/font/google";
import { ReactNode } from "react";
import "@/app/globals.scss";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap"
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin", "cyrillic"],
  variable: "--font-serif",
  display: "swap"
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  variable: "--font-brand",
  display: "swap",
  weight: ["500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Галльярд | Прямые поставки сырья из Китая",
  description:
    "Галльярд организует прямые поставки промышленного сырья из Китая в Беларусь: от поиска поставщика до таможенного оформления и логистики.",
  openGraph: {
    title: "Галльярд | Импорт сырья из Китая",
    description:
      "Комплексное сопровождение поставок сырья из Китая в Беларусь.",
    url: "https://example.by",
    siteName: "Галльярд",
    locale: "ru_BY",
    type: "website",
    images: [
      {
        url: "/og-placeholder.svg",
        width: 1200,
        height: 630,
        alt: "Импорт сырья из Китая в РБ"
      }
    ]
  },
  metadataBase: new URL("https://example.by")
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${sourceSerif.variable} ${cormorant.variable}`}>
        {children}
      </body>
    </html>
  );
}
