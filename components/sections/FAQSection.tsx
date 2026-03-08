import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { FAQItem } from "@/types/content";
import styles from "@/components/sections/FAQSection.module.scss";

interface FAQSectionProps {
  items: FAQItem[];
}

export function FAQSection({ items }: FAQSectionProps) {
  return (
    <section className={styles.section}>
      <Container>
        <SectionTitle
          centered
          description="Короткие ответы на вопросы, которые чаще всего возникают перед стартом поставки."
          eyebrow="FAQ"
          title="Частые вопросы"
        />

        <div className={styles.list}>
          {items.map((item, index) => (
            <Reveal delay={index * 60} key={item.question}>
              <details className={styles.item}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
