export const title = "Vecka";

export function mount(el) {
  el.innerHTML = `
    <section class="card">
      <h2><span class="dot" style="background: var(--c-vikt)"></span>Vecka</h2>
      <p class="empty">Ingen vecka skapad än.</p>
      <p class="empty">Här ser du veckans träningspass när din profil är klar.</p>
    </section>`;
}
