import { ElementType, ReactNode } from "react";
import styles from "@/components/ui/Container.module.scss";

interface ContainerProps {
  as?: ElementType;
  className?: string;
  size?: "default" | "wide";
  children: ReactNode;
}

export function Container({ as: Tag = "div", className, size = "default", children }: ContainerProps) {
  const baseClass = size === "wide" ? styles.wideContainer : styles.container;
  const classNames = className ? `${baseClass} ${className}` : baseClass;

  return <Tag className={classNames}>{children}</Tag>;
}
