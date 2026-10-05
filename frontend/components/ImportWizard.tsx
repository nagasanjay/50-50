'use client';

import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import type { CommitImportResult, PreviewImportResult } from '@/lib/types';
import type { SplitMember } from '@/components/SplitInput';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ImportWizardProps {
  groupId: string;
  members: SplitMember[];
}

type Step =
  | { name: 'upload' }
  | { name: 'map'; csv: string; preview: PreviewImportResult }
  | { name: 'result'; result: CommitImportResult };

export function ImportWizard({ groupId, members }: ImportWizardProps) {
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ name: 'upload' });
  const [memberMap, setMemberMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsv(await readFileAsText(file));
  }

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const preview = await apiFetch<PreviewImportResult>(`/groups/${groupId}/import/preview`, {
        method: 'POST',
        body: JSON.stringify({ csv }),
      });
      const defaultMap: Record<string, string> = {};
      for (const name of preview.memberNames) {
        const match = members.find((m) => m.name.toLowerCase() === name.toLowerCase());
        if (match) defaultMap[name] = match.userId;
      }
      setMemberMap(defaultMap);
      setStep({ name: 'map', csv, preview });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not parse that CSV');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCommit() {
    if (step.name !== 'map') return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<CommitImportResult>(`/groups/${groupId}/import/commit`, {
        method: 'POST',
        body: JSON.stringify({ csv: step.csv, memberMap }),
      });
      setStep({ name: 'result', result });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Import failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (step.name === 'result') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import complete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            Imported {step.result.importedExpenses} expense(s) and {step.result.importedSettlements}{' '}
            settlement(s).
          </p>
          {step.result.warnings.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Skipped rows ({step.result.warnings.length}):</p>
              {step.result.warnings.map((w, i) => (
                <p key={i} className="text-sm text-muted-foreground">
                  {w.date} — {w.description}: {w.reason}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (step.name === 'map') {
    const unmapped = step.preview.memberNames.filter((name) => !memberMap[name]);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Map Splitwise members to group members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {step.preview.expenseCount} expense(s) and {step.preview.settlementCount} settlement(s) found.
            {step.preview.warnings.length > 0 &&
              ` ${step.preview.warnings.length} row(s) will be skipped — see the summary after import.`}
          </p>
          {step.preview.memberNames.map((name) => (
            <div key={name} className="flex items-center gap-2">
              <Label className="w-40 shrink-0">{name}</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={memberMap[name] ?? ''}
                onChange={(e) => setMemberMap({ ...memberMap, [name]: e.target.value })}
              >
                <option value="">Select a group member…</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button disabled={unmapped.length > 0 || submitting} className="w-full" onClick={handleCommit}>
            {submitting ? 'Importing…' : 'Import'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import from Splitwise</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handlePreview} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="csv">Upload the CSV export from your Splitwise group</Label>
            <input
              id="csv"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            {fileName && <p className="text-xs text-muted-foreground">Selected: {fileName}</p>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting || !csv} className="w-full">
            {submitting ? 'Reading…' : 'Preview'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
