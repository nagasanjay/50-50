import { BadRequestException } from '@nestjs/common';

export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE';

export interface EqualSplitInput {
  userIds: string[];
}

export interface ExactSplitInput {
  shares: { userId: string; amountCents: number }[];
}

export interface PercentageSplitInput {
  shares: { userId: string; percentage: number }[];
}

export type SplitInput = EqualSplitInput | ExactSplitInput | PercentageSplitInput;

export interface ComputedShare {
  userId: string;
  shareCents: number;
  percentage?: number;
}

const PERCENTAGE_EPSILON = 0.01;

export function computeShares(
  amountCents: number,
  splitType: SplitType,
  input: SplitInput,
): ComputedShare[] {
  switch (splitType) {
    case 'EQUAL':
      return computeEqualShares(amountCents, input as EqualSplitInput);
    case 'EXACT':
      return computeExactShares(amountCents, input as ExactSplitInput);
    case 'PERCENTAGE':
      return computePercentageShares(amountCents, input as PercentageSplitInput);
    default:
      throw new BadRequestException(`Unknown split type: ${splitType}`);
  }
}

function computeEqualShares(amountCents: number, { userIds }: EqualSplitInput): ComputedShare[] {
  if (!userIds || userIds.length === 0) {
    throw new BadRequestException('EQUAL split requires at least one participant');
  }

  const sortedUserIds = [...userIds].sort();
  const n = sortedUserIds.length;
  const base = Math.floor(amountCents / n);
  const remainder = amountCents - base * n;

  return sortedUserIds.map((userId, index) => ({
    userId,
    shareCents: base + (index < remainder ? 1 : 0),
  }));
}

function computeExactShares(amountCents: number, { shares }: ExactSplitInput): ComputedShare[] {
  if (!shares || shares.length === 0) {
    throw new BadRequestException('EXACT split requires at least one participant');
  }

  const sum = shares.reduce((total, s) => total + s.amountCents, 0);
  if (sum !== amountCents) {
    throw new BadRequestException(
      `EXACT split shares must sum to ${amountCents}, got ${sum}`,
    );
  }

  return shares.map((s) => ({ userId: s.userId, shareCents: s.amountCents }));
}

function computePercentageShares(
  amountCents: number,
  { shares }: PercentageSplitInput,
): ComputedShare[] {
  if (!shares || shares.length === 0) {
    throw new BadRequestException('PERCENTAGE split requires at least one participant');
  }

  const percentageSum = shares.reduce((total, s) => total + s.percentage, 0);
  if (Math.abs(percentageSum - 100) > PERCENTAGE_EPSILON) {
    throw new BadRequestException(
      `PERCENTAGE split percentages must sum to 100, got ${percentageSum}`,
    );
  }

  const rounded = shares.map((s) => ({
    userId: s.userId,
    percentage: s.percentage,
    shareCents: Math.round((amountCents * s.percentage) / 100),
  }));

  const roundedTotal = rounded.reduce((total, r) => total + r.shareCents, 0);
  let diff = amountCents - roundedTotal;

  if (diff !== 0) {
    const order = [...rounded].sort((a, b) => {
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
      return a.userId.localeCompare(b.userId);
    });
    const step = diff > 0 ? 1 : -1;
    let i = 0;
    while (diff !== 0) {
      const target = order[i % order.length];
      target.shareCents += step;
      diff -= step;
      i++;
    }
  }

  return rounded;
}
