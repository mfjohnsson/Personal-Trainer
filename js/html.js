// Text typed by the user (dish and ingredient names) goes through here before it is put in innerHTML.
const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ENTITIES[c]);

export function actionMenu(name, actions) {
  return `<details class="action-menu" name="row-actions">
    <summary aria-label="Alternativ för ${esc(name)}">⋯</summary>
    <div>${actions}</div>
  </details>`;
}
