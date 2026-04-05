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
type WorkType = "manual" | "consulting" | "digital";

type SeedSubcategory = {
  name: LocalizedLabel;
  slug: string;
};

type RootCategory = {
  name: LocalizedLabel;
  slug: string;
  workType: WorkType;
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

// Authoritative taxonomy source for the workType rollout. Root categories own
// the classification and child records store the inherited value for simpler
// later sorting/filtering.
const ROOT_CATEGORIES: RootCategory[] = [
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
    workType: "manual",
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
    workType: "manual",
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
    workType: "manual",
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
    workType: "manual",
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
    workType: "manual",
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
    workType: "manual",
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
    workType: "manual",
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
    workType: "manual",
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
  {
    name: label(
      "Coaching",
      "Coaching",
      "Coaching",
      "Coaching",
      "Coaching",
      "Coaching",
      "Coaching",
      "Coaching",
      "Коучинг",
    ),
    slug: "coaching",
    workType: "consulting",
    color: "#7c3aed",
    icon: "lucide:briefcase-business",
    subcategories: [
      {
        name: label(
          "Life Coaching",
          "Life Coaching",
          "Coaching de vie",
          "Life coaching",
          "Coaching de vida",
          "Coaching de vida",
          "Coaching życiowy",
          "Coaching de viață",
          "Лайф-коучинг",
        ),
        slug: "life-coaching",
      },
      {
        name: label(
          "Career Coaching",
          "Karrierecoaching",
          "Coaching de carrière",
          "Career coaching",
          "Coaching profesional",
          "Coaching de carreira",
          "Coaching kariery",
          "Coaching de carieră",
          "Кар’єрний коучинг",
        ),
        slug: "career-coaching",
      },
      {
        name: label(
          "Business Coaching",
          "Business Coaching",
          "Coaching d'entreprise",
          "Business coaching",
          "Coaching empresarial",
          "Coaching empresarial",
          "Coaching biznesowy",
          "Coaching de business",
          "Бізнес-коучинг",
        ),
        slug: "business-coaching",
      },
      {
        name: label(
          "Executive Coaching",
          "Executive Coaching",
          "Coaching exécutif",
          "Executive coaching",
          "Coaching ejecutivo",
          "Coaching executivo",
          "Coaching menedżerski",
          "Coaching executiv",
          "Виконавчий коучинг",
        ),
        slug: "executive-coaching",
      },
    ],
  },
  {
    name: label(
      "Tutoring",
      "Nachhilfe",
      "Cours particuliers",
      "Ripetizioni",
      "Clases particulares",
      "Explicações",
      "Korepetycje",
      "Meditații",
      "Репетиторство",
    ),
    slug: "tutoring",
    workType: "consulting",
    color: "#2563eb",
    icon: "lucide:graduation-cap",
    subcategories: [
      {
        name: label(
          "Language Tutoring",
          "Sprachunterricht",
          "Cours de langues",
          "Ripetizioni di lingue",
          "Clases de idiomas",
          "Aulas de línguas",
          "Korepetycje językowe",
          "Meditații limbi străine",
          "Репетиторство з мов",
        ),
        slug: "language-tutoring",
      },
      {
        name: label(
          "Math Tutoring",
          "Mathe-Nachhilfe",
          "Cours de mathématiques",
          "Ripetizioni di matematica",
          "Clases de matemáticas",
          "Explicações de matemática",
          "Korepetycje z matematyki",
          "Meditații la matematică",
          "Репетиторство з математики",
        ),
        slug: "math-tutoring",
      },
      {
        name: label(
          "Science Tutoring",
          "Nachhilfe in Naturwissenschaften",
          "Cours de sciences",
          "Ripetizioni di scienze",
          "Clases de ciencias",
          "Explicações de ciências",
          "Korepetycje z przedmiotów ścisłych",
          "Meditații la științe",
          "Репетиторство з природничих наук",
        ),
        slug: "science-tutoring",
      },
      {
        name: label(
          "Exam Preparation",
          "Prüfungsvorbereitung",
          "Préparation aux examens",
          "Preparazione agli esami",
          "Preparación de exámenes",
          "Preparação para exames",
          "Przygotowanie do egzaminów",
          "Pregătire pentru examene",
          "Підготовка до іспитів",
        ),
        slug: "exam-preparation",
      },
    ],
  },
  {
    name: label(
      "Tax Advisory",
      "Steuerberatung",
      "Conseil fiscal",
      "Consulenza fiscale",
      "Asesoría fiscal",
      "Consultoria fiscal",
      "Doradztwo podatkowe",
      "Consultanță fiscală",
      "Податкове консультування",
    ),
    slug: "tax-advisory",
    workType: "consulting",
    color: "#0f766e",
    icon: "lucide:receipt-text",
    subcategories: [
      {
        name: label(
          "Personal Tax Returns",
          "Private Steuererklärungen",
          "Déclarations fiscales personnelles",
          "Dichiarazioni fiscali personali",
          "Declaraciones fiscales personales",
          "Declarações fiscais pessoais",
          "Prywatne rozliczenia podatkowe",
          "Declarații fiscale personale",
          "Особисті податкові декларації",
        ),
        slug: "personal-tax-returns",
      },
      {
        name: label(
          "Business Tax Filing",
          "Betriebliche Steuererklärungen",
          "Déclarations fiscales d'entreprise",
          "Dichiarazioni fiscali aziendali",
          "Declaraciones fiscales empresariales",
          "Declarações fiscais empresariais",
          "Rozliczenia podatkowe firm",
          "Declarații fiscale pentru afaceri",
          "Податкова звітність для бізнесу",
        ),
        slug: "business-tax-filing",
      },
      {
        name: label(
          "VAT Support",
          "Umsatzsteuer-Unterstützung",
          "Assistance TVA",
          "Supporto IVA",
          "Soporte de IVA",
          "Suporte de IVA",
          "Wsparcie VAT",
          "Asistență TVA",
          "Підтримка з ПДВ",
        ),
        slug: "vat-support",
      },
      {
        name: label(
          "Tax Planning",
          "Steuerplanung",
          "Planification fiscale",
          "Pianificazione fiscale",
          "Planificación fiscal",
          "Planeamento fiscal",
          "Planowanie podatkowe",
          "Planificare fiscală",
          "Податкове планування",
        ),
        slug: "tax-planning",
      },
    ],
  },
  {
    name: label(
      "Project Management",
      "Projektmanagement",
      "Gestion de projet",
      "Project management",
      "Gestión de proyectos",
      "Gestão de projetos",
      "Zarządzanie projektami",
      "Management de proiect",
      "Управління проєктами",
    ),
    slug: "project-management",
    workType: "consulting",
    color: "#1d4ed8",
    icon: "lucide:kanban-square",
    subcategories: [
      {
        name: label(
          "Project Planning",
          "Projektplanung",
          "Planification de projet",
          "Pianificazione del progetto",
          "Planificación de proyectos",
          "Planeamento de projetos",
          "Planowanie projektu",
          "Planificare de proiect",
          "Планування проєкту",
        ),
        slug: "project-planning",
      },
      {
        name: label(
          "Project Support",
          "Projektunterstützung",
          "Support de projet",
          "Supporto di progetto",
          "Soporte de proyectos",
          "Suporte de projetos",
          "Wsparcie projektu",
          "Suport de proiect",
          "Підтримка проєкту",
        ),
        slug: "project-support",
      },
      {
        name: label(
          "Agile Project Management",
          "Agiles Projektmanagement",
          "Gestion de projet agile",
          "Project management agile",
          "Gestión ágil de proyectos",
          "Gestão ágil de projetos",
          "Zwinne zarządzanie projektami",
          "Management agil de proiect",
          "Гнучке управління проєктами",
        ),
        slug: "agile-project-management",
      },
      {
        name: label(
          "Project Coordination",
          "Projektkoordination",
          "Coordination de projet",
          "Coordinamento di progetto",
          "Coordinación de proyectos",
          "Coordenação de projetos",
          "Koordynacja projektu",
          "Coordonare de proiect",
          "Координація проєкту",
        ),
        slug: "project-coordination",
      },
    ],
  },
  {
    name: label(
      "Web Design",
      "Webdesign",
      "Web design",
      "Web design",
      "Diseño web",
      "Web design",
      "Projektowanie stron www",
      "Web design",
      "Вебдизайн",
    ),
    slug: "web-design",
    workType: "digital",
    color: "#0ea5e9",
    icon: "lucide:monitor-smartphone",
    subcategories: [
      {
        name: label(
          "Business Websites",
          "Business-Websites",
          "Sites web d'entreprise",
          "Siti web aziendali",
          "Sitios web corporativos",
          "Websites empresariais",
          "Strony firmowe",
          "Site-uri de business",
          "Бізнес-сайти",
        ),
        slug: "business-websites",
      },
      {
        name: label(
          "Landing Pages",
          "Landingpages",
          "Pages d'atterrissage",
          "Landing page",
          "Landing pages",
          "Landing pages",
          "Landing pages",
          "Landing pages",
          "Лендінги",
        ),
        slug: "landing-pages",
      },
      {
        name: label(
          "E-commerce Websites",
          "E-Commerce-Websites",
          "Sites e-commerce",
          "Siti e-commerce",
          "Sitios web e-commerce",
          "Websites e-commerce",
          "Sklepy internetowe",
          "Site-uri e-commerce",
          "E-commerce сайти",
        ),
        slug: "ecommerce-websites",
      },
      {
        name: label(
          "Website Maintenance",
          "Website-Wartung",
          "Maintenance de site web",
          "Manutenzione siti web",
          "Mantenimiento web",
          "Manutenção de websites",
          "Utrzymanie stron internetowych",
          "Mentenanță site-uri",
          "Підтримка сайтів",
        ),
        slug: "website-maintenance",
      },
    ],
  },
  {
    name: label(
      "Graphic Design",
      "Grafikdesign",
      "Design graphique",
      "Graphic design",
      "Diseño gráfico",
      "Design gráfico",
      "Projektowanie graficzne",
      "Design grafic",
      "Графічний дизайн",
    ),
    slug: "graphic-design",
    workType: "digital",
    color: "#db2777",
    icon: "lucide:palette",
    subcategories: [
      {
        name: label(
          "Logo Design",
          "Logo-Design",
          "Création de logo",
          "Logo design",
          "Diseño de logotipos",
          "Design de logótipos",
          "Projektowanie logo",
          "Design logo",
          "Дизайн логотипів",
        ),
        slug: "logo-design",
      },
      {
        name: label(
          "Brand Identity",
          "Markenidentität",
          "Identité de marque",
          "Brand identity",
          "Identidad de marca",
          "Identidade de marca",
          "Identyfikacja wizualna",
          "Identitate de brand",
          "Айдентика бренду",
        ),
        slug: "brand-identity",
      },
      {
        name: label(
          "Marketing Materials",
          "Marketingmaterialien",
          "Supports marketing",
          "Materiali di marketing",
          "Materiales de marketing",
          "Materiais de marketing",
          "Materiały marketingowe",
          "Materiale de marketing",
          "Маркетингові матеріали",
        ),
        slug: "marketing-materials",
      },
      {
        name: label(
          "Social Media Design",
          "Social-Media-Design",
          "Design pour réseaux sociaux",
          "Design per social media",
          "Diseño para redes sociales",
          "Design para redes sociais",
          "Grafiki do social media",
          "Design pentru social media",
          "Дизайн для соцмереж",
        ),
        slug: "social-media-design",
      },
    ],
  },
  {
    name: label(
      "Copywriting",
      "Copywriting",
      "Copywriting",
      "Copywriting",
      "Copywriting",
      "Copywriting",
      "Copywriting",
      "Copywriting",
      "Копірайтинг",
    ),
    slug: "copywriting",
    workType: "digital",
    color: "#f97316",
    icon: "lucide:pen-tool",
    subcategories: [
      {
        name: label(
          "Website Copy",
          "Website-Texte",
          "Textes de site web",
          "Testi per siti web",
          "Textos para sitios web",
          "Textos para websites",
          "Teksty na strony internetowe",
          "Texte pentru website",
          "Тексти для сайтів",
        ),
        slug: "website-copy",
      },
      {
        name: label(
          "Blog Articles",
          "Blogartikel",
          "Articles de blog",
          "Articoli per blog",
          "Artículos de blog",
          "Artigos para blog",
          "Artykuły blogowe",
          "Articole de blog",
          "Блог-статті",
        ),
        slug: "blog-articles",
      },
      {
        name: label(
          "Product Descriptions",
          "Produktbeschreibungen",
          "Descriptions de produits",
          "Descrizioni prodotto",
          "Descripciones de producto",
          "Descrições de produtos",
          "Opisy produktów",
          "Descrieri produse",
          "Опис товарів",
        ),
        slug: "product-descriptions",
      },
      {
        name: label(
          "Ad Copy",
          "Anzeigentexte",
          "Textes publicitaires",
          "Testi pubblicitari",
          "Textos publicitarios",
          "Textos publicitários",
          "Teksty reklamowe",
          "Texte publicitare",
          "Рекламні тексти",
        ),
        slug: "ad-copy",
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
    workType?: WorkType | null;
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
      workType?: WorkType | null;
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
    if ((doc.workType ?? null) !== (data.workType ?? null)) {
      patch.workType = data.workType ?? null;
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
      workType: data.workType ?? null,
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

  for (const cat of ROOT_CATEGORIES) {
    const parent = await upsertCategory(payload, {
      name: cat.name,
      slug: cat.slug,
      workType: cat.workType,
      color: cat.color,
      icon: cat.icon,
      parent: null,
    });
    summary.push({ slug: cat.slug, action: parent.action });

    for (const sub of cat.subcategories ?? []) {
      const subRes = await upsertCategory(payload, {
        name: sub.name,
        slug: sub.slug,
        // Child records store the inherited value too so querying/sorting can
        // stay simple later, but the value is still authored by the root group.
        workType: cat.workType,
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
