# Play Store પર એપ મૂકવાની રીત (ક્લિક-બાય-ક્લિક)

એપ વેબસાઇટ છે, અને Play Store ની એપ એ વેબસાઇટને જ ખોલે છે (TWA).
એટલે **નવી યોજના કે સુધારો વેબસાઇટ પર જાય એટલે Play Store વાળી એપમાં પણ આપોઆપ આવે**.
Play Store પર ફરી અપલોડ ફક્ત નામ કે આઇકન બદલાય ત્યારે જ કરવું પડે.

## પગલું 0: પહેલાં આટલું નક્કી કરો

1. Play Store માં "જાણકાર" શોધીને જુઓ કે એ નામની બીજી એપ નથી.
2. સંપર્ક: krupadigitalhub@gmail.com અને વોટ્સએપ 7777919128. આ `js/config.js` માં મૂક્યા છે, એટલે "ભૂલ જણાવો" બટન અને "સંપર્ક" પેજ ચાલુ છે.
3. નીચેનું "પગલું 1" પૂરું કરો, પછી ફોનમાં `https://jankar.krupadigitalhub.in` ખોલીને જુઓ કે એપ ખૂલે છે.

## પગલું 1: પોતાનું સરનામું `jankar.krupadigitalhub.in` (10 મિનિટ, મફત)

`krupadigitalhub.in` નું DNS Vercel માં છે, એટલે ત્યાં એક લીટી ઉમેરવાની છે.

**ભાગ A: Vercel માં**

1. `https://vercel.com` ખોલીને લોગિન કરો.
2. ઉપર "Domains" દબાવો (ન દેખાય તો ટીમના નામ પર ક્લિક કરો, પછી "Domains").
3. `krupadigitalhub.in` પર ક્લિક કરો.
4. "DNS Records" વિભાગમાં "Add Record" દબાવો.
5. Name માં લખો: `jankar`
6. Type માં પસંદ કરો: `CNAME`
7. Value માં લખો: `rajenczinzuvadiya-web.github.io`
8. "Add" દબાવો.

**ભાગ B: GitHub માં**

1. `https://github.com/rajenczinzuvadiya-web/govdocs-pro/settings/pages` ખોલો.
2. "Custom domain" ના ખાનામાં લખો: `jankar.krupadigitalhub.in`
3. "Save" દબાવો.
4. 5 થી 30 મિનિટ રાહ જુઓ. "DNS check successful" લખાઈ આવશે.
5. "Enforce HTTPS" પર ✓ કરો (તરત ન થાય તો 1 કલાક પછી ફરી પ્રયત્ન કરો).
6. ફોનમાં `https://jankar.krupadigitalhub.in` ખોલીને જુઓ.

જૂની github.io વાળી લિંક પણ આપોઆપ નવા સરનામા પર જશે.

## પગલું 2: Play Console એકાઉન્ટ (એક જ વાર, $25)

1. કમ્પ્યુટરમાં `https://play.google.com/console` ખોલો.
2. તમારા Gmail થી લોગિન કરો.
3. "Yourself" (વ્યક્તિગત એકાઉન્ટ) પસંદ કરો.
4. નામ, સરનામું અને ફોન નંબર ભરો.
5. Developer name માં લખો: `KruPa Digital Hub`
6. $25 ની ફી કાર્ડથી ભરો.
7. ઓળખ માટે આધાર કે PAN નો ફોટો અપલોડ કરો. ચકાસણીમાં 1 થી 3 દિવસ લાગે.

## પગલું 3: Android ફાઇલ બનાવો (PWABuilder, મફત)

