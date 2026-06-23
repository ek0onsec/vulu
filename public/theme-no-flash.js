(function () {
  try {
    var t = localStorage.getItem('vulu-theme');
    if (!t) { t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
    document.documentElement.classList.toggle('dark', t === 'dark');
    var p = localStorage.getItem('vulu-palette');
    if (p && p !== 'vulu') { document.documentElement.setAttribute('data-palette', p); }
  } catch (e) {}
})();
