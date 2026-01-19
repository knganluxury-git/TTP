
import { Cost, DebtRecord, User, DebtDetail, Payment } from '../types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export const formatDate = (dateInput: string | number | Date): string => {
  if (!dateInput) return '';
  
  // Handle YYYY-MM-DD string explicitly to avoid timezone shifts
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-');
    return `${day}/${month}/${year}`;
  }

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

// Calculate days between two dates. If endDate is not provided, use now.
export const calculateDaysDiff = (startDateStr: string, endDateStr?: string): number => {
  const start = new Date(startDateStr);
  // Reset hours to ensure we count full days based on calendar dates
  start.setHours(0, 0, 0, 0);
  
  const end = endDateStr ? new Date(endDateStr) : new Date();
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - start.getTime();
  // Return 0 if start date is in the future
  if (diffTime < 0) return 0;
  
  return Math.floor(diffTime / MS_PER_DAY); 
};

/**
 * Calculates simple interest for a specific period on a specific principal.
 * DISABLE INTEREST: Always return 0.
 */
export const calculateInterest = (principal: number, yearlyRate: number, days: number): number => {
  return 0; 
};

/**
 * Advanced Loan Status Calculation
 * DISABLE INTEREST LOGIC: Only tracks Principal.
 */
export const calculateLoanStatus = (
    initialPrincipal: number,
    startDateStr: string,
    yearlyRate: number,
    payments: Payment[],
    targetDateStr?: string // Defaults to Now if undefined
) => {
    let currentPrincipal = initialPrincipal;
    const totalAccruedInterest = 0; // Disabled
    let totalPaidInterest = 0;
    
    // Sort payments chronologically
    const sortedPayments = [...payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Determine the last event date (purely for 'daysSinceLastEvent' display if needed)
    let lastDate = new Date(startDateStr);
    lastDate.setHours(0, 0, 0, 0);

    // Process historical payments
    for (const payment of sortedPayments) {
        const payDate = new Date(payment.date);
        payDate.setHours(0, 0, 0, 0);

        // Apply payment (Only reduce principal)
        currentPrincipal -= payment.amount;
        totalPaidInterest += (payment.interest || 0); // Keep tracking if data exists, but won't be used for debt calc
        
        lastDate = payDate;
    }

    // Calculate days from Last Payment -> Target Date (Now)
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    
    const diffFinal = targetDate.getTime() - lastDate.getTime();
    const daysFinal = Math.max(0, Math.floor(diffFinal / MS_PER_DAY));

    return {
        remainingPrincipal: currentPrincipal,
        remainingInterest: 0, // Disabled
        totalAccruedInterest: 0, // Disabled
        totalPaidInterest,
        daysSinceLastEvent: daysFinal
    };
};

/**
 * Calculates internal debts based on approved costs.
 */
export const calculateDebts = (
  costs: Cost[], 
  users: User[]
): DebtRecord[] => {
  
  const debtMap = new Map<string, Map<string, DebtRecord>>();

  costs.filter(c => c.status === 'APPROVED').forEach(cost => {
    const payerId = cost.payerId;
    
    cost.allocations.forEach(allocation => {
      // You don't owe yourself
      if (allocation.userId === payerId) return;

      const debtorId = allocation.userId;
      
      // Calculate status (Interest will return 0)
      const status = calculateLoanStatus(
          allocation.amount,
          cost.date,
          0, // Force rate 0
          allocation.payments || []
      );

      // If fully paid (Principal <= 0), skip
      // We allow small floating point margin or exact 0.
      if (status.remainingPrincipal <= 0) return;

      // Initialize maps if needed
      if (!debtMap.has(debtorId)) {
        debtMap.set(debtorId, new Map());
      }
      const debtorRecords = debtMap.get(debtorId)!;

      if (!debtorRecords.has(payerId)) {
        debtorRecords.set(payerId, {
          debtorId,
          creditorId: payerId,
          principal: 0,
          interest: 0,
          totalDebt: 0,
          details: []
        });
      }

      const record = debtorRecords.get(payerId)!;
      record.principal += status.remainingPrincipal;
      record.interest += 0; // Disabled
      record.totalDebt += status.remainingPrincipal; // Only Principal
      
      record.details.push({
        costId: cost.id,
        description: cost.description,
        dateIncurred: cost.date,
        daysOverdue: status.daysSinceLastEvent,
        principal: status.remainingPrincipal,
        interest: 0,
        interestRate: 0
      });
    });
  });

  // Flatten map to array
  const allDebts: DebtRecord[] = [];
  debtMap.forEach((creditorMap) => {
    creditorMap.forEach((record) => {
      record.principal = Math.round(record.principal);
      record.interest = 0;
      record.totalDebt = Math.round(record.totalDebt);
      allDebts.push(record);
    });
  });

  return allDebts;
};
