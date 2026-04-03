import { Checkbox } from "@/components/ui/checkbox";
import { SERVICES_OPTIONS } from "@/constants";
import { useTranslations } from "next-intl";

interface ServicesFilterProps {
  value?: string[] | null;
  onChange: (value: string[]) => void;
}

export const ServicesFilter = ({ value, onChange }: ServicesFilterProps) => {
  const tMarketplace = useTranslations("marketplace");

  // if the service is in the list, we remove it from the list, otherwise add it to the list: this is the array of services that are currently selected/checked
  const onClick = (service: string) => {
    if (value?.includes(service)) {
      onChange(value.filter((t) => t !== service) || []);
    } else {
      onChange([...(value || []), service]);
    }
  };

  type ServiceValue = (typeof SERVICES_OPTIONS)[number]["value"];
  // Step 4 stays display-only: translate labels by canonical value so URL/state
  // still use the original on-site/on-line identifiers unchanged.
  const labelsByValue: Record<ServiceValue, string> = {
    "on-site": tMarketplace("services.on_site"),
    "on-line": tMarketplace("services.on_line"),
  };

  return (
    <div className="flex flex-col gap-y-2">
      {SERVICES_OPTIONS.map((opt) => (
        <div
          key={opt.value}
          className="flex items-center justify-between"
        >
          <label 
            htmlFor={`service-${opt.value}`} 
            className="font-medium cursor-pointer flex-1"
          >
            {labelsByValue[opt.value]}
          </label>
          <Checkbox
            id={`service-${opt.value}`}
            checked={value?.includes(opt.value)}
            onCheckedChange={() => onClick(opt.value)}
          />
        </div>
      ))}
    </div>
  );
};
