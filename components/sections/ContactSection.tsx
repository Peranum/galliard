import { ContactForm } from "@/components/forms/ContactForm";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { ContactsContent, IndustryItem } from "@/types/content";
import styles from "@/components/sections/ContactSection.module.scss";

interface ContactSectionProps {
  contacts: ContactsContent;
  industries: IndustryItem[];
}

export function ContactSection({ contacts, industries }: ContactSectionProps) {
  const mailtoHref = `mailto:${contacts.email}`;
  const telHref = `tel:${contacts.phone.replace(/[^+\d]/g, "")}`;

  return (
    <section className={styles.section} id="contacts">
      <Container>
        <div className={styles.grid}>
          <Reveal>
            <article className={styles.infoCard}>
              <p className={styles.eyebrow}>Контакты</p>
              <h2>Обсудим вашу задачу по поставке сырья</h2>
              <p className={styles.subtitle}>
                Опишите запрос в форме: отрасль, объемы и сроки. Мы подготовим первичную консультацию и предложим
                рабочий формат поставки.
              </p>

              <dl>
                <div>
                  <dt>Компания</dt>
                  <dd>{contacts.companyName}</dd>
                </div>
                <div>
                  <dt>Телефон</dt>
                  <dd>
                    <a href={telHref}>{contacts.phone}</a>
                  </dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={mailtoHref}>{contacts.email}</a>
                  </dd>
                </div>
                <div>
                  <dt>Адрес</dt>
                  <dd>{contacts.address}</dd>
                </div>
                <div>
                  <dt>Режим работы</dt>
                  <dd>{contacts.workHours}</dd>
                </div>
                <div>
                  <dt>Мессенджеры</dt>
                  <dd>{contacts.messengers}</dd>
                </div>
              </dl>
            </article>
          </Reveal>

          <Reveal delay={120}>
            <article className={styles.formCard}>
              <h3>Запросить консультацию</h3>
              <p>Ответим по вашему запросу и предложим следующий шаг по поставке.</p>
              <ContactForm industries={industries} />
            </article>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
