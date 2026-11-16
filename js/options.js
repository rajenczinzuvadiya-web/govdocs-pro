// યુઝર વર્ગ અને પ્રોફાઇલના વિકલ્પો

export const CATEGORIES = [
  { id: 'khedut', label: 'ખેડૂત', icon: 'wheat', tone: 'green', hint: 'ખેતી સહાય, પાક નુકસાન, મંડી ભાવ' },
  { id: 'vidyarthi', label: 'વિદ્યાર્થી', icon: 'graduation', tone: 'sky', hint: 'શિષ્યવૃત્તિ, પરીક્ષા, પ્રવેશ' },
  { id: 'yuvan', label: 'બેરોજગાર / યુવાન', icon: 'briefcase', tone: 'indigo', hint: 'ભરતી, તાલીમ, સ્વરોજગાર લોન' },
  { id: 'mata', label: 'માતા / સગર્ભા', icon: 'pregnant', tone: 'pink', hint: 'પોષણ, બાળકની રસી, દીકરી યોજના' },
  { id: 'vali', label: 'માતા-પિતા', icon: 'child', tone: 'cyan', hint: 'બાળકોનું શિક્ષણ, આરોગ્ય, જન્મ દાખલો' },
  { id: 'vrudh', label: 'વૃદ્ધ', icon: 'elder', tone: 'amber', hint: 'પેન્શન, આરોગ્ય, ફ્રોડ ચેતવણી' },
  { id: 'vidhva', label: 'વિધવા', icon: 'woman', tone: 'violet', hint: 'ગંગા સ્વરૂપા સહાય, તાલીમ' },
  { id: 'divyang', label: 'દિવ્યાંગ', icon: 'wheelchair', tone: 'teal', hint: 'સહાય, સાધનો, પ્રમાણપત્ર' },
  { id: 'shikshak', label: 'શિક્ષક', icon: 'school', tone: 'purple', hint: 'પરિપત્રો, ભરતી, તાલીમ' },
  { id: 'vepari', label: 'નાના વેપારી / દુકાનદાર', icon: 'store', tone: 'orange', hint: 'વ્યવસાય લોન, Udyam' },
  { id: 'samanya', label: 'સામાન્ય માણસ', icon: 'people', tone: 'slate', hint: 'રેશનકાર્ડ, આયુષ્માન, આવાસ' },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export const JATI = [
  { id: 'general', label: 'સામાન્ય (General)' },
  { id: 'ews', label: 'આર્થિક નબળા (EWS)' },
  { id: 'obc', label: 'બક્ષીપંચ (OBC / SEBC)' },
  { id: 'sc', label: 'અનુસૂચિત જાતિ (SC)' },
  { id: 'st', label: 'અનુસૂચિત જનજાતિ (ST)' },
];

export const OCCUPATIONS = [
  'ખેતી', 'ખેત મજૂરી', 'પશુપાલન', 'છૂટક મજૂરી', 'નોકરી (ખાનગી)', 'નોકરી (સરકારી)',
  'નાનો વેપાર / દુકાન', 'અભ્યાસ', 'ગૃહિણી', 'નોકરી શોધું છું', 'નિવૃત્ત', 'બીજું',
];

// આવક શ્રેણી: min/max વાર્ષિક રૂપિયામાં
export const INCOME = [
  { id: 'i1', label: 'વર્ષે ₹1.2 લાખ સુધી', min: 0, max: 120000 },
  { id: 'i2', label: '₹1.2 થી ₹2.5 લાખ', min: 120000, max: 250000 },
  { id: 'i3', label: '₹2.5 થી ₹5 લાખ', min: 250000, max: 500000 },
  { id: 'i4', label: '₹5 લાખથી વધુ', min: 500000, max: Infinity },
];

export const DISTRICTS = [
  'અમદાવાદ', 'અમરેલી', 'આણંદ', 'અરવલ્લી', 'બનાસકાંઠા', 'ભરૂચ', 'ભાવનગર', 'બોટાદ',
  'છોટા ઉદેપુર', 'દાહોદ', 'ડાંગ', 'દેવભૂમિ દ્વારકા', 'ગાંધીનગર', 'ગીર સોમનાથ', 'જામનગર',
  'જૂનાગઢ', 'ખેડા', 'કચ્છ', 'મહીસાગર', 'મહેસાણા', 'મોરબી', 'નર્મદા', 'નવસારી', 'પંચમહાલ',
  'પાટણ', 'પોરબંદર', 'રાજકોટ', 'સાબરકાંઠા', 'સુરત', 'સુરેન્દ્રનગર', 'તાપી', 'વડોદરા',
  'વલસાડ', 'વાવ-થરાદ',
];
