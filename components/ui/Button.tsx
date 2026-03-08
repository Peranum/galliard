import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "@/components/ui/Button.module.scss";

type ButtonVariant = "primary" | "secondary";
type ButtonSize = "md" | "lg";

interface SharedProps {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

interface LinkButtonProps extends SharedProps {
  href: string;
  target?: string;
  rel?: string;
}

type NativeButtonProps = SharedProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type ButtonProps = LinkButtonProps | NativeButtonProps;

function getClassName(variant: ButtonVariant, size: ButtonSize, className?: string) {
  const classNames = [styles.button, styles[variant], styles[size]];

  if (className) {
    classNames.push(className);
  }

  return classNames.join(" ");
}

export function Button(props: ButtonProps) {
  const variant = props.variant ?? "primary";
  const size = props.size ?? "md";

  if ("href" in props && props.href) {
    const { href, target, rel, children, className } = props;

    return (
      <Link
        className={getClassName(variant, size, className)}
        href={href}
        target={target}
        rel={rel}
      >
        {children}
      </Link>
    );
  }

  const { className, children, type, ...buttonProps } = props as NativeButtonProps;

  return (
    <button
      className={getClassName(variant, size, className)}
      type={type ?? "button"}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
