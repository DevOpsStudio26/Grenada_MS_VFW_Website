// Builds downloadable files of events for visitors: a calendar file (.ics) that
// adds the events to phone, Google, Outlook, or Apple calendars, and a
// spreadsheet (.csv) that opens in Excel or Google Sheets.
import { addDays, parseDate, toDateString } from "./dates";

const POST_NAME = "VFW Post 4488 - Grenada, MS";
const SITE_URL = "https://vfwgrenada.org";

// ---------- Calendar (.ics) ----------

// Commas, semicolons, backslashes, and line breaks must be escaped in .ics text.
function icsText(value = "") {
    return String(value).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// .ics lines over 75 characters must be folded onto continuation lines.
function foldLine(line) {
    const parts = [];
    let rest = line;
    while (rest.length > 74) {
        parts.push(rest.slice(0, 74));
        rest = ` ${rest.slice(74)}`;
    }
    parts.push(rest);
    return parts.join("\r\n");
}

const icsDate = (dateString) => dateString.replace(/-/g, "");

function eventDetails(event) {
    return [
        event.event_time && `Time: ${event.event_time}`,
        event.admission && `Admission: ${event.admission}`,
        event.performer && `Band: ${event.performer}`,
        event.category && `Type: ${event.category}`,
        event.description,
        `${POST_NAME} - ${SITE_URL}`,
    ]
        .filter(Boolean)
        .join("\n");
}

// Events have free-text times ("6 PM - 11 PM"), so they're added as all-day
// events with the time in the title and description.
export function eventsToIcs(events) {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//VFW Post 4488//Events//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        `X-WR-CALNAME:${icsText(POST_NAME)} Events`,
    ];
    for (const event of events) {
        const nextDay = toDateString(addDays(parseDate(event.event_date), 1));
        const title = event.event_time ? `${event.title} (${event.event_time})` : event.title;
        lines.push(
            "BEGIN:VEVENT",
            `UID:${event.id}@vfwgrenada.org`,
            `DTSTAMP:${stamp}`,
            `DTSTART;VALUE=DATE:${icsDate(event.event_date)}`,
            `DTEND;VALUE=DATE:${icsDate(nextDay)}`,
            `SUMMARY:${icsText(title)}`,
            `DESCRIPTION:${icsText(eventDetails(event))}`,
            `LOCATION:${icsText(POST_NAME)}`,
            `URL:${SITE_URL}`,
            "END:VEVENT"
        );
    }
    lines.push("END:VCALENDAR");
    return lines.map(foldLine).join("\r\n") + "\r\n";
}

// ---------- Spreadsheet (.csv) ----------

// Quotes every cell, and stops spreadsheet apps from treating text that starts
// with = + - @ as a formula.
function csvCell(value = "") {
    let text = String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
}

export function eventsToCsv(events) {
    const header = ["Date", "Day", "Title", "Time", "Admission", "Band", "Type", "Repeats", "Description"];
    const rows = events.map((event) => {
        const date = parseDate(event.event_date);
        return [
            date.toLocaleDateString("en-US"),
            date.toLocaleDateString("en-US", { weekday: "long" }),
            event.title,
            event.event_time,
            event.admission,
            event.performer,
            event.category,
            event.repeat_label,
            event.description,
        ];
    });
    // The byte-order mark makes Excel read accented characters and $ correctly.
    return "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// ---------- Saving ----------

export function downloadFile(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
