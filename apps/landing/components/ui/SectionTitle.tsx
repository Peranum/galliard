import styles from "@/components/ui/SectionTitle.module.scss";

interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  description?: string;
  centered?: boolean;
}

export function SectionTitle({ eyebrow, title, description, centered = false }: SectionTitleProps) {
  const alignClass = centered ? styles.centered : "";
  const className = alignClass ? `${styles.wrapper} ${alignClass}` : styles.wrapper;

  return (
    <header className={className}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h2 className={styles.title}>{title}</h2>
      {description ? <p className={styles.description}>{description}</p> : null}
    </header>
  );
}
