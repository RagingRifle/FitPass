import { useEffect, useState } from 'react';
import API from '../services/api';

/** Searchable member dropdown for report and assignment filters. */
export default function MemberFilterSelect({ value = '', onChange, onSelectMember, label = 'Member', includeAll = true, required = false, status = '', excludeIds = [], className = 'input', style = {} }) {
    const [members, setMembers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);
    const excluded = new Set(excludeIds.map(String));
    const selectableMembers = members.filter(member => !excluded.has(String(member.id || member._id)));

    useEffect(() => {
        const resetSearch = () => setSearch('');
        window.addEventListener('app:reset-filters', resetSearch);
        return () => window.removeEventListener('app:reset-filters', resetSearch);
    }, []);

    useEffect(() => {
        let active = true;
        const timer = window.setTimeout(async () => {
            setLoading(true);
            setError('');
            try {
                const limit = 100;
                const first = await API.get('/members', { params: { page: 1, limit, ...(status ? { status } : {}), ...(search.trim() ? { search: search.trim() } : {}) } });
                const firstData = first.data;
                const firstPage = Array.isArray(firstData) ? firstData : (firstData?.members || firstData?.data || []);
                const totalPages = Math.min(Math.max(Number(firstData?.pages) || 1, 1), 10);
                const rest = totalPages > 1 ? await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) =>
                    API.get('/members', { params: { page: index + 2, limit, ...(status ? { status } : {}), ...(search.trim() ? { search: search.trim() } : {}) } })
                )) : [];
                const all = [...firstPage, ...rest.flatMap(({ data }) => Array.isArray(data) ? data : (data?.members || data?.data || []))];
                const unique = [...new Map(all.filter(member => member?.id || member?._id).map(member => [String(member.id || member._id), member])).values()];
                unique.sort((a, b) => String(a.registrationNumber || a.displayId || '').localeCompare(String(b.registrationNumber || b.displayId || ''), undefined, { numeric: true }));
                if (active) setMembers(unique);
            } catch (requestError) {
                if (active) {
                    setMembers([]);
                    setError(requestError.response?.data?.message || 'Could not load members for this filter.');
                }
            } finally {
                if (active) setLoading(false);
            }
        }, search ? 250 : 0);
        return () => { active = false; window.clearTimeout(timer); };
    }, [search, status]);

    useEffect(() => {
        const match = members.find(member => String(member.id || member._id) === String(value));
        if (match) setSelectedMember(match);
    }, [members, value]);

    return <div style={{ display: 'grid', gap: 6, ...style }}>
        {label && <span style={{ fontSize: '.8rem', fontWeight: 600 }}>{label}</span>}
        <input className={className} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search member ID, name, or phone" aria-label={`Search ${label || 'members'} by ID, name, or phone`} />
        <select className={className} value={value} required={required} onChange={event => {
            const nextValue = event.target.value;
            const selected = members.find(member => String(member.id || member._id) === nextValue) || null;
            setSelectedMember(selected);
            onSelectMember?.(selected);
            onChange(nextValue);
        }} aria-label={label || 'Select member'}>
            <option value="">{includeAll ? 'All members' : 'Choose a member'}</option>
            {value && selectedMember && !selectableMembers.some(member => String(member.id || member._id) === String(value)) && <option value={value}>{selectedMember.registrationNumber || selectedMember.displayId || 'Member'} · {selectedMember.name}</option>}
            {selectableMembers.map(member => {
                const id = String(member.id || member._id);
                return <option key={id} value={id}>{member.registrationNumber || member.displayId || 'Member'} | {member.name}{member.phone ? ` | ${member.phone}` : ''}</option>;
            })}
            {!selectableMembers.length && !loading && <option value="" disabled>{error ? 'Members unavailable' : 'No members match your search'}</option>}
        </select>
        {loading && <small style={{ color: 'var(--text-secondary)' }}>Loading members...</small>}
        {error && <small role="status" style={{ color: 'var(--text-secondary)' }}>{error}</small>}
    </div>;
}
