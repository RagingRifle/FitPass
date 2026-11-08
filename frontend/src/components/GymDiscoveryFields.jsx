import { useMemo, useState } from 'react';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import API from '../services/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const timeInput = value => {
  if (!value) return '';
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return /^\d{1,2}:\d{2}$/.test(text) ? text.padStart(5, '0') : '';
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
};

export default function GymDiscoveryFields({ profile = {}, onChange, gymId, showContactFields = true }) {
  const [uploading, setUploading] = useState('');
  const workingDays = Array.isArray(profile.workingDays) ? profile.workingDays : DAYS.slice(0, 6);
  const weekly = useMemo(() => {
    const current = profile.weeklySchedule && Object.keys(profile.weeklySchedule).length ? profile.weeklySchedule : null;
    return Object.fromEntries(DAYS.map(day => {
      const value = current?.[day] || {};
      return [day, {
        closed: value.closed !== undefined ? value.closed : !workingDays.includes(day),
        open: timeInput(value.open || value.openingTime || profile.openingTime || '06:00 AM'),
        close: timeInput(value.close || value.closingTime || profile.closingTime || '10:00 PM'),
      }];
    }));
  }, [profile.weeklySchedule, profile.openingTime, profile.closingTime, profile.workingDays]);
  const exceptions = Array.isArray(profile.scheduleExceptions) ? profile.scheduleExceptions : [];

  const setField = (key, value) => onChange({ ...profile, [key]: value });
  const updateDay = (day, patch) => {
    const next = { ...weekly, [day]: { ...weekly[day], ...patch } };
    const openDays = DAYS.filter(name => !next[name].closed);
    const firstOpen = next[openDays[0]];
    onChange({
      ...profile,
      weeklySchedule: next,
      workingDays: openDays,
      openingTime: firstOpen?.open || '06:00 AM',
      closingTime: firstOpen?.close || '10:00 PM',
    });
  };
  const updateException = (index, patch) => setField('scheduleExceptions', exceptions.map((item, i) => i === index ? { ...item, ...patch } : item));
  const addException = () => {
    const date = new Date(); date.setDate(date.getDate() + 1);
    const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setField('scheduleExceptions', [...exceptions, { date: dateValue, closed: true, open: '09:00', close: '17:00', reason: '' }]);
  };
  const uploadImage = async (field, file) => {
    if (!file || !gymId) return;
    const body = new FormData(); body.append('image', file); body.append('field', field);
    setUploading(field);
    try {
      const { data } = await API.post(`/discovery/profiles/${gymId}/image`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setField(field, data.url);
    } catch (error) {
      window.alert(error.response?.data?.message || 'Could not upload gym image.');
    } finally { setUploading(''); }
  };

  const textField = (key, label, type = 'text', placeholder = '') => <label className="gym-profile-field">{label}<input type={type} value={profile[key] || ''} placeholder={placeholder} onChange={e => setField(key, e.target.value)} /></label>;

  return <div className="gym-discovery-fields">
    <div className="gym-profile-form-grid">
      {showContactFields && textField('contactNumber', 'Member call number', 'tel', 'Phone members can call')}
      {showContactFields && textField('email', 'Public email', 'email')}
      {textField('city', 'City')}
      {textField('timeZone', 'Time zone (IANA)', 'text', 'Asia/Kolkata')}
      {textField('website', 'Website', 'url', 'https://')}
      {textField('googleMapsUrl', 'Google Maps link', 'url', 'Map directions URL')}
      {textField('ownerName', 'Contact person')}
    </div>
    <label className="gym-profile-field">Short description<input value={profile.shortDescription || ''} maxLength={300} onChange={e => setField('shortDescription', e.target.value)} placeholder="A short introduction shown in gym listings" /></label>
    <label className="gym-profile-field">About the gym<textarea rows={4} value={profile.description || ''} onChange={e => setField('description', e.target.value)} placeholder="Describe the facilities, training, and services" /></label>

    <div className="gym-profile-form-grid">
      {['coverImageUrl', 'logoUrl'].map((field, index) => <label className="gym-profile-field" key={field}>{index === 0 ? 'Cover photo URL' : 'Logo URL'}<input type="url" value={profile[field] || ''} onChange={e => setField(field, e.target.value)} placeholder="Paste an image URL or upload below" />{gymId && <span className="gym-profile-upload"><ImagePlus size={15} />{uploading === field ? 'Uploading…' : `Upload ${index === 0 ? 'cover photo' : 'logo'}`}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!uploading} onChange={e => uploadImage(field, e.target.files?.[0])} /></span>}</label>)}
    </div>

    <div className="gym-profile-schedule-block">
      <div className="gym-profile-section-heading"><div><h4>Weekly opening hours</h4><p>Set regular opening times or mark a day closed.</p></div></div>
      <div className="gym-weekly-hours-table">{DAYS.map(day => <div className="gym-weekly-hours-row" key={day}>
        <strong>{day}</strong><label className="gym-closed-toggle"><input type="checkbox" checked={weekly[day].closed} onChange={e => updateDay(day, { closed: e.target.checked })} /> Closed</label>
        <label>Opens<input type="time" value={weekly[day].open} disabled={weekly[day].closed} onChange={e => updateDay(day, { open: e.target.value })} /></label>
        <label>Closes<input type="time" value={weekly[day].close} disabled={weekly[day].closed} onChange={e => updateDay(day, { close: e.target.value })} /></label>
      </div>)}</div>
    </div>

    <div className="gym-profile-schedule-block">
      <div className="gym-profile-section-heading"><div><h4>One-time schedule changes</h4><p>For a specific date, add different hours or a closure. Regular weekly hours resume afterward.</p></div><button type="button" className="btn btn-secondary" onClick={addException}><Plus size={15} /> Add date</button></div>
      {exceptions.length === 0 ? <p className="gym-profile-empty-note">No special closures or hours added.</p> : <div className="gym-exceptions-list">{exceptions.map((item, index) => <div className="gym-exception-row" key={`${item.date}-${index}`}>
        <label>Date<input type="date" value={item.date || ''} onChange={e => updateException(index, { date: e.target.value })} /></label>
        <label className="gym-closed-toggle"><input type="checkbox" checked={!!item.closed} onChange={e => updateException(index, { closed: e.target.checked })} /> Closed</label>
        <label>Opens<input type="time" value={timeInput(item.open)} disabled={item.closed} onChange={e => updateException(index, { open: e.target.value })} /></label>
        <label>Closes<input type="time" value={timeInput(item.close)} disabled={item.closed} onChange={e => updateException(index, { close: e.target.value })} /></label>
        <label className="gym-exception-reason">Reason<input value={item.reason || ''} onChange={e => updateException(index, { reason: e.target.value })} placeholder="Optional" /></label>
        <button type="button" className="gym-exception-delete" onClick={() => setField('scheduleExceptions', exceptions.filter((_, i) => i !== index))} aria-label="Remove date change"><Trash2 size={17} /></button>
      </div>)}</div>}
    </div>

    <div className="gym-profile-form-grid">
      <label className="gym-profile-field">Amenities <small>Separate items with commas</small><textarea rows={2} value={(profile.amenities || []).join(', ')} onChange={e => setField('amenities', e.target.value.split(',').map(v => v.trim()).filter(Boolean))} placeholder="Free WiFi, Locker Room, Showers" /></label>
      <label className="gym-profile-field">Equipment <small>Separate items with commas</small><textarea rows={2} value={(profile.equipments || []).join(', ')} onChange={e => setField('equipments', e.target.value.split(',').map(v => v.trim()).filter(Boolean))} placeholder="Treadmills, Dumbbells, Power Racks" /></label>
    </div>
  </div>;
}
