type GoogleCleanUnderlineProps = {
  id: string;
};

export default function GoogleCleanUnderline({ id }: GoogleCleanUnderlineProps) {
  return (
    <div className="mt-1 h-[12px] max-w-[220px]" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 12" width="100%" height="12">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--dp-chart-1)" />
            <stop offset="25%" stopColor="var(--dp-chart-1)" />
            <stop offset="25%" stopColor="var(--dp-chart-4)" />
            <stop offset="50%" stopColor="var(--dp-chart-4)" />
            <stop offset="50%" stopColor="var(--dp-chart-3)" />
            <stop offset="75%" stopColor="var(--dp-chart-3)" />
            <stop offset="75%" stopColor="var(--dp-chart-2)" />
            <stop offset="100%" stopColor="var(--dp-chart-2)" />
          </linearGradient>
        </defs>
        <rect width="100%" height="12" rx="6" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}
