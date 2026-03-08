"use client";

import {
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  FileCheck,
  FileText,
  Headphones,
  Mail,
  Menu,
  Package,
  Phone,
  Search,
  Send,
  Shield,
  TrendingUp,
  Truck,
  Zap
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import styles from "@/components/soft-ui/SoftLanding.module.scss";
import { faqItems, seoExpanded, seoIntro } from "@/data/seo";

type ContactType = "call" | "telegram";

interface ServiceItem {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
}

interface AdvantageItem {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
}

interface ContactFormData {
  name: string;
  company: string;
  phone: string;
  email: string;
  message: string;
  contactType: ContactType;
}

const services: ServiceItem[] = [
  {
    icon: Search,
    title: "Поставки от лучших производителей",
    description:
      "Поставляем продукцию от проверенных поставщиков в Китае или подбираем под ваш запрос. Проверяем документы, репутацию и производственные мощности."
  },
  {
    icon: Shield,
    title: "Контроль качества",
    description:
      "Инспекция на производстве, проверка образцов, контроль соответствия спецификациям перед отгрузкой."
  },
  {
    icon: FileCheck,
    title: "Договорная работа",
    description:
      "Составление и согласование контрактов, защита ваших интересов, работа по требованиям РФ и РБ с учетом международных стандартов."
  },
  {
    icon: Truck,
    title: "Логистика",
    description:
      "Организация доставки морем, ж/д или автотранспортом. Оптимизация маршрутов и сроков поставки."
  },
  {
    icon: Package,
    title: "Таможенное оформление",
    description:
      "Полное сопровождение при прохождении таможни. Подготовка документов, декларирование, оплата пошлин."
  },
  {
    icon: TrendingUp,
    title: "Консалтинг",
    description:
      "Анализ рынка, подбор оптимальных условий поставки, консультации по сертификации и стандартам."
  }
];

const advantages: AdvantageItem[] = [
  {
    icon: DollarSign,
    title: "Прямые цены",
    description: "Работаем напрямую с производителями без посредников. Экономия до 30% на закупке."
  },
  {
    icon: Clock,
    title: "Сжатые сроки",
    description: "Сроки логистики рассчитываем конкретно под ваш запрос и формат поставки."
  },
  {
    icon: Shield,
    title: "Гарантия качества",
    description: "Многоступенчатый контроль: от выбора завода до инспекции перед отгрузкой."
  },
  {
    icon: Headphones,
    title: "Личный менеджер",
    description: "Закрепленный специалист на всех этапах. Всегда на связи и в курсе деталей."
  },
  {
    icon: FileText,
    title: "Прозрачность",
    description: "Полная отчетность по каждому этапу. Доступ к документам в режиме реального времени."
  },
  {
    icon: Zap,
    title: "Гибкость условий",
    description: "Индивидуальные решения под ваш бизнес. Подбираем оптимальную схему поставки."
  }
];

const benefitItems = [
  "Прямые контракты с заводами",
  "Контроль качества на производстве",
  "Полное таможенное сопровождение",
  'Логистика "под ключ"'
];

const INITIAL_FORM_DATA: ContactFormData = {
  name: "",
  company: "",
  phone: "",
  email: "",
  message: "",
  contactType: "call"
};

function scrollToSection(sectionId: string) {
  if (typeof window === "undefined") {
    return;
  }

  document.getElementById(sectionId)?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

export function SoftLanding() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isCloudEnabled, setIsCloudEnabled] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>(INITIAL_FORM_DATA);
  const cloudRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSubmitted) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setIsSubmitted(false);
      setFormData(INITIAL_FORM_DATA);
    }, 3000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isSubmitted]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updateCloudAvailability = () => {
      setIsCloudEnabled(mediaQuery.matches && !reducedMotionQuery.matches);
    };

    updateCloudAvailability();
    mediaQuery.addEventListener("change", updateCloudAvailability);
    reducedMotionQuery.addEventListener("change", updateCloudAvailability);

    return () => {
      mediaQuery.removeEventListener("change", updateCloudAvailability);
      reducedMotionQuery.removeEventListener("change", updateCloudAvailability);
    };
  }, []);

  useEffect(() => {
    if (!isCloudEnabled || !cloudRef.current || typeof window === "undefined") {
      return;
    }

    const cloud = cloudRef.current;
    const target = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    };
    const current = {
      x: target.x,
      y: target.y
    };

    let frameId = 0;

    const onPointerMove = (event: PointerEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;
    };

    const animate = () => {
      current.x += (target.x - current.x) * 0.16;
      current.y += (target.y - current.y) * 0.16;
      cloud.style.transform = `translate3d(${current.x}px, ${current.y}px, 0) translate(-50%, -50%)`;
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    window.addEventListener("pointermove", onPointerMove);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [isCloudEnabled]);

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Не удалось отправить заявку.");
      }

      setIsSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Не удалось отправить заявку.");
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const field = event.target.name as keyof ContactFormData;
    const value = event.target.value;

    setFormData((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const handleMenuClick = (targetId: string) => {
    scrollToSection(targetId);
    setIsMenuOpen(false);
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className={styles.page}>
      {isCloudEnabled && <div aria-hidden="true" className={styles.cursorCloud} ref={cloudRef} />}

      <a className={styles.skipLink} href="#main-content">
        Перейти к содержимому
      </a>

      <header className={styles.header}>
        <nav className={`${styles.card} ${styles.navCard}`}>
          <div className={styles.logoBlock}>
            <div className={styles.logoBadge}>
              <span className={styles.logoWordmark}>Галльярд</span>
            </div>
          </div>

          <div className={styles.desktopNav}>
            <button onClick={() => scrollToSection("services")} type="button">
              Услуги
            </button>
            <button onClick={() => scrollToSection("advantages")} type="button">
              Преимущества
            </button>
            <button onClick={() => scrollToSection("contact")} type="button">
              Контакты
            </button>
          </div>

          <button
            className={`${styles.button} ${styles.softRaised} ${styles.headerCta}`}
            onClick={() => scrollToSection("contact")}
            type="button"
          >
            <Phone className={styles.iconSmall} />
            Оставить заявку
          </button>

          <button
            aria-expanded={isMenuOpen}
            aria-label="Открыть меню"
            className={`${styles.button} ${styles.softRaised} ${styles.menuToggle}`}
            onClick={() => setIsMenuOpen((previous) => !previous)}
            type="button"
          >
            <Menu className={styles.iconSmall} />
          </button>
        </nav>

        {isMenuOpen && (
          <div className={`${styles.card} ${styles.mobileMenu}`}>
            <button onClick={() => handleMenuClick("services")} type="button">
              Услуги
            </button>
            <button onClick={() => handleMenuClick("advantages")} type="button">
              Преимущества
            </button>
            <button onClick={() => handleMenuClick("contact")} type="button">
              Контакты
            </button>
            <button
              className={`${styles.button} ${styles.softRaised}`}
              onClick={() => handleMenuClick("contact")}
              type="button"
            >
              <Phone className={styles.iconSmall} />
              Оставить заявку
            </button>
          </div>
        )}
      </header>

      <main id="main-content" className={styles.mainContent}>
        <section className={styles.heroSection}>
          <div className={styles.containerGridTwo}>
            <Reveal className={styles.heroTextBlock}>
              <h1>Импорт товаров и сырья из Китая в Беларусь</h1>
              <p>
                Работаем с проверенными производителями. Обеспечиваем полный цикл импорта: от поиска
                поставщика до доставки до вашего склада или производства.
              </p>

              <ul className={styles.benefitsList}>
                {benefitItems.map((item, index) => (
                  <Reveal className={styles.benefitItem} delay={120 + index * 80} key={item}>
                    <CheckCircle2 className={styles.iconCheck} />
                    <span>{item}</span>
                  </Reveal>
                ))}
              </ul>

              <button
                className={`${styles.button} ${styles.primaryButton}`}
                onClick={() => scrollToSection("contact")}
                type="button"
              >
                Оставить заявку на консультацию
                <ArrowRight className={styles.iconSmall} />
              </button>
            </Reveal>

            <Reveal className={`${styles.card} ${styles.heroImageCard}`} delay={240}>
              <img
                alt="Грузовой порт с контейнерами"
                className={styles.imageCover}
                loading="lazy"
                src="https://images.unsplash.com/photo-1735048002878-da85b65b96b3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaGlwcGluZyUyMGNvbnRhaW5lcnMlMjBjYXJnbyUyMHBvcnQlMjBjaGluYXxlbnwxfHx8fDE3NzI2MzkzNzB8MA&ixlib=rb-4.1.0&q=80&w=1080"
              />
            </Reveal>
          </div>
        </section>

        <section className={styles.section} id="services">
          <div className={styles.containerStack}>
            <Reveal className={styles.sectionHeading}>
              <h2>Наши услуги</h2>
              <p>
                Комплексное сопровождение импорта: от выбора поставщика до получения товара на вашем
                складе
              </p>
            </Reveal>

            <div className={styles.gridThree}>
              {services.map((service, index) => {
                const Icon = service.icon;
                return (
                  <Reveal className={`${styles.card} ${styles.infoCard}`} delay={index * 90} key={service.title}>
                    <div className={styles.iconBubble}>
                      <Icon className={styles.iconMedium} strokeWidth={1.6} />
                    </div>
                    <h3>{service.title}</h3>
                    <p>{service.description}</p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.section} id="advantages">
          <div className={styles.containerStack}>
            <Reveal className={styles.sectionHeading}>
              <h2>Почему выбирают нас</h2>
              <p>
                Системный подход, проверенные процессы и фокус на долгосрочных партнерских отношениях
              </p>
            </Reveal>

            <div className={`${styles.gridThree} ${styles.advantagesGrid}`}>
              {advantages.map((advantage, index) => {
                const Icon = advantage.icon;
                return (
                  <Reveal className={`${styles.card} ${styles.infoCard}`} delay={index * 90} key={advantage.title}>
                    <div className={styles.iconBubble}>
                      <Icon className={styles.iconMedium} strokeWidth={1.6} />
                      <span className={styles.iconDot} aria-hidden="true" />
                    </div>
                    <h3>{advantage.title}</h3>
                    <p>{advantage.description}</p>
                  </Reveal>
                );
              })}
            </div>

            <Reveal className={`${styles.card} ${styles.ctaCard}`}>
              <h3>Начните работу с надежным партнером</h3>
              <p>
                Оставьте заявку, и наш специалист свяжется с вами в течение часа для обсуждения деталей
              </p>
              <button
                className={`${styles.button} ${styles.primaryButton}`}
                onClick={() => scrollToSection("contact")}
                type="button"
              >
                Отправить заявку
              </button>
            </Reveal>
          </div>
        </section>

        <section className={styles.section} id="seo">
          <div className={styles.containerStack}>
            <Reveal className={styles.sectionHeading}>
              <h2>Ответы на частые вопросы</h2>
              <p>Коротко о том, как мы выстраиваем поставки и что входит в сопровождение.</p>
            </Reveal>

            <div className={styles.faqGrid}>
              {faqItems.map((item, index) => (
                <Reveal className={styles.faqItem} delay={index * 90} key={item.question}>
                  <details>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                </Reveal>
              ))}
            </div>

            <Reveal className={styles.seoCard} delay={120}>
              <h3>Импорт из Китая под ваш запрос</h3>
              <p>{seoIntro}</p>
              <details className={styles.seoDetails}>
                <summary>Читать полностью</summary>
                <p>{seoExpanded}</p>
              </details>
            </Reveal>
          </div>
        </section>

        <section className={styles.section} id="contact">
          <div className={styles.containerStack}>
            <Reveal className={styles.sectionHeading}>
              <h2>Оставить заявку</h2>
              <p>Оставьте заявку, и мы свяжемся с вами удобным для вас способом</p>
            </Reveal>

            <div className={styles.contactGrid}>
              <Reveal className={styles.contactInfoColumn}>
                <article className={`${styles.card} ${styles.contactInfoCard}`}>
                  <Phone className={styles.iconLarge} strokeWidth={1.6} />
                  <h4>Телефон</h4>
                  <a href="tel:+375291234567">+375 29 123-45-67</a>
                  <a href="tel:+375291234568">+375 29 123-45-68</a>
                </article>

                <article className={`${styles.card} ${styles.contactInfoCard}`}>
                  <Mail className={styles.iconLarge} strokeWidth={1.6} />
                  <h4>Email</h4>
                  <a href="mailto:info@galliard.by">info@galliard.by</a>
                </article>
              </Reveal>

              <Reveal className={styles.formColumn} delay={120}>
                <form className={`${styles.card} ${styles.formCard}`} onSubmit={handleFormSubmit}>
                  {isSubmitted ? (
                    <div className={styles.successState}>
                      <div className={styles.successIconWrap}>
                        <CheckCircle2 className={styles.iconLarge} />
                      </div>
                      <h3>Заявка отправлена!</h3>
                      <p>
                        {formData.contactType === "call"
                          ? "Мы позвоним вам в ближайшее время"
                          : "Мы напишем вам в Telegram в ближайшее время"}
                      </p>
                    </div>
                  ) : (
                    <>
                      {submitError && <p className={styles.formError}>{submitError}</p>}
                      <div className={styles.formGridTwo}>
                        <label className={styles.field} htmlFor="name">
                          Имя *
                          <input
                            className={styles.softInput}
                            id="name"
                            name="name"
                            onChange={handleInputChange}
                            placeholder="Иван Иванов"
                            required
                            type="text"
                            value={formData.name}
                          />
                        </label>

                        <label className={styles.field} htmlFor="company">
                          Компания *
                          <input
                            className={styles.softInput}
                            id="company"
                            name="company"
                            onChange={handleInputChange}
                            placeholder="ООО Компания"
                            required
                            type="text"
                            value={formData.company}
                          />
                        </label>
                      </div>

                      <fieldset className={styles.contactTypeFieldset}>
                        <legend>Предпочтительный способ связи *</legend>
                        <label className={styles.radioCard} htmlFor="contact-call">
                          <input
                            checked={formData.contactType === "call"}
                            id="contact-call"
                            name="contactType"
                            onChange={() => setFormData((previous) => ({ ...previous, contactType: "call" }))}
                            type="radio"
                            value="call"
                          />
                          <span className={styles.radioVisual} aria-hidden="true" />
                          <span className={styles.radioText}>
                            <Phone className={styles.iconSmall} />
                            Звонок
                          </span>
                        </label>

                        <label className={styles.radioCard} htmlFor="contact-telegram">
                          <input
                            checked={formData.contactType === "telegram"}
                            id="contact-telegram"
                            name="contactType"
                            onChange={() => setFormData((previous) => ({ ...previous, contactType: "telegram" }))}
                            type="radio"
                            value="telegram"
                          />
                          <span className={styles.radioVisual} aria-hidden="true" />
                          <span className={styles.radioText}>
                            <Send className={styles.iconSmall} />
                            Telegram
                          </span>
                        </label>
                      </fieldset>

                      <div className={styles.formGridTwo}>
                        <label className={styles.field} htmlFor="phone">
                          Телефон *
                          <input
                            className={styles.softInput}
                            id="phone"
                            name="phone"
                            onChange={handleInputChange}
                            placeholder="+375 29 123-45-67"
                            required
                            type="tel"
                            value={formData.phone}
                          />
                        </label>

                        <label className={styles.field} htmlFor="email">
                          Email
                          <input
                            className={styles.softInput}
                            id="email"
                            name="email"
                            onChange={handleInputChange}
                            placeholder="email@company.by"
                            type="email"
                            value={formData.email}
                          />
                        </label>
                      </div>

                      <label className={styles.field} htmlFor="message">
                        Ваша задача *
                        <textarea
                          className={styles.softInput}
                          id="message"
                          name="message"
                          onChange={handleInputChange}
                          placeholder="Опишите, что вам нужно импортировать, какие объемы и другие важные детали..."
                          required
                          rows={6}
                          value={formData.message}
                        />
                      </label>

                      <button className={`${styles.button} ${styles.primaryButton}`} type="submit">
                        Отправить заявку
                        <Send className={styles.iconSmall} />
                      </button>
                    </>
                  )}
                </form>
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.containerStack}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <div className={styles.logoBlock}>
                <div className={styles.logoBadge}>
                  <span className={styles.logoWordmark}>Галльярд</span>
                </div>
              </div>
              <p className={styles.footerDescription}>
                Прямые поставки промышленного сырья и материалов из Китая в Беларусь. Надежный
                партнер вашего бизнеса с 2011 года.
              </p>
            </div>

            <div>
              <h4>Навигация</h4>
              <div className={styles.footerLinks}>
                <button onClick={() => scrollToSection("services")} type="button">
                  Услуги
                </button>
                <button onClick={() => scrollToSection("advantages")} type="button">
                  Преимущества
                </button>
                <button onClick={() => scrollToSection("contact")} type="button">
                  Контакты
                </button>
              </div>
            </div>

            <div>
              <h4>Контакты</h4>
              <div className={styles.footerLinks}>
                <a href="tel:+375291234567">
                  <Phone className={styles.iconSmall} />
                  +375 29 123-45-67
                </a>
                <a href="mailto:info@galliard.by">
                  <Mail className={styles.iconSmall} />
                  info@galliard.by
                </a>
              </div>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <p>© {currentYear} Галльярд. Все права защищены.</p>
            <div className={styles.footerPolicyLinks}>
              <button type="button">Политика конфиденциальности</button>
              <button type="button">Условия использования</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
