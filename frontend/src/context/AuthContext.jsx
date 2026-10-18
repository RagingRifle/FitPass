import { createContext, useState, useEffect } from 'react';
import API from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedGymId, setSelectedGymId] = useState(() => {
        return sessionStorage.getItem('selectedGymId') || '';
    });
    const [selectedBranchId, setSelectedBranchId] = useState(() => {
        return sessionStorage.getItem('selectedBranchId') || '';
    });
    const [activeDivision, setActiveDivision] = useState(() => {
        return sessionStorage.getItem('activeDivision') || 'fitpass';
    });

    useEffect(() => {
        // Migrate the previous shared browser-wide auth state into this tab once.
        // Removing the legacy keys prevents other tabs from reusing this session.
        ['user', 'token', 'selectedGymId', 'selectedBranchId', 'activeDivision'].forEach((key) => {
            const legacyValue = localStorage.getItem(key);
            if (!sessionStorage.getItem(key) && legacyValue !== null) sessionStorage.setItem(key, legacyValue);
            localStorage.removeItem(key);
        });
        setSelectedGymId(sessionStorage.getItem('selectedGymId') || '');
        setSelectedBranchId(sessionStorage.getItem('selectedBranchId') || '');
        setActiveDivision(sessionStorage.getItem('activeDivision') || 'fitpass');

        const storedUser = sessionStorage.getItem('user');
        const token = sessionStorage.getItem('token');
        if (storedUser && token) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            
            let division = sessionStorage.getItem('activeDivision') || 'fitpass';
            if (parsedUser.role === 'superadmin') {
                if (window.location.pathname === '/dashboard') {
                    division = 'h4';
                    if (!sessionStorage.getItem('selectedGymId')) {
                        API.get('/superadmin/h4-gym').then(({ data: h4Gym }) => {
                            const h4Id = h4Gym?._id || h4Gym?.id;
                            if (h4Id) {
                                sessionStorage.setItem('selectedGymId', h4Id);
                                setSelectedGymId(h4Id);
                            }
                        }).catch(() => {});
                    }
                }
                else if (window.location.pathname.startsWith('/superadmin/')) {
                    division = 'fitpass';
                    sessionStorage.removeItem('selectedGymId');
                    sessionStorage.removeItem('selectedBranchId');
                    setSelectedGymId('');
                    setSelectedBranchId('');
                }
            } else if (parsedUser.role === 'h4_admin' || (parsedUser.gymName && parsedUser.gymName.toUpperCase() === 'H4') || parsedUser.gymId === '05a08fdf-7427-48a5-8b25-e18d5a5668cd') {
                division = 'h4';
            } else if (parsedUser.role === 'fitpass_admin') {
                division = 'fitpass';
            }
            if (division) {
                sessionStorage.setItem('activeDivision', division);
                setActiveDivision(division);
            }
        }
        setLoading(false);
    }, []);

    const login = async (email, password, selectedRole) => {
        try {
            const portalType = selectedRole;
            const { data } = await API.post('/auth/login', { email, password, portalType });

            const roleMatches = (selRole, userRole, gymName, gymId) => {
                if (!selRole) return true;
                const normalizedGym = (gymName || '').toUpperCase();
                const isH4Gym = normalizedGym === 'H4' || gymId === '05a08fdf-7427-48a5-8b25-e18d5a5668cd';

                if (selRole === 'superadmin') return userRole === 'superadmin';
                if (selRole === 'fitpass_admin') return userRole === 'fitpass_admin';
                if (selRole === 'h4_admin') return userRole === 'h4_admin';
                if (selRole === 'h4_gym_admin') {
                    return userRole === 'h4_admin' || (['admin', 'partner'].includes(userRole) && isH4Gym);
                }
                if (selRole === 'fitpass_partner_admin') {
                    return ['admin', 'partner'].includes(userRole) && !isH4Gym;
                }
                if (selRole === 'staff') return ['receptionist', 'trainer'].includes(userRole);
                if (selRole === 'h4_member') {
                    return userRole === 'member' && isH4Gym;
                }
                if (selRole === 'fitpass_member') {
                    return userRole === 'member' && !isH4Gym;
                }
                if (selRole === 'member') return userRole === 'member';
                return false;
            };

            if (selectedRole && !roleMatches(selectedRole, data.role, data.gymName, data.gymId)) {
                const readableRoleName = 
                    selectedRole === 'superadmin' ? 'Super Admin' :
                    selectedRole === 'fitpass_admin' ? 'FitPass Admin' :
                    selectedRole === 'h4_admin' ? 'H4 Admin' :
                    selectedRole === 'h4_gym_admin' ? 'H4 Gym Admin' :
                    selectedRole === 'fitpass_partner_admin' ? 'Fitpass Partner Admin' :
                    selectedRole === 'staff' ? 'Gym Staff / Trainer' :
                    selectedRole === 'h4_member' ? 'H4 Member' :
                    selectedRole === 'fitpass_member' ? 'Fitpass Member' :
                    'Member';
                return { 
                    success: false, 
                    message: `Access Denied: Your account is not authorized as a ${readableRoleName}.` 
                };
            }

            setUser(data);
            sessionStorage.setItem('user', JSON.stringify(data));
            sessionStorage.setItem('token', data.token);
            
            let division = 'fitpass';
            if (data.role === 'h4_admin' || (data.gymName && data.gymName.toUpperCase() === 'H4') || data.gymId === '05a08fdf-7427-48a5-8b25-e18d5a5668cd') {
                division = 'h4';
            } else if (data.role === 'fitpass_admin') {
                division = 'fitpass';
            }
            sessionStorage.setItem('activeDivision', division);
            setActiveDivision(division);

            if (data.role === 'superadmin') {
                sessionStorage.removeItem('selectedGymId');
                sessionStorage.removeItem('selectedBranchId');
                setSelectedGymId('');
                setSelectedBranchId('');
            } else if (data.gymId) {
                sessionStorage.setItem('selectedGymId', data.gymId);
                setSelectedGymId(data.gymId);
            } else {
                sessionStorage.removeItem('selectedGymId');
                setSelectedGymId('');
            }
            if (data.branchId) {
                sessionStorage.setItem('selectedBranchId', data.branchId);
                setSelectedBranchId(data.branchId);
            } else {
                sessionStorage.removeItem('selectedBranchId');
                setSelectedBranchId('');
            }
            return { success: true, user: data };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Login failed' };
        }
    };
 
    const register = async (name, email, password, phone) => {
        try {
            const { data } = await API.post('/auth/register', { name, email, password, phone });
            return { success: true, email: data.email || email };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Registration failed' };
        }
    };

    const verifyRegistration = async (email, otp) => {
        try {
            const { data } = await API.post('/auth/verify-otp', { email, otp });
            setUser(data);
            sessionStorage.setItem('user', JSON.stringify(data));
            sessionStorage.setItem('token', data.token);
            if (data.gymId) { sessionStorage.setItem('selectedGymId', data.gymId); setSelectedGymId(data.gymId); }
            return { success: true, user: data };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Verification failed' };
        }
    };

    const logout = () => {
        setUser(null);
        setSelectedGymId('');
        setSelectedBranchId('');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('selectedGymId');
        sessionStorage.removeItem('selectedBranchId');
    };

    const updateUserLocal = (updates) => setUser((current) => {
        const next = { ...current, ...updates };
        sessionStorage.setItem('user', JSON.stringify(next));
        return next;
    });

    const changeSelectedGym = (gymId) => {
        setSelectedGymId(gymId);
        if (gymId) {
            sessionStorage.setItem('selectedGymId', gymId);
        } else {
            sessionStorage.removeItem('selectedGymId');
        }
    };

    const changeSelectedBranch = (branchId) => {
        setSelectedBranchId(branchId);
        if (branchId) {
            sessionStorage.setItem('selectedBranchId', branchId);
        } else {
            sessionStorage.removeItem('selectedBranchId');
        }
    };

    const changeActiveDivision = (division) => {
        setActiveDivision(division);
        sessionStorage.setItem('activeDivision', division);
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            updateUserLocal,
            loading, 
            login, 
            register, 
            verifyRegistration,
            logout, 
            selectedGymId, 
            changeSelectedGym, 
            selectedBranchId,
            changeSelectedBranch,
            activeDivision, 
            changeActiveDivision 
        }}>
            {children}
        </AuthContext.Provider>
    );
};
