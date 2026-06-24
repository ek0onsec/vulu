// Garde DEV uniquement. React 19.2 / Next 16.2 (Turbopack) émettent en développement
// des `performance.measure(name, { start, end })` pour la piste « Server Components ».
// Quand le timing du rendu serveur est mappé avant `performance.timeOrigin` du document,
// `start` devient négatif et le navigateur lève « cannot have a negative time stamp »,
// ce qui déclenche l'overlay d'erreur de Next pendant la navigation.
//
// Ce shim borne les bornes négatives à 0 (les mesures valides passent inchangées) et,
// en dernier recours, avale l'exception : ces mesures sont purement décoratives (panneau
// Performance) et ne doivent jamais interrompre le rendu. Non chargé en production.
(function () {
  if (typeof performance === "undefined" || typeof performance.measure !== "function") return;
  var original = performance.measure.bind(performance);
  performance.measure = function (name, startOrOptions, end) {
    try {
      if (startOrOptions && typeof startOrOptions === "object") {
        var opts = startOrOptions;
        var start = typeof opts.start === "number" ? Math.max(0, opts.start) : opts.start;
        var stop = typeof opts.end === "number" ? Math.max(0, opts.end) : opts.end;
        if (typeof start === "number" && typeof stop === "number" && stop < start) stop = start;
        var patched = {};
        for (var k in opts) patched[k] = opts[k];
        patched.start = start;
        patched.end = stop;
        return original(name, patched);
      }
      return arguments.length >= 3 ? original(name, startOrOptions, end)
        : arguments.length === 2 ? original(name, startOrOptions)
        : original(name);
    } catch (e) {
      return undefined;
    }
  };
})();
