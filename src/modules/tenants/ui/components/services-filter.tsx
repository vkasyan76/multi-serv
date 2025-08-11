import { Checkbox } from "@/components/ui/checkbox";
import { SERVICES_OPTIONS } from "@/constants";

interface ServicesFilterProps {
  value?: string[] | null;
  onChange: (value: string[]) => void;
}

export const ServicesFilter = ({ value, onChange }: ServicesFilterProps) => {
  // if the service is in the list, we remove it from the list, otherwise add it to the list: this is the array of services that are currently selected/checked
  const onClick = (service: string) => {
    if (value?.includes(service)) {
      onChange(value.filter((t) => t !== service) || []);
    } else {
      onChange([...(value || []), service]);
    }
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
            {opt.label}
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
