import React from 'react';
import { I18nLensProvider } from 'next-i18n-lens/react';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <I18nLensProvider />
        {children}
      </body>
    </html>
  );
}
