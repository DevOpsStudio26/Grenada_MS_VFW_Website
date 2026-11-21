// Event dates are stored as "YYYY-MM-DD". Parsing that directly treats it as UTC,
// which shows the previous day in US time zones, so always parse as a local date.
export function parseDate(dateString) {
    return new Date(`${dateString}T00:00:00`);
}

// A local Date as "YYYY-MM-DD".
export function toDateString(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

export function todayString() {
    return toDateString(new Date());
}

export function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
}

export function formatLongDate(dateString) {
    return parseDate(dateString).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

export function formatShortDate(dateString) {
    return parseDate(dateString).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

// ---------- Repeating events ----------

const MAX_OCCURRENCES = 104;
export const MAX_REPEAT_MONTHS = 24;

const ordinals = ["1st", "2nd", "3rd", "4th", "last"];
const weekdayName = (date) => date.toLocaleDateString("en-US", { weekday: "long" });

// Which week of the month a date falls in: 0 = first ... 3 = fourth, 4 = fifth,
// which repeats as "last" since most months don't have a fifth.
function weekOfMonth(date) {
    return Math.floor((date.getDate() - 1) / 7);
}

// The nth weekday (0-3, or 4 = last) of a given month, or null.
function nthWeekdayOfMonth(year, month, weekday, nth) {
    if (nth === 4) {
        const last = new Date(year, month + 1, 0);
        return addDays(last, -((last.getDay() - weekday + 7) % 7));
    }
    // `month` may run past 11 (e.g. 13 = February next year); Date handles that.
    const first = new Date(year, month, 1);
    const date = addDays(first, ((weekday - first.getDay() + 7) % 7) + nth * 7);
    return date.getMonth() === first.getMonth() ? date : null;
}

// The choices shown in the event form, worded for the chosen start date.
export function repeatOptions(startDateString) {
    if (!startDateString) {
        return [{ value: "none", label: "Does not repeat" }];
    }
    const start = parseDate(startDateString);
    const day = weekdayName(start);
    const nth = weekOfMonth(start);
    return [
        { value: "none", label: "Does not repeat" },
        { value: "weekly", label: `Every ${day}` },
        { value: "biweekly", label: `Every other ${day}` },
        { value: "monthly_weekday", label: `The ${ordinals[nth]} ${day} of each month` },
        { value: "monthly_date", label: `Monthly on the ${start.getDate()}${daySuffix(start.getDate())}` },
    ];
}

function daySuffix(day) {
    if (day >= 11 && day <= 13) return "th";
    return { 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th";
}

// Every date from the start through `until` (inclusive) for a repeat rule.
// Returns "YYYY-MM-DD" strings, first date included.
export function repeatDates(startDateString, rule, untilDateString) {
    const start = parseDate(startDateString);
    if (rule === "none" || !untilDateString) return [startDateString];
    const until = parseDate(untilDateString);
    const dates = [];

    if (rule === "weekly" || rule === "biweekly") {
        const step = rule === "weekly" ? 7 : 14;
        for (let date = start; date <= until && dates.length < MAX_OCCURRENCES; date = addDays(date, step)) {
            dates.push(toDateString(date));
        }
        return dates;
    }

    const nth = weekOfMonth(start);
    for (let offset = 0; dates.length < MAX_OCCURRENCES; offset += 1) {
        const year = start.getFullYear();
        const month = start.getMonth() + offset;
        const date =
            rule === "monthly_weekday"
                ? nthWeekdayOfMonth(year, month, start.getDay(), nth)
                : new Date(year, month, start.getDate());
        if (new Date(year, month, 1) > until) break;
        // Skip months without that date (e.g. the 31st in April rolls into May).
        if (!date || (rule === "monthly_date" && date.getDate() !== start.getDate())) continue;
        if (date >= start && date <= until) dates.push(toDateString(date));
    }
    return dates;
}
