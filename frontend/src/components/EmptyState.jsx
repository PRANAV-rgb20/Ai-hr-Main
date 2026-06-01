import { Inbox } from 'lucide-react';

export default function EmptyState({ title = 'Nothing here yet', description, icon: Icon = Inbox, action }) {
  return (
    <div
      className="flex flex-col items-center justify-center p-10 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50"
      data-testid="empty-state"
    >
      <Icon className="h-10 w-10 text-slate-400 mb-3" />
      <p className="text-sm font-medium text-slate-900 mb-1">{title}</p>
      {description && <p className="text-sm text-slate-500 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
