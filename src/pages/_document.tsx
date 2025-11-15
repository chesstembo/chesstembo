import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <meta
          name="description"
          content="Analyze your chess games for free on any device with Stockfish!"
        />

        {/* OG (Social networks) */}
        <meta property="og:title" content="Tembochess.com" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Tembochess.com" />
        <meta property="og:url" content="https://Tembochess.com/" />
        <meta
          property="og:image"
          content="https://Tembochess.com/social-networks-1200x630.png"
        />
        <meta
          property="og:description"
          content="Analyze your chess games for free on any device with Stockfish!"
        />

        {/* Twitter */}
        <meta name="twitter:title" content="Tembochess.com" />
        <meta name="twitter:domain" content="Tembochess.com" />
        <meta name="twitter:url" content="https://Tembochess.com/" />
        <meta
          name="twitter:description"
          content="Analyze your chess games for free on any device with Stockfish!"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:image"
          content="https://Tembochess.com/social-networks-1200x630.png"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
