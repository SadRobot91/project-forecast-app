import { useEffect, useState } from 'react';
import type { Decision, Risk, SlippageEvent, Retrospective } from '../types';
import { getDecisions, getRisks, getSlippageEvents, getRetrospectives } from '../api/knowledge';
import { fmtDate } from '../utils/dates';

// ─── Timeline item union ──────────────────────

type MemoryItemKind = 'decision' | 'risk' | 'slippage' | 'retrospective';

interface BaseItem {
  kind: MemoryItemKind;
  sortKey: string;
}

interface DecisionItem extends BaseItem { kind: 'decision'; data: Decision }
interface RiskItem     extends BaseItem { kind: 'risk';     data: Risk;     linkedDecisionTitle?: string }
interface SlippageItem extends BaseItem { kind: 'slippage'; data: SlippageEvent }
interface RetroItem    extends BaseItem { kind: 'retrospective'; data: Retrospective }

type MemoryItem = DecisionItem | RiskItem | SlippageItem | RetroItem;

// ─── Kind configs ─────────────────────────────

const KIND_CONFIG: Record<MemoryItemKind, { label: string; dot: string; border: string }> = {
  decision:      { label: 'Decisione',    dot: 'bg-accent',        border: 'border-accent/30' },
  risk:          { label: 'Rischio',      dot: 'bg-rag-yellow',    border: 'border-rag-yellow/30' },
  slippage:      { label: 'Slippage',     dot: 'bg-rag-red',       border: 'border-rag-red/30' },
  retrospective: { label: 'Retrospettiva', dot: 'bg-accent-cyan',  border: 'border-accent-cyan/30' },
};

// ─── Item renderers ───────────────────────────

function DecisionCard({ item }: { item: DecisionItem }) {
  return (
    <div>
      <p className="font-medium text-text-primary text-sm">{item.data.title}</p>
      {item.data.rationale && (
        <p className="text-text-muted text-xs mt-1">{item.data.rationale}</p>
      )}
      {item.data.expected_consequence && (
        <p className="text-text-dim text-xs mt-1 italic">Conseguenza attesa: {item.data.expected_consequence}</p>
      )}
    </div>
  );
}

function RiskCard({ item }: { item: RiskItem }) {
  return (
    <div>
      <p className="text-text-primary text-sm">{item.data.description}</p>
      <div className="flex flex-wrap gap-2 mt-1">
        {item.data.category && (
          <span className="text-xs border border-border rounded-full px-2 py-0.5 text-text-muted">
            {item.data.category}
          </span>
        )}
        {item.linkedDecisionTitle && (
          <span className="text-xs text-accent/80">
            Decisione correlata: {item.linkedDecisionTitle}
          </span>
        )}
      </div>
    </div>
  );
}

function SlippageCard({ item }: { item: SlippageItem }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`text-xs rounded-full border px-2 py-0.5 ${item.data.expected ? 'border-rag-yellow/40 text-rag-yellow' : 'border-rag-red/40 text-rag-red'}`}>
          {item.data.expected ? 'Atteso' : 'Inatteso'}
        </span>
      </div>
      {item.data.cause && (
        <p className="text-text-muted text-xs mt-1">{item.data.cause}</p>
      )}
    </div>
  );
}

function RetroCard({ item }: { item: RetroItem }) {
  return (
    <div>
      {item.data.question && (
        <p className="text-text-muted text-xs mb-1 italic">{item.data.question}</p>
      )}
      {item.data.answer && (
        <p className="text-text-primary text-sm">{item.data.answer}</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────

interface ProjectMemoryTabProps {
  projectId: number;
}

export default function ProjectMemoryTab({ projectId }: ProjectMemoryTabProps) {
  const [items, setItems]   = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getDecisions(projectId),
      getRisks(projectId),
      getSlippageEvents(projectId),
      getRetrospectives(projectId),
    ])
      .then(([decisions, risks, slippage, retrospectives]) => {
        if (cancelled) return;

        const decisionMap = new Map<number, string>(
          decisions.map(d => [d.id, d.title]),
        );

        const merged: MemoryItem[] = [
          ...decisions.map<DecisionItem>(d => ({
            kind: 'decision',
            sortKey: d.decided_at,
            data: d,
          })),
          ...risks.map<RiskItem>(r => ({
            kind: 'risk',
            sortKey: r.identified_at,
            data: r,
            linkedDecisionTitle: r.decision_id != null
              ? (decisionMap.get(r.decision_id) ?? r.decision_title ?? undefined)
              : undefined,
          })),
          ...slippage.map<SlippageItem>(s => ({
            kind: 'slippage',
            sortKey: s.recorded_at,
            data: s,
          })),
          ...retrospectives.map<RetroItem>(r => ({
            kind: 'retrospective',
            sortKey: r.created_at,
            data: r,
          })),
        ];

        merged.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
        setItems(merged);
      })
      .catch(() => {
        if (!cancelled) setError('Impossibile caricare la memoria del progetto.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [projectId]);

  if (loading) {
    return (
      <div className="py-8 text-center">
        <p className="text-text-muted text-sm animate-pulse">Caricamento memoria progetto…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-rag-red text-sm">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center space-y-2">
        <p className="text-text-muted text-sm">Nessun elemento registrato nella memoria del progetto.</p>
        <p className="text-text-dim text-xs">Aggiungi decisioni, rischi, slippage o retrospettive dalla sezione Knowledge.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-4 space-y-0">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" aria-hidden="true" />
      {items.map((item) => {
        const cfg = KIND_CONFIG[item.kind];
        const dateStr = fmtDate(item.sortKey);
        return (
          <div key={`${item.kind}-${item.data.id}`} className="relative flex gap-4 pb-6">
            <div className={`relative z-10 mt-1 w-3 h-3 rounded-full flex-shrink-0 border-2 border-base ${cfg.dot}`} />
            <div className={`flex-1 bg-surface border ${cfg.border} rounded-xl p-4 shadow-card`}>
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {cfg.label}
                </span>
                <span className="text-xs text-text-dim flex-shrink-0">{dateStr}</span>
              </div>
              {item.kind === 'decision'      && <DecisionCard item={item} />}
              {item.kind === 'risk'          && <RiskCard     item={item} />}
              {item.kind === 'slippage'      && <SlippageCard item={item} />}
              {item.kind === 'retrospective' && <RetroCard    item={item} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
