import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { ProcessStep } from "@/types/content";
import styles from "@/components/sections/ProcessSection.module.scss";

interface ProcessSectionProps {
  steps: ProcessStep[];
}

export function ProcessSection({ steps }: ProcessSectionProps) {
  return (
    <section className={styles.section} id="process">
      <Container>
        <SectionTitle
          centered
          description="Прозрачный и контролируемый процесс поставки: вы заранее понимаете этапы, риски и контрольные точки."
          eyebrow="Процесс"
          title="Как мы работаем"
        />

        <ol className={styles.timeline}>
          {steps.map((step, index) => (
            <Reveal delay={index * 80} key={step.title}>
              <li className={styles.item}>
                <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
