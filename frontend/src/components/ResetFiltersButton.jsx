import { RotateCcw } from 'lucide-react';

export default function ResetFiltersButton({ onClick, label = 'Reset filters', style = {} }) {
    return <button type="button" className="btn btn-secondary" onClick={event => { window.dispatchEvent(new Event('app:reset-filters')); onClick?.(event); }} style={{ alignSelf: 'end', whiteSpace: 'nowrap', ...style }}>
        <RotateCcw size={15} /> {label}
    </button>;
}
