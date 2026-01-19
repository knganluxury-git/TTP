
export enum Role {
  ADMIN = 'ADMIN',
  VIEWER = 'VIEWER',
}

export interface User {
  id: string;
  name: string;
  email: string; // Added email for Firebase Auth mapping
  role: Role;
  avatar: string;
}

export enum StageStatus {
  NOT_STARTED = 'Chưa bắt đầu',
  IN_PROGRESS = 'Đang thực hiện',
  COMPLETED = 'Hoàn thành',
}

export interface Stage {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: StageStatus;
  totalCost: number; // Cache of total confirmed costs for this stage
  budget: number; // Planned budget for this stage
  paymentCallAmount?: number; // If set, triggers a dashboard alert for users to prepare money
}

export interface Payment {
  id: string;
  amount: number; // Amount of PRINCIPAL paid
  interest: number; // Amount of INTEREST paid
  date: string;
}

export interface Allocation {
  userId: string;
  amount: number; // Total principal allocated to this user
  percentage: number;
  paidAmount: number; // Total principal paid so far
  payments: Payment[]; // History of payments
  isPaid: boolean; // True if paidAmount >= amount
}

export interface Cost {
  id: string;
  stageId: string;
  description: string;
  amount: number;
  payerId: string;
  date: string;
  interestRate: number; // Interest rate specific to this cost
  allocations: Allocation[];
  isCustomAllocation: boolean;
  approvedBy: string[]; // List of user IDs who approved
  status: 'PENDING' | 'APPROVED';
  createdAt: number;
}

export interface DebtRecord {
  debtorId: string;
  creditorId: string;
  principal: number;
  interest: number;
  totalDebt: number;
  details: DebtDetail[];
}

export interface DebtDetail {
  costId: string;
  description: string;
  dateIncurred: string;
  daysOverdue: number;
  principal: number; // Remaining principal
  interest: number;
  interestRate: number;
}

// --- DISCUSSION BOARD TYPES ---

export enum TopicStatus {
  VOTING = 'VOTING',       // Đang bỏ phiếu
  APPROVED = 'APPROVED',   // Đã thông qua (Thành Rules)
  REJECTED = 'REJECTED',   // Bị bác bỏ
  CONFLICT = 'CONFLICT',   // Không thống nhất (Chờ quay số)
}

export interface Vote {
  userId: string;
  type: 'LIKE' | 'DISLIKE';
}

export interface TopicComment {
  id: string;
  userId: string;
  content: string;
  createdAt: number;
}

export interface Topic {
  id: string;
  creatorId: string;
  title: string;
  createdAt: number;
  status: TopicStatus;
  votes: Vote[];
  comments: TopicComment[]; // Chat history specific to this topic
  readyToSpin: string[]; // List of user IDs who agreed to let the system decide (random spin)
  finalDecisionMethod?: 'CONSENSUS' | 'RANDOM_SPIN'; // Cách thức được duyệt
}

export interface AppState {
  currentUser: User;
  users: User[];
  stages: Stage[];
  costs: Cost[];
  topics: Topic[];
  settings: {
    defaultInterestRateYearly: number;
  };
}
