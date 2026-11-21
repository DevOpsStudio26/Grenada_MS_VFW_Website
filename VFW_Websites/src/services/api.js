import { supabase } from "./supabase";
import { uploadImage, deleteImage, uploadDocument, deleteDocumentFiles, DOCUMENT_BUCKET } from "./storage";
import { todayString } from "../utils/dates";

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
    return unwrap(await supabase.from("events").select("*").order("event_date"));
}

// Creates one event, or one per date for a repeating event (sharing a series_id).
// Returns the first event created.
export async function createEvents(fields, dates, repeatLabel = "") {
    const seriesId = dates.length > 1 ? crypto.randomUUID() : null;
    const rows = dates.map((event_date) => ({
        ...fields,
        event_date,
        series_id: seriesId,
        repeat_label: seriesId ? repeatLabel : "",
    }));
    const created = unwrap(await supabase.from("events").insert(rows).select().order("event_date"));
    return created[0];
}

// `fields` must not include event_date when updating a whole series.
export async function updateEvent(id, fields) {
    unwrap(await supabase.from("events").update(fields).eq("id", id));
}

// Updates this date and every later date in the series.
export async function updateSeriesFrom(seriesId, fromDate, fields) {
    unwrap(await supabase.from("events").update(fields).eq("series_id", seriesId).gte("event_date", fromDate));
}

export async function deleteEvent(event) {
    unwrap(await supabase.from("events").delete().eq("id", event.id));
    await removeUnusedEventImage(event.image_path);
}

// Deletes this date and every later date in the series.
export async function deleteSeriesFrom(event) {
    unwrap(
        await supabase.from("events").delete().eq("series_id", event.series_id).gte("event_date", event.event_date)
    );
    await removeUnusedEventImage(event.image_path);
}

// Events in a series share one flyer, so it's only deleted once nothing uses it.
export async function removeUnusedEventImage(path) {
    if (!path) return;
    const { count, error } = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("image_path", path);
    if (error || count > 0) return;
    await deleteImage(path).catch((deleteError) => console.error("Couldn't delete flyer:", deleteError.message));
}

export async function uploadEventImage(file) {
    return uploadImage(file, "events");
}

// ---------- Facebook & Instagram ----------

// Posts an event or photo to the post's Facebook Page and/or Instagram
// (supabase/functions/share-to-social). Returns { facebook, instagram }, each
// "posted", "skipped", or an error message.
export async function shareToSocial({ kind, id, facebook, instagram }) {
    return callFunction("share-to-social", { kind, id, facebook, instagram });
}

// ---------- Photos ----------

export async function fetchPhotos() {
    if (!supabase) return [];
    return unwrap(await supabase.from("photos").select("*").order("created_at", { ascending: false }));
}

// Returns the saved photo.
export async function addPhoto(file, caption, inSlideshow) {
    const { url, path } = await uploadImage(file, "gallery");
    try {
        return unwrap(
            await supabase
                .from("photos")
                .insert({ url, storage_path: path, caption, in_slideshow: inSlideshow })
                .select()
                .single()
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

// Documents are in a private bucket, so admins get a link that works for 5 minutes.
// Pass a filename to download instead of opening it.
export async function getDocumentLink(path, downloadName) {
    const { data, error } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .createSignedUrl(path, 300, downloadName ? { download: downloadName } : undefined);
    if (error) throw error;
    return data.signedUrl;
}

// Each application comes with its files as `application_documents`, oldest first.
export async function fetchApplications() {
    return unwrap(
        await supabase
            .from("applications")
            .select("*, application_documents(*)")
            .order("created_at", { ascending: false })
            .order("created_at", { referencedTable: "application_documents" })
    );
}

// Attaches a file to an application, e.g. a document the applicant emailed in.
export async function addApplicationDocument(applicationId, file) {
    const path = await uploadDocument(file, applicationId);
    try {
        unwrap(
            await supabase.from("application_documents").insert({
                application_id: applicationId,
                storage_path: path,
                file_name: file.name.slice(0, 200),
                added_by: "admin",
            })
        );
    } catch (error) {
        await deleteDocumentFiles([path]).catch(() => {});
        throw error;
    }
}

export async function deleteApplicationDocument(document) {
    unwrap(await supabase.from("application_documents").delete().eq("id", document.id));
    await deleteDocumentFiles([document.storage_path]);
}

export async function updateApplicationStatus(id, status) {
    unwrap(await supabase.from("applications").update({ status }).eq("id", id));
}

// Accepts, declines, or asks for more info, and emails the applicant
// (supabase/functions/respond-to-application). action: "approved" | "declined" | "info_requested"
export async function respondToApplication(id, action, message = "") {
    return callFunction("respond-to-application", { id, action, message });
}

// Deleting the application removes its document rows too (on delete cascade);
// this then removes the files themselves.
export async function deleteApplication(application) {
    const paths = (application.application_documents ?? []).map((document) => document.storage_path);
    if (application.dd214_path) paths.push(application.dd214_path);
    unwrap(await supabase.from("applications").delete().eq("id", application.id));
    await deleteDocumentFiles(paths).catch((error) =>
        console.error("Couldn't delete the application's files:", error.message)
    );
}

// ---------- Admin sign-in ----------

export async function checkIsAdmin() {
    return unwrap(await supabase.rpc("is_admin")) === true;
}
