// src/scripts/categories.ts
process.env.PAYLOAD_DISABLE_AUTH_FOR_SCRIPTS = "true";

import "dotenv/config";
import { getPayload, type Payload } from "payload";
import config from "../payload.config.js";
import {
  DEFAULT_APP_LANG,
  SUPPORTED_APP_LANGS,
  type AppLang,
} from "../lib/i18n/app-lang.ts";

const NEW_ONLY = process.argv.includes("--new-only");
// Payload supports locale="all" for reads, which lets this script compare the full localized name object.
const ALL_LOCALES = "all" as never;

type LocalizedLabel = Record<AppLang, string>;

type SeedSubcategory = {
  name: LocalizedLabel;
  slug: string;
};

type Cat = {
  name: LocalizedLabel;
  slug: string;
  color?: string;
  icon?: string; // Lucide icon name for the category
  subcategories?: SeedSubcategory[];
};

const label = (
  en: string,
  de: string,
  fr: string,
  it: string,
  es: string,
  pt: string,
  pl: string,
  ro: string,
  uk: string,
): LocalizedLabel => ({
  en,
  de,
  fr,
  it,
  es,
  pt,
  pl,
  ro,
  uk,
});

function normalizeLabel(value: LocalizedLabel): LocalizedLabel {
  const normalized = {} as LocalizedLabel;

  for (const locale of SUPPORTED_APP_LANGS) {
    normalized[locale] = (value[locale] ?? "").trim();
  }

  return normalized;
}

function changedLabelLocales(current: unknown, next: LocalizedLabel): AppLang[] {
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    return [...SUPPORTED_APP_LANGS];
  }

  const currentRecord = current as Partial<Record<AppLang, unknown>>;
  const normalizedNext = normalizeLabel(next);

  return SUPPORTED_APP_LANGS.filter((locale) => {
    return String(currentRecord[locale] ?? "").trim() !== normalizedNext[locale];
  });
}

