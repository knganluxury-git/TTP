
import { Role, StageStatus, User, Stage, Cost, Topic, TopicStatus } from './types';

export const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'TuanChom', email: 'tuanchom@ttp.com', role: Role.ADMIN, avatar: 'TC' },
  { id: 'u2', name: 'TamTrang', email: 'tamtrang@ttp.com', role: Role.VIEWER, avatar: 'TT' },
  { id: 'u3', name: 'Phi', email: 'phi@ttp.com', role: Role.VIEWER, avatar: 'PH' },
];

export const INITIAL_STAGES: Stage[] = [];

export const DEFAULT_INTEREST_RATE_YEARLY = 10; // 10% per year

// Start with empty costs
export const INITIAL_COSTS: Cost[] = [];

// Start with empty topics
export const INITIAL_TOPICS: Topic[] = [];
