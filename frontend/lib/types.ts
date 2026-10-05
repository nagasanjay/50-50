export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: 'OWNER' | 'MEMBER';
  user: User;
}

export interface GroupInvite {
  id: string;
  groupId: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface ExpenseParticipant {
  id: string;
  userId: string;
  shareCents: number;
  percentage: number | null;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  category: string | null;
  amountCents: number;
  splitType: SplitType;
  paidById: string;
  incurredAt: string;
  participants: ExpenseParticipant[];
}

export interface Settlement {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  note: string | null;
  createdAt: string;
}

export interface NetBalance {
  userId: string;
  netCents: number;
  name: string | null;
}

export interface SimplifiedTransfer {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}

export interface BalancesResponse {
  balances: NetBalance[];
  simplifiedTransfers: SimplifiedTransfer[];
}

export interface ActivityLogEntry {
  id: string;
  groupId: string;
  actorId: string;
  type:
    | 'EXPENSE_CREATED'
    | 'EXPENSE_UPDATED'
    | 'EXPENSE_DELETED'
    | 'SETTLEMENT_CREATED'
    | 'MEMBER_JOINED'
    | 'GROUP_CREATED';
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: { id: string; name: string };
}

export interface ImportWarningSummary {
  date: string;
  description: string;
  reason: string;
}

export interface PreviewImportResult {
  memberNames: string[];
  expenseCount: number;
  settlementCount: number;
  warnings: ImportWarningSummary[];
}

export interface CommitImportResult {
  importedExpenses: number;
  importedSettlements: number;
  warnings: ImportWarningSummary[];
}