const MANUAL_CATEGORIES: Cat[] = [
  {
    name: label(
      "Auto Repair",
      "Autoreparatur",
      "Réparation automobile",
      "Riparazione auto",
      "Reparación de automóviles",
      "Reparação automóvel",
      "Naprawa samochodów",
      "Reparații auto",
      "Ремонт автомобілів",
    ),
    slug: "auto-repair",
    color: "#374151",
    icon: "lucide:car",
    subcategories: [
      {
        name: label(
          "Vehicle Diagnostics",
          "Fahrzeugdiagnose",
          "Diagnostic du véhicule",
          "Diagnostica del veicolo",
          "Diagnóstico del vehículo",
          "Diagnóstico do veículo",
          "Diagnostyka pojazdu",
          "Diagnostic vehicul",
          "Діагностика авто",
        ),
        slug: "vehicle-diagnostics",
      },
      {
        name: label(
          "Brake Service",
          "Bremsenservice",
          "Entretien des freins",
          "Servizio freni",
          "Servicio de frenos",
          "Serviço de travões",
          "Serwis hamulców",
          "Service frâne",
          "Обслуговування гальм",
        ),
        slug: "brake-service",
      },
      {
        name: label(
          "Oil Change",
          "Ölwechsel",
          "Vidange",
          "Cambio olio",
          "Cambio de aceite",
          "Mudança de óleo",
          "Wymiana oleju",
          "Schimb de ulei",
          "Заміна мастила",
        ),
        slug: "oil-change",
      },
      {
        name: label(
          "Tires & Wheels",
          "Reifen und Räder",
          "Pneus et roues",
          "Pneumatici e ruote",
          "Neumáticos y ruedas",
          "Pneus e rodas",
          "Opony i koła",
          "Anvelope și roți",
          "Шини та колеса",
        ),
        slug: "tires-wheels",
      },
      {
        name: label(
          "Electrical & Battery",
          "Elektrik und Batterie",
          "Électricité et batterie",
          "Impianto elettrico e batteria",
          "Electricidad y batería",
          "Sistema elétrico e bateria",
          "Elektryka i akumulator",
          "Sistem electric și baterie",
          "Електрика та акумулятор",
        ),
        slug: "auto-electrical",
      },
    ],
  },
  {
    name: label(
      "Plumbing",
      "Sanitär",
      "Plomberie",
      "Idraulica",
      "Fontanería",
      "Canalização",
      "Hydraulika",
      "Instalații sanitare",
      "Сантехніка",
    ),
    slug: "plumbing",
    color: "#2563eb",
    icon: "lucide:wrench",
    subcategories: [
      {
        name: label(
          "Leak Repair",
          "Leckreparatur",
          "Réparation de fuite",
          "Riparazione perdite",
          "Reparación de fugas",
          "Reparação de fugas",
          "Naprawa przecieków",
          "Reparații scurgeri",
          "Усунення протікань",
        ),
        slug: "leak-repair",
      },
      {
        name: label(
          "Pipe Installation",
          "Rohrinstallation",
          "Installation de tuyaux",
          "Installazione tubazioni",
          "Instalación de tuberías",
          "Instalação de tubagens",
          "Montaż rur",
          "Instalare țevi",
          "Монтаж труб",
        ),
        slug: "pipe-installation",
      },
      {
        name: label(
          "Drain Cleaning",
          "Abflussreinigung",
          "Débouchage",
          "Pulizia scarichi",
          "Limpieza de desagües",
          "Limpeza de canos",
          "Czyszczenie odpływów",
          "Curățare scurgeri",
          "Прочищення зливів",
        ),
        slug: "drain-cleaning",
      },
      {
        name: label(
          "Water Heater Service",
          "Wartung von Warmwasserbereitern",
          "Service de chauffe-eau",
          "Assistenza scaldabagno",
          "Servicio de calentadores de agua",
          "Serviço de esquentador",
          "Serwis podgrzewaczy wody",
          "Service pentru boiler",
          "Обслуговування водонагрівачів",
        ),
        slug: "water-heater-service",
      },
      {
        name: label(
          "Fixtures (Bath/Kitchen)",
          "Armaturen (Bad/Küche)",
          "Équipements (salle de bain/cuisine)",
          "Sanitari (bagno/cucina)",
          "Accesorios (baño/cocina)",
          "Equipamentos (casa de banho/cozinha)",
          "Armatura (łazienka/kuchnia)",
          "Obiecte sanitare (baie/bucătărie)",
          "Сантехнічні прилади (ванна/кухня)",
        ),
        slug: "fixtures-installation",
      },
    ],
  },
  {
    name: label(
      "Bricklaying & Masonry",
      "Maurer- und Steinmetzarbeiten",
      "Maçonnerie",
      "Muratura e lavori in pietra",
      "Albañilería y mampostería",
      "Alvenaria e cantaria",
      "Murowanie i kamieniarstwo",
      "Zidărie și piatrărie",
      "Мурування та кам'яні роботи",
    ),
    slug: "bricklaying-masonry",
    color: "#d97706",
    icon: "lucide:brick-wall",
    subcategories: [
      {
        name: label(
          "Masonry Repair",
          "Mauerwerksreparatur",
          "Réparation de maçonnerie",
          "Riparazione muratura",
          "Reparación de mampostería",
          "Reparação de alvenaria",
          "Naprawa murów",
          "Reparații zidărie",
          "Ремонт кладки",
        ),
        slug: "masonry-repair",
      },
      {
        name: label(
          "Paving & Walkways",
          "Pflasterarbeiten und Gehwege",
          "Pavage et allées",
          "Pavimentazioni e camminamenti",
          "Pavimentación y senderos",
          "Pavimentação e caminhos",
          "Kostka brukowa i chodniki",
          "Pavaje și alei",
          "Брукування та доріжки",
        ),
        slug: "paving-walkways",
      },
      {
        name: label(
          "Chimney Work",
          "Schornsteinarbeiten",
          "Travaux de cheminée",
          "Lavori su camini",
          "Trabajos de chimenea",
          "Trabalhos em chaminés",
          "Prace przy kominach",
          "Lucrări la coșuri de fum",
          "Роботи з димоходом",
        ),
        slug: "chimney-work",
      },
      {
        name: label(
          "Retaining Walls",
          "Stützmauern",
          "Murs de soutènement",
          "Muri di sostegno",
          "Muros de contención",
          "Muros de contenção",
          "Mury oporowe",
          "Ziduri de sprijin",
          "Підпірні стіни",
        ),
        slug: "retaining-walls",
      },
      {
        name: label(
          "Stonework",
          "Steinmetzarbeiten",
          "Travaux de pierre",
          "Lavori in pietra",
          "Trabajos en piedra",
          "Trabalhos em pedra",
          "Kamieniarstwo",
          "Lucrări în piatră",
          "Роботи з каменю",
        ),
        slug: "stonework",
      },
    ],
  },
  {
    name: label(
      "Roofing",
      "Dachdeckerarbeiten",
      "Couverture",
      "Coperture",
      "Techado",
      "Coberturas",
      "Dekarstwo",
      "Acoperișuri",
      "Покрівельні роботи",
    ),
    slug: "roofing",
    color: "#6b7280",
    icon: "fa6-solid:house-chimney",
    subcategories: [
      {
        name: label(
          "Roof Repair",
          "Dachreparatur",
          "Réparation de toiture",
          "Riparazione tetto",
          "Reparación de tejados",
          "Reparação de telhados",
          "Naprawa dachu",
          "Reparații acoperiș",
          "Ремонт даху",
        ),
        slug: "roof-repair",
      },
      {
        name: label(
          "New Roof Installation",
          "Neue Dachinstallation",
          "Installation de toiture neuve",
          "Installazione nuovo tetto",
          "Instalación de tejado nuevo",
          "Instalação de telhado novo",
          "Montaż nowego dachu",
          "Montaj acoperiș nou",
          "Монтаж нового даху",
        ),
        slug: "new-roof-installation",
      },
      {
        name: label(
          "Gutter Installation",
          "Dachrinneninstallation",
          "Installation de gouttières",
          "Installazione grondaie",
          "Instalación de canalones",
          "Instalação de caleiras",
          "Montaż rynien",
          "Instalare jgheaburi",
          "Монтаж ринв",
        ),
        slug: "gutter-installation",
      },
      {
        name: label(
          "Roof Inspection",
          "Dachinspektion",
          "Inspection de toiture",
          "Ispezione del tetto",
          "Inspección de tejado",
          "Inspeção de telhado",
          "Przegląd dachu",
          "Inspecție acoperiș",
          "Огляд даху",
        ),
        slug: "roof-inspection",
      },
      {
        name: label(
          "Solar System Installer",
          "Installateur für Solaranlagen",
          "Installateur de systèmes solaires",
          "Installatore di impianti solari",
          "Instalador de sistemas solares",
          "Instalador de sistemas solares",
          "Instalator systemów solarnych",
          "Instalator sisteme solare",
          "Монтаж сонячних систем",
        ),
        slug: "solar-system-installer",
      },
    ],
  },
  {
    name: label(
      "Furniture Assembly",
      "Möbelmontage",
      "Montage de meubles",
      "Montaggio mobili",
      "Montaje de muebles",
      "Montagem de móveis",
      "Montaż mebli",
      "Asamblare mobilier",
      "Збирання меблів",
    ),
    slug: "furniture-assembly",
    color: "#10b981",
    icon: "lucide:armchair",
    subcategories: [
      {
        name: label(
          "Flat-pack / IKEA",
          "Flatpack / IKEA",
          "Meubles en kit / IKEA",
          "Mobili in kit / IKEA",
          "Muebles en kit / IKEA",
          "Móveis em kit / IKEA",
          "Meble w paczkach / IKEA",
          "Mobilier la pachet / IKEA",
          "Меблі в коробках / IKEA",
        ),
        slug: "flatpack-assembly",
      },
      {
        name: label(
          "Office Furniture",
          "Büromöbel",
          "Mobilier de bureau",
          "Arredi per ufficio",
          "Mobiliario de oficina",
          "Mobiliário de escritório",
          "Meble biurowe",
          "Mobilier de birou",
          "Офісні меблі",
        ),
        slug: "office-furniture-assembly",
      },
      {
        name: label(
          "Bed & Wardrobe",
          "Bett und Kleiderschrank",
          "Lit et armoire",
          "Letto e armadio",
          "Cama y armario",
          "Cama e guarda-roupa",
          "Łóżko i szafa",
          "Pat și dulap",
          "Ліжко та шафа",
        ),
        slug: "bed-wardrobe-assembly",
      },
      {
        name: label(
          "Outdoor Furniture",
          "Gartenmöbel",
          "Mobilier d'extérieur",
          "Mobili da esterno",
          "Muebles de exterior",
          "Móveis de exterior",
          "Meble ogrodowe",
          "Mobilier de exterior",
          "Вуличні меблі",
        ),
        slug: "outdoor-furniture-assembly",
      },
      {
        name: label(
          "Mounting & Disassembly",
          "Montage und Demontage",
          "Montage et démontage",
          "Montaggio e smontaggio",
          "Montaje y desmontaje",
          "Montagem e desmontagem",
          "Montaż i demontaż",
          "Montaj și demontare",
          "Монтаж і демонтаж",
        ),
        slug: "mounting-disassembly",
      },
    ],
  },
  {
    name: label(
      "Relocation",
      "Umzug",
      "Déménagement",
      "Traslochi",
      "Mudanzas",
      "Mudanças",
      "Przeprowadzki",
      "Mutări",
      "Переїзд",
    ),
    slug: "relocation",
    color: "#0ea5e9",
    icon: "lucide:truck",
    subcategories: [
      {
        name: label(
          "Local Moving",
          "Nahumzug",
          "Déménagement local",
          "Trasloco locale",
          "Mudanza local",
          "Mudança local",
          "Przeprowadzka lokalna",
          "Mutare locală",
          "Локальний переїзд",
        ),
        slug: "local-moving",
      },
      {
        name: label(
          "Long-Distance Moving",
          "Fernumzug",
          "Déménagement longue distance",
          "Trasloco a lunga distanza",
          "Mudanza de larga distancia",
          "Mudança de longa distância",
          "Przeprowadzka dalekobieżna",
          "Mutare pe distanțe lungi",
          "Міжміський переїзд",
        ),
        slug: "long-distance-moving",
      },
      {
        name: label(
          "Packing & Unpacking",
          "Ein- und Auspacken",
          "Emballage et déballage",
          "Imballaggio e disimballaggio",
          "Embalaje y desembalaje",
          "Embalagem e desembalagem",
          "Pakowanie i rozpakowywanie",
          "Ambalare și despachetare",
          "Пакування та розпакування",
        ),
        slug: "packing-unpacking",
      },
      {
        name: label(
          "Furniture Disassembly/Assembly",
          "Möbelabbau und -aufbau",
          "Démontage et montage de meubles",
          "Smontaggio e montaggio mobili",
          "Desmontaje y montaje de muebles",
          "Desmontagem e montagem de móveis",
          "Demontaż i montaż mebli",
          "Demontare și montare mobilier",
          "Розбирання та збирання меблів",
        ),
        slug: "moving-furniture-assembly",
      },
      {
        name: label(
          "Van/Truck with Driver",
          "Transporter/LKW mit Fahrer",
          "Camionnette/camion avec chauffeur",
          "Furgone/camion con autista",
          "Furgoneta/camión con conductor",
          "Carrinha/camião com motorista",
          "Bus/dostawczak z kierowcą",
          "Dubă/camion cu șofer",
          "Фургон/вантажівка з водієм",
        ),
        slug: "man-and-van",
      },
    ],
  },
  {
    name: label(
      "Cleaning",
      "Reinigung",
      "Nettoyage",
      "Pulizia",
      "Limpieza",
      "Limpeza",
      "Sprzątanie",
      "Curățenie",
      "Прибирання",
    ),
    slug: "cleaning",
    color: "#a855f7",
    icon: "mdi:broom",
    subcategories: [
      {
        name: label(
          "Regular Home Cleaning",
          "Regelmäßige Haushaltsreinigung",
          "Nettoyage régulier du domicile",
          "Pulizia domestica regolare",
          "Limpieza habitual del hogar",
          "Limpeza doméstica regular",
          "Regularne sprzątanie domu",
          "Curățenie regulată a locuinței",
          "Регулярне прибирання дому",
        ),
        slug: "home-cleaning",
      },
      {
        name: label(
          "Deep Cleaning",
          "Grundreinigung",
          "Nettoyage en profondeur",
          "Pulizia profonda",
          "Limpieza profunda",
          "Limpeza profunda",
          "Sprzątanie gruntowne",
          "Curățenie profundă",
          "Генеральне прибирання",
        ),
        slug: "deep-cleaning",
      },
      {
        name: label(
          "Move-Out / End-of-Lease",
          "Endreinigung bei Auszug",
          "Nettoyage de fin de bail",
          "Pulizia di fine locazione",
          "Limpieza de fin de alquiler",
          "Limpeza de fim de contrato",
          "Sprzątanie po wyprowadzce",
          "Curățenie la sfârșit de contract",
          "Прибирання після виїзду",
        ),
        slug: "end-of-lease-cleaning",
      },
      {
        name: label(
          "Office / Commercial",
          "Büro / Gewerbe",
          "Bureaux / commercial",
          "Uffici / commerciale",
          "Oficina / comercial",
          "Escritório / comercial",
          "Biuro / komercyjne",
          "Birouri / spații comerciale",
          "Офісне / комерційне прибирання",
        ),
        slug: "office-cleaning",
      },
      {
        name: label(
          "Carpet & Upholstery",
          "Teppiche und Polster",
          "Tapis et tissus d'ameublement",
          "Tappeti e tappezzeria",
          "Alfombras y tapicería",
          "Carpetes e estofos",
          "Dywany i tapicerka",
          "Covoare și tapițerie",
          "Чищення килимів та м'яких меблів",
        ),
        slug: "carpet-upholstery-cleaning",
      },
    ],
  },
  {
    name: label(
      "Gardening",
      "Gartenarbeit",
      "Jardinage",
      "Giardinaggio",
      "Jardinería",
      "Jardinagem",
      "Ogrodnictwo",
      "Grădinărit",
      "Садові роботи",
    ),
    slug: "gardening",
    color: "#16a34a",
    icon: "lucide:trees",
    subcategories: [
      {
        name: label(
          "Lawn Mowing",
          "Rasenmähen",
          "Tonte de pelouse",
          "Taglio del prato",
          "Corte de césped",
          "Corte de relva",
          "Koszenie trawnika",
          "Tuns gazon",
          "Косіння газону",
        ),
        slug: "lawn-mowing",
      },
      {
        name: label(
          "Hedge & Tree Trimming",
          "Hecken- und Baumschnitt",
          "Taille de haies et d'arbres",
          "Potatura di siepi e alberi",
          "Poda de setos y árboles",
          "Poda de sebes e árvores",
          "Przycinanie żywopłotów i drzew",
          "Tăiere gard viu și copaci",
          "Підрізання живоплоту й дерев",
        ),
        slug: "hedge-tree-trimming",
      },
      {
        name: label(
          "Planting & Bed Setup",
          "Pflanzung und Beetanlage",
          "Plantation et aménagement de massifs",
          "Piantumazione e preparazione aiuole",
          "Plantación y preparación de parterres",
          "Plantação e preparação de canteiros",
          "Sadzenie i zakładanie rabat",
          "Plantare și amenajare straturi",
          "Висадка та облаштування клумб",
        ),
        slug: "planting-bed-setup",
      },
      {
        name: label(
          "Weeding & Cleanup",
          "Unkraut jäten und Aufräumen",
          "Désherbage et nettoyage",
          "Diserbo e pulizia",
          "Deshierbe y limpieza",
          "Remoção de ervas e limpeza",
          "Pielenie i porządki",
          "Plivit și curățenie",
          "Прополювання та прибирання",
        ),
        slug: "garden-cleanup",
      },
      {
        name: label(
          "Irrigation Setup",
          "Bewässerungssystem einrichten",
          "Installation d'irrigation",
          "Installazione irrigazione",
          "Instalación de riego",
          "Instalação de rega",
          "Montaż nawadniania",
          "Instalare irigații",
          "Монтаж зрошення",
        ),
        slug: "irrigation-setup",
      },
    ],
  },
];

