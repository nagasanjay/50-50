const AMOUNT_TOLERANCE_CENTS = 1;
const TOTAL_ROW_DESCRIPTION = 'total balance';
const PAYMENT_CATEGORY = 'payment';

export interface ParsedCsvRow {
  date: string;
  description: string;
  category: string;
  costCents: number;
  currency: string;
  deltas: Record<string, number>;
  isPayment: boolean;
}

export interface ParsedSplitwiseCsv {
  memberNames: string[];
  rows: ParsedCsvRow[];
  declaredTotals: Record<string, number> | null;
}

/** Splits one CSV line into fields, honoring double-quoted fields that may contain commas or escaped quotes (""). */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function toCents(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export function parseSplitwiseCsv(csvText: string): ParsedSplitwiseCsv {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { memberNames: [], rows: [], declaredTotals: null };
  }

  const header = splitCsvLine(lines[0]);
  const memberNames = header.slice(5).map((name) => name.trim());

  const rows: ParsedCsvRow[] = [];
  let declaredTotals: Record<string, number> | null = null;

  for (const line of lines.slice(1)) {
    const fields = splitCsvLine(line);
    const description = (fields[1] ?? '').trim();
    const category = (fields[2] ?? '').trim();
    const currency = (fields[4] ?? '').trim();
    const memberValues = memberNames.map((name, i) => toCents(fields[5 + i] ?? ''));

    if (description.toLowerCase() === TOTAL_ROW_DESCRIPTION) {
      declaredTotals = Object.fromEntries(memberNames.map((name, i) => [name, memberValues[i]]));
      continue;
    }

    rows.push({
      date: (fields[0] ?? '').trim(),
      description,
      category,
      costCents: toCents(fields[3] ?? ''),
      currency,
      deltas: Object.fromEntries(memberNames.map((name, i) => [name, memberValues[i]])),
      isPayment: category.toLowerCase() === PAYMENT_CATEGORY,
    });
  }

  return { memberNames, rows, declaredTotals };
}

export interface ReconstructedExpenseParticipant {
  memberName: string;
  shareCents: number;
}

export interface ReconstructedExpense {
  type: 'expense';
  date: string;
  description: string;
  category: string;
  amountCents: number;
  paidByMemberName: string;
  participants: ReconstructedExpenseParticipant[];
}

export interface ReconstructedSettlement {
  type: 'settlement';
  date: string;
  description: string;
  amountCents: number;
  fromMemberName: string;
  toMemberName: string;
}

export interface ImportWarning {
  row: ParsedCsvRow;
  reason: string;
}

export interface ReconstructedImport {
  expenses: ReconstructedExpense[];
  settlements: ReconstructedSettlement[];
  warnings: ImportWarning[];
}

export function reconstructTransactions(parsed: ParsedSplitwiseCsv): ReconstructedImport {
  const expenses: ReconstructedExpense[] = [];
  const settlements: ReconstructedSettlement[] = [];
  const warnings: ImportWarning[] = [];

  for (const row of parsed.rows) {
    if (!Number.isFinite(row.costCents) || row.costCents <= 0) {
      warnings.push({ row, reason: 'Cost could not be parsed or is not positive' });
      continue;
    }

    const nonZero = Object.entries(row.deltas).filter(([, v]) => Number.isFinite(v) && v !== 0);
    const positives = nonZero.filter(([, v]) => v > 0);
    const negatives = nonZero.filter(([, v]) => v < 0);

    if (row.isPayment) {
      if (positives.length !== 1 || negatives.length !== 1) {
        warnings.push({ row, reason: 'Payment row does not have exactly one payer and one receiver' });
        continue;
      }
      const [fromMemberName, fromDelta] = positives[0];
      const [toMemberName, toDelta] = negatives[0];
      if (
        Math.abs(fromDelta - row.costCents) > AMOUNT_TOLERANCE_CENTS ||
        Math.abs(-toDelta - row.costCents) > AMOUNT_TOLERANCE_CENTS
      ) {
        warnings.push({ row, reason: 'Payment amounts do not match the row cost' });
        continue;
      }
      settlements.push({
        type: 'settlement',
        date: row.date,
        description: row.description,
        amountCents: row.costCents,
        fromMemberName,
        toMemberName,
      });
      continue;
    }

    if (positives.length === 0) {
      warnings.push({ row, reason: 'No payer could be identified for this expense' });
      continue;
    }
    if (positives.length > 1) {
      warnings.push({ row, reason: 'Multiple payers in one expense are not supported yet' });
      continue;
    }

    const [paidByMemberName] = positives[0];
    const participants: ReconstructedExpenseParticipant[] = nonZero.map(([memberName, delta]) => ({
      memberName,
      shareCents: memberName === paidByMemberName ? row.costCents - delta : -delta,
    }));

    const shareSum = participants.reduce((sum, p) => sum + p.shareCents, 0);
    if (Math.abs(shareSum - row.costCents) > AMOUNT_TOLERANCE_CENTS) {
      warnings.push({ row, reason: `Reconstructed shares (${shareSum}) do not sum to the cost (${row.costCents})` });
      continue;
    }

    expenses.push({
      type: 'expense',
      date: row.date,
      description: row.description,
      category: row.category,
      amountCents: row.costCents,
      paidByMemberName,
      participants,
    });
  }

  return { expenses, settlements, warnings };
}
