import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  checkboxLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  title,
  description,
  checkboxLabel,
  confirmLabel,
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="rounded-lg p-6 w-full max-w-md mx-4 animate-fade-in"
        style={{
          background: 'var(--color-surface-container-low)',
          border: '1px solid var(--color-surface-border-default)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} style={{ color: 'var(--color-brand-yellow)' }} />
            <h3 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
              {title}
            </h3>
          </div>
          <button onClick={onCancel} className="p-1 rounded-md transition-colors cursor-pointer" style={{ color: 'var(--color-text-tertiary)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)', lineHeight: '20px' }}>
          {description}
        </p>

        {/* Checkbox */}
        <label className="flex items-start gap-2 mb-6 cursor-pointer">
          <input
            type="checkbox"
            id="modal-ack-checkbox"
            className="mt-0.5 accent-yellow-500"
            onChange={() => {}}
          />
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)', lineHeight: '16px' }}>
            {checkboxLabel}
          </span>
        </label>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm transition-colors cursor-pointer"
            style={{
              background: 'var(--color-surface-container-med)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-surface-border-default)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 rounded-md text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            style={{
              background: 'var(--color-brand-yellow)',
              color: 'var(--color-surface-base)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