1. `https://www.pwabuilder.com` ખોલો.
2. ખાનામાં `https://jankar.krupadigitalhub.in` પેસ્ટ કરો, પછી "Start" દબાવો.
3. "Package For Stores" દબાવો.
4. "Android" માં "Generate Package" દબાવો.
5. Package ID માં લખો: `in.krupadigitalhub.jankar` (પછી ક્યારેય બદલાશે નહીં).
6. "Download" દબાવો. એક zip ફાઇલ આવશે.
7. **zip માંની `signing.keystore` અને `signing-key-info.txt` Google Drive માં સાચવી રાખો.** આ ખોવાય તો એપ ક્યારેય અપડેટ નહીં થાય.
8. zip માંની `assetlinks.json` Claude ને આપો. Claude તેને વેબસાઇટ પર મૂકશે, એટલે એપ ઉપર બ્રાઉઝરની પટ્ટી વગર ખૂલશે.

## પગલું 4: Play Console માં એપ બનાવો

1. Play Console માં "Create app" દબાવો.
2. App name: `store/listing.md` માંથી કોપી કરો.
3. Default language: "Gujarati – gu" પસંદ કરો.
4. "App" અને "Free" પસંદ કરો.
5. નીચેનાં બધાં ✓ કરીને "Create app" દબાવો.

## પગલું 5: "Set up your app" નાં ખાનાં

Dashboard માં દરેક કામ પર ક્લિક કરો. જવાબ `store/listing.md` માં લખેલા છે.

1. Privacy policy: privacy.html ની લિંક.
2. App access: "All functionality is available without special access".
3. Ads: "No".
4. Content rating: ઈમેલ લખો, Category "Reference, News, or Educational", બધા પ્રશ્નમાં "No".
5. Target audience: "18 and over".
6. News app: "No".
7. Data safety: `listing.md` ના જવાબ.
8. Government apps: "No".
9. Store listing: ટૂંકું અને પૂરું વર્ણન, આઇકન, feature graphic અને screenshot અપલોડ કરો.

## પગલું 6: 12 લોકો સાથે 14 દિવસનો ટેસ્ટ (ફરજિયાત)

નવા વ્યક્તિગત એકાઉન્ટ માટે Google નો નિયમ છે.

1. ડાબી બાજુ "Testing" → "Closed testing" → "Create track" દબાવો.
2. "Create new release" દબાવો અને zip માંની `.aab` ફાઇલ અપલોડ કરો.
3. "Testers" માં ઓછામાં ઓછા 12 લોકોના Gmail ઉમેરો (VCE, વિદ્યાર્થી, ઓળખીતા).
4. "Copy link" થી ટેસ્ટની લિંક એ લોકોને વોટ્સએપ પર મોકલો.
5. દરેક જણ લિંક ખોલીને એપ ઇન્સ્ટોલ કરે, અને 14 દિવસ સુધી ફોનમાં રાખે.

## પગલું 7: બધા લોકો માટે ચાલુ કરો

1. 14 દિવસ પછી Dashboard માં "Apply for production" દબાવો.
2. ટેસ્ટ વિશેના પ્રશ્નોના જવાબ ગુજરાતી કે અંગ્રેજીમાં લખો.
3. મંજૂરી આવે એટલે "Production" → "Create new release" → એ જ `.aab` અપલોડ કરો.
4. Google ની ચકાસણીમાં 2 થી 7 દિવસ લાગે.

## એપનાં કાર્ડના ફોટા (થંબનેલ) — Play Store ના નિયમ
Digital Hub → ગાઇડ મેનેજમાં યોજના / દસ્તાવેજનો "ફોટો" મૂકો ત્યારે:
- માપ 1280 × 720 (આડો, YouTube થંબનેલ જેવો). ન હોય તો એપ જાતે રંગીન થંબનેલ બનાવે છે.
- સરકારી લોગો, અશોક સ્તંભ, સરકારી મહોર કે નેતાના ફોટા **નહીં**: Google એને "સરકારની નકલ" ગણી એપ રોકી શકે.
- બીજી એપ, વેબસાઇટ કે YouTube ના ફોટા **નહીં** (કોપીરાઇટ). ફક્ત તમે બનાવેલા કે મફત વાપરવાની છૂટવાળા ફોટા.
- ફોટામાં "₹ મળશે જ", "100% મંજૂર" જેવું ખોટું વચન નહીં.
