import { useRef } from 'react';
import type { MouseEvent } from 'react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  title?: string;
  onClick?: (e: MouseEvent<HTMLInputElement>) => void;
}

export default function DateInput({ value, onChange, disabled, min, max, className = '', title, onClick }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <input
      ref={ref}
      type="date"
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      title={title}
      onChange={(e) => onChange(e.target.value)}
      onClick={onClick}
      onDoubleClick={() => ref.current?.blur()}
      className={className}
    />
  );
}
