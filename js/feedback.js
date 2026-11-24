// ભૂલ / સૂચન (યુઝર 19/11/26): જાણકારમાંથી સીધું KruPa Digital Hub એડમિન → "સૂચન / તકલીફ" માં.
// લખાણ, પેજનું નામ, પેજ (#/...), ફોને પોતે બનાવેલો 8 અક્ષરનો નંબર, અને વ્યક્તિ પોતે લખે તો નામ અને મોબાઇલ નંબર
// (યુઝર 24/11/26: જવાબ આપવા). પ્રોફાઇલ ક્યારેય નહીં.
// સર્વર પણ મર્યાદા રાખે છે: એક ફોનમાંથી દિવસના 3, બધા મળીને 30 (Digital Hub src/lib/jankarFeedback.ts).
import { APP } from './config.js';
import { phoneId } from './report.js';

const URL_ = APP.krupa.digitalHub + '/api/jankar/feedback';

/** 'ok' = મોકલ્યું, 'limit' = આજની મર્યાદા પૂરી, 'fail' = ન ગયું (નેટ નથી કે બીજી ભૂલ). */
export async function sendFeedback({ kind, message, title, page, name = '', phone = '' }) {
  if (!navigator.onLine) return 'fail';
  try {
    const res = await fetch(URL_, {
      method: 'POST',
      // text/plain: બ્રાઉઝરને પહેલાં પરવાનગી પૂછવી ન પડે
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ kind, message: String(message).slice(0, 1000), title: String(title || '').slice(0, 80), page: String(page || '').split('?')[0].slice(0, 100), id: phoneId(), name: String(name).slice(0, 60), phone: String(phone).slice(0, 10) }),
      mode: 'cors',
      credentials: 'omit',
    });
    if (res.status === 204 || res.ok) return 'ok';
    if (res.status === 429) return 'limit';
    return 'fail';
  } catch {
    return 'fail';
  }
}
