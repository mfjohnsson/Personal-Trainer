// Rest timer between sets: a card on the Träning page that you start yourself. The card element and its
// state live in this module, so the timer keeps counting when you switch tab and shows the right time
// when you come back. It counts against a fixed end time, so a phone that slept is right when it wakes.
// At zero it vibrates and beeps (where the phone allows it).
import { get, set } from "./store.js";

export const REST_CHOICES = [60, 90, 120, 180];
export const DEFAULT_REST = 90;

let picked = null; // the last choice, kept in memory if storage refused it

export const restSeconds = () => {
  const v = picked ?? get("settings")?.restSeconds;
  return REST_CHOICES.includes(v) ? v : DEFAULT_REST;
};

let card = null, body = null, status = null, state = "idle", endAt = 0, tick = null, idleLater = null, audio = null;

const FORGOTTEN_MS = 5 * 60 * 1000;

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const choiceText = (s) => (s < 120 ? s + " s" : s / 60 + " min");
const secondsLeft = () => Math.max(0, Math.ceil((endAt - Date.now()) / 1000));

// Browsers only allow sound after a tap, so the audio context is made (or woken) when the timer starts.
function primeAudio() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  } catch { audio = null; }
}

function beep() {
  if (!audio) return;
  try {
    for (const [at, freq] of [[0, 880], [0.25, 880], [0.5, 1320]]) {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, audio.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + at + 0.2);
      osc.connect(gain).connect(audio.destination);
      osc.start(audio.currentTime + at);
      osc.stop(audio.currentTime + at + 0.2);
    }
  } catch {}
}

const btn = (act, label, cls = "btn-secondary", aria = "") =>
  `<button type="button" class="${cls}" data-rest="${act}"${aria ? ` aria-label="${aria}"` : ""}>${label}</button>`;

function draw() {
  if (!card) return;
  const focused = card.contains(document.activeElement) ? document.activeElement.dataset.rest : null;
  const rest = restSeconds();
  card.className = `card rest-card ${state}`;
  status.textContent = state === "done" ? "Vilan är slut" : "";
  const head = state === "done" ? "Vilan är slut" : "Vila";
  const time = state === "running" ? fmt(secondsLeft()) : state === "done" ? "" : fmt(rest);
  const actions = state === "running"
    ? btn("-15", "−15", "btn-secondary", "15 sekunder kortare") + btn("15", "+15", "btn-secondary", "15 sekunder längre") + btn("stop", "Stoppa")
    : state === "done"
      ? btn("stop", "Stoppa") + btn("start", "Starta igen", "btn-primary")
      : btn("start", "Starta vila", "btn-primary");
  const choices = state === "idle"
    ? `<div class="seg" role="group" aria-label="Vilotid">${REST_CHOICES.map((s) =>
        `<button type="button" data-rest="set:${s}" aria-pressed="${s === rest}">${choiceText(s)}</button>`).join("")}</div>`
    : "";
  body.innerHTML = `<div class="rest-row">
      <span class="rest-label">${head}</span><span class="rest-time" role="timer" aria-live="off">${time}</span>
      <div class="rest-actions">${actions}</div>
    </div>${choices}`;
  // Keep focus on the same button, or on the main button when the one you pressed went away.
  // preventScroll: the timer ending must not pull the page up while you are further down.
  if (focused) (card.querySelector(`[data-rest="${focused}"]`) ?? card.querySelector(`[data-rest="start"], [data-rest="stop"]`))?.focus({ preventScroll: true });
}

function update() {
  if (secondsLeft() > 0) {
    const el = card?.querySelector(".rest-time");
    if (el) el.textContent = fmt(secondsLeft());
    return;
  }
  clearInterval(tick);
  tick = null;
  state = "done";
  draw();
  navigator.vibrate?.([300, 150, 300]);
  beep();
  // "Vilan är slut" stays until you pick Stoppa or Starta igen; a forgotten timer goes back to idle later.
  idleLater = setTimeout(() => { state = "idle"; draw(); }, FORGOTTEN_MS);
}

export function start(seconds = restSeconds()) {
  primeAudio();
  clearTimeout(idleLater);
  clearInterval(tick);
  endAt = Date.now() + seconds * 1000;
  state = "running";
  draw();
  tick = setInterval(update, 250);
}

export function stop() {
  clearInterval(tick);
  clearTimeout(idleLater);
  tick = null;
  state = "idle";
  draw();
}

// The timer card, ready to put in a view. The same element is reused each time the page is opened.
export function element() {
  if (!card) {
    card = document.createElement("section");
    body = document.createElement("div");
    // A live region that stays in place across redraws, so screen readers announce when the rest is over.
    status = document.createElement("p");
    status.className = "sr-only";
    status.setAttribute("role", "status");
    card.append(body, status);
    card.addEventListener("click", (e) => {
      const act = e.target.closest("button")?.dataset.rest;
      if (!act) return;
      if (act === "start") start();
      else if (act === "stop") stop();
      else if (act.startsWith("set:")) {
        picked = Number(act.slice(4));
        set("settings", { ...(get("settings") ?? {}), restSeconds: picked }); // if refused, it holds until reload
        draw();
      } else if (tick) {
        endAt = Math.max(Date.now() + 1000, endAt + Number(act) * 1000);
        update();
      }
    });
  }
  draw();
  return card;
}
