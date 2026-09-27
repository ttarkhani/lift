import Link from "next/link";
import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary" | "danger" | "quiet";

const variants: Record<Variant, string> = {
  primary: "border-stamp bg-stamp text-paper hover:bg-ink hover:border-ink",
  secondary: "border-stamp bg-paper text-stamp hover:bg-ground",
  danger: "border-alert bg-paper text-alert hover:bg-alert-wash",
  quiet: "border-transparent bg-transparent text-stamp underline underline-offset-4 hover:text-ink",
};

type Common = {
  variant?: Variant;
  /** Full width on phones, natural width from 640px. */
  block?: boolean;
  className?: string;
  children: React.ReactNode;
};

type AsButton = Common &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type AsLink = Common & { href: string };

export function buttonClasses({ variant = "primary", block, className }: Omit<Common, "children">) {
  return cx(
    "inline-flex min-h-tap items-center justify-center gap-2 rounded-md border-2 px-5 text-base font-bold transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-60",
    variants[variant],
    block && "w-full sm:w-auto",
    className,
  );
}

export function Button(props: AsButton | AsLink) {
  if (props.href !== undefined) {
    const { href, variant, block, className, children } = props;
    return (
      <Link href={href} className={buttonClasses({ variant, block, className })}>
        {children}
      </Link>
    );
  }
  const { variant, block, className, children, type = "button", ...rest } = props;
  return (
    <button type={type} className={buttonClasses({ variant, block, className })} {...rest}>
      {children}
    </button>
  );
}
