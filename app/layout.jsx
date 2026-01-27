export const metadata = {
  title: 'Automated API Tests',
  description: 'Test your APIs in jiffy',
};

import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400..700&family=Manrope:wght@300..800&family=Sora:wght@400..700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
