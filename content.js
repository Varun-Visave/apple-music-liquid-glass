(() => {
  'use strict';
  const api = typeof browser !== 'undefined' ? browser : chrome;

  const DEFAULTS = {
    enabled: true, blur: 22, saturation: 180, tint: 12, radius: 22,
    ambient: true, specular: true, extra: ''
  };

  // Apple changes class names often. Exact class tokens ([class~=]) are used wherever
  // possible so only the container is matched, never its children.
  const SIDE = ['.web-navigation', 'nav[class*="navigation"]'];
  const BAR = ['amp-chrome-player', '[class*="chrome-player"]', '[class*="player-bar"]'];
  const MENUS = ['[role="menu"]', '[role="dialog"]', '[role="listbox"]', '[class~="popover"]',
    '[class~="toast"]', '[class*="search-input"]'];
  const ROWS = ['[class~="songs-list-row"]', '[class~="track-list__item"]', '[class~="library-track"]'];
  const NAV = ['[class~="navigation-item"]', '[class~="navigation-item__link"]'];
  const ART = ['[class*="artwork-component"]', 'amp-artwork'];

  let settings = { ...DEFAULTS };
  let cssText = '';
  const styledRoots = new WeakSet();
  const root = document.documentElement;

  const splitExtra = () => settings.extra.split('\n').map(s => s.trim()).filter(Boolean);

  function applyVars() {
    root.classList.toggle('lg-on', settings.enabled);
    root.classList.toggle('lg-ambient', settings.enabled && settings.ambient);
    const s = root.style;
    s.setProperty('--lg-blur', settings.blur + 'px');
    s.setProperty('--lg-sat', settings.saturation + '%');
    s.setProperty('--lg-tint', (settings.tint / 100).toString());
    s.setProperty('--lg-radius', settings.radius + 'px');
    s.setProperty('--lg-spec', settings.specular ? '1' : '0');
  }

  function ensureAmbient() {
    if (document.getElementById('lg-ambient') || !document.body) return;
    const d = document.createElement('div');
    d.id = 'lg-ambient';
    document.body.prepend(d);
  }

  function getRoots() {
    const roots = [document];
    document.querySelectorAll('*').forEach(el => {
      if (el.localName.includes('-') && el.shadowRoot) roots.push(el.shadowRoot);
    });
    return roots;
  }

  function injectShadowStyle(r) {
    if (r === document || styledRoots.has(r) || !cssText) return;
    const st = document.createElement('style');
    st.className = 'lg-shadow-style';
    st.textContent = cssText.replace(/html\.lg-on(\.lg-ambient)?\s+/g, '');
    r.appendChild(st);
    styledRoots.add(r);
  }

  function tag(r, selectors, classes) {
    for (const sel of selectors) {
      let list;
      try { list = r.querySelectorAll(sel); } catch { continue; }
      list.forEach(el => el.classList.add(...classes));
    }
  }

  const visible = el => {
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    const alpha = bg.startsWith('rgba') ? parseFloat(bg.split(',')[3]) : (bg === 'transparent' ? 0 : 1);
    return (parseFloat(cs.borderTopWidth) || 0) > 0 || alpha > 0.02 || cs.boxShadow !== 'none' ||
      (cs.backdropFilter && cs.backdropFilter !== 'none') || cs.backgroundImage !== 'none';
  };

  function collect(scope, out) {
    scope.querySelectorAll('*').forEach(el => {
      out.push(el);
      if (el.shadowRoot) collect(el.shadowRoot, out);
    });
    return out;
  }

  function descendantsOf(host) {
    const out = collect(host, []);
    if (host.shadowRoot) collect(host.shadowRoot, out);
    return out;
  }

  // The player's native centred capsule: the outermost visible box narrower than the full-width host
  function findPill(host, list) {
    const hostW = host.getBoundingClientRect().width || window.innerWidth;
    return list.find(el => el.offsetWidth >= 360 && el.offsetHeight >= 48 &&
      el.offsetWidth < hostW - 40 && visible(el));
  }

  function setupBars(r) {
    r.querySelectorAll('.lg-host').forEach(host => {
      const list = descendantsOf(host);
      const pill = findPill(host, list);
      if (pill) {
        pill.classList.add('lg-glass', 'lg-bar');
        host.classList.add('lg-host-clear');
        list.forEach(el => {
          if (el !== pill && pill.contains(el) !== false && el.offsetWidth >= 120 &&
              el.offsetHeight >= 40 && !el.classList.contains('lg-art') && visible(el)) {
            el.classList.add('lg-flat');
          }
        });
      } else {
        host.classList.remove('lg-host-clear');
        host.classList.add('lg-glass', 'lg-bar');
      }
    });
  }

  // Does any ancestor (crossing shadow boundaries) carry this class?
  function hasAncestorWith(el, cls) {
    let n = el.parentNode || el.host;
    while (n) {
      if (n.classList && n.classList.contains(cls)) return true;
      n = n.parentNode || n.host;
    }
    return false;
  }

  // Glass never nests: remove it from anything already inside glass.
  function prune(r) {
    r.querySelectorAll('.lg-glass').forEach(el => {
      if (hasAncestorWith(el, 'lg-glass')) el.classList.remove('lg-glass', 'lg-bar', 'lg-side');
    });
    ['lg-row', 'lg-nav'].forEach(c => {
      r.querySelectorAll('.' + c).forEach(el => {
        if (hasAncestorWith(el, c)) el.classList.remove(c);
      });
    });
  }

  function fixPositions(r) {
    r.querySelectorAll('.lg-glass,.lg-host').forEach(el => {
      if (getComputedStyle(el).position === 'static') {
        el.style.setProperty('position', 'relative', 'important');
      }
    });
  }

  function scan() {
    if (!settings.enabled) return;
    ensureAmbient();
    for (const r of getRoots()) {
      injectShadowStyle(r);
      tag(r, SIDE, ['lg-glass', 'lg-side']);
      tag(r, BAR, ['lg-host']);
      tag(r, MENUS, ['lg-glass']);
      tag(r, splitExtra(), ['lg-glass']);
      tag(r, ROWS, ['lg-row']);
      tag(r, NAV, ['lg-nav']);
      tag(r, ART, ['lg-art']);
      setupBars(r);
      prune(r);
      fixPositions(r);
    }
  }

  function clearAll() {
    for (const r of getRoots()) {
      r.querySelectorAll('.lg-glass,.lg-host,.lg-flat,.lg-row,.lg-nav,.lg-art').forEach(el => {
        el.classList.remove('lg-glass', 'lg-bar', 'lg-side', 'lg-host', 'lg-host-clear', 'lg-flat', 'lg-row', 'lg-nav', 'lg-art');
      });
      r.querySelectorAll('.lg-shadow-style').forEach(s => s.remove());
    }
  }

  let timer = null;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(scan, 250); };

  let raf = 0;
  document.addEventListener('pointermove', e => {
    if (!settings.enabled || !settings.specular || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const el = e.composedPath().find(n => n.classList && n.classList.contains('lg-glass'));
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--lg-x', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      el.style.setProperty('--lg-y', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    });
  }, { passive: true });

  function refresh() {
    applyVars();
    if (settings.enabled) scan(); else clearAll();
  }

  async function init() {
    try {
      const res = await fetch(api.runtime.getURL('styles.css'));
      cssText = await res.text();
    } catch { cssText = ''; }

    try {
      const stored = await api.storage.local.get(DEFAULTS);
      settings = { ...DEFAULTS, ...stored };
    } catch { /* defaults */ }

    applyVars();

    const start = () => {
      refresh();
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
      setInterval(() => { if (!document.hidden) scan(); }, 2500);
    };
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });

    api.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      for (const k in changes) settings[k] = changes[k].newValue;
      if ('extra' in changes || 'enabled' in changes) clearAll();
      refresh();
    });
  }

  init();
})();
