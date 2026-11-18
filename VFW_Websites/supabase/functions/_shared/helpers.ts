// Shared code for the Edge Functions: CORS, JSON replies, the database client,
// and sending email through Resend.
//
// Secrets (set with `supabase secrets set NAME=value`):
//   RESEND_API_KEY - from resend.com -> API Keys
//   EMAIL_FROM     - sender on a domain verified in Resend,
//                    e.g. "VFW Post 4488 <applications@vfwgrenada.org>"
//   ADMIN_EMAIL    - who gets a copy of each new application (comma-separate several)
//   POST_EMAIL     - where applicants' replies go, e.g. info@vfwgrenada.org
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import { createClient } from "npm:@supabase/supabase-js@2";

export const POST_NAME = "VFW Post 4488 – Grenada, MS";
export const SITE_URL = "https://vfwgrenada.org";

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

// The service role client skips row level security, so it only ever runs here
// on the server, never in the browser.
export const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
);

export const text = (value: unknown, max = 200) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

export function escapeHtml(value: unknown) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

// Wraps an email body in the post's colors. `body` must already be escaped.
export function emailLayout(title: string, body: string) {
    return `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;color:#0B1E4A">
  <div style="border-top:4px solid #D4871A;padding-top:12px">
    <h2 style="margin:0 0 12px;font-family:Georgia,serif">${escapeHtml(title)}</h2>
    ${body}
  </div>
  <p style="margin-top:24px;color:#888;font-size:12px">${escapeHtml(POST_NAME)} · <a href="${SITE_URL}" style="color:#888">${SITE_URL.replace("https://", "")}</a></p>
</div>`;
}

// Turns plain text (like an admin's message) into safe HTML paragraphs.
export function paragraphs(value: string) {
    return value
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(p).replaceAll("\n", "<br>")}</p>`)
        .join("");
}

type Email = { to: string | string[]; subject: string; html: string; replyTo?: string };

export async function sendEmail({ to, subject, html, replyTo }: Email) {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("EMAIL_FROM");
    if (!apiKey || !from) throw new Error("RESEND_API_KEY or EMAIL_FROM is not set");

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            from,
            to,
            subject: subject.replace(/[\r\n]+/g, " "),
            html,
            ...(replyTo ? { reply_to: replyTo } : {}),
        }),
    });
    if (!response.ok) throw new Error(`Resend error ${response.status}: ${await response.text()}`);
}
