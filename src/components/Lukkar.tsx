/* ══════════════════════════════════════════════════════════════════
   LUKKEREN

   Mobilappen lukker tre skrå plater når du trykker på en side. Chrome
   tar over skjermen, og da er det systemet selv som må åpne dem igjen.
   Gjør vi det begge steder, blir overgangen sammenhengende, og den hvite
   stunden mens sida laster forsvinner bak platene.

   MÅ rendres inline i HTML-en fra serveren, ikke lastes som en modul.
   Rakk nettleseren å male den hvite siden først, er hele poenget borte.
   Derfor dangerouslySetInnerHTML og ikke en <style>-import: innholdet
   skal stå i det første svaret.

   Vinkelen er −12°, den samme som bransjebåndet i logoen.

   SIKKERHETSNETT, fordi dette ligger over et system i drift:
     · pointer-events: none — platene kan aldri svelge et trykk
     · åpner på load, men SENEST etter 2,6 sekund uansett
     · fjerner seg selv etterpå
     · respekterer prefers-reduced-motion

   Kanonisk kopi: hauge-maskin-mobil/twa/lukkar.html
   ══════════════════════════════════════════════════════════════════ */

const CSS = `
#hm-lukkar { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; overflow: hidden; }
#hm-lukkar .hm-l-grunn { position: absolute; inset: 0; background: #0a0a0c; }
#hm-lukkar i {
  position: absolute; top: -14%; bottom: -14%; width: 46%;
  background: linear-gradient(100deg, #0b0b0f 0%, #16161c 72%, #1c1c24 100%);
  transform: skewX(-12deg);
}
#hm-lukkar i::after {
  content: ""; position: absolute; right: 0; top: 0; bottom: 0; width: 4px; background: #e2001a;
}
#hm-lukkar i:nth-of-type(1) { left: -8%; }
#hm-lukkar i:nth-of-type(2) { left: 28%; }
#hm-lukkar i:nth-of-type(3) { left: 64%; }
#hm-lukkar.opp .hm-l-grunn { opacity: 0; }
#hm-lukkar.opp i { animation: hmLukkOpp 520ms cubic-bezier(.62,.02,.34,1) both; }
#hm-lukkar.opp i:nth-of-type(1) { animation-delay: 0ms; }
#hm-lukkar.opp i:nth-of-type(2) { animation-delay: 60ms; }
#hm-lukkar.opp i:nth-of-type(3) { animation-delay: 120ms; }
@keyframes hmLukkOpp { to { transform: skewX(-12deg) translate3d(210%, 0, 0); } }
@media (prefers-reduced-motion: reduce) {
  #hm-lukkar i { display: none; }
  #hm-lukkar.opp { opacity: 0; transition: opacity .2s linear; }
}
`

const JS = `
(function () {
  var e = document.getElementById('hm-lukkar');
  if (!e) return;
  var start = Date.now(), gjort = false;
  function opne() {
    if (gjort) return;
    gjort = true;
    setTimeout(function () {
      e.className = 'opp';
      setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 760);
    }, Math.max(0, 260 - (Date.now() - start)));
  }
  if (document.readyState === 'complete') opne();
  else window.addEventListener('load', opne);
  setTimeout(opne, 2600);
})();
`

export function Lukkar() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div id="hm-lukkar">
        <div className="hm-l-grunn" />
        <i />
        <i />
        <i />
      </div>
      <script dangerouslySetInnerHTML={{ __html: JS }} />
    </>
  )
}
