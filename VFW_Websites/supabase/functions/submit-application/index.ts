// Public endpoint for the Join Us form: saves the application (and the optional
// DD-214 in a private bucket), then emails the post a copy of what was entered.

import { corsHeaders, db, emailLayout, escapeHtml, json, sendEmail, text } from "../_shared/helpers.ts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_REGEX = /^[0-9]{5}(-[0-9]{4})?$/;
const MAX_PER_EMAIL_PER_DAY = 3;

// DD-214s hold Social Security numbers, so they live in a private bucket that
// only admins can read, and are never attached to emails.
const DOCUMENT_BUCKET = "dd214-documents";
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

// Checks the file's first bytes, so a renamed file can't pass as a PDF or image.
function detectDocumentType(bytes: Uint8Array) {
    const starts = (...sig: number[]) => sig.every((byte, i) => bytes[i] === byte);
    if (starts(0x25, 0x50, 0x44, 0x46)) return { ext: "pdf", contentType: "application/pdf" };
    if (starts(0xff, 0xd8, 0xff)) return { ext: "jpg", contentType: "image/jpeg" };
    if (starts(0x89, 0x50, 0x4e, 0x47)) return { ext: "png", contentType: "image/png" };
    return null;
}

const safeFilename = (name: string) => name.replace(/[^\w.\- ()]+/g, "_").slice(0, 150) || "DD-214";

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

    // Required DD-214
    const upload = form.get("dd214");
    if (!(upload instanceof File) || upload.size === 0) {
        return json({ error: "Please upload your DD-214 to apply." }, 400);
    }
    const bytes = new Uint8Array(await upload.arrayBuffer());
    const type = detectDocumentType(bytes);
    if (!type || bytes.length > MAX_DOCUMENT_BYTES) {
        return json({ error: "Your DD-214 must be a PDF, JPG, or PNG file under 10 MB." }, 400);
    }
    const documentPath = `${crypto.randomUUID()}.${type.ext}`;
    const documentName = safeFilename(upload.name);
    const { error: uploadError } = await db.storage
        .from(DOCUMENT_BUCKET)
        .upload(documentPath, bytes, { contentType: type.contentType });
    if (uploadError) {
        console.error("DD-214 upload failed:", uploadError.message);
        return json({ error: "Your DD-214 couldn't be uploaded. Please try again." }, 500);
    }

    const { data: saved, error: insertError } = await db
        .from("applications")
        .insert(application)
        .select("id")
        .single();
    if (insertError) {
        console.error("Saving application failed:", insertError.message);
        await db.storage.from(DOCUMENT_BUCKET).remove([documentPath]);
        return json({ error: "Something went wrong sending your application. Please try again." }, 500);
    }

    if (documentPath) {
        const { error: documentError } = await db.from("application_documents").insert({
            application_id: saved.id,
            storage_path: documentPath,
            file_name: documentName,
            added_by: "applicant",
        });
        if (documentError) {
            console.error("Saving DD-214 record failed:", documentError.message);
            await db.storage.from(DOCUMENT_BUCKET).remove([documentPath]);
            await db.from("applications").delete().eq("id", saved.id);
            return json({ error: "Your DD-214 couldn't be uploaded. Please try again." }, 500);
        }
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
            ["DD-214", "Uploaded. View it in the Admin Dashboard."],
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
