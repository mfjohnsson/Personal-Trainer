export const title = "Profil";

export function mount(el) {
  el.innerHTML = `
    <section class="card">
      <h2><span class="dot" style="background: var(--c-vikt)"></span>Profil</h2>
      <p class="empty">Ingen profil än.</p>
      <p class="empty">Här fyller du i ålder, längd, vikt, midja och målvikt.</p>
    </section>`;
}
