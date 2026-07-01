// Shared demo helpers — sample nation + toast + cooldown. Vanilla, no build.
// ponytail: one nation, in-memory, no persistence — it's a look-and-feel demo.
window.NATION = {
  name: "Valehaven",
  vision: "Maritime Trading Republic",
  leader: "First Minister Aldwin Roe",
  // player-facing state is ALWAYS bands, never raw numbers (bible §7)
  standing: {
    Economy:   { band: "good", label: "Expanding" },
    Approval:  { band: "mid",  label: "Restless" },
    Stability: { band: "good", label: "Steady" },
    Capacity:  { band: "mid",  label: "Stretched" },   // CivCap
    Standing:  { band: "info", label: "Respected" },   // diplomatic
    Treasury:  { band: "fog",  label: "Unclear" },      // Fog of Information
  },
};

// canonical loop demo output: action -> effect(band shift) -> narrative -> ledger
window.LEDGER = [];
function recordEvent({ title, effect, delta, dir = "up", narrative }) {
  const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  window.LEDGER.unshift({ t, title, effect, delta, dir, narrative });
  document.dispatchEvent(new CustomEvent("ledger", { detail: window.LEDGER }));
  if (narrative) toast(narrative);
  return window.LEDGER;
}

let _toastTimer;
function toast(html) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
  el.innerHTML = '<span class="k">◆ In-world:</span> ' + html;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("show"), 4200);
}

// Instant commit + cooldown ring (bible: default is instant, cooldown gates pacing)
function commitWithCooldown(btn, seconds, onDone) {
  if (btn.dataset.cooling) return;
  btn.dataset.cooling = "1";
  const ring = document.createElement("span");
  ring.className = "cooldown"; ring.style.setProperty("--p", 0);
  const label = btn.querySelector(".lbl")?.textContent;
  btn.prepend(ring);
  btn.disabled = true;
  let p = 0;
  const iv = setInterval(() => {
    p += 100 / (seconds * 10);
    ring.style.setProperty("--p", Math.min(100, p));
    if (p >= 100) {
      clearInterval(iv);
      ring.remove(); btn.disabled = false; delete btn.dataset.cooling;
    }
  }, 100);
  onDone && onDone();
}

// tiny helper to bump a band up one notch (visual only)
const BAND_ORDER = ["bad", "mid", "good"];
function bumpBand(state, key, up = true) {
  const s = state[key]; if (!s || s.band === "fog" || s.band === "info") return;
  const i = BAND_ORDER.indexOf(s.band);
  const ni = Math.max(0, Math.min(2, i + (up ? 1 : -1)));
  s.band = BAND_ORDER[ni];
  s.label = up ? ({0:"Strained",1:"Improving",2:"Strong"}[ni]) : ({0:"Strained",1:"Wavering",2:"Holding"}[ni]);
}
