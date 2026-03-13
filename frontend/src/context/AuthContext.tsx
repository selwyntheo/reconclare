import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { AppRole, RolePermissions } from '../types/rbac';
import { ROLE_PERMISSIONS } from '../config/permissions';

const STORAGE_KEY = 'recon-ai-demo-role';

// ── Role Display Info ──────────────────────────────────────

const ROLE_USER_INFO: Record<AppRole, { userId: string; userName: string; initials: string }> = {
  FUND_ACCOUNTANT: { userId: 'u-fa', userName: 'Jane Doe', initials: 'FA' },
  PRICING_TEAM: { userId: 'u-pt', userName: 'Mark Chen', initials: 'PT' },
  TRADE_CAPTURE_TEAM: { userId: 'u-tc', userName: 'Sarah Kim', initials: 'TC' },
  RECON_LEAD: { userId: 'u-rl', userName: 'David Park', initials: 'RL' },
  AUDITOR: { userId: 'u-au', userName: 'Lisa Wang', initials: 'AU' },
  NAV_OPS_ANALYST: { userId: 'u-na', userName: 'Rachel Torres', initials: 'NA' },
  CLIENT_STAKEHOLDER: { userId: 'u-cs', userName: 'James Mitchell', initials: 'CS' },
  FUND_ADMIN: { userId: 'u-fad', userName: "Claire O'Brien", initials: 'FD' },
};

// ── State Shape ────────────────────────────────────────────

interface AuthState {
  role: AppRole;
  userId: string;
  userName: string;
  initials: string;
  permissions: RolePermissions;
}

function buildState(role: AppRole): AuthState {
  const info = ROLE_USER_INFO[role];
  return {
    role,
    userId: info.userId,
    userName: info.userName,
    initials: info.initials,
    permissions: ROLE_PERMISSIONS[role],
  };
}

function getInitialRole(): AppRole {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in ROLE_PERMISSIONS) {
      return stored as AppRole;
    }
  } catch {
    // localStorage unavailable
  }
  return 'FUND_ACCOUNTANT';
}

// ── Actions ────────────────────────────────────────────────

type AuthAction = { type: 'SET_ROLE'; role: AppRole };

function authReducer(_state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_ROLE':
      return buildState(action.role);
    default:
      return _state;
  }
}

// ── Context ────────────────────────────────────────────────

const initialRole = getInitialRole();
const initialState = buildState(initialRole);

const AuthStateContext = createContext<AuthState>(initialState);
const AuthDispatchContext = createContext<React.Dispatch<AuthAction>>(() => {});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Persist role to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, state.role);
    } catch {
      // localStorage unavailable
    }
  }, [state.role]);

  return (
    <AuthStateContext.Provider value={state}>
      <AuthDispatchContext.Provider value={dispatch}>
        {children}
      </AuthDispatchContext.Provider>
    </AuthStateContext.Provider>
  );
}

export function useAuth() {
  const state = useContext(AuthStateContext);
  const dispatch = useContext(AuthDispatchContext);

  const setRole = (role: AppRole) => {
    dispatch({ type: 'SET_ROLE', role });
  };

  return { ...state, setRole };
}
