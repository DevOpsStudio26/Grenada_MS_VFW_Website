import { supabase } from "./supabase";
import { uploadImage, deleteImage } from "./storage";

// Supabase returns { data, error } instead of throwing; this turns errors into exceptions.
function unwrap({ data, error }) {
    if (error) throw error;
    return data;
}

// Calls a Supabase Edge Function and turns its { error } reply into an exception
// with a message that's safe to show on screen.
async function callFunction(name, body) {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
        const reply = await error.context?.json?.().catch(() => null);
        throw new Error(reply?.error || "Something went wrong. Please try again.");
    }
    return data;
}

// Today's date as YYYY-MM-DD in the visitor's own time zone.
function todayString() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
}

// ---------- Page content ----------

// Returns everything saved from the Pages tab, keyed by section ("home", "contact", ...).
export async function fetchAllContent() {
    if (!supabase) return {};
    const rows = unwrap(await supabase.from("site_content").select("key, value"));
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function saveContent(key, value) {
    unwrap(
        await supabase
            .from("site_content")
            .upsert({ key, value, updated_at: new Date().toISOString() })
    );
}

// ---------- Events ----------

export async function fetchUpcomingEvents() {
    if (!supabase) return [];
    return unwrap(
        await supabase
            .from("events")
            .select("*")
            .gte("event_date", todayString())
            .order("event_date")
    );
}

export async function fetchAllEvents() {
    return unwrap(await supabase.from("events").select("*").order("event_date", { ascending: false }));
}

export async function saveEvent({ id, title, description, event_date, event_time }) {
    const fields = { title, description, event_date, event_time };
    if (id) {
        unwrap(await supabase.from("events").update(fields).eq("id", id));
    } else {
        unwrap(await supabase.from("events").insert(fields));
    }
}

export async function deleteEvent(id) {
    unwrap(await supabase.from("events").delete().eq("id", id));
}

// ---------- Photos ----------

export async function fetchPhotos() {
    if (!supabase) return [];
    return unwrap(await supabase.from("photos").select("*").order("created_at", { ascending: false }));
}

export async function addPhoto(file, caption, inSlideshow) {
    const { url, path } = await uploadImage(file, "gallery");
    try {
        unwrap(
            await supabase
                .from("photos")
                .insert({ url, storage_path: path, caption, in_slideshow: inSlideshow })
        );
    } catch (error) {
        await deleteImage(path).catch(() => {});
        throw error;
    }
}

export async function updatePhoto(id, fields) {
    unwrap(await supabase.from("photos").update(fields).eq("id", id));
}

export async function deletePhoto(photo) {
    unwrap(await supabase.from("photos").delete().eq("id", photo.id));
    await deleteImage(photo.storage_path);
}

// ---------- Membership applications ----------

// Saves the application (plus the optional DD-214 file) and emails the post a copy
// (supabase/functions/submit-application).
export async function submitApplication(form, dd214File) {
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    if (dd214File) body.append("dd214", dd214File);
    await callFunction("submit-application", body);
}

// DD-214s are in a private bucket, so admins get a link that works for 5 minutes.
// Pass a filename to download instead of opening it.
export async function getDocumentLink(path, downloadName) {
    const { data, error } = await supabase.storage
        .from("dd214-documents")
        .createSignedUrl(path, 300, downloadName ? { download: downloadName } : undefined);
    if (error) throw error;
    return data.signedUrl;
}

export async function fetchApplications() {
    return unwrap(
        await supabase.from("applications").select("*").order("created_at", { ascending: false })
    );
}

export async function updateApplicationStatus(id, status) {
    unwrap(await supabase.from("applications").update({ status }).eq("id", id));
}

// Accepts, declines, or asks for more info, and emails the applicant
// (supabase/functions/respond-to-application). action: "approved" | "declined" | "info_requested"
export async function respondToApplication(id, action, message = "") {
    return callFunction("respond-to-application", { id, action, message });
}

export async function deleteApplication(application) {
    unwrap(await supabase.from("applications").delete().eq("id", application.id));
    if (application.dd214_path) {
        const { error } = await supabase.storage.from("dd214-documents").remove([application.dd214_path]);
        if (error) console.error("Couldn't delete the DD-214 file:", error.message);
    }
}

// ---------- Admin sign-in ----------

export async function checkIsAdmin() {
    return unwrap(await supabase.rpc("is_admin")) === true;
}
