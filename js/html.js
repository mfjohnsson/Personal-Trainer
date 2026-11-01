// Text typed by the user (dish and ingredient names) goes through here before it is put in innerHTML.
const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ENTITIES[c]);
