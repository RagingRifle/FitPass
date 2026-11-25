const getFitPassRegistrationPayment = ({ role, targetGymId, plan, paidAmount, planPrice }) => {
    const isFitPassPlan = plan?.gymId === 'SYSTEM' && Number(plan.sessions) > 0;
    const isFitPassAdmin = role === 'fitpass_admin'
        || (role === 'superadmin' && String(targetGymId) === 'SYSTEM');
    const enteredAmount = Number(paidAmount);

    return isFitPassPlan && isFitPassAdmin && !(enteredAmount > 0)
        ? Number(planPrice) || 0
        : enteredAmount || 0;
};

module.exports = getFitPassRegistrationPayment;