type UpsertResult = { id: string; action: "created" | "updated" | "skipped" };

async function syncLocalizedName(
  payload: Payload,
  id: string,
  current: unknown,
  next: LocalizedLabel,
): Promise<boolean> {
  const normalizedNext = normalizeLabel(next);
  const changedLocales = changedLabelLocales(current, normalizedNext);

  if (changedLocales.length === 0) return false;

  for (const locale of changedLocales) {
    await payload.update({
      collection: "categories",
      id,
      data: { name: normalizedNext[locale] } as never,
      overrideAccess: true,
      fallbackLocale: false,
      locale,
    });
  }

  return true;
}

// Create or update by slug (idempotent). No deletes.
async function upsertCategory(
  payload: Payload,
  data: {
    name: LocalizedLabel;
    slug: string;
    color?: string;
    icon?: string;
    parent?: string | null;
  },
): Promise<UpsertResult> {
  const normalizedName = normalizeLabel(data.name);
  const existing = await payload.find({
    collection: "categories",
    where: { slug: { equals: data.slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    fallbackLocale: false,
    // Read raw localized values so unchanged docs can still be skipped.
    locale: ALL_LOCALES,
  });

  if (existing.totalDocs > 0) {
    const doc = existing.docs[0]! as {
      id: string;
      name?: unknown;
      color?: string | null;
      icon?: string | null;
      parent?: string | { id?: string } | null;
    };

    if (NEW_ONLY) return { id: String(doc.id), action: "skipped" };

    const patch: Record<string, unknown> = {};
    if ((doc.color ?? null) !== (data.color ?? null)) {
      patch.color = data.color ?? null;
    }
    if ((doc.icon ?? null) !== (data.icon ?? null)) {
      patch.icon = data.icon ?? null;
    }

    // parent can be string or populated object; compare as strings
    const currentParentId =
      (typeof doc.parent === "object" && doc.parent && "id" in doc.parent
        ? doc.parent.id
        : typeof doc.parent === "string"
          ? doc.parent
          : null) ?? null;

    if (String(currentParentId ?? "") !== String(data.parent ?? "")) {
      patch.parent = data.parent ?? null;
    }

    let updated = false;
    if (Object.keys(patch).length > 0) {
      await payload.update({
        collection: "categories",
        id: doc.id,
        data: patch as never,
        overrideAccess: true,
      });
      updated = true;
    }

    if (await syncLocalizedName(payload, String(doc.id), doc.name, normalizedName)) {
      updated = true;
    }

    return { id: String(doc.id), action: updated ? "updated" : "skipped" };
  }

  const created = await payload.create({
    collection: "categories",
    data: {
      name: normalizedName[DEFAULT_APP_LANG],
      slug: data.slug,
      color: data.color,
      icon: data.icon ?? null,
      parent: data.parent ?? null,
    } as never,
    overrideAccess: true,
    fallbackLocale: false,
    locale: DEFAULT_APP_LANG,
  });

  await syncLocalizedName(
    payload,
    String(created.id),
    { [DEFAULT_APP_LANG]: normalizedName[DEFAULT_APP_LANG] },
    normalizedName,
  );
  return { id: String(created.id), action: "created" };
}

async function run() {
  const payload = await getPayload({ config });

  const summary: Array<{ slug: string; action: UpsertResult["action"] }> = [];

  for (const cat of MANUAL_CATEGORIES) {
    const parent = await upsertCategory(payload, {
      name: cat.name,
      slug: cat.slug,
      color: cat.color,
      icon: cat.icon,
      parent: null,
    });
    summary.push({ slug: cat.slug, action: parent.action });

    for (const sub of cat.subcategories ?? []) {
      const subRes = await upsertCategory(payload, {
        name: sub.name,
        slug: sub.slug,
        parent: parent.id,
      });
      summary.push({ slug: sub.slug, action: subRes.action });
    }
  }

  console.table(summary);
}

run()
  .then(() => {
    console.log("Category upsert completed.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Category upsert failed:", e);
    process.exit(1);
  });
