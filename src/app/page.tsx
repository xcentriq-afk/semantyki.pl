import Game from "@/components/game";
import styles from "./landing.module.css";

const FAQ = [
  {
    q: "Na czym polega gra?",
    a: "Dostajesz dwa losowe polskie słowa. Twoim zadaniem jest dopisywanie kolejnych słów tak, aby powstał łańcuch znaczeń łączący oba wyrazy. Każde nowe słowo musi być wystarczająco powiązane znaczeniowo z którymś słowem na planszy — wtedy powstaje połączenie. Wygrywasz, gdy oba słowa docelowe znajdą się w jednym łańcuchu. Im mniej słów użyjesz, tym lepszy wynik.",
  },
  {
    q: "Skąd gra wie, że słowa są powiązane?",
    a: "Podobieństwo wyliczamy z kilku źródeł: modelu językowego fastText wytrenowanego na miliardach polskich zdań, relacji słownikowych z polskiego Wikisłownika (synonimy, hiperonimy) oraz słownika skojarzeń. Połączenie powstaje, gdy łączne podobieństwo przekracza 32%.",
  },
  {
    q: "Co oznacza procent przy słowach?",
    a: "To siła powiązania znaczeniowego — od 0% (brak związku) do 100% (niemal synonimy). Próg połączenia wynosi 32%.",
  },
  {
    q: "Czym jest zagadka dnia?",
    a: "Każdego dnia o północy czasu polskiego pojawia się nowa, ta sama dla wszystkich para słów. Możesz porównywać wyniki ze znajomymi i dzielić się łańcuchem w mediach społecznościowych.",
  },
  {
    q: "Jakie części mowy są dozwolone?",
    a: "W zagadce dnia gra się rzeczownikami i przymiotnikami. W trybie treningowym sam wybierasz kategorie (np. tylko czasowniki), zanim rozpoczniesz nową grę.",
  },
  {
    q: "Czy gra jest darmowa?",
    a: "Tak. Gra jest w pełni darmowa, bez rejestracji, reklam i limitów. Projekt hobbystyczny — kod źródłowy jest dostępny publicznie.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "SYMANTYKA.pl",
      url: "https://symantyka.pl",
      applicationCategory: "GameApplication",
      inLanguage: "pl",
      description:
        "Darmowa polska gra słowna online: połącz dwa losowe słowa łańcuchem wyrazów powiązanych znaczeniowo. Codzienna zagadka i tryb treningowy.",
      operatingSystem: "Any",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "PLN",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <Game />
      <main className={styles.wrap}>
        <section className={styles.info} aria-label="Jak grać">
          <h2 className={styles.h2}>Jak grać w SYMANTYKĘ?</h2>
          <ol className={styles.steps}>
            <li>
              Zobaczysz dwa słowa: <strong>start</strong> i <strong>cel</strong> — na pozór
              zupełnie niezwiązane.
            </li>
            <li>
              Wpisz słowo, które znaczeniowo kojarzy się z którymś słowem na planszy. Jeśli
              podobieństwo przekroczy 32%, powstanie połączenie.
            </li>
            <li>
              Dopisuj kolejne wyrazy, budując most między startem a celem. Słowa bez połączeń
              wiszą w próżni — możesz je odsunąć na bok.
            </li>
            <li>
              Połącz oba słowa docelowe jednym łańcuchem i wygraj! Im mniej słów pomostowych,
              tym lepszy wynik. Podziel się nim ze znajomymi.
            </li>
          </ol>
          <p className={styles.lead}>
            SYMANTYKA.pl to polska gra słowna online, w której nie liczy się ortografia, lecz
            znaczenie. Zamiast zgadywać litery, budujesz <strong>łańcuchy skojarzeń</strong> —
            od „deszczu&rdquo; przez „parasol&rdquo; aż po „muzykę&rdquo;. Codziennie nowa zagadka dla wszystkich,
            a w treningu nielimitowane pary i wybór części mowy. Zagraj teraz — za darmo, bez
            rejestracji.
          </p>
        </section>

        <section className={styles.info} aria-label="Częste pytania">
          <h2 className={styles.h2}>Częste pytania</h2>
          <div className={styles.faq}>
            {FAQ.map((f) => (
              <details key={f.q} className={styles.faqItem}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>© {new Date().getFullYear()} SYMANTYKA.pl — polska gra słowna</span>
          <span className={styles.footerLinks}>
            <a
              href="https://creativecommons.org/licenses/by-sa/3.0/"
              rel="noopener noreferrer"
            >
              fastText CC BY-SA 3.0
            </a>
            <span aria-hidden>·</span>
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              rel="noopener noreferrer"
            >
              Wikisłownik CC BY-SA 4.0
            </a>
            <span aria-hidden>·</span>
            <span>Inspirowane grą Linxicon</span>
          </span>
        </div>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
