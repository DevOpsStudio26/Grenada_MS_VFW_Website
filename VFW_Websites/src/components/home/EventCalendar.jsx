import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Music, X } from "lucide-react";
import { formatLongDate, parseDate, toDateString, todayString } from "../../utils/dates";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Pop-up month calendar of upcoming events. Click a day to see its events.
function EventCalendar({ events, onClose }) {
    const today = todayString();
    const firstMonth = useMemo(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }, []);
    // Start on the month of the soonest event, with that day selected.
    const [month, setMonth] = useState(() => {
        if (!events[0]) return firstMonth;
        const first = parseDate(events[0].event_date);
        return new Date(first.getFullYear(), first.getMonth(), 1);
    });
    const [selectedDay, setSelectedDay] = useState(() => events[0]?.event_date ?? today);
    const closeButton = useRef(null);

    // Close with Escape, keep the page behind from scrolling, and focus the dialog.
    useEffect(() => {
        const onKey = (event) => event.key === "Escape" && onClose();
        document.addEventListener("keydown", onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        closeButton.current?.focus();
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [onClose]);

    const eventsByDay = useMemo(() => {
        const map = new Map();
        events.forEach((event) => map.set(event.event_date, [...(map.get(event.event_date) ?? []), event]));
        return map;
    }, [events]);

    const lastEvent = events.at(-1);
    const lastMonth = lastEvent ? parseDate(lastEvent.event_date) : firstMonth;
    const canGoBack = month > firstMonth;
    const canGoForward =
        month.getFullYear() * 12 + month.getMonth() < lastMonth.getFullYear() * 12 + lastMonth.getMonth();

    // 6 rows x 7 days, starting on the Sunday on/before the 1st.
    const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
    const cells = Array.from({ length: 42 }, (_, i) => {
        const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
        return { date, key: toDateString(date), inMonth: date.getMonth() === month.getMonth() };
    });
    // Drop a trailing week that's entirely next month.
    const visibleCells = cells.slice(35).every((cell) => !cell.inMonth) ? cells.slice(0, 35) : cells;

    function changeMonth(step) {
        setMonth(new Date(month.getFullYear(), month.getMonth() + step, 1));
    }

    const selectedEvents = eventsByDay.get(selectedDay) ?? [];

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={(event) => event.target === event.currentTarget && onClose()}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="calendar-title"
                className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border-t-4 border-[#D4871A]"
            >
                <div className="flex items-center justify-between gap-2 p-4 border-b border-gray-100">
                    <button
                        onClick={() => changeMonth(-1)}
                        disabled={!canGoBack}
                        className="p-2 rounded hover:bg-[#F5F1E8] text-[#0B1E4A] disabled:opacity-30"
                        aria-label="Previous month"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <h2
                        id="calendar-title"
                        className="text-xl font-bold text-[#0B1E4A] text-center flex-1"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                        {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </h2>
                    <button
                        onClick={() => changeMonth(1)}
                        disabled={!canGoForward}
                        className="p-2 rounded hover:bg-[#F5F1E8] text-[#0B1E4A] disabled:opacity-30"
                        aria-label="Next month"
                    >
                        <ChevronRight size={20} />
                    </button>
                    <button
                        ref={closeButton}
                        onClick={onClose}
                        className="p-2 rounded hover:bg-[#F5F1E8] text-gray-500 ml-2"
                        aria-label="Close calendar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4">
                    <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-500 mb-1">
                        {weekdays.map((day) => (
                            <div key={day} className="py-1">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {visibleCells.map(({ date, key, inMonth }) => {
                            const dayEvents = eventsByDay.get(key) ?? [];
                            const isPast = key < today;
                            const isSelected = key === selectedDay;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setSelectedDay(key)}
                                    disabled={!inMonth}
                                    aria-label={`${formatLongDate(key)}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}` : ""}`}
                                    aria-pressed={isSelected}
                                    className={`min-h-[3.5rem] sm:min-h-[5rem] rounded-lg p-1 text-left align-top flex flex-col transition-colors ${
                                        !inMonth
                                            ? "invisible"
                                            : isSelected
                                              ? "bg-[#0B1E4A] text-white"
                                              : dayEvents.length
                                                ? "bg-[#FFF5E8] hover:bg-[#FCE7C8] text-[#0B1E4A]"
                                                : "hover:bg-gray-50 text-gray-700"
                                    } ${isPast && !isSelected ? "opacity-50" : ""}`}
                                >
                                    <span className={`text-sm font-semibold ${key === today && !isSelected ? "text-[#D4871A]" : ""}`}>
                                        {date.getDate()}
                                    </span>
                                    {dayEvents.slice(0, 2).map((event) => (
                                        <span
                                            key={event.id}
                                            className={`hidden sm:block text-[11px] leading-tight truncate w-full ${
                                                isSelected ? "text-[#D4C090]" : "text-[#A86010]"
                                            }`}
                                        >
                                            {event.title}
                                        </span>
                                    ))}
                                    {dayEvents.length > 0 && (
                                        <span className="sm:hidden mt-auto w-2 h-2 rounded-full bg-[#D4871A]" />
                                    )}
                                    {dayEvents.length > 2 && (
                                        <span className="hidden sm:block text-[11px] text-gray-400">
                                            +{dayEvents.length - 2} more
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-5 border-t border-gray-100 pt-4" aria-live="polite">
                        <h3 className="font-semibold text-[#0B1E4A] mb-2">{formatLongDate(selectedDay)}</h3>
                        {selectedEvents.length === 0 ? (
                            <p className="text-gray-500 text-sm">No events on this day.</p>
                        ) : (
                            <ul className="space-y-3">
                                {selectedEvents.map((event) => (
                                    <li key={event.id} className="bg-[#F5F1E8] rounded-lg p-4 border-l-4 border-[#D4871A] flex gap-3">
                                        {event.image_url && (
                                            <img src={event.image_url} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                            <p className="font-bold text-[#0B1E4A]">{event.title}</p>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
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
                                                {event.category && <span className="text-[#A86010]">{event.category}</span>}
                                            </div>
                                            {event.description && (
                                                <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{event.description}</p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EventCalendar;
