export const dynamic = "force-dynamic";

export const metadata = {
  title: "Impressum",
};

export default function ImpressumPage() {
  return (
    <article className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Impressum</h1>
      </header>

      <div className="space-y-4 leading-7 text-sm sm:text-base whitespace-pre-wrap">
        <p>
          <strong>Provider / Operator</strong>
          {"\n"}
          Valentyn Kasyan
          {"\n"}
          Helfmann Str. 28
          {"\n"}
          64293 Darmstadt
          {"\n"}
          Germany
        </p>

        <p>
          <strong>Contact</strong>
          {"\n"}
          Telefon: +49 (0) 6151-3963588
          {"\n"}
          E-Mail: info@infinisimo.com
        </p>

        <p>
          <strong>Represented by</strong>
          {"\n"}
          Valentyn Kasyan
        </p>

        <p>
          <strong>VAT</strong>
          {"\n"}
          VAT ID: not applicable (not VAT-registered)
        </p>

        <p>
          <strong>EU dispute resolution</strong>
          {"\n"}
          The European Commission provides an online dispute resolution (ODR)
          platform.
        </p>
      </div>
    </article>
  );
}
