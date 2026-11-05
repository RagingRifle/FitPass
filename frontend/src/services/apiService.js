import API from './api';

export const getStats = async () => {
    const { data } = await API.get('/dashboard/stats');
    return data;
};

export const getPlans = async () => {
    const { data } = await API.get('/plans');
    return data;
};

export const createPlan = async (planData) => {
    const { data } = await API.post('/plans', planData);
    return data;
};

export const updatePlan = async (id, planData) => {
    const { data } = await API.put(`/plans/${id}`, planData);
    return data;
};

export const deletePlan = async (id) => {
    const { data } = await API.delete(`/plans/${id}`);
    return data;
};

export const getMembers = async (status = '', page = 1, search = '', limit = 10) => {
    let url = `/members?page=${page}&limit=${limit}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const { data } = await API.get(url);
    return data;
};

export const createMember = async (memberData) => {
    const { data } = await API.post('/members', memberData);
    return data;
};

export const updateMember = async (id, memberData) => {
    const { data } = await API.put(`/members/${id}`, memberData);
    return data;
};

export const deleteMember = async (id) => {
    const { data } = await API.delete(`/members/${id}`);
    return data;
};

export const getMemberAuditTrail = async (id) => {
    const { data } = await API.get(`/members/${id}/audit`);
    return data;
};

export const getPayments = async () => {
    const { data } = await API.get('/payments');
    return data;
};

export const getMemberPayments = async (memberId) => {
    const { data } = await API.get(`/payments/member/${memberId}`);
    return data;
};

export const createPayment = async (paymentData) => {
    const { data } = await API.post('/payments', paymentData);
    return data;
};

export const markAttendance = async (attendanceData) => {
    const { data } = await API.post('/attendance', attendanceData);
    return data;
};

export const getTodayAttendance = async () => {
    const { data } = await API.get('/attendance/today');
    return data;
};

export const getMemberAttendance = async (memberId) => {
    const { data } = await API.get(`/attendance/member/${memberId}`);
    return data;
};

export const getStaff = async () => {
    const { data } = await API.get('/staff');
    return data;
};

export const createStaff = async (staffData) => {
    const { data } = await API.post('/staff', staffData);
    return data;
};

export const updateStaff = async (id, staffData) => {
    const { data } = await API.put(`/staff/${id}`, staffData);
    return data;
};

export const deleteStaff = async (id) => {
    const { data } = await API.delete(`/staff/${id}`);
    return data;
};

export const getBodyAssessments = async (memberId = '', filters = {}) => {
    const params = { ...filters, ...(memberId ? { memberId } : {}), timezoneOffset: new Date().getTimezoneOffset(), limit: 100 };
    const { data } = await API.get('/body-assessments', { params });
    return data;
};

export const createBodyAssessment = async (assessmentData) => {
    const { data } = await API.post('/body-assessments', assessmentData);
    return data;
};

export const updateBodyAssessment = async (id, assessmentData) => {
    const { data } = await API.put(`/body-assessments/${id}`, assessmentData);
    return data;
};

export const deleteBodyAssessment = async (id) => {
    const { data } = await API.delete(`/body-assessments/${id}`);
    return data;
};

// Trainer Attendance
export const getTrainerAttendance = async (filters = {}) => {
    const params = typeof filters === 'string' ? { trainerId: filters } : filters;
    const { data } = await API.get('/trainer-attendance', { params });
    return data;
};

export const markTrainerLeave = async (leaveData) => {
    const { data } = await API.post('/trainer-attendance/leave', leaveData);
    return data;
};

export const trainerCheckIn = async (trainerId = '') => {
    const { data } = await API.post('/trainer-attendance/checkin', trainerId ? { trainerId } : {});
    return data;
};

export const trainerCheckOut = async (trainerId = '') => {
    const { data } = await API.post('/trainer-attendance/checkout', trainerId ? { trainerId } : {});
    return data;
};

// Payroll
export const getSalaryStructure = async (trainerId) => {
    const { data } = await API.get(`/payroll/salary-structure/${trainerId}`);
    return data;
};

export const upsertSalaryStructure = async (salaryData) => {
    const { data } = await API.post('/payroll/salary-structure', salaryData);
    return data;
};

export const getPayrolls = async (params = {}) => {
    let url = '/payroll';
    const query = [];
    if (params.trainerId) query.push(`trainerId=${params.trainerId}`);
    if (params.month) query.push(`month=${params.month}`);
    if (params.year) query.push(`year=${params.year}`);
    if (query.length > 0) url += `?${query.join('&')}`;
    
    const { data } = await API.get(url);
    return data;
};

export const generatePayroll = async (payrollData) => {
    const { data } = await API.post('/payroll/generate', payrollData);
    return data;
};

export const updatePayroll = async (id, payrollData) => {
    const { data } = await API.put(`/payroll/${id}`, payrollData);
    return data;
};

export const addCommission = async (commissionData) => {
    const { data } = await API.post('/payroll/commission', commissionData);
    return data;
};

export const updatePayrollStatus = async (id, statusData) => {
    const { data } = await API.put(`/payroll/${id}`, statusData);
    return data;
};

// PT Packages
export const getPTPackages = async () => {
    const { data } = await API.get('/pt-packages');
    return data;
};

export const createPTPackage = async (packageData) => {
    const { data } = await API.post('/pt-packages', packageData);
    return data;
};

export const updatePTPackage = async (id, packageData) => {
    const { data } = await API.put(`/pt-packages/${id}`, packageData);
    return data;
};

export const deletePTPackage = async (id) => {
    const { data } = await API.delete(`/pt-packages/${id}`);
    return data;
};

// PT Sessions
export const getPTSessions = async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const { data } = await API.get(`/pt-sessions${query ? `?${query}` : ''}`);
    return data;
};

export const createPTSession = async (sessionData) => {
    const { data } = await API.post('/pt-sessions', sessionData);
    return data;
};

export const updatePTSession = async (id, sessionData) => {
    const { data } = await API.put(`/pt-sessions/${id}`, sessionData);
    return data;
};

export const deletePTSession = async (id) => {
    const { data } = await API.delete(`/pt-sessions/${id}`);
    return data;
};

// Trainer <-> Member assignments
export const getTrainerAssignments = async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const { data } = await API.get(`/trainer-assignments${query ? `?${query}` : ''}`);
    return data;
};

export const assignTrainerToMember = async (assignmentData) => {
    const { data } = await API.post('/trainer-assignments', assignmentData);
    return data;
};

export const removeTrainerAssignment = async (id) => {
    const { data } = await API.delete(`/trainer-assignments/${id}`);
    return data;
};

// Equipment
export const getEquipments = async () => {
    const { data } = await API.get('/equipments');
    return data;
};

export const createEquipment = async (equipmentData) => {
    const { data } = await API.post('/equipments', equipmentData);
    return data;
};

export const updateEquipment = async (id, equipmentData) => {
    const { data } = await API.put(`/equipments/${id}`, equipmentData);
    return data;
};

export const deleteEquipment = async (id) => {
    const { data } = await API.delete(`/equipments/${id}`);
    return data;
};

export const getMaintenanceLogs = async () => {
    const { data } = await API.get('/equipments/maintenance/logs');
    return data;
};

export const createMaintenanceLog = async (logData) => {
    const { data } = await API.post('/equipments/maintenance/logs', logData);
    return data;
};


