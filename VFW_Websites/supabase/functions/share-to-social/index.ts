// Admin-only: posts an event or a gallery photo to the post's Facebook Page and
// Instagram account through Meta's Graph API.
//
// Secrets (set with `supabase secrets set NAME=value`, or in the dashboard under
// Edge Functions -> Secrets). See the README for how to get them.
//   META_PAGE_ID           - the Facebook Page's ID
//   META_PAGE_ACCESS_TOKEN - a long-lived Page access token
//   INSTAGRAM_ACCOUNT_ID   - the Instagram professional account linked to the Page
//                            (optional; leave unset to post to Facebook only)
//   META_GRAPH_VERSION     - optional, defaults to v27.0

import { corsHeaders, db, json, POST_NAME, SITE_URL, text } from "../_shared/helpers.ts";

type Result = "posted" | "skipped" | string;

const graphVersion = () => Deno.env.get("META_GRAPH_VERSION") || "v27.0";

async function graph(path: string, params: Record<string, string>, method = "POST") {
    const token = Deno.env.get("META_PAGE_ACCESS_TOKEN") ?? "";
    const query = new URLSearchParams({ ...params, access_token: token });
    const url = `https://graph.facebook.com/${graphVersion()}/${path}`;
    const response =
        method === "GET"
            ? await fetch(`${url}?${query}`)
            : await fetch(url, { method: "POST", body: query });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) {
        throw new Error(data.error?.message ?? `Meta returned ${response.status}`);
    }
    return data;
}

function formatDate(dateString: string) {
    return new Date(`${dateString}T00:00:00Z`).toLocaleDateString("en-US", {
        timeZone: "UTC",
        weekday: "long",
        month: "long",
        day: "numeric",
    });
}

// Builds the post text and picks the picture for an event or photo.
async function loadPost(kind: string, id: string) {
    if (kind === "event") {
        const { data: event } = await db.from("events").select("*").eq("id", id).maybeSingle();
        if (!event) return null;
        const details = [
            `📅 ${formatDate(event.event_date)}${event.event_time ? ` · ${event.event_time}` : ""}`,
            event.repeat_label && `🔁 ${event.repeat_label}`,
            event.performer && `🎵 ${event.performer}`,
            event.admission && `🎟 Admission: ${event.admission}`,
        ].filter(Boolean);
        // Blank lines between the title, details, description, and sign-off.
        const message = [event.title, details.join("\n"), event.description, `${POST_NAME}\n${SITE_URL}`]
            .filter(Boolean)
            .join("\n\n");
        return { message, image: event.image_url };
    }
    if (kind === "photo") {
        const { data: photo } = await db.from("photos").select("*").eq("id", id).maybeSingle();
        if (!photo) return null;
        const message = [photo.caption, `${POST_NAME}\n${SITE_URL}/gallery`].filter(Boolean).join("\n\n");
        return { message, image: photo.url };
    }
    return null;
}

async function postToFacebook(message: string, image: string): Promise<Result> {
    const pageId = Deno.env.get("META_PAGE_ID");
    if (!pageId || !Deno.env.get("META_PAGE_ACCESS_TOKEN")) return "Facebook isn't connected yet (see the README).";
    if (image) {
        await graph(`${pageId}/photos`, { url: image, caption: message });
    } else {
        await graph(`${pageId}/feed`, { message, link: SITE_URL });
    }
    return "posted";
}

async function postToInstagram(message: string, image: string): Promise<Result> {
    const accountId = Deno.env.get("INSTAGRAM_ACCOUNT_ID");
    if (!accountId || !Deno.env.get("META_PAGE_ACCESS_TOKEN")) return "Instagram isn't connected yet (see the README).";
    if (!image) return "Instagram posts need a picture. Add a flyer image to the event to post it there.";
    if (!/\.jpe?g$/i.test(new URL(image).pathname)) return "Instagram only accepts JPG pictures.";

    const container = await graph(`${accountId}/media`, { image_url: image, caption: message.slice(0, 2200) });
    // Instagram processes the picture before it can be published.
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const status = await graph(container.id, { fields: "status_code" }, "GET");
        if (status.status_code === "FINISHED") break;
        if (status.status_code === "ERROR") throw new Error("Instagram couldn't process the picture.");
        await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    await graph(`${accountId}/media_publish`, { creation_id: container.id });
    return "posted";
}

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    // Only signed-in admins may post
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: userData } = await db.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Please sign in again." }, 401);
    const { data: adminRow } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!adminRow) return json({ error: "Only admins can post to social media." }, 403);

    const body = await request.json().catch(() => ({}));
    const kind = text(body.kind, 20);
    const id = text(body.id, 50);
    const post = await loadPost(kind, id);
    if (!post) return json({ error: "Couldn't find that event or photo." }, 404);

    const result: { facebook: Result; instagram: Result } = { facebook: "skipped", instagram: "skipped" };
    if (body.facebook) {
        result.facebook = await postToFacebook(post.message, post.image).catch((error) => {
            console.error("Facebook post failed:", error.message);
            return `Facebook said: ${error.message}`;
        });
    }
    if (body.instagram) {
        result.instagram = await postToInstagram(post.message, post.image).catch((error) => {
            console.error("Instagram post failed:", error.message);
            return `Instagram said: ${error.message}`;
        });
    }
    return json(result);
});
