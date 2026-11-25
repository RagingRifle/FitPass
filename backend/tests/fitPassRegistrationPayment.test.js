const getFitPassRegistrationPayment = require('../utils/fitPassRegistrationPayment');

const fitPassPlan = { gymId: 'SYSTEM', sessions: 10 };

describe('FitPass registration payment', () => {
    it('records the plan price for a FitPass admin registration without an explicit amount', () => {
        expect(getFitPassRegistrationPayment({
            role: 'fitpass_admin',
            targetGymId: 'SYSTEM',
            plan: fitPassPlan,
            planPrice: 1200
        })).toBe(1200);
    });

    it('uses the plan price when the FitPass admin form submits zero', () => {
        expect(getFitPassRegistrationPayment({
            role: 'fitpass_admin',
            targetGymId: 'SYSTEM',
            plan: fitPassPlan,
            paidAmount: '0',
            planPrice: 1200
        })).toBe(1200);
    });

    it('preserves an explicitly entered partial payment', () => {
        expect(getFitPassRegistrationPayment({
            role: 'fitpass_admin',
            targetGymId: 'SYSTEM',
            plan: fitPassPlan,
            paidAmount: '400',
            planPrice: 1200
        })).toBe(400);
    });

    it('does not auto-record the plan price for a non-FitPass plan', () => {
        expect(getFitPassRegistrationPayment({
            role: 'admin',
            targetGymId: 'gym-1',
            plan: { gymId: 'gym-1', sessions: 10 },
            planPrice: 1200
        })).toBe(0);
    });
});
