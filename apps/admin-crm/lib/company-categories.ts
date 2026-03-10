export type CompanySubcategoryOption = {
  value: string;
  label: string;
};

export type CompanyCategoryOption = {
  value: string;
  label: string;
  subcategories: CompanySubcategoryOption[];
};

export const companyCategoryOptions: CompanyCategoryOption[] = [
  {
    value: "CHEMICALS",
    label: "Химическая промышленность",
    subcategories: [
      { value: "BASIC_CHEMICALS", label: "Базовая химия" },
      { value: "POLYMERS", label: "Полимеры и пластики" },
      { value: "PAINTS_COATINGS", label: "ЛКМ и покрытия" },
      { value: "HOUSEHOLD_CHEMICALS", label: "Бытовая химия" }
    ]
  },
  {
    value: "TEXTILE",
    label: "Текстиль",
    subcategories: [
      { value: "FABRICS", label: "Ткани и пряжа" },
      { value: "GARMENTS", label: "Одежда и швейка" },
      { value: "TECHNICAL_TEXTILES", label: "Технический текстиль" },
      { value: "HOME_TEXTILES", label: "Домашний текстиль" }
    ]
  },
  {
    value: "FOOD_BEVERAGE",
    label: "Пищевая промышленность",
    subcategories: [
      { value: "FOOD_PRODUCTION", label: "Производство продуктов" },
      { value: "BEVERAGES", label: "Напитки" },
      { value: "PACKED_FOOD", label: "Фасованная продукция" }
    ]
  },
  {
    value: "WOOD_FURNITURE",
    label: "Дерево и мебель",
    subcategories: [
      { value: "WOOD_PROCESSING", label: "Деревообработка" },
      { value: "FURNITURE_MANUFACTURING", label: "Производство мебели" },
      { value: "INTERIOR_COMPONENTS", label: "Интерьерные компоненты" }
    ]
  },
  {
    value: "METALWORKING",
    label: "Металлообработка",
    subcategories: [
      { value: "CNC_MACHINING", label: "Механообработка / CNC" },
      { value: "SHEET_METAL", label: "Листовой металл" },
      { value: "WELDING_ASSEMBLY", label: "Сварка и сборка" }
    ]
  },
  {
    value: "CONSTRUCTION_MATERIALS",
    label: "Стройматериалы",
    subcategories: [
      { value: "DRY_MIXES", label: "Сухие смеси" },
      { value: "INSULATION", label: "Утеплители" },
      { value: "FINISHING_MATERIALS", label: "Отделочные материалы" }
    ]
  },
  {
    value: "MACHINERY_EQUIPMENT",
    label: "Машиностроение и оборудование",
    subcategories: [
      { value: "INDUSTRIAL_EQUIPMENT", label: "Промышленное оборудование" },
      { value: "COMPONENTS", label: "Комплектующие" },
      { value: "SERVICE_MAINTENANCE", label: "Сервис и обслуживание" }
    ]
  },
  {
    value: "ELECTRONICS_ELECTRICAL",
    label: "Электроника и электротехника",
    subcategories: [
      { value: "ELECTRONIC_COMPONENTS", label: "Электронные компоненты" },
      { value: "CABLE_PRODUCTS", label: "Кабельная продукция" },
      { value: "POWER_EQUIPMENT", label: "Силовое оборудование" }
    ]
  },
  {
    value: "PACKAGING",
    label: "Упаковка",
    subcategories: [
      { value: "PAPER_PACKAGING", label: "Бумажная упаковка" },
      { value: "PLASTIC_PACKAGING", label: "Пластиковая упаковка" },
      { value: "LABELING", label: "Этикетка и маркировка" }
    ]
  },
  {
    value: "LOGISTICS_ECOM",
    label: "Логистика и e-commerce",
    subcategories: [
      { value: "DISTRIBUTION", label: "Дистрибуция" },
      { value: "WAREHOUSING", label: "Складская логистика" },
      { value: "ONLINE_RETAIL", label: "Онлайн-ритейл" }
    ]
  },
  {
    value: "OTHER",
    label: "Другое",
    subcategories: [
      { value: "OTHER", label: "Без подкатегории" }
    ]
  }
];

export function companyCategoryLabel(value: string): string {
  const normalized = value.toUpperCase();
  return companyCategoryOptions.find((item) => item.value === normalized)?.label ?? "Другое";
}

export function companySubcategoryOptions(category: string): CompanySubcategoryOption[] {
  const normalized = category.toUpperCase();
  return companyCategoryOptions.find((item) => item.value === normalized)?.subcategories ?? [];
}

export function companySubcategoryLabel(category: string, subcategory: string): string {
  const normalized = subcategory.toUpperCase();
  if (!normalized) {
    return "";
  }
  return companySubcategoryOptions(category).find((item) => item.value === normalized)?.label ?? subcategory;
}
