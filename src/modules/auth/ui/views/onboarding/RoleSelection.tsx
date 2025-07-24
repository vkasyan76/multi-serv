import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState } from "react";

type Role = "client" | "service-provider" | "both";
export function RoleSelection({
  onSelect,
}: {
  onSelect: (role: Role) => void;
}) {
  const [role, setRole] = useState<Role>();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">What brings you to OurApp?</h1>
      <RadioGroup
        value={role}
        onValueChange={(v) => setRole(v as Role)}
        className="flex gap-4"
      >
        {["client", "service-provider", "both"].map((value) => (
          <Card
            key={value}
            onClick={() => setRole(value as Role)}
            className={`cursor-pointer border ${role === value ? "border-blue-500 ring ring-blue-300" : ""}`}
          >
            <CardContent className="flex items-center gap-2 p-4">
              <RadioGroupItem value={value} />
              <div>
                <h2 className="font-semibold">
                  {value === "client"
                    ? "I'm a client"
                    : value === "service-provider"
                      ? "I'm a provider"
                      : "Both"}
                </h2>
                <p className="text-sm text-gray-500">
                  {value === "client"
                    ? "I want to order freelance services."
                    : value === "service-provider"
                      ? "I want to offer services."
                      : "Both roles."}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </RadioGroup>
      <Button
        onClick={() => role && onSelect(role)}
        disabled={!role}
        className="mt-6"
      >
        Next
      </Button>
    </div>
  );
}
