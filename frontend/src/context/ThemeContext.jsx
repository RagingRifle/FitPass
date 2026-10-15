import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        const savedTheme = localStorage.getItem('fitpass-theme');
        return savedTheme === 'dark' ? 'dark' : 'light';
    });

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('fitpass-theme', theme);
    }, [theme]);

    const value = useMemo(() => ({
        theme,
        toggleTheme: () => setTheme(current => current === 'light' ? 'dark' : 'light'),
    }), [theme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
