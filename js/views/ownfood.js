import { saveOwnFood } from "../foods.js";
import { esc } from "../html.js";

export function createOwnFood(query, pick) {
  const fields = [["kcal", "Energi (kcal)", 900], ["protein", "Protein (g)", 100], ["fat", "Fett (g)", 100], ["carbs", "Kolhydrater (g)", 100]];
  editDialog("Skapa eget livsmedel", `
    <label class="field">Namn <input name="name" required maxlength="100" value="${esc(query.trim().slice(0, 100))}"></label>
    <p>Näringsvärden per 100 g</p>
    ${fields.map(([key, label, max]) => `<label class="field">${label} <input name="${key}" type="number" min="0" max="${max}" step="any" required></label>`).join("")}
  `, "Spara och välj", (data) => {
    const food = saveOwnFood(data.get("name"), Object.fromEntries(fields.map(([key]) => [key, Number(data.get(key))])));
    if (!food) return "Kunde inte spara livsmedlet. Kontrollera namn och värden.";
    pick(food);
  });
}

export function editDialog(title, body, action, submit, change = null) {
  const dialog = document.createElement("dialog");
  dialog.className = "food-dialog";
  dialog.setAttribute("aria-label", title);
  dialog.innerHTML = `<form>
    <h2>${esc(title)}</h2>
    ${body}
    <p class="field-error" role="alert" hidden></p>
    <div class="meal-actions"><button class="btn-secondary" type="button">Avbryt</button>
    <button class="btn-primary" type="submit">${esc(action)}</button></div>
  </form>`;
  const form = dialog.querySelector("form");
  const refresh = () => change?.(new FormData(form), form);
  form.oninput = refresh;
  dialog.querySelector('button[type="button"]').onclick = () => dialog.close();
  form.onsubmit = (event) => {
    event.preventDefault();
    const result = submit(new FormData(form));
    if (typeof result === "string" && result) {
      const error = dialog.querySelector("[role=alert]");
      error.textContent = result;
      error.hidden = false;
      return;
    }
    if (typeof result === "function") dialog.addEventListener("close", result, { once: true });
    dialog.close();
  };
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
  refresh();
}

export const foodHint = (food) => food.own ? "Eget livsmedel · " : food.suggested ? "Liknande vara · " : "";
