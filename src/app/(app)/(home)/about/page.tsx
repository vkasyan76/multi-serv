"use client";

// import { useEffect } from "react";
// import { useTRPC } from "@/trpc/client";
// import { useMutation } from "@tanstack/react-query";

// function errToMsg(e: unknown) {
//   return e instanceof Error ? e.message : e ? String(e) : "Unknown error";
// }

export default function Page() {
  // const trpc = useTRPC();
  // const validateVat = useMutation(trpc.vat.validate.mutationOptions());

  // Run once on mount
  // useEffect(() => {
  //   validateVat.mutate({ countryCode: "IE", vat: "6388047V" });
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  return (
    <div style={{ padding: 16 }}>
      <h1>About</h1>
      <p>Quick VIES sanity check via tRPC mutation.</p>

      {/* {validateVat.isPending && <p>Checking…</p>}

      {validateVat.error && (
        <p style={{ color: "red" }}>Error: {errToMsg(validateVat.error)}</p>
      )}

      {validateVat.data && (
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(validateVat.data, null, 2)}
        </pre>
      )} */}

      {/* <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button
          onClick={() =>
            validateVat.mutate({ countryCode: "IE", vat: "6388047V" })
          }
        >
          Test “6388047V”
        </button>

        <button
          onClick={() =>
            validateVat.mutate({ countryCode: "IE", vat: "IE6388047V" })
          }
        >
          Test “IE6388047V”
        </button>
      </div> */}
    </div>
  );
}
