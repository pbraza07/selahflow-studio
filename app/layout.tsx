import type { Metadata } from "next";
import "./globals.css";
import {isStaging} from '../server/staging-safety.mjs';

export const metadata: Metadata = {
  ...(isStaging()?{robots:{index:false,follow:false}}:{}),
  title: "SelahFlow | Smart booking & AI receptionist.",
  description: "Your bookings flow. You breathe. Smart booking & AI receptionist.",
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'SelahFlow' },
  icons: {
    icon: [{ url: "/brand/app-icon.svg?v=1.3.11", type: "image/svg+xml" }],
    shortcut: "/brand/app-icon.svg?v=1.3.11",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{isStaging()&&<div role="status" style={{background:'#8a4b00',color:'#fff',padding:'10px 16px',textAlign:'center',fontWeight:700}}>SelahFlow STAGING · Test data only · Sandbox payments</div>}{children}</body>
    </html>
  );
}
