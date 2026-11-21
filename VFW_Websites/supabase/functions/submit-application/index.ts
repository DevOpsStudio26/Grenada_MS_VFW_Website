// Public endpoint for the Join Us form: saves the application, then emails the
// post a copy of what was entered. DD-214s are requested from the applicant by
// email afterward and attached by an admin (private dd214-documents bucket).

import { corsHeaders, db, emailLayout, escapeHtml, json, sendEmail, text } from "../_shared/helpers.ts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_REGEX = /^[0-9]{5}(-[0-9]{4})?$/;
const MAX_PER_EMAIL_PER_DAY = 3;

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const form = await request.formData().catch(() => null);
    if (!form) return json({ error: "Please check your details and try again." }, 400);
    const body = Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === "string"));

    // Hidden "website" field: people never see it, bots fill it in
    if (text(body.website)) return json({ ok: true });

    const application = {
        first_name: text(body.firstName, 100),
        last_name: text(body.lastName, 100),
        email: text(body.email, 254).toLowerCase(),
        phone: text(body.phone, 30),
        address: text(body.address, 200),
        city: text(body.city, 100),
        state: text(body.state, 50),
        zip: text(body.zip, 10),
    };

    if (
        !application.first_name ||
        !application.last_name ||
        !EMAIL_REGEX.test(application.email) ||
        application.phone.replace(/\D/g, "").length < 7 ||
        !application.address ||
        !application.city ||
        !application.state ||
        !ZIP_REGEX.test(application.zip)
    ) {
        return json({ error: "Please check your details and try again." }, 400);
    }

    // Stops one person (or a bot) flooding the post with copies
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await db
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("email", application.email)
        .gte("created_at", since);
    if ((count ?? 0) >= MAX_PER_EMAIL_PER_DAY) {
        return json({ error: "We've already received your application. We'll be in touch soon." }, 429);
    }

    // The DD-214 isn't collected here: a post officer emails the applicant to
    // request it, then attaches it under Applications -> Documents.
    const { error: insertError } = await db.from("applications").insert(application);
    if (insertError) {
        console.error("Saving application failed:", insertError.message);
        return json({ error: "Something went wrong sending your application. Please try again." }, 500);
    }

    // The application is saved even if this email fails, so it still shows in the dashboard
    const adminEmails = (Deno.env.get("ADMIN_EMAIL") ?? "").split(",").map((e) => e.trim()).filter(Boolean);
    if (adminEmails.length) {
        const name = `${application.first_name} ${application.last_name}`;
        const rows = [
            ["Name", name],
            ["Email", application.email],
            ["Phone", application.phone],
            ["Address", `${application.address}, ${application.city}, ${application.state} ${application.zip}`],
            ["DD-214", "Not received yet. Email the applicant to request it, then add it to their application under Documents."],
        ]
            .filter(([, value]) => value)
            .map(
                ([label, value]) =>
                    `<tr><td style="padding:4px 16px 4px 0;color:#666;vertical-align:top"><b>${label}</b></td>` +
                    `<td style="padding:4px 0">${escapeHtml(value)}</td></tr>`,
            )
            .join("");

        try {
            await sendEmail({
                to: adminEmails,
                replyTo: application.email,
                subject: `New membership application: ${name}`,
                html: emailLayout(
                    "New Membership Application",
                    `<table>${rows}</table>
                    <p style="margin-top:16px">Accept, decline, or ask for more information in the
                    <a href="https://vfwgrenada.org/admin">Admin Dashboard</a> under Forms.</p>`,
                ),
            });
        } catch (emailError) {
            console.error("Admin notification email failed:", (emailError as Error).message);
        }
    }

    return json({ ok: true });
});
