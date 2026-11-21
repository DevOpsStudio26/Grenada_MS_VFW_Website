import { useCallback, useMemo, useState } from "react";
import { Calendar, CalendarDays, Clock, Music, Repeat, Star, Tag, Ticket } from "lucide-react";
import { useContent } from "../../hooks/useContent";
import { useEvents } from "../../hooks/useEvents";
import { addDays, formatLongDate, parseDate, toDateString, todayString } from "../../utils/dates";
import EventCalendar from "./EventCalendar";
import DownloadEvents from "./DownloadEvents";

// Every event card is the same height, so the event area is always exactly
// three cards tall, whether there are 0, 2, or 20 events. The blue featured
// card matches it. Tailwind needs these as literal class names:
//   card = 9.5rem; three cards + two 1rem gaps = 30.5rem.
const VISIBLE_EVENTS = 3;
const CARD_HEIGHT = "h-[9.5rem]";
const AREA_HEIGHT = "lg:h-[30.5rem]";
const LIST_MAX_HEIGHT = "max-h-[30.5rem]";

const timeRanges = [
    { value: "any", label: "Any date" },
    { value: "week", label: "Next 7 days" },
    { value: "weekend", label: "This weekend" },
    { value: "month", label: "This month" },
    { value: "nextMonth", label: "Next month" },
    { value: "custom", label: "Pick dates..." },
];

// First and last "YYYY-MM-DD" (inclusive) for a time range, or null for any date.
// "custom" uses the visitor's own dates: one date means just that day; with an
// end date it's that range.
function rangeFor(value, customStart = "", customEnd = "") {
    if (value === "custom") {
        if (!customStart && !customEnd) return null;
        const start = customStart || customEnd;
        const end = customEnd || customStart;
        return start <= end ? [start, end] : [end, start];
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (value === "week") return [toDateString(today), toDateString(addDays(today, 6))];
    if (value === "weekend") {
        // The coming Friday through Sunday; on Saturday or Sunday, today through Sunday.
        const day = today.getDay(); // 0 = Sunday ... 6 = Saturday
        if (day === 0) return [toDateString(today), toDateString(today)];
        if (day === 6) return [toDateString(today), toDateString(addDays(today, 1))];
        const friday = addDays(today, 5 - day);
        return [toDateString(friday), toDateString(addDays(friday, 2))];
    }
    if (value === "month") {
        return [toDateString(today), toDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0))];
    }
    if (value === "nextMonth") {
        return [
            toDateString(new Date(today.getFullYear(), today.getMonth() + 1, 1)),
            toDateString(new Date(today.getFullYear(), today.getMonth() + 2, 0)),
        ];
    }
    return null;
}

const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort();

const selectClass =
    "px-3 py-2 border-2 border-gray-300 rounded-lg bg-white text-sm text-[#0B1E4A] focus:border-[#D4871A] focus:outline-none";

