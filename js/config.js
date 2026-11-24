// એપનું નામ અને મૂળ સેટિંગ્સ — નામ બદલાય તો અહીં, manifest.json, index.html અને store/listing.md માં બદલવું.
export const APP = {
  name: 'જાણકાર',
  // દરેક નવા પ્રકાશન વખતે વધારવું (ફક્ત નોંધ માટે, એપમાં દેખાતું નથી).
  version: '0.12.0',
  // એપ શું છે તેની એક સાદી લીટી (સ્વાગત પેજ અને વોટ્સએપથી એપ મોકલો ત્યારે).
  about: 'યોજના, સહાય અને દાખલાની માહિતી, ગુજરાતીમાં.',
  // KruPa ની બીજી બે એપ (હોમ પર "અમારી બીજી એપ", ફૂટર, મેનુમાં "ઓપરેટર માટે")
  krupa: {
    digitalHub: 'https://www.krupadigitalhub.in',
    docHub: 'https://dochub.krupadigitalhub.in',
  },
  // KruPa Digital Hub ની ચેનલ (હોમ પર "અમને ફોલો કરો" અને ફૂટર). Digital Hub અને Doc Hub માં પણ આ જ.
  social: [
    { id: 'whatsapp', label: 'વોટ્સએપ ચેનલ', action: 'વોટ્સએપ ચેનલ ફોલો કરો', href: 'https://whatsapp.com/channel/0029Vb9GJgjGJP8JOjAFHr3M', color: '#1f9d55' },
    { id: 'youtube', label: 'YouTube', action: 'YouTube પર સબ્સ્ક્રાઇબ કરો', href: 'https://www.youtube.com/@krupadigitalhub', color: '#c4302b' },
    { id: 'facebook', label: 'Facebook', action: 'Facebook પર ફોલો કરો', href: 'https://www.facebook.com/krupadigitalhub', color: '#1877f2' },
    { id: 'instagram', label: 'Instagram', action: 'Instagram પર ફોલો કરો', href: 'https://www.instagram.com/krupadigitalhub', color: '#c13584' },
  ],
  // છેલ્લી તારીખ કેટલા દિવસ પહેલાં યાદ કરાવવી
  reminderDays: 7,
  // સંપર્ક: ભરશો એટલે એપમાં "ભૂલ જણાવો" અને "સંપર્ક" બટન દેખાશે.
  // email: 'name@example.com'   whatsapp: દેશના કોડ સાથે, જગ્યા વગર, જેમ કે '919876543210'
  contact: { email: 'krupadigitalhub@gmail.com', whatsapp: '917777919128' },
};
