import { Loader2 } from 'lucide-react';

export default function Spinner({ label = 'Loading…', size = 18 }) {
  return (
    <div className="flex items-center justify-center gap-2 p-6 text-slate-500" data-testid="spinner">
      <Loader2 size={size} className="animate-spin text-blue-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