function UpcomingEvents() {
    const content = useContent("home");
    const events = useEvents();
    const [type, setType] = useState("");
    const [performer, setPerformer] = useState("");
    const [when, setWhen] = useState("any");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [calendarOpen, setCalendarOpen] = useState(false);
    const closeCalendar = useCallback(() => setCalendarOpen(false), []);

    const types = useMemo(() => uniqueSorted(events.map((event) => event.category)), [events]);
    const performers = useMemo(() => uniqueSorted(events.map((event) => event.performer)), [events]);

    const filtered = useMemo(() => {
        const range = rangeFor(when, customStart, customEnd);
        return events.filter(
            (event) =>
                (!type || event.category === type) &&
                (!performer || event.performer === performer) &&
                (!range || (event.event_date >= range[0] && event.event_date <= range[1]))
        );
    }, [events, type, performer, when, customStart, customEnd]);

    const isFiltered = type || performer || (when !== "any" && rangeFor(when, customStart, customEnd));
    const [featuredEvent, ...otherEvents] = filtered;
    const today = todayString();

    function clearFilters() {
        setType("");
        setPerformer("");
        setWhen("any");
        setCustomStart("");
        setCustomEnd("");
    }

    return (
        <section className="py-14 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                    <div>
                        <h2
                            className="text-3xl font-bold text-[#0B1E4A]"
                            style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                            {content.eventsTitle}
                        </h2>
                        <div className="w-12 h-1 bg-[#D4871A] mt-2 rounded" />
                    </div>
                    {events.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <DownloadEvents events={filtered} isFiltered={Boolean(isFiltered)} />
                            <button
                                onClick={() => setCalendarOpen(true)}
                                className="inline-flex items-center gap-2 bg-[#0B1E4A] text-white px-4 py-2 rounded-md font-semibold hover:bg-[#162F5E] transition-colors"
                            >
                                <CalendarDays size={18} /> View calendar
                            </button>
                        </div>
                    )}
                </div>

                {events.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 mb-6" role="group" aria-label="Filter events">
                        {types.length > 0 && (
                            <select value={type} onChange={(event) => setType(event.target.value)} className={selectClass} aria-label="Type of event">
                                <option value="">All event types</option>
                                {types.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        )}
                        {performers.length > 0 && (
                            <select
                                value={performer}
                                onChange={(event) => setPerformer(event.target.value)}
                                className={selectClass}
                                aria-label="Band or performer"
                            >
                                <option value="">All bands</option>
                                {performers.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        )}
                        <select value={when} onChange={(event) => setWhen(event.target.value)} className={selectClass} aria-label="Date">
                            {timeRanges.map((range) => (
                                <option key={range.value} value={range.value}>
                                    {range.label}
                                </option>
                            ))}
                        </select>
                        {when === "custom" && (
                            <div className="flex flex-wrap items-center gap-2 text-sm text-[#0B1E4A]">
                                <input
                                    type="date"
                                    value={customStart}
                                    min={today}
                                    onChange={(event) => setCustomStart(event.target.value)}
                                    className={selectClass}
                                    aria-label="Date, or start of date range"
                                />
                                <span className="text-gray-500">to</span>
                                <input
                                    type="date"
                                    value={customEnd}
                                    min={customStart || today}
                                    onChange={(event) => setCustomEnd(event.target.value)}
                                    className={selectClass}
                                    aria-label="End of date range (optional)"
                                />
                                <span className="text-xs text-gray-400">(end date optional)</span>
                            </div>
                        )}
                        {isFiltered && (
                            <button onClick={clearFilters} className="text-sm text-[#A86010] hover:underline">
                                Clear filters
                            </button>
                        )}
                        <span className="text-sm text-gray-500 ml-auto" aria-live="polite">
                            {filtered.length} {filtered.length === 1 ? "event" : "events"}
                        </span>
                    </div>
                )}

                {filtered.length === 0 ? (
                    <div className="text-center py-16 bg-[#F5F1E8] rounded-xl">
                        <p className="text-gray-500 text-lg">
                            {isFiltered ? "No events match these filters." : content.noEventsText}
                        </p>
                        {isFiltered && (
                            <button onClick={clearFilters} className="mt-3 text-[#A86010] font-semibold hover:underline">
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid lg:grid-cols-5 gap-4">
                            <FeaturedEvent event={featuredEvent} />

                            {otherEvents.length > 0 ? (
                                <div
                                    className={`lg:col-span-3 ${LIST_MAX_HEIGHT} ${AREA_HEIGHT} overflow-y-auto space-y-4 pr-2 events-scroll`}
                                    tabIndex={0}
                                    aria-label="More upcoming events"
                                >
                                    {otherEvents.map((event) => (
                                        <EventCard key={event.id} event={event} />
                                    ))}
                                </div>
                            ) : (
                                <div
                                    className={`lg:col-span-3 ${AREA_HEIGHT} rounded-xl bg-[#F5F1E8] flex flex-col items-center justify-center gap-3 p-8 text-center`}
                                >
                                    <p className="text-gray-500">
                                        {isFiltered ? "No other events match these filters." : "No other upcoming events yet."}
                                    </p>
                                    <button
                                        onClick={() => setCalendarOpen(true)}
                                        className="text-[#A86010] font-semibold hover:underline"
                                    >
                                        View calendar
                                    </button>
                                </div>
                            )}
                        </div>
                        {otherEvents.length > VISIBLE_EVENTS && (
                            <p className="text-xs text-gray-400 mt-2 text-right">
                                Scroll to see all {otherEvents.length + 1} events
                            </p>
                        )}
                    </>
                )}
            </div>

            {calendarOpen && <EventCalendar events={events} onClose={closeCalendar} />}
        </section>
    );
}

// `oneLine` keeps the details to a single line (cut off if too long), so
// event cards stay the same height.
function EventMeta({ event, light, oneLine }) {
    const color = light ? "text-[#D4C090]" : "text-gray-500";
    const layout = oneLine ? "flex-nowrap overflow-hidden whitespace-nowrap" : "flex-wrap gap-y-1";
    return (
        <div className={`flex gap-x-4 text-sm ${layout} ${color}`}>
            {event.event_time && (
                <span className="flex items-center gap-1">
                    <Clock size={13} /> {event.event_time}
                </span>
            )}
            {event.admission && (
                <span className="flex items-center gap-1">
                    <Ticket size={13} /> Admission: {event.admission}
                </span>
            )}
            {event.performer && (
                <span className="flex items-center gap-1">
                    <Music size={13} /> {event.performer}
                </span>
            )}
            {event.category && (
                <span className="flex items-center gap-1">
                    <Tag size={13} /> {event.category}
                </span>
            )}
            {event.repeat_label && (
                <span className="flex items-center gap-1">
                    <Repeat size={13} /> {event.repeat_label}
                </span>
            )}
        </div>
    );
}

// On wide screens this is always three event cards tall, scrolling inside if
// its own content (e.g. a flyer plus a long description) is taller.
function FeaturedEvent({ event }) {
    return (
        <div
            className={`lg:col-span-2 ${AREA_HEIGHT} bg-[#0B1E4A] rounded-xl text-white flex flex-col overflow-hidden lg:overflow-y-auto events-scroll`}
        >
            {event.image_url && <img src={event.image_url} alt="" className="w-full max-h-64 object-cover" />}
            <div className="p-7 flex flex-col justify-between flex-1">
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Star className="text-[#D4871A] fill-[#D4871A]" size={16} />
                        <span className="text-[#D4871A] text-xs font-semibold tracking-widest uppercase">
                            {event.event_date === todayString() ? "Today" : "Next up"}
                        </span>
                    </div>
                    <h3
                        className="text-2xl font-bold mb-4 leading-tight"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                        {event.title}
                    </h3>
                    {event.description && (
                        <p className="text-[#B8C8E8] text-sm leading-relaxed mb-6 whitespace-pre-line">{event.description}</p>
                    )}
                </div>
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#D4C090]">
                        <Calendar size={16} />
                        <span className="text-sm">{formatLongDate(event.event_date)}</span>
                    </div>
                    <EventMeta event={event} light />
                </div>
            </div>
        </div>
    );
}

function EventCard({ event }) {
    const date = parseDate(event.event_date);
    return (
        <div
            className={`${CARD_HEIGHT} flex flex-col overflow-hidden bg-[#F5F1E8] rounded-xl p-5 border-l-4 border-[#D4871A] hover:shadow-md transition-shadow`}
        >
            <div className="flex justify-between items-start gap-4 min-h-0">
                <div className="min-w-0">
                    <h3
                        className="text-lg font-bold text-[#0B1E4A] mb-1 truncate"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                        title={event.title}
                    >
                        {event.title}
                    </h3>
                    {event.description && (
                        <p className="text-gray-600 text-sm whitespace-pre-line line-clamp-2">{event.description}</p>
                    )}
                </div>
                <div className="text-right flex-shrink-0">
                    <div className="text-[#D4871A] font-bold text-lg leading-none">{date.getDate()}</div>
                    <div className="text-gray-400 text-xs">{date.toLocaleDateString("en-US", { month: "short" })}</div>
                </div>
            </div>
            <div className="mt-auto pt-2">
                <EventMeta event={event} oneLine />
            </div>
        </div>
    );
}

export default UpcomingEvents;
