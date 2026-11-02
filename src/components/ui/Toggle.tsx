'use client';

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[22px] w-[38px] flex-shrink-0 items-center rounded-full transition-colors duration-150 ease-out
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50
        ${checked ? 'bg-success-bar' : 'bg-fill'}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-segment transition-transform duration-150 ease-out ${checked ? 'translate-x-[18px]' : 'translate-x-[2px]'}`}
      />
    </button>
  );
}
