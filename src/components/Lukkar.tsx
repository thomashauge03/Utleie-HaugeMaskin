/* ══════════════════════════════════════════════════════════════════
   LUKKEREN

   Mobilappen lukker tre skrå plater når du trykker på en side. Chrome
   tar over skjermen, og da er det systemet selv som må åpne dem igjen.
   Gjør vi det begge steder, blir overgangen sammenhengende, og den hvite
   stunden mens sida laster forsvinner bak platene.

   ── SPILLER BARE NÅR APPEN ÅPNET SIDA ──────────────────────────
   Åpner du systemet i en vanlig nettleser – på PC, som er
   primærplattformen – skal det ikke skje noen ting.

   Signalet er document.referrer. Når appen åpner en side, setter Chrome
   referreren til «android-app://no.haugemaskin.mobil/», og en nettleser
   kan ALDRI produsere det skjemaet: referreren er adressen til
   dokumentet som startet navigasjonen, og et nettdokument kan ikke ha
   en android-app-adresse.

   Prefiks-sammenlikning, ikke ===, fordi adressen kanoniseres med
   skråstrek til slutt.

   Tre andre signaler ble vurdert og forkastet:
     · display-mode: standalone — fem av systemene våre er installerbare
       som PWA med display:standalone, og melder da standalone uten at
       appen er involvert.
     · en parameter i adressa — window.open-utgangen i appen ligger
       utenfor den native sjekken, så parameteren ville havnet på
       PC-adresser. Feil vei å feile.
     · sessionStorage alene — Chrome på Android tømmer det ved oppstart.

   Feilmodusen går bare én vei: sida kan gå glipp av animasjonen (for
   eksempel etter en innloggingsrunde, som bytter referreren), men den
   kan aldri spille i en vanlig nettleser.

   ── MÅ RENDRES INLINE FRA SERVEREN ─────────────────────────────
   Ikke lastes som en modul. Rakk nettleseren å male den hvite siden
   først, er hele poenget borte. Derfor dangerouslySetInnerHTML og ikke
   en <style>-import: innholdet skal stå i det første svaret.

   SIKKERHETSNETT, fordi dette ligger over et system i drift: platene er
   display:none som utgangspunkt, så svikter skriptet ser ingen noe;
   pointer-events none; åpner senest etter 2,6 sekund uansett; fjerner
   seg selv; respekterer prefers-reduced-motion.

   Kanonisk kopi: hauge-maskin-mobil/twa/lukkar.html
   ══════════════════════════════════════════════════════════════════ */

const CSS = `
#hm-lukkar { display: none; }
html[data-hm-app] #hm-lukkar {
  display: block;
  position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; overflow: hidden;
}
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
  function vekk() { if (e.parentNode) e.parentNode.removeChild(e); }
  var r = document.referrer || '';
  if (r.lastIndexOf('android-app://no.haugemaskin.mobil', 0) !== 0) { vekk(); return; }
  try {
    if (sessionStorage.getItem('hm-lukkar')) { vekk(); return; }
    sessionStorage.setItem('hm-lukkar', '1');
  } catch (x) {}
  document.documentElement.setAttribute('data-hm-app', '');
  var start = Date.now(), gjort = false;
  function opne() {
    if (gjort) return;
    gjort = true;
    setTimeout(function () {
      e.className = 'opp';
      setTimeout(vekk, 760);
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
