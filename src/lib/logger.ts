import { Axiom } from '@axiomhq/js';

const axiom = process.env.AXIOM_API_TOKEN
  ? new Axiom({ token: process.env.AXIOM_API_TOKEN })
  : null;

const dataset = process.env.AXIOM_DATASET ?? 'tasktree-logs';

export interface AccessLogEntry {
  type: 'access';
  method: string;
  path: string;
  status: number;
  account_id?: string;
  user_id?: string;
  ip?: string;
  duration_ms: number;
}

export interface ErrorLogEntry {
  type: 'error';
  method: string;
  path: string;
  account_id?: string;
  user_id?: string;
  ip?: string;
  message: string;
}

type LogEntry = AccessLogEntry | ErrorLogEntry;

export function log(entry: LogEntry): void {
  if (!axiom) return;
  axiom.ingest(dataset, [{ ...entry, _time: new Date().toISOString() }]);
  // flush is best-effort — don't await in the hot path
  axiom.flush().catch(() => {});
}
