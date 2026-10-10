import { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

let _toastId = 0;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 3500) => {
        const id = ++_toastId;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    }, []);

    const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

    return (
        <ToastContext.Provider value={addToast}>
            {children}
            <div className="toast-container">
                {toasts.map(toast => (
                    <div key={toast.id} className={`toast toast-${toast.type}`} onClick={() => removeToast(toast.id)}>
                        <span className="toast-icon">
                            {toast.type === 'success' ? <CheckCircle2 size={19} strokeWidth={2.2} />
                                : toast.type === 'error' ? <XCircle size={19} strokeWidth={2.2} />
                                    : toast.type === 'warning' ? <AlertTriangle size={19} strokeWidth={2.2} />
                                        : <Info size={19} strokeWidth={2.2} />}
                        </span>
                        <span style={{ flex: 1 }}>{toast.message}</span>
                        <button className="toast-close" aria-label="Dismiss notification"><X size={16} /></button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const addToast = useContext(ToastContext);
    if (!addToast) throw new Error('useToast must be used inside ToastProvider');
    return {
        success: (msg, dur) => addToast(msg, 'success', dur),
        error: (msg, dur) => addToast(msg, 'error', dur),
        info: (msg, dur) => addToast(msg, 'info', dur),
        warning: (msg, dur) => addToast(msg, 'warning', dur),
    };
};
