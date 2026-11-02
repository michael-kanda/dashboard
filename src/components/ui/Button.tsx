import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'tonal' | 'plain' | 'destructive' | 'destructive-solid' | 'secondary';
export type ButtonSize = 'sm' | 'md';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent-solid text-white hover:opacity-90',
  tonal: 'bg-accent-tint text-accent hover:bg-accent-tint/80',
  plain: 'bg-transparent text-accent hover:bg-fill',
  secondary: 'bg-fill text-heading hover:bg-surface-quaternary',
  destructive: 'bg-transparent text-danger hover:bg-danger-bg',
  'destructive-solid': 'bg-danger-solid text-white hover:opacity-90',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-9 px-3.5 text-[13px]',
};

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = '') {
  return `inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-semibold
    transition-[background-color,color,opacity] duration-150 ease-out
    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
    disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = 'tonal',
  size = 'sm',
  className = '',
  children,
  ...rest
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  target?: string;
  rel?: string;
  'aria-label'?: string;
}) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

// 36 × 36, Beschriftung zwingend über aria-label.
export function IconButton({
  label,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-control text-muted transition-colors duration-150 ease-out hover:bg-fill hover:text-heading focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
