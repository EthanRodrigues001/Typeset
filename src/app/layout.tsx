import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Typeset",
  description: "Native Markdown workspace",
  icons: {
    icon: "/typeset-logo.png",
    shortcut: "/typeset-logo.png",
    apple: "/typeset-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark h-full antialiased"
      suppressHydrationWarning
    >
      <body className="flex h-dvh min-h-0 flex-col overflow-hidden overscroll-none">
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
