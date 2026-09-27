// Small inline icons drawn at the current text size, in currentColor.

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

export function CircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="5.5" />
    </Svg>
  );
}

export function HalfCircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
    </Svg>
  );
}

export function HourglassIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 2.5h8M4 13.5h8M5 2.5c0 3 6 3.5 6 5.5s-6 2.5-6 5.5M11 2.5c0 3-6 3.5-6 5.5s6 2.5 6 5.5" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 8.5l3.2 3L13 4.5" />
    </Svg>
  );
}

export function FlagIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 14V2.5M3.5 3h8l-2 3 2 3h-8" />
    </Svg>
  );
}

export function ReverseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 3v3.5h3.5M3.4 6.5A5 5 0 1 1 3.5 10" />
    </Svg>
  );
}

export function DiamondIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 2l6 6-6 6-6-6z" />
    </Svg>
  );
}

export function LiftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 13.5V3M3.5 7.5L8 3l4.5 4.5" />
    </Svg>
  );
}
