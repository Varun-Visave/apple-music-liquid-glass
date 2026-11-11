const api = typeof browser !== 'undefined' ? browser : chrome;
const DEFAULTS = { enabled: true, blur: 22, saturation: 180, tint: 12, radius: 22, ambient: true, specular: true, extra: '' };
const units = { blur: 'px', saturation: '%', tint: '%', radius: 'px' };

function bind(key, el) {
  const isCheck = el.type === 'checkbox';
  const out = document.getElementById('v-' + key);
  el.addEventListener('input', () => {
    const val = isCheck ? el.checked : (el.type === 'range' ? Number(el.value) : el.value);
    if (out) out.textContent = val + units[key];
    api.storage.local.set({ [key]: val });
  });
}

async function load() {
  const s = { ...DEFAULTS, ...(await api.storage.local.get(DEFAULTS)) };
  for (const key of Object.keys(DEFAULTS)) {
    const el = document.getElementById(key);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = s[key]; else el.value = s[key];
    const out = document.getElementById('v-' + key);
    if (out) out.textContent = s[key] + units[key];
    bind(key, el);
  }
}
document.getElementById('reset').addEventListener('click', async () => {
  await api.storage.local.set(DEFAULTS);
  location.reload();
});
load();
