/** Business-scoped booking field definitions and notification selection. */
export const STANDARD_NOTIFICATION_FIELDS = Object.freeze([
 'customerName','customerEmail','customerPhone','services','date','time','duration','quotedPrice'
]);
const TYPES = new Set(['text','number','date','select','checkbox']);
const ID = /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/;
export function validateBookingFields(fields, selected) {
 if (!Array.isArray(fields) || fields.length > 25) throw Error('Use no more than 25 custom booking fields.');
 if (!Array.isArray(selected) || selected.length > 40) throw Error('Invalid notification field selection.');
 const ids = new Set();
 for (const f of fields) {
  if (!f || !ID.test(f.id) || ids.has(f.id) || !TYPES.has(f.type) ||
      typeof f.label !== 'string' || !f.label.trim() || f.label.length > 80 ||
      typeof f.required !== 'boolean' || typeof f.showInNotification !== 'boolean')
   throw Error('Check custom booking field definitions.');
  ids.add(f.id);
  if (f.type === 'select' && (!Array.isArray(f.options) || f.options.length < 1 ||
      f.options.length > 30 || !f.options.every(o => typeof o === 'string' && o.trim() && o.length <= 80)))
   throw Error('Dropdown fields require 1–30 valid options.');
 }
 const allowed = new Set([...STANDARD_NOTIFICATION_FIELDS,...ids]);
 if (new Set(selected).size !== selected.length || !selected.every(x => typeof x === 'string' && allowed.has(x)))
  throw Error('Select valid notification fields.');
 return true;
}
export function sanitizeBookingAnswers(fields, answers) {
 const input = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
 const result = {};
 for (const f of fields) {
  const raw = input[f.id];
  if (f.type === 'checkbox') {
   if (raw !== undefined && typeof raw !== 'boolean') throw Error('Invalid checkbox value.');
   result[f.id] = raw === true;
  } else {
   if (raw !== undefined && typeof raw !== 'string') throw Error('Invalid booking field value.');
   const value = (raw || '').trim();
   if (value.length > 500) throw Error('Booking field answer is too long.');
   if (f.type === 'number' && value && !Number.isFinite(Number(value))) throw Error('Enter a valid number.');
   if (f.type === 'date' && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Enter a valid date.');
   if (f.type === 'select' && value && !f.options.includes(value)) throw Error('Choose a valid dropdown option.');
   result[f.id] = value;
  }
  if (f.required && (result[f.id] === '' || result[f.id] === false)) throw Error(f.label + ' is required.');
 }
 return result;
}
export function bookingNotificationLines(fields, selected, answers, standard) {
 const selectedSet = new Set(selected);
 const lines = [];
 for (const key of STANDARD_NOTIFICATION_FIELDS) if (selectedSet.has(key) && standard[key] != null)
  lines.push(key.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())+': '+String(standard[key]).slice(0,500));
 for (const f of fields) if (selectedSet.has(f.id) && answers[f.id] !== undefined)
  lines.push(f.label+': '+String(answers[f.id]).slice(0,500));
 return lines;
}
