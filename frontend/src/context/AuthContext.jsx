import { createContext, useState, useEffect } from 'react';
import API from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedGymId, setSelectedGymId] = useState(() => {
        return localStorage.getItem('selectedGymId') || '';
    });
    const [selectedBranchId, setSelectedBranchId] = useState(() => {
        return localStorage.getItem('selectedBranchId') || '';
    });
    const [activeDivision, setActiveDivision] = useState(() => {
        return localStorage.getItem('activeDivision') || 'fitpass';
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        if (storedUser && token) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            
            let division = localStorage.getItem('activeDivision') || 'fitpass';
            if (parsedUser.role === 'superadmin') {
                if (window.location.pathname === '/dashboard') {
                    division = 'h4';
                    if (!localStorage.getItem('selectedGymId')) {
                        API.get('/superadmin/h4-gym').then(({ data: h4Gym }) => {
                            const h4Id = h4Gym?._id || h4Gym?.id;
                            if (h4Id) {
                                localStorage.setItem('selectedGymId', h4Id);
                                setSelectedGymId(h4Id);
                            }
                        }).catch(() => {});
                    }
                }
                else if (window.location.pathname.startsWith('/superadmin/')) {
                    division = 'fitpass';
                    localStorage.removeItem('selectedGymId');
                    localStorage.removeItem('selectedBranchId');
                    setSelectedGymId('');
                    setSelectedBranchId('');
                }
            } else if (parsedUser.role === 'h4_admin' || (parsedUser.gymName && parsedUser.gymName.toUpperCase() === 'H4') || parsedUser.gymId === '05a08fdf-7427-48a5-8b25-e18d5a5668cd') {
                division = 'h4';
            } else if (parsedUser.role === 'fitpass_admin') {
                division = 'fitpass';
            }
            if (division) {
                localStorage.setItem('activeDivision', division);
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
            localStorage.setItem('user', JSON.stringify(data));
            localStorage.setItem('token', data.token);
            
            let division = 'fitpass';
            if (data.role === 'h4_admin' || (data.gymName && data.gymName.toUpperCase() === 'H4') || data.gymId === '05a08fdf-7427-48a5-8b25-e18d5a5668cd') {
                division = 'h4';
            } else if (data.role === 'fitpass_admin') {
                division = 'fitpass';
            }
            localStorage.setItem('activeDivision', division);
            setActiveDivision(division);

            if (data.role === 'superadmin') {
                localStorage.removeItem('selectedGymId');
                localStorage.removeItem('selectedBranchId');
                setSelectedGymId('');
                setSelectedBranchId('');
            } else if (data.gymId) {
                localStorage.setItem('selectedGymId', data.gymId);
                setSelectedGymId(data.gymId);
            } else {
                localStorage.removeItem('selectedGymId');
                setSelectedGymId('');
            }
            if (data.branchId) {
                localStorage.setItem('selectedBranchId', data.branchId);
                setSelectedBranchId(data.branchId);
            } else {
                localStorage.removeItem('selectedBranchId');
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
            localStorage.setItem('user', JSON.stringify(data));
            localStorage.setItem('token', data.token);
            if (data.gymId) { localStorage.setItem('selectedGymId', data.gymId); setSelectedGymId(data.gymId); }
            return { success: true, user: data };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Verification failed' };
        }
    };

    const logout = () => {
        setUser(null);
        setSelectedGymId('');
        setSelectedBranchId('');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('selectedGymId');
        localStorage.removeItem('selectedBranchId');
    };

    const changeSelectedGym = (gymId) => {
        setSelectedGymId(gymId);
        if (gymId) {
            localStorage.setItem('selectedGymId', gymId);
        } else {
            localStorage.removeItem('selectedGymId');
        }
    };

    const changeSelectedBranch = (branchId) => {
        setSelectedBranchId(branchId);
        if (branchId) {
            localStorage.setItem('selectedBranchId', branchId);
        } else {
            localStorage.removeItem('selectedBranchId');
        }
    };

    const changeActiveDivision = (division) => {
        setActiveDivision(division);
        localStorage.setItem('activeDivision', division);
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
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
