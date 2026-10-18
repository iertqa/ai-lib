export type Field = { key: string; label: string; json?: boolean; long?: boolean };

export const TABLE_LABELS: Record<string, string> = {
  products: "Products",
  materials: "Materials",
  machines: "Machines",
  processes: "Processes",
  suppliers: "Suppliers",
  cultural_references: "Cultural references",
  projects: "Projects",
};

export const FIELDS: Record<string, Field[]> = {
  suppliers: [
    { key: "name_en", label: "Name (English)" },
    { key: "name_ar", label: "Name (Arabic)" },
    { key: "contact_name", label: "Contact name" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "notes", label: "Notes", long: true },
  ],
  materials: [
    { key: "name_en", label: "Name (English)" },
    { key: "name_ar", label: "Name (Arabic)" },
    { key: "category", label: "Category" },
    { key: "specs", label: "Specs (JSON)", json: true, long: true },
    { key: "unit", label: "Unit" },
    { key: "description", label: "Description", long: true },
  ],
  machines: [
    { key: "name_en", label: "Name (English)" },
    { key: "name_ar", label: "Name (Arabic)" },
    { key: "machine_type", label: "Type" },
    { key: "capabilities", label: "Capabilities (JSON)", json: true, long: true },
    { key: "max_dimensions", label: "Max dimensions" },
    { key: "description", label: "Description", long: true },
  ],
  processes: [
    { key: "name_en", label: "Name (English)" },
    { key: "name_ar", label: "Name (Arabic)" },
    { key: "steps", label: "Steps", long: true },
    { key: "description", label: "Description", long: true },
  ],
  products: [
    { key: "name_en", label: "Name (English)" },
    { key: "name_ar", label: "Name (Arabic)" },
    { key: "category", label: "Category" },
    { key: "description", label: "Description", long: true },
  ],
  cultural_references: [
    { key: "topic_en", label: "Topic (English)" },
    { key: "topic_ar", label: "Topic (Arabic)" },
    { key: "description", label: "Description", long: true },
    { key: "source", label: "Source" },
  ],
  projects: [
    { key: "title", label: "Title" },
    { key: "project_date", label: "Date (YYYY-MM-DD)" },
    { key: "status", label: "Status" },
    { key: "notes", label: "Notes", long: true },
  ],
};

export const REQUIRED_FIELD: Record<string, string> = {
  suppliers: "name_en",
  materials: "name_en",
  machines: "name_en",
  processes: "name_en",
  products: "name_en",
  cultural_references: "topic_en",
  projects: "title",
};
