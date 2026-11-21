// Sort choices for the admin events list. Date ties fall back to title.
const byTitle = (a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" });
const byDate = (a, b) => a.event_date.localeCompare(b.event_date) || byTitle(a, b);

export const sorters = {
    dateAsc: byDate,
    dateDesc: (a, b) => byDate(b, a),
    titleAsc: byTitle,
    titleDesc: (a, b) => byTitle(b, a),
};

export const sortChoices = [
    { value: "dateAsc", label: "Date: soonest first" },
    { value: "dateDesc", label: "Date: latest first" },
    { value: "titleAsc", label: "Title: A to Z" },
    { value: "titleDesc", label: "Title: Z to A" },
];

export const DEFAULT_SORT = "dateAsc";

export const noEventFilters = { search: "", sortBy: DEFAULT_SORT, type: "", band: "" };

// Admission price new events start with (if it's in the admission list).
export const DEFAULT_ADMISSION = "$10";
