import { useEffect, useState } from 'react';
import { Heart, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSentimentPulse } from '../../api/ai';
import EmptyState from '../../components/EmptyState';

// ── colour maps ───────────────────────────────────────────────────────────────

const CELL_BG = {
  positive: 'bg-green-400',
  neutral:  'bg-yellow-300',
  negative: 'bg-orange-400',
  burnout:  'bg-red-500',
};

const CELL_TEXT = {
  positive: 'text-white',
  neutral:  'text-slate-800',
  negative: 'text-white',
  burnout:  'text-white',
};

const LEGEND = [
  { label: 'Positive', cls: 'bg-green-400'  },
  { label: 'Neutral',  cls: 'bg-yellow-300' },
  { label: 'Negative', cls: 'bg-orange-400' },
  { label: 'Burnout',  cls: 'bg-red-500'    },
];

// ── summary helpers ───────────────────────────────────────────────────────────

function thisWeekNum() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
}

// ── skeleton ──────────────────────────────────────────────────────────────────

function HeatmapSkeleton() {
  return (
    <div className="overflow-x-auto">
      <div className="space-y-2 min-w-[480px]">
        {[1, 2, 3].map((r) => (
          <div key={r} className="flex gap-2">
            <div className="w-32 h-14 bg-slate-100 rounded animate-pulse" />
            {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
              <div key={c} className="h-14 w-14 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function SentimentPulse() {
  const [pulse, setPulse]     = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getSentimentPulse();
      setPulse(data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load sentiment data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── derive unique departments + ordered weeks from data ──
  const departments = [...new Set(pulse.map((p) => p.department_name))].sort();

  // Build ordered week list (unique, sorted by year then week)
  const weekSet = new Map();
  pulse.forEach((p) => {
    const key = `${p.year}-${String(p.week_number).padStart(2, '0')}`;
    if (!weekSet.has(key)) weekSet.set(key, { week_number: p.week_number, year: p.year });
  });
  const orderedWeeks = [...weekSet.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);

  // Build lookup: dept → week_key → cell data
  const cellMap: Record<string, Record<string, typeof pulse[0]>> = {};
  pulse.forEach((p) => {
    const wk = `${p.year}-${String(p.week_number).padStart(2, '0')}`;
    if (!cellMap[p.department_name]) cellMap[p.department_name] = {};
    cellMap[p.department_name][wk] = p;
  });

  // ── summary stats (current week) ──
  const cwk = thisWeekNum();
  const thisWeekData = pulse.filter((p) => p.week_number === cwk);
  const totalCheckins = thisWeekData.reduce((s, p) => s + p.response_count, 0);
  const avgSentiment = thisWeekData.length
    ? (thisWeekData.reduce((s, p) => s + p.avg_sentiment, 0) / thisWeekData.length).toFixed(2)
    : 'N/A';
  const labels = thisWeekData.map((p) => p.label);
  const mostCommon = labels.length
    ? [...labels].sort((a, b) =>
        labels.filter((v) => v === b).length - labels.filter((v) => v === a).length
      )[0]
    : null;

  return (
    <div className="space-y-5" data-testid="sentiment-pulse-page">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">AI Tools</p>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
            Sentiment Pulse
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Weekly wellbeing heatmap across departments — powered by Gemini sentiment analysis.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Avg Sentiment (this week)</p>
          <p className={`text-3xl font-semibold mt-2 ${
            avgSentiment === 'N/A' ? 'text-slate-400' :
            Number(avgSentiment) >= 0.3 ? 'text-green-600' :
            Number(avgSentiment) >= -0.2 ? 'text-yellow-600' : 'text-red-600'
          }`} style={{ fontFamily: 'Outfit' }}>{avgSentiment}</p>
          <p className="text-[11px] text-slate-400 mt-1">Range: −1.0 to +1.0</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Dominant Mood</p>
          {mostCommon ? (
            <span className={`mt-2 inline-flex items-center text-sm font-semibold px-3 py-1 rounded-full
              ${mostCommon === 'positive' ? 'bg-green-100 text-green-800' :
                mostCommon === 'neutral'  ? 'bg-yellow-100 text-yellow-800' :
                mostCommon === 'negative' ? 'bg-orange-100 text-orange-800' :
                                            'bg-red-100 text-red-800'}`}>
              {mostCommon}
            </span>
          ) : (
            <p className="text-slate-400 text-sm mt-2">No data this week</p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Check-ins This Week</p>
          <p className="text-3xl font-semibold text-slate-900 mt-2" style={{ fontFamily: 'Outfit' }}>
            {totalCheckins}
          </p>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Heatmap</p>
        <h3 className="text-lg font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Outfit' }}>
          Department sentiment · last 8 weeks
        </h3>

        {loading ? (
          <HeatmapSkeleton />
        ) : departments.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No check-ins yet"
            description="Sentiment data will appear here once employees start submitting weekly check-ins."
          />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[520px]">
              {/* Column headers */}
              <div className="flex gap-2 mb-2 ml-[136px]">
                {orderedWeeks.map((w) => (
                  <div
                    key={`${w.year}-${w.week_number}`}
                    className="w-14 text-center text-[11px] text-slate-500 font-semibold uppercase tracking-wider"
                  >
                    Wk {w.week_number}
                  </div>
                ))}
              </div>

              {/* Rows */}
              <div className="space-y-2">
                {departments.map((dept) => (
                  <div key={dept} className="flex items-center gap-2">
                    {/* Department label */}
                    <div className="w-32 shrink-0 text-xs font-medium text-slate-700 truncate text-right pr-2">
                      {dept}
                    </div>

                    {/* Cells */}
                    {orderedWeeks.map((w) => {
                      const wk = `${w.year}-${String(w.week_number).padStart(2, '0')}`;
                      const cell = cellMap[dept]?.[wk];
                      const bgCls = cell ? CELL_BG[cell.label] ?? 'bg-slate-200' : '';
                      const txtCls = cell ? CELL_TEXT[cell.label] ?? 'text-slate-700' : '';
                      const tooltip = cell
                        ? `Avg: ${cell.avg_sentiment} | ${cell.response_count} responses\nThemes: ${cell.key_themes?.join(', ') || '—'}`
                        : 'No data';

                      return (
                        <div
                          key={wk}
                          title={tooltip}
                          className={`h-14 w-14 shrink-0 rounded-lg flex items-center justify-center transition-all
                            ${cell
                              ? `${bgCls} hover:opacity-90 hover:scale-105 cursor-default`
                              : 'bg-slate-100 border border-slate-200'
                            }`}
                        >
                          {cell ? (
                            <span className={`text-xs font-semibold ${txtCls}`}>
                              {cell.response_count}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-5 flex-wrap">
                {LEGEND.map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className={`h-3 w-3 rounded-sm ${l.cls}`} />
                    <span className="text-xs text-slate-600">{l.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-sm bg-slate-100 border border-slate-200" />
                  <span className="text-xs text-slate-600">No data</span>
                </div>
                <span className="text-[11px] text-slate-400 ml-2">Number inside = response count</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
