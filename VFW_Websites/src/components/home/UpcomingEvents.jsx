import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Calendar, CalendarDays, Clock, Music, Repeat, Star, Tag } from "lucide-react";
import { useContent } from "../../hooks/useContent";
import { useEvents } from "../../hooks/useEvents";
import { addDays, formatLongDate, parseDate, toDateString, todayString } from "../../utils/dates";
import EventCalendar from "./EventCalendar";

// How many event cards show before the list scrolls.
const VISIBLE_EVENTS = 3;

// Limits a list's height to exactly its first `count` children (they vary in
// height), re-measuring when the window or the cards resize.
function useVisibleCount(count, deps) {
    const listRef = useRef(null);
    const [maxHeight, setMaxHeight] = useState(undefined);

    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list) return undefined;
        function measure() {
            const cards = list.children;
            if (cards.length <= count) {
                setMaxHeight(undefined);
                return;
            }
            // The list is position: relative, so offsetTop is measured from its top.
            const last = cards[count - 1];
            setMaxHeight(last.offsetTop + last.offsetHeight);
        }
        measure();
        const observer = new ResizeObserver(measure);
        [...list.children].slice(0, count).forEach((card) => observer.observe(card));
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [count, ...deps]);

    return { listRef, maxHeight };
}

const timeRanges = [
    { value: "any", label: "Any date" },
    { value: "week", label: "Next 7 days" },
    { value: "weekend", label: "This weekend" },
    { value: "month", label: "This month" },
    { value: "nextMonth", label: "Next month" },
];

// First and last "YYYY-MM-DD" (inclusive) for a time range, or null for any date.
function rangeFor(value) {
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
    const [calendarOpen, setCalendarOpen] = useState(false);
    const closeCalendar = useCallback(() => setCalendarOpen(false), []);

    const types = useMemo(() => uniqueSorted(events.map((event) => event.category)), [events]);
    const performers = useMemo(() => uniqueSorted(events.map((event) => event.performer)), [events]);

    const filtered = useMemo(() => {
        const range = rangeFor(when);
        return events.filter(
            (event) =>
                (!type || event.category === type) &&
                (!performer || event.performer === performer) &&
                (!range || (event.event_date >= range[0] && event.event_date <= range[1]))
        );
    }, [events, type, performer, when]);

    const isFiltered = type || performer || when !== "any";
    const [featuredEvent, ...otherEvents] = filtered;
    const { listRef, maxHeight } = useVisibleCount(VISIBLE_EVENTS, [filtered]);

    function clearFilters() {
        setType("");
        setPerformer("");
        setWhen("any");
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
                        <button
                            onClick={() => setCalendarOpen(true)}
                            className="inline-flex items-center gap-2 bg-[#0B1E4A] text-white px-4 py-2 rounded-md font-semibold hover:bg-[#162F5E] transition-colors"
                        >
                            <CalendarDays size={18} /> View calendar
                        </button>
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
                        {/* Columns stretch to the same height, so the featured card
                            lines up with the top and bottom of the event list. */}
                        <div className="grid lg:grid-cols-5 gap-4">
                            <FeaturedEvent event={featuredEvent} matchListHeight={otherEvents.length > 0} />

                            {otherEvents.length > 0 && (
                                <div
                                    ref={listRef}
                                    style={{ maxHeight }}
                                    className="lg:col-span-3 relative overflow-y-auto space-y-4 pr-2 events-scroll"
                                    tabIndex={0}
                                    aria-label="More upcoming events"
                                >
                                    {otherEvents.map((event) => (
                                        <EventCard key={event.id} event={event} />
                                    ))}
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

function EventMeta({ event, light }) {
    const color = light ? "text-[#D4C090]" : "text-gray-500";
    return (
        <div className={`flex flex-wrap gap-x-4 gap-y-1 text-sm ${color}`}>
            {event.event_time && (
                <span className="flex items-center gap-1">
                    <Clock size={13} /> {event.event_time}
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

// With matchListHeight, on wide screens the event list alone decides the row's
// height (contain: size stops this card's content from stretching it) and this
// card fills it, scrolling if its own content is taller.
function FeaturedEvent({ event, matchListHeight }) {
    const sizing = matchListHeight ? "lg:[contain:size] lg:overflow-y-auto events-scroll" : "overflow-hidden";
    return (
        <div className={`lg:col-span-2 bg-[#0B1E4A] rounded-xl text-white flex flex-col ${sizing}`}>
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
        <div className="bg-[#F5F1E8] rounded-xl p-5 border-l-4 border-[#D4871A] hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
                    <h3
                        className="text-lg font-bold text-[#0B1E4A] mb-1"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                        {event.title}
                    </h3>
                    {event.description && (
                        <p className="text-gray-600 text-sm mb-2 whitespace-pre-line line-clamp-3">{event.description}</p>
                    )}
                </div>
                <div className="text-right flex-shrink-0">
                    <div className="text-[#D4871A] font-bold text-lg leading-none">{date.getDate()}</div>
                    <div className="text-gray-400 text-xs">{date.toLocaleDateString("en-US", { month: "short" })}</div>
                </div>
            </div>
            <EventMeta event={event} />
        </div>
    );
}

export default UpcomingEvents;
