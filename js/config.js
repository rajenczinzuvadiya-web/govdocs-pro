// એપનું નામ અને મૂળ સેટિંગ્સ — નામ બદલાય તો અહીં, manifest.json, index.html અને store/listing.md માં બદલવું.
export const APP = {
  name: 'જાણકાર',
  // દરેક નવા પ્રકાશન વખતે વધારવું; એપમાં નીચે દેખાય છે, એટલે ફોનમાં નવું વર્ઝન આવ્યું કે નહીં તે ખબર પડે.
  version: '0.5.0',
  // એપ શું છે તેની એક સાદી લીટી (સ્વાગત પેજ અને વોટ્સએપથી એપ મોકલો ત્યારે). ભરતી વિભાગ બને ત્યારે "ભરતી" ઉમેરવું.
  about: 'યોજના, સહાય અને દાખલાની માહિતી, ગુજરાતીમાં.',
  // ઓપરેટર માટેની KruPa એપ (મેનુમાં "ઓપરેટર માટે")
  krupa: {
    digitalHub: 'https://www.krupadigitalhub.in',
    docHub: 'https://dochub.krupadigitalhub.in',
  },
  // છેલ્લી તારીખ કેટલા દિવસ પહેલાં યાદ કરાવવી
  reminderDays: 7,
  // સંપર્ક: ભરશો એટલે એપમાં "ભૂલ જણાવો" અને "સંપર્ક" બટન દેખાશે.
  // email: 'name@example.com'   whatsapp: દેશના કોડ સાથે, જગ્યા વગર, જેમ કે '919876543210'
  contact: { email: 'krupadigitalhub@gmail.com', whatsapp: '917777919128' },
};
