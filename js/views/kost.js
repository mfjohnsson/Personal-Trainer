export const title = "Kost";

export function mount(el) {
  el.innerHTML = `
    <section class="card">
      <h2><span class="dot" style="background: var(--c-midja)"></span>Kost</h2>
      <p class="empty">Inget kostschema än.</p>
      <p class="empty">Här ser du veckans måltider när din profil är klar.</p>
    </section>`;
}
