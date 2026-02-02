import { Resend } from "resend";

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return Response.json(
      { ok: false, error: "Missing RESEND_API_KEY" },
      { status: 500 },
    );
  }

  const resend = new Resend(apiKey);

  const from = process.env.EMAIL_FROM || "no-reply@infinisimo.com";
  const to = "info@infinisimo.com"; // change if you want

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: "Resend test — Infinisimo",
    html: "<p>If you got this, Resend sending works ✅</p>",
    text: "If you got this, Resend sending works ✅",
  });

  if (error) {
    return Response.json({ ok: false, error }, { status: 500 });
  }

  return Response.json({ ok: true, data });
}

// To test incomming e-mails, run in powershell: Invoke-RestMethod http://localhost:3000/api/email/test
