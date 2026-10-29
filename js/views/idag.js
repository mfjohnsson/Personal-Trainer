export const title = "Idag";

export function mount(el) {
  el.innerHTML = `
    <section class="card">
      <h2><span class="dot" style="background: var(--c-vikt)"></span>Idag</h2>
      <p class="empty">Inget att visa än.</p>
      <p class="empty">Här hamnar dagens pass och måltider när veckan är skapad.</p>
    </section>`;
}
