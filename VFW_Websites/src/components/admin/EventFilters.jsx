import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { DEFAULT_SORT, sortChoices } from "../../utils/eventSort";
import { inputClass, labelClass } from "./styles";

// Search box plus one "Filter & sort" button that opens a small panel.
// Active filters show underneath as tags that can be removed with ✕.
function EventFilters({ value, onChange, options, resultCount }) {
    const { search, sortBy, type, band } = value;
    const [open, setOpen] = useState(false);
    const wrapper = useRef(null);
    const activeCount = [type, band, sortBy !== DEFAULT_SORT].filter(Boolean).length;
    const set = (changes) => onChange({ ...value, ...changes });

    // Close the panel when clicking outside it or pressing Escape.
    useEffect(() => {
        if (!open) return undefined;
        const onClick = (event) => !wrapper.current?.contains(event.target) && setOpen(false);
        const onKey = (event) => event.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const tags = [
        type && { label: type, clear: () => set({ type: "" }) },
        band && { label: band, clear: () => set({ band: "" }) },
        sortBy !== DEFAULT_SORT && {
            label: sortChoices.find((choice) => choice.value === sortBy)?.label,
            clear: () => set({ sortBy: DEFAULT_SORT }),
        },
    ].filter(Boolean);

    return (
        <div className="mb-3">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => set({ search: event.target.value })}
                        placeholder="Search events..."
                        aria-label="Search events by title"
                        className={`${inputClass} pl-9 text-sm py-2`}
                    />
                </div>
                <div ref={wrapper} className="relative">
                    <button
                        type="button"
                        onClick={() => setOpen((isOpen) => !isOpen)}
                        aria-expanded={open}
                        aria-haspopup="dialog"
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                            open || activeCount
                                ? "border-[#0B1E4A] text-[#0B1E4A] bg-[#EEF4FF]"
                                : "border-gray-300 text-[#0B1E4A] hover:border-[#0B1E4A]"
                        }`}
                    >
                        <SlidersHorizontal size={16} />
                        Filter & sort
                        {activeCount > 0 && (
                            <span className="min-w-5 h-5 px-1 rounded-full bg-[#D4871A] text-white text-xs flex items-center justify-center">
                                {activeCount}
                            </span>
                        )}
                    </button>

                    {open && (
                        <div
                            role="dialog"
                            aria-label="Filter and sort events"
                            className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-gray-200 p-4 space-y-4"
                        >
                            <fieldset>
                                <legend className={labelClass}>Sort by</legend>
                                <div className="space-y-1">
                                    {sortChoices.map((choice) => (
                                        <label key={choice.value} className="flex items-center gap-2 text-sm text-[#0B1E4A] cursor-pointer">
                                            <input
                                                type="radio"
                                                name="event-sort"
                                                value={choice.value}
                                                checked={sortBy === choice.value}
                                                onChange={() => set({ sortBy: choice.value })}
                                            />
                                            {choice.label}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            <div>
                                <label htmlFor="filter-type" className={labelClass}>Event type</label>
                                <select
                                    id="filter-type"
                                    value={type}
                                    onChange={(event) => set({ type: event.target.value })}
                                    className={`${inputClass} text-sm py-1.5`}
                                >
                                    <option value="">All event types</option>
                                    {options.type.map((name) => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="filter-band" className={labelClass}>Band</label>
                                <select
                                    id="filter-band"
                                    value={band}
                                    onChange={(event) => set({ band: event.target.value })}
                                    className={`${inputClass} text-sm py-1.5`}
                                >
                                    <option value="">All bands</option>
                                    {options.band.map((name) => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center justify-between pt-1">
                                <button
                                    type="button"
                                    onClick={() => set({ type: "", band: "", sortBy: DEFAULT_SORT })}
                                    className="text-sm text-gray-500 hover:text-[#0B1E4A]"
                                >
                                    Reset
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="bg-[#0B1E4A] text-white px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-[#162F5E]"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2 min-h-6">
                {tags.map((tag) => (
                    <span
                        key={tag.label}
                        className="inline-flex items-center gap-1 pl-3 pr-1 py-0.5 rounded-full bg-[#F5F1E8] text-xs text-[#0B1E4A]"
                    >
                        {tag.label}
                        <button
                            type="button"
                            onClick={tag.clear}
                            className="p-0.5 rounded-full hover:bg-white text-gray-500 hover:text-[#9B1C2E]"
                            aria-label={`Remove ${tag.label}`}
                        >
                            <X size={12} />
                        </button>
                    </span>
                ))}
                {tags.length > 1 && (
                    <button
                        type="button"
                        onClick={() => set({ type: "", band: "", sortBy: DEFAULT_SORT })}
                        className="text-xs text-[#A86010] hover:underline"
                    >
                        Clear all
                    </button>
                )}
                <span className="text-xs text-gray-500 ml-auto">
                    {resultCount} {resultCount === 1 ? "event" : "events"}
                </span>
            </div>
        </div>
    );
}

export default EventFilters;
