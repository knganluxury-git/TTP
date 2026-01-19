
import { Role, StageStatus, User, Stage, Cost, Topic, TopicStatus } from './types';

export const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'TuanChom', role: Role.ADMIN, avatar: 'TC' },
  { id: 'u2', name: 'TamTrang', role: Role.VIEWER, avatar: 'TT' },
  { id: 'u3', name: 'Phi', role: Role.VIEWER, avatar: 'PH' },
];

export const INITIAL_STAGES: Stage[] = [
  { id: 's1', name: 'Đặt cọc đất', startDate: '2023-10-01', endDate: '2023-10-15', status: StageStatus.COMPLETED, totalCost: 0, budget: 300000000 },
  { id: 's2', name: 'Thanh toán đợt 1', startDate: '2023-11-01', endDate: '2023-11-05', status: StageStatus.COMPLETED, totalCost: 0, budget: 500000000 },
  { id: 's3', name: 'Làm sổ đỏ', startDate: '2024-01-10', endDate: '2024-02-10', status: StageStatus.IN_PROGRESS, totalCost: 0, budget: 20000000 },
  { id: 's4', name: 'Thiết kế & Xin phép', startDate: '2024-03-01', endDate: '2024-04-01', status: StageStatus.NOT_STARTED, totalCost: 0, budget: 30000000 },
  { id: 's5', name: 'Khởi công xây dựng', startDate: '2024-05-01', endDate: '2024-12-01', status: StageStatus.NOT_STARTED, totalCost: 0, budget: 1500000000 },
];

export const DEFAULT_INTEREST_RATE_YEARLY = 10; // 10% per year

// Sample costs for demo purposes
export const INITIAL_COSTS: Cost[] = [
  {
    id: 'c1',
    stageId: 's1',
    description: 'Tiền cọc đất cho chủ nhà',
    amount: 300000000,
    payerId: 'u1', // TuanChom paid
    date: '2023-10-02',
    interestRate: DEFAULT_INTEREST_RATE_YEARLY,
    isCustomAllocation: false,
    allocations: [
      { userId: 'u1', amount: 100000000, percentage: 33.33, paidAmount: 0, payments: [], isPaid: false },
      { userId: 'u2', amount: 100000000, percentage: 33.33, paidAmount: 0, payments: [], isPaid: false },
      { userId: 'u3', amount: 100000000, percentage: 33.33, paidAmount: 0, payments: [], isPaid: false },
    ],
    approvedBy: ['u1', 'u2', 'u3'],
    status: 'APPROVED',
    createdAt: 1696200000000,
  },
  {
    id: 'c2',
    stageId: 's3',
    description: 'Phí dịch vụ sang tên',
    amount: 15000000,
    payerId: 'u1',
    date: '2024-01-15',
    interestRate: 12, // Example of different rate
    isCustomAllocation: true,
    allocations: [
        { userId: 'u1', amount: 7500000, percentage: 50, paidAmount: 0, payments: [], isPaid: false },
        { userId: 'u2', amount: 3750000, percentage: 25, paidAmount: 0, payments: [], isPaid: false },
        { userId: 'u3', amount: 3750000, percentage: 25, paidAmount: 0, payments: [], isPaid: false },
    ],
    approvedBy: ['u1'],
    status: 'PENDING', // Waiting for others
    createdAt: 1705276800000,
  }
];

export const INITIAL_TOPICS: Topic[] = [
  {
    id: 't1',
    creatorId: 'u1',
    title: 'Quy định nuôi chó: Phải rọ mõm khi ra sân chung',
    createdAt: 1704067200000,
    status: TopicStatus.APPROVED,
    votes: [
      { userId: 'u1', type: 'LIKE' },
      { userId: 'u2', type: 'LIKE' },
      { userId: 'u3', type: 'LIKE' }
    ],
    comments: [
        { id: 'cm1', userId: 'u1', content: 'Chó nhà ai dữ thì tự giác nhé.', createdAt: 1704067500000 },
        { id: 'cm2', userId: 'u2', content: 'Đồng ý, an toàn là trên hết.', createdAt: 1704067800000 }
    ],
    readyToSpin: [],
    finalDecisionMethod: 'CONSENSUS'
  },
  {
    id: 't2',
    creatorId: 'u2',
    title: 'Tổ chức nhậu vào ngày 15 hàng tháng',
    createdAt: 1709251200000,
    status: TopicStatus.CONFLICT,
    votes: [
      { userId: 'u2', type: 'LIKE' },
      { userId: 'u3', type: 'LIKE' },
      { userId: 'u1', type: 'DISLIKE' }
    ],
    comments: [
        { id: 'cm3', userId: 'u2', content: 'Lâu lâu anh em tụ tập cho vui.', createdAt: 1709251500000 },
        { id: 'cm4', userId: 'u1', content: 'Tháng nào cũng nhậu tốn kém lắm.', createdAt: 1709251800000 },
        { id: 'cm5', userId: 'u3', content: 'Vui mà anh, vote đi.', createdAt: 1709251900000 }
    ],
    readyToSpin: ['u2'] // TamTrang accepted spin, waiting for others
  }
];
