"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";

const ROLE_OPTIONS = [
  {
    value: "client",
    label: "I'm a client",
    // desc: "I want to order freelance services.",
  },
  {
    value: "provider",
    label: "I offer services",
    // desc: "I want to offer services.",
  },
];

export function RoleSelectionDialog({
  onSelectAction,
}: {
  onSelectAction: (roles: string[]) => void | Promise<void>;
}) {
  const router = useRouter();

  const [selected, setSelected] = useState<string[]>([]);
  //   Closing the Dialog (x button)
  const [open, setOpen] = useState(true);

  const handleToggle = (role: string) => {
    setSelected((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleNext = async () => {
    await onSelectAction(selected);
    router.push("/profile"); // (adjust path if needed)
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="w-full max-w-[95vw] sm:max-w-xl
          p-4 sm:py-10 sm:px-8
          bg-white rounded-2xl shadow-2xl
          flex flex-col items-center
          max-h-[90vh] overflow-y-auto"
        style={{ margin: "auto" }}
      >
        <DialogTitle className="w-full text-center text-xl font-bold mb-8">
          What brings you to Infinisimo?
        </DialogTitle>
        <div className="flex gap-4 sm:gap-6 mb-8 w-full items-center justify-center">
          {ROLE_OPTIONS.map((role) => (
            <Card
              key={role.value}
              className={`relative flex items-center justify-center cursor-pointer w-[140px] h-[90px] sm:w-[180px] sm:h-[110px] transition-all duration-150 border-2 rounded-xl px-2 py-2 sm:px-4 sm:py-4 ${
                selected.includes(role.value)
                  ? "border-black ring-0.5 ring-black"
                  : "border-gray-200"
              }`}
              onClick={() => handleToggle(role.value)}
            >
              {/* Checkbox in top-right corner - absolute */}
              <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10">
                <Checkbox
                  checked={selected.includes(role.value)}
                  onCheckedChange={() => handleToggle(role.value)}
                  tabIndex={-1}
                  // Prevent card click bubbling when user clicks only checkbox
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex flex-col items-center justify-center w-full h-full">
                <span className="font-bold text-base sm:text-lg leading-tight">
                  {role.label}
                </span>
              </div>

              {/* <span className="text-gray-500">{role.desc}</span> */}
            </Card>
          ))}
        </div>
        <Button
          className="w-40"
          disabled={selected.length === 0}
          onClick={handleNext}
        >
          Next
        </Button>
      </DialogContent>
    </Dialog>
  );
}
