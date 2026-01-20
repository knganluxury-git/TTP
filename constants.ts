
import { Role, StageStatus, User, Stage, Cost, Topic, TopicStatus } from './types';

// Default Blue House Logo (SVG Base64) - Matches the Blue/Emerald theme
export const APP_LOGO = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMjU2M2ViIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTMgOWw5LTcgOSA3djExYTIgMiAwIDAgMS0yIDJINWEyIDIgMCAwIDEtMi0yeiI+PC9wYXRoPjxwb2x5bGluZSBwb2ludHM9IjkgMjIgOSAxMiAxNSAxMiAxNSAyMiI+PC9wb2x5bGluZT48L3N2Zz4=";

export const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'TuanChom', email: 'tuanchom@ttp.com', role: Role.ADMIN, avatar: 'TC' },
  { id: 'u2', name: 'TamTrang', email: 'tamtrang@ttp.com', role: Role.VIEWER, avatar: 'TT' },
  { id: 'u3', name: 'Phi', email: 'phi@ttp.com', role: Role.VIEWER, avatar: 'PH' },
];

export const INITIAL_STAGES: Stage[] = [];

export const DEFAULT_INTEREST_RATE_YEARLY = 0; // Set to 0 to disable interest logic

// Start with empty costs
export const INITIAL_COSTS: Cost[] = [];

// Start with empty topics
export const INITIAL_TOPICS: Topic[] = [];
