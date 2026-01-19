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
 */
export const calculateInterest = (principal: number, yearlyRate: number, days: number): number => {
  if (days <= 0 || principal <= 0) return 0;
  const dailyRate = (yearlyRate / 100) / 365;
  return Math.round(principal * dailyRate * days);
};

/**
 * Advanced Loan Status Calculation (Segmented Method)
 * 
 * Logic:
 * 1. Start with initial principal.
 * 2. Move time forward from Start Date.
 * 3. Whenever a payment occurs:
 *    a. Calculate interest accrued from Last Event -> Payment Date on Current Principal.
 *    b. Add to Total Accrued Interest.
 *    c. Subtract Payment Principal from Current Principal.
 *    d. Add Payment Interest to Total Paid Interest.
 * 4. Finally, calculate interest from Last Event -> Target Date (Now).
 */
export const calculateLoanStatus = (
    initialPrincipal: number,
    startDateStr: string,
    yearlyRate: number,
    payments: Payment[],
    targetDateStr?: string // Defaults to Now if undefined
) => {
    let currentPrincipal = initialPrincipal;
    let totalAccruedInterest = 0;
    let totalPaidInterest = 0;
    
    // Sort payments chronologically
    const sortedPayments = [...payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let lastDate = new Date(startDateStr);
    lastDate.setHours(0, 0, 0, 0);

    // Process historical payments
    for (const payment of sortedPayments) {
        const payDate = new Date(payment.date);
        payDate.setHours(0, 0, 0, 0);

        // Calculate days since last event
        const diffTime = payDate.getTime() - lastDate.getTime();
        const days = Math.max(0, Math.floor(diffTime / MS_PER_DAY));

        // Accrue interest for this segment
        if (days > 0 && currentPrincipal > 0) {
            const segmentInterest = calculateInterest(currentPrincipal, yearlyRate, days);
            totalAccruedInterest += segmentInterest;
        }

        // Apply payment
        currentPrincipal -= payment.amount;
        totalPaidInterest += (payment.interest || 0);
        
        // Move cursor
        lastDate = payDate;
    }

    // Calculate pending interest from Last Payment -> Target Date (Now)
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    
    const diffFinal = targetDate.getTime() - lastDate.getTime();
    const daysFinal = Math.max(0, Math.floor(diffFinal / MS_PER_DAY));

    if (daysFinal > 0 && currentPrincipal > 0) {
        const finalSegmentInterest = calculateInterest(currentPrincipal, yearlyRate, daysFinal);
        totalAccruedInterest += finalSegmentInterest;
    }

    const remainingInterest = totalAccruedInterest - totalPaidInterest;

    return {
        remainingPrincipal: currentPrincipal,
        remainingInterest: remainingInterest, // Can be negative if overpaid, but logically implies credit
        totalAccruedInterest,
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
      
      // USE NEW LOGIC: Calculate status based on history
      const status = calculateLoanStatus(
          allocation.amount,
          cost.date,
          cost.interestRate,
          allocation.payments || []
      );

      // If fully paid (Principal <= 0 AND Interest <= 0), we can skip adding to debt record
      // OR we add it but it shows 0. Let's add it if there is any balance.
      // We allow small floating point margin or exact 0.
      if (status.remainingPrincipal <= 0 && status.remainingInterest <= 0) return;

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
      // If user overpaid interest, we sum it as is (reducing total debt), or clamp to 0? 
      // Usually in this app context, debt is debt.
      record.interest += status.remainingInterest;
      record.totalDebt += (status.remainingPrincipal + status.remainingInterest);
      
      record.details.push({
        costId: cost.id,
        description: cost.description,
        dateIncurred: cost.date,
        daysOverdue: status.daysSinceLastEvent, // Shows days since last activity
        principal: status.remainingPrincipal,
        interest: status.remainingInterest,
        interestRate: cost.interestRate
      });
    });
  });

  // Flatten map to array
  const allDebts: DebtRecord[] = [];
  debtMap.forEach((creditorMap) => {
    creditorMap.forEach((record) => {
      // Round numbers for display cleanliness
      record.principal = Math.round(record.principal);
      record.interest = Math.round(record.interest);
      record.totalDebt = Math.round(record.totalDebt);
      allDebts.push(record);
    });
  });

  return allDebts;
};