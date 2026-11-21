import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, ImagePlus, Music, Pencil, Plus, Repeat, Tag, Trash2 } from "lucide-react";
import {
    createEvents,
    deleteEvent,
    deleteSeriesFrom,
    fetchAllEvents,
    removeUnusedEventImage,
    updateEvent,
    updateSeriesFrom,
    uploadEventImage,
} from "../../services/api";
import { checkImageFile } from "../../services/storage";
import { noSharing, shareAndDescribe } from "../../services/social";
import { eventTypes } from "../../data/eventTypes";
import { addDays, formatShortDate, MAX_REPEAT_MONTHS, parseDate, repeatDates, repeatOptions, toDateString, todayString } from "../../utils/dates";
import SocialShareOptions from "./SocialShare";
import { cardClass, dangerButtonClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "./styles";

const emptyEvent = {
    title: "",
    category: "",
    performer: "",
    event_date: "",
    event_time: "",
    description: "",
    image_url: "",
    image_path: "",
};

function EventsTab() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notices, setNotices] = useState([]);
    const [editing, setEditing] = useState(null);
    const [showPast, setShowPast] = useState(false);

    // Reloads the list after a change.
    async function loadEvents() {
        try {
            setEvents(await fetchAllEvents());
        } catch (loadError) {
            setError(`Couldn't load events: ${loadError.message}`);
        }
    }

    useEffect(() => {
        fetchAllEvents()
            .then(setEvents)
            .catch((loadError) => setError(`Couldn't load events: ${loadError.message}`))
            .finally(() => setLoading(false));
    }, []);

    const today = todayString();
    const visible = showPast ? [...events].reverse() : events.filter((event) => event.event_date >= today);
    const pastCount = events.filter((event) => event.event_date < today).length;
    const performers = useMemo(
        () => [...new Set(events.map((event) => event.performer).filter(Boolean))].sort(),
        [events]
    );

    async function runDelete(action) {
        setError("");
        try {
            await action();
            await loadEvents();
        } catch (deleteError) {
            setError(`Couldn't delete: ${deleteError.message}`);
        }
    }

    return (
        <div className="space-y-6">
            {editing ? (
                <EventForm
                    initialEvent={editing}
                    performers={performers}
                    onCancel={() => setEditing(null)}
                    onSaved={async (messages) => {
                        setEditing(null);
                        setNotices(messages);
                        await loadEvents();
                    }}
                />
            ) : (
                <button
                    onClick={() => {
                        setNotices([]);
                        setEditing(emptyEvent);
                    }}
                    className={`${primaryButtonClass} inline-flex items-center gap-2`}
                >
                    <Plus size={18} /> Add event
                </button>
            )}

            {error && <p className="text-sm text-[#9B1C2E]">{error}</p>}
            {notices.length > 0 && (
                <ul className="text-sm bg-white rounded-lg p-3 space-y-1 border-l-4 border-[#D4871A]">
                    {notices.map((notice) => (
                        <li key={notice.text} className={notice.ok ? "text-green-700" : "text-[#9B1C2E]"}>
                            {notice.text}
                        </li>
                    ))}
                </ul>
            )}

            <div className={cardClass}>
                <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                    <div>
                        <h2
                            className="text-2xl font-bold text-[#0B1E4A] mb-1"
                            style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                            Events
                        </h2>
                        <p className="text-gray-500 text-sm">
                            Upcoming events show on the home page automatically. Past events are hidden from visitors.
                        </p>
                    </div>
                    {pastCount > 0 && (
                        <label className="flex items-center gap-2 text-sm text-[#0B1E4A]">
                            <input type="checkbox" checked={showPast} onChange={(event) => setShowPast(event.target.checked)} />
                            Show past events ({pastCount})
                        </label>
                    )}
                </div>

                {loading ? (
                    <p className="text-gray-500">Loading...</p>
                ) : visible.length === 0 ? (
                    <p className="text-gray-500">No upcoming events.</p>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {visible.map((event) => (
                            <EventRow
                                key={event.id}
                                event={event}
                                onEdit={() => {
                                    setNotices([]);
                                    setEditing(event);
                                }}
                                onDeleteOne={() => runDelete(() => deleteEvent(event))}
                                onDeleteSeries={() => runDelete(() => deleteSeriesFrom(event))}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function EventRow({ event, onEdit, onDeleteOne, onDeleteSeries }) {
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    function handleDeleteClick() {
        if (event.series_id) {
            setConfirmingDelete(true);
        } else if (window.confirm(`Delete "${event.title}"?`)) {
            onDeleteOne();
        }
    }

    return (
        <li className="py-4">
            <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3 min-w-0">
                    {event.image_url && (
                        <img src={event.image_url} alt="" className="w-14 h-14 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                        <p className="font-semibold text-[#0B1E4A]">{event.title}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                                <Calendar size={14} /> {formatShortDate(event.event_date)}
                            </span>
                            {event.event_time && (
                                <span className="flex items-center gap-1">
                                    <Clock size={14} /> {event.event_time}
                                </span>
                            )}
                            {event.category && (
                                <span className="flex items-center gap-1">
                                    <Tag size={14} /> {event.category}
                                </span>
                            )}
                            {event.performer && (
                                <span className="flex items-center gap-1">
                                    <Music size={14} /> {event.performer}
                                </span>
                            )}
                            {event.repeat_label && (
                                <span className="flex items-center gap-1 text-[#A86010]">
                                    <Repeat size={14} /> {event.repeat_label}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                    <button onClick={onEdit} className="p-2 text-[#0B1E4A] hover:bg-[#F5F1E8] rounded" aria-label="Edit">
                        <Pencil size={16} />
                    </button>
                    <button
                        onClick={handleDeleteClick}
                        className="p-2 text-[#9B1C2E] hover:bg-[#FFF0F3] rounded"
                        aria-label="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {confirmingDelete && (
                <div className="mt-3 p-3 rounded-lg bg-[#FFF0F3] text-sm">
                    <p className="text-[#0B1E4A] mb-2">
                        "{event.title}" repeats ({event.repeat_label}). What do you want to delete?
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={onDeleteOne} className={`${dangerButtonClass} bg-white`}>
                            Only {formatShortDate(event.event_date)}
                        </button>
                        <button onClick={onDeleteSeries} className={`${dangerButtonClass} bg-white`}>
                            This date and all later dates
                        </button>
                        <button onClick={() => setConfirmingDelete(false)} className="px-3 py-2 text-gray-600">
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </li>
    );
}

function EventForm({ initialEvent, performers, onCancel, onSaved }) {
    const isNew = !initialEvent.id;
    const inSeries = Boolean(initialEvent.series_id);
    const [event, setEvent] = useState(initialEvent);
    const [repeat, setRepeat] = useState("none");
    const [repeatUntil, setRepeatUntil] = useState("");
    const [applyToSeries, setApplyToSeries] = useState(true);
    const [imageFile, setImageFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(initialEvent.image_url);
    const [sharing, setSharing] = useState(noSharing);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const options = repeatOptions(event.event_date);
    const repeatLabel = options.find((option) => option.value === repeat)?.label ?? "";
    let maxUntil = "";
    if (event.event_date) {
        const limit = parseDate(event.event_date);
        limit.setMonth(limit.getMonth() + MAX_REPEAT_MONTHS);
        maxUntil = toDateString(limit);
    }
    const dates = repeat === "none" || !event.event_date ? [event.event_date] : repeatDates(event.event_date, repeat, repeatUntil);

    function handleChange(changeEvent) {
        const { name, value } = changeEvent.target;
        setEvent({ ...event, [name]: value });
    }

    function handleRepeatChange(value) {
        setRepeat(value);
        // Default to three months of dates.
        if (value !== "none" && !repeatUntil && event.event_date) {
            setRepeatUntil(toDateString(addDays(parseDate(event.event_date), 91)));
        }
    }

    function handleImageChange(changeEvent) {
        const file = changeEvent.target.files?.[0];
        changeEvent.target.value = "";
        if (!file) return;
        const problem = checkImageFile(file);
        setError(problem ?? "");
        if (problem) return;
        if (imageFile) URL.revokeObjectURL(previewUrl);
        setImageFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    }

    function removeImage() {
        if (imageFile) URL.revokeObjectURL(previewUrl);
        setImageFile(null);
        setPreviewUrl("");
    }

    async function handleSubmit(submitEvent) {
        submitEvent.preventDefault();
        if (repeat !== "none" && (!repeatUntil || repeatUntil < event.event_date)) {
            setError("Choose the last date this event repeats.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            let image = { image_url: previewUrl ? event.image_url : "", image_path: previewUrl ? event.image_path : "" };
            if (imageFile) {
                const { url, path } = await uploadEventImage(imageFile);
                image = { image_url: url, image_path: path };
            }
            const fields = {
                title: event.title.trim(),
                category: event.category,
                performer: event.performer.trim(),
                event_time: event.event_time.trim(),
                description: event.description.trim(),
                ...image,
            };

            let savedId = initialEvent.id;
            if (isNew) {
                const created = await createEvents(fields, dates, repeatLabel);
                savedId = created.id;
            } else if (inSeries && applyToSeries) {
                await updateEvent(initialEvent.id, { ...fields, event_date: event.event_date });
                await updateSeriesFrom(initialEvent.series_id, initialEvent.event_date, fields);
            } else {
                await updateEvent(initialEvent.id, { ...fields, event_date: event.event_date });
            }
            if (initialEvent.image_path && initialEvent.image_path !== image.image_path) {
                await removeUnusedEventImage(initialEvent.image_path);
            }

            const messages = [{ text: isNew && dates.length > 1 ? `Saved ${dates.length} dates.` : "Saved.", ok: true }];
            messages.push(...(await shareAndDescribe("event", savedId, sharing)));
            await onSaved(messages);
        } catch (saveError) {
            setError(`Couldn't save: ${saveError.message}`);
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className={`${cardClass} space-y-4 border-t-4 border-[#D4871A]`}>
            <h2
                className="text-xl font-bold text-[#0B1E4A]"
                style={{ fontFamily: "'Playfair Display', serif" }}
            >
                {isNew ? "New event" : "Edit event"}
            </h2>
            <div>
                <label className={labelClass}>Title *</label>
                <input name="title" required maxLength={200} value={event.title} onChange={handleChange} className={inputClass} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Type of event</label>
                    <select name="category" value={event.category} onChange={handleChange} className={inputClass}>
                        <option value="">Choose a type</option>
                        {eventTypes.map((type) => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                        {event.category && !eventTypes.includes(event.category) && (
                            <option value={event.category}>{event.category}</option>
                        )}
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Band / performer</label>
                    <input
                        name="performer"
                        maxLength={200}
                        list="performer-options"
                        value={event.performer}
                        onChange={handleChange}
                        placeholder="Leave blank if none"
                        className={inputClass}
                    />
                    <datalist id="performer-options">
                        {performers.map((performer) => (
                            <option key={performer} value={performer} />
                        ))}
                    </datalist>
                </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>{isNew ? "Date (first date, if it repeats) *" : "Date *"}</label>
                    <input type="date" name="event_date" required value={event.event_date} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>Time</label>
                    <input
                        name="event_time"
                        maxLength={100}
                        value={event.event_time}
                        onChange={handleChange}
                        placeholder="e.g. 6:00 PM - 8:00 PM"
                        className={inputClass}
                    />
                </div>
            </div>

            {isNew && (
                <div className="grid sm:grid-cols-2 gap-4 p-3 rounded-lg bg-[#F5F1E8]">
                    <div>
                        <label className={labelClass}>Repeats</label>
                        <select
                            value={repeat}
                            onChange={(changeEvent) => handleRepeatChange(changeEvent.target.value)}
                            disabled={!event.event_date}
                            className={inputClass}
                        >
                            {options.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        {!event.event_date && <p className="text-xs text-gray-500 mt-1">Pick a date first.</p>}
                    </div>
                    {repeat !== "none" && (
                        <div>
                            <label className={labelClass}>Last date *</label>
                            <input
                                type="date"
                                required
                                min={event.event_date}
                                max={maxUntil}
                                value={repeatUntil}
                                onChange={(changeEvent) => setRepeatUntil(changeEvent.target.value)}
                                className={inputClass}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {dates.length} {dates.length === 1 ? "date" : "dates"} will be added (up to {MAX_REPEAT_MONTHS} months).
                            </p>
                        </div>
                    )}
                </div>
            )}

            {inSeries && (
                <label className="flex items-start gap-2 text-sm text-[#0B1E4A] p-3 rounded-lg bg-[#F5F1E8]">
                    <input
                        type="checkbox"
                        className="mt-1"
                        checked={applyToSeries}
                        onChange={(changeEvent) => setApplyToSeries(changeEvent.target.checked)}
                    />
                    <span>
                        Also update all later dates in this series ({initialEvent.repeat_label}). Dates themselves
                        aren't changed.
                    </span>
                </label>
            )}

            <div>
                <label className={labelClass}>Description</label>
                <textarea
                    name="description"
                    rows={4}
                    maxLength={2000}
                    value={event.description}
                    onChange={handleChange}
                    className={`${inputClass} resize-y`}
                />
            </div>

            <div>
                <p className={labelClass}>Flyer image (optional, needed for Instagram)</p>
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="w-32 h-24 rounded-lg bg-[#F5F1E8] border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center text-xs text-gray-500 text-center px-2">
                        {previewUrl ? <img src={previewUrl} alt="Flyer preview" className="w-full h-full object-cover" /> : "No image"}
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className={`${secondaryButtonClass} inline-flex items-center gap-2 cursor-pointer text-sm`}>
                            <ImagePlus size={16} /> {previewUrl ? "Choose a different image" : "Choose image"}
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                onChange={handleImageChange}
                                disabled={saving}
                                className="hidden"
                            />
                        </label>
                        {previewUrl && (
                            <button type="button" onClick={removeImage} className={`${dangerButtonClass} text-sm`}>
                                Remove image
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <SocialShareOptions
                value={sharing}
                onChange={setSharing}
                disabled={saving}
                instagramNote={
                    dates.length > 1
                        ? "A repeating event is posted once, with its schedule. Instagram needs a JPG flyer image."
                        : "Instagram needs a JPG flyer image."
                }
            />

            {error && <p className="text-sm text-[#9B1C2E]">{error}</p>}
            <div className="flex gap-3">
                <button type="submit" disabled={saving} className={primaryButtonClass}>
                    {saving ? "Saving..." : "Save event"}
                </button>
                <button type="button" onClick={onCancel} disabled={saving} className={secondaryButtonClass}>
                    Cancel
                </button>
            </div>
        </form>
    );
}

export default EventsTab;
