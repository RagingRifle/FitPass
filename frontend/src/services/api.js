import axios from 'axios';

const getLoginRoute = () => {
    try {
        const user = JSON.parse(sessionStorage.getItem('user') || 'null');
        if (user?.role === 'member') {
            const gymName = (user.gymName || user.gymId?.name || '').toUpperCase();
            const gymId = user.gymId?._id || user.gymId || '';
            return gymName === 'H4' || gymId === '05a08fdf-7427-48a5-8b25-e18d5a5668cd'
                ? '/h4/login'
                : '/member-login';
        }
        if (['trainer', 'receptionist'].includes(user?.role)) return '/staff-login';
    } catch {
        // Corrupt cached user data should still take administrative users to the admin entry.
    }
    return '/control-room';
};

const API = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
});

// Add a request interceptor to include the JWT token
API.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    const selectedGymId = sessionStorage.getItem('selectedGymId');
    if (selectedGymId) {
        config.headers['x-gym-id'] = selectedGymId;
    }
    const selectedBranchId = sessionStorage.getItem('selectedBranchId');
    if (selectedBranchId) {
        config.headers['x-branch-id'] = selectedBranchId;
    }
    return config;
});

// Add a response interceptor to handle 401 Unauthorized errors globally
API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // A rejected credential attempt is a form error, not an expired session.
            if (error.config?.url?.includes('/auth/login')) return Promise.reject(error);
            const loginRoute = getLoginRoute();
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('token');
            const publicAuthPaths = ['/login', '/member-login', '/h4/login', '/staff-login', '/control-room', '/register'];
            if (!publicAuthPaths.includes(window.location.pathname)) {
                window.location.replace(loginRoute);
            }
        }
        return Promise.reject(error);
    }
);

export default API;
