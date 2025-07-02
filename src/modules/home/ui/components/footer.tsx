import Image from "next/image";
import Link from "next/link";

export const Footer = () => {
  return (
    <footer className="border-t">
      <div className="flex-center wrapper flex-between flex flex-col gap-4 p-5 text-center sm:flex-row">
        <Link href="/">
          <Image
            src="/images/infinisimo_logo_illustrator.png"
            alt="logo"
            width={90}
            height={20}
          />
        </Link>

        <p className="text-right flex-1">
          © 2025 Infinisimo. All rights reserved.
        </p>
      </div>
    </footer>
  );
};
