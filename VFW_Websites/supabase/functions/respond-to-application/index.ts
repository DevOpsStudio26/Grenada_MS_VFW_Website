// Admin-only: accepts, declines, or asks for more information on an application,
// then emails the applicant at the address on their application.

import { corsHeaders, db, emailLayout, escapeHtml, json, paragraphs, POST_NAME, sendEmail, text } from "../_shared/helpers.ts";

type Action = "approved" | "declined" | "info_requested";

function buildEmail(action: Action, firstName: string, message: string) {
    const greeting = `<p style="margin:0 0 12px">Dear ${escapeHtml(firstName)},</p>`;
    const signoff = `<p style="margin:16px 0 0">Thank you,<br>${escapeHtml(POST_NAME)}</p>`;

    if (action === "approved") {
        return {
            subject: "Welcome to VFW Post 4488",
            html: emailLayout(
                "Your Application Was Accepted",
                `${greeting}
                <p style="margin:0 0 12px;line-height:1.5">We're glad to let you know your membership application to ${escapeHtml(POST_NAME)} has been accepted. Welcome to the post!</p>
                <p style="margin:0 0 12px;line-height:1.5">A member of our team will reach out with next steps, including dues and upcoming meetings. If you have any questions in the meantime, just reply to this email.</p>
                ${signoff}`,
            ),
        };
    }
    if (action === "declined") {
        return {
            subject: "Your VFW Post 4488 membership application",
            html: emailLayout(
                "About Your Application",
                `${greeting}
                <p style="margin:0 0 12px;line-height:1.5">Thank you for your interest in ${escapeHtml(POST_NAME)}. After reviewing your application, we're unable to accept it at this time.</p>
                <p style="margin:0 0 12px;line-height:1.5">If you think this was a mistake or would like to know more, please reply to this email and we'll be happy to talk with you.</p>
                ${signoff}`,
            ),
        };
    }
    return {
        subject: "More information needed for your VFW application",
        html: emailLayout(
            "We Need a Little More Information",
            `${greeting}
            <p style="margin:0 0 12px;line-height:1.5">Thank you for applying to ${escapeHtml(POST_NAME)}. Before we can finish reviewing your application, we need the following:</p>
            <div style="background:#F5F1E8;border-left:4px solid #D4871A;padding:12px 16px;margin:0 0 12px">${paragraphs(message)}</div>
            <p style="margin:0 0 12px;line-height:1.5">Please reply to this email with the information above.</p>
            ${signoff}`,
        ),
    };
}

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    // Only signed-in admins may send responses
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: userData } = await db.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Please sign in again." }, 401);
    const { data: adminRow } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!adminRow) return json({ error: "Only admins can respond to applications." }, 403);

    const body = await request.json().catch(() => ({}));
    const id = text(body.id, 100);
    const action = body.action as Action;
    const message = text(body.message, 5000);

    if (!["approved", "declined", "info_requested"].includes(action)) {
        return json({ error: "Unknown action." }, 400);
    }
    if (action === "info_requested" && !message) {
        return json({ error: "Please write what information you need." }, 400);
    }

    const { data: application } = await db
        .from("applications")
        .select("id, first_name, email")
        .eq("id", id)
        .maybeSingle();
    if (!application) return json({ error: "That application no longer exists." }, 404);

    // Send first, so the status only changes if the applicant actually got the email
    try {
        const { subject, html } = buildEmail(action, application.first_name, message);
        await sendEmail({
            to: application.email,
            subject,
            html,
            replyTo: Deno.env.get("POST_EMAIL") || undefined,
        });
    } catch (emailError) {
        console.error("Applicant email failed:", (emailError as Error).message);
        return json({ error: "The email couldn't be sent, so nothing was changed. Please try again." }, 502);
    }

    const respondedAt = new Date().toISOString();
    const { error: updateError } = await db
        .from("applications")
        .update({ status: action, admin_message: message, responded_at: respondedAt })
        .eq("id", id);
    if (updateError) {
        console.error("Status update failed:", updateError.message);
        return json({ error: "The email was sent, but the status couldn't be saved. Please refresh." }, 500);
    }

    return json({ ok: true, status: action, responded_at: respondedAt });
});
