# જાણકાર — કામ ક્યાં પહોંચ્યું (નવું ઉપર)

## 16/11/26 — v0.5.1 (main માં merge)
- નામ "ગામની જાણકારી" → **જાણકાર** (ટેગલાઇન નહીં). Play Store: "જાણકાર: યોજના, સહાય, દાખલા", Developer name "KruPa Digital Hub".
- આઇકન અને Play Store નો મોટો ફોટો: યુઝરે Gemini થી બનાવેલું ચોપડી + માણસ (`icons/icon-source.png`, `store/feature-bg.png`). "હાલ પૂરતું, પછી બદલીશું."
- સ્વાગત (3 પગલાં), હોમ પર 6 મોટાં બટન, "કેવી રીતે વાપરવી", "સંપર્ક અને સૂચન", નિયમો, "ભૂલ જણાવો".
- મેનુમાં "ઓપરેટર માટે": KruPa Digital Hub અને Doc Hub ની લિંક. Digital Hub અને Doc Hub Play Store પર નહીં (કમ્પ્યુટરનું કામ, લોગિન).
- સંપર્ક: krupadigitalhub@gmail.com, વોટ્સએપ 7777919128.
- `store/`: Play Store નું લખાણ, Data safety, 6 screenshot, આઇકન, મોટો ફોટો, અપલોડની ક્લિક-બાય-ક્લિક રીત.

## યુઝરે કરવાનું (નવી ચેટમાં પહેલાં આ યાદ કરાવવું)
1. ડોમેન `jankar.krupadigitalhub.in`: Vercel DNS માં CNAME + GitHub Pages માં Custom domain (`store/README.md` પગલું 1).
2. Play Console એકાઉન્ટ ($25) અને PWABuilder થી Android ફાઇલ (`store/README.md` પગલાં 2–7). zip માંની `assetlinks.json` Claude ને આપવી.
3. 12 ટેસ્ટર (Gmail) ભેગા કરવા: 14 દિવસનો ટેસ્ટ.

## આગળનું કામ (Claude, ક્રમ પ્રમાણે)
1. **ભરતી વિભાગ** (નવું ટેબ/પેજ, `data/bharti.json`), પછી નામ અને મોટા ફોટામાં "ભરતી" ઉમેરવું.
2. **રોજ સવારનો ડ્રાફ્ટ:** GitHub Actions — OJAS, GPSC, GSSSB, iKhedut, Digital Gujarat જોઈ નવી ભરતી/યોજનાનો PR; યુઝર જોઈને merge કરે.
3. **92 કાર્ડની ચકાસણી** સત્તાવાર સાઇટ પરથી, 5-5 ના ભાગમાં (`verified: true`).
4. યોજનામાં છેલ્લી તારીખ (`lastDate`) ભરવી, જેથી "સેવ" ની યાદ કામ કરે.
5. પછી: KruPa Digital Hub / Doc Hub માં "ગ્રાહકને જાણકાર મોકલો" (વોટ્સએપ + QR પોસ્ટર); KruPa admin (Supabase) માંથી ડેટા.
