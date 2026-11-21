import { shareToSocial } from "./api";

export const noSharing = { facebook: false, instagram: false };

const platformNames = { facebook: "Facebook", instagram: "Instagram" };

// Posts a saved event/photo and returns a notice for each platform, e.g.
// [{ text: "Posted to Facebook.", ok: true }]. Never throws: the event or
// photo is already saved, so a failed post is only a warning.
export async function shareAndDescribe(kind, id, options) {
    if (!options.facebook && !options.instagram) return [];
    try {
        const result = await shareToSocial({ kind, id, ...options });
        return Object.entries(platformNames)
            .filter(([key]) => options[key])
            .map(([key, name]) =>
                result[key] === "posted" ? { text: `Posted to ${name}.`, ok: true } : { text: result[key], ok: false }
            );
    } catch (error) {
        return [{ text: `Couldn't post to social media: ${error.message}`, ok: false }];
    }
}
