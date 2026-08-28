const principles = [
  "Payment events are processed idempotently.",
  "Recovery never outruns verified payment state.",
  "Every future action will be auditable and bounded.",
];

export default function HomePage() {
  return (
    <main className="shell">
      <p className="eyebrow">RecoveryOS / foundation</p>
      <h1>Autonomous payment revenue recovery, built safely.</h1>
      <p className="lede">
        The first system layer is in place: a strict TypeScript application and a tested
        payment-journey state engine.
      </p>
      <section aria-labelledby="foundation-principles">
        <h2 id="foundation-principles">Foundation principles</h2>
        <ul>
          {principles.map((principle) => (
            <li key={principle}>{principle}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
