import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="th">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <meta name="description" content="ระบบจัดเวรพยาบาลอัจฉริยะ" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}