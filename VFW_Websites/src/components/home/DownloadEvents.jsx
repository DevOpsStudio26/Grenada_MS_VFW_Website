import { useEffect, useRef, useState } from "react";
import { CalendarPlus, ChevronDown, Download, FileSpreadsheet } from "lucide-react";
import { downloadFile, eventsToCsv, eventsToIcs } from "../../utils/eventExport";
import { todayString } from "../../utils/dates";

// "Download" button with a small menu: add the events to a calendar app, or
// save them as a spreadsheet. Downloads whichever events are currently shown.
function DownloadEvents({ events, isFiltered }) {
    const [open, setOpen] = useState(false);
    const wrapper = useRef(null);

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

    function save(format) {
        const name = `vfw-post-4488-events-${todayString()}`;
        if (format === "ics") {
            downloadFile(`${name}.ics`, eventsToIcs(events), "text/calendar;charset=utf-8");
        } else {
            downloadFile(`${name}.csv`, eventsToCsv(events), "text/csv;charset=utf-8");
        }
        setOpen(false);
    }

    const count = `${events.length} ${isFiltered ? "filtered " : ""}${events.length === 1 ? "event" : "events"}`;
    const itemClass =
        "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#F5F1E8] focus:bg-[#F5F1E8] focus:outline-none";

    return (
        <div ref={wrapper} className="relative">
            <button
                onClick={() => setOpen((isOpen) => !isOpen)}
                disabled={events.length === 0}
                aria-expanded={open}
                aria-haspopup="menu"
                className="inline-flex items-center gap-2 border-2 border-[#0B1E4A] text-[#0B1E4A] px-4 py-1.5 rounded-md font-semibold hover:bg-[#0B1E4A] hover:text-white transition-colors disabled:opacity-50"
            >
                <Download size={18} /> Download <ChevronDown size={16} />
            </button>
            {open && (
                <div
                    role="menu"
                    className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
                >
                    <p className="px-4 pt-3 pb-1 text-xs text-gray-500">Download {count}</p>
                    <button role="menuitem" onClick={() => save("ics")} className={itemClass}>
                        <CalendarPlus size={20} className="text-[#D4871A] shrink-0 mt-0.5" />
                        <span>
                            <span className="block font-semibold text-[#0B1E4A]">Add to my calendar</span>
                            <span className="block text-xs text-gray-500">
                                Calendar file for iPhone, Android, Google, or Outlook
                            </span>
                        </span>
                    </button>
                    <button role="menuitem" onClick={() => save("csv")} className={itemClass}>
                        <FileSpreadsheet size={20} className="text-[#D4871A] shrink-0 mt-0.5" />
                        <span>
                            <span className="block font-semibold text-[#0B1E4A]">Spreadsheet</span>
                            <span className="block text-xs text-gray-500">Opens in Excel or Google Sheets</span>
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}

export default DownloadEvents;
