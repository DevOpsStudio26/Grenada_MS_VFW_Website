import { useState } from "react";
import { Plus, X } from "lucide-react";
import { addEventOption, countEventsUsingOption, deleteEventOption } from "../../services/api";
import { cardClass, inputClass, labelClass, primaryButtonClass } from "./styles";

const ADD_NEW = "__add_new__";
const MAX_NAME = 50;

const kindNames = {
    type: { singular: "event type", plural: "Event types", placeholder: "e.g. Karaoke Night" },
    band: { singular: "band", plural: "Bands / performers", placeholder: "e.g. The Delta Ramblers" },
};

// A dropdown of saved choices, with "+ Add new..." at the bottom to add one
// without leaving the event form. The new choice is saved for future events too.
export function OptionSelect({ kind, label, options, value, onChange, onOptionsChanged, disabled }) {
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const names = kindNames[kind];

    function handleSelect(selected) {
        if (selected === ADD_NEW) {
            setAdding(true);
            setError("");
        } else {
            onChange(selected);
        }
    }

    async function handleAdd() {
        const name = newName.trim();
        if (!name) return;
        setSaving(true);
        setError("");
        try {
            await addEventOption(kind, name);
            await onOptionsChanged();
            onChange(name);
            setAdding(false);
            setNewName("");
        } catch (addError) {
            setError(`Couldn't add: ${addError.message}`);
        } finally {
            setSaving(false);
        }
    }

    function cancelAdd() {
        setAdding(false);
        setNewName("");
        setError("");
    }

    return (
        <div>
            <label className={labelClass}>{label}</label>
            {adding ? (
                <div className="flex gap-2">
                    <input
                        autoFocus
                        value={newName}
                        maxLength={MAX_NAME}
                        onChange={(event) => setNewName(event.target.value)}
                        onKeyDown={(event) => {
                            // Enter adds the choice instead of submitting the whole event form.
                            if (event.key === "Enter") {
                                event.preventDefault();
                                handleAdd();
                            } else if (event.key === "Escape") {
                                cancelAdd();
                            }
                        }}
                        placeholder={names.placeholder}
                        aria-label={`New ${names.singular}`}
                        className={inputClass}
                    />
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={saving || !newName.trim()}
                        className={`${primaryButtonClass} px-3 whitespace-nowrap`}
                    >
                        {saving ? "Adding..." : "Add"}
                    </button>
                    <button type="button" onClick={cancelAdd} disabled={saving} className="px-2 text-gray-500 hover:text-[#0B1E4A]">
                        Cancel
                    </button>
                </div>
            ) : (
                <select value={value} onChange={(event) => handleSelect(event.target.value)} disabled={disabled} className={inputClass}>
                    <option value="">None</option>
                    {options.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                    {/* Keeps an older value visible if its choice was deleted elsewhere. */}
                    {value && !options.includes(value) && <option value={value}>{value}</option>}
                    <option value={ADD_NEW}>+ Add new {names.singular}...</option>
                </select>
            )}
            {error && <p className="text-xs text-[#9B1C2E] mt-1">{error}</p>}
        </div>
    );
}

// Card listing every event type and band, where admins can add and delete choices.
function EventOptionsManager({ options, onChanged }) {
    const [error, setError] = useState("");

    return (
        <div className={cardClass}>
            <h2
                className="text-2xl font-bold text-[#0B1E4A] mb-1"
                style={{ fontFamily: "'Playfair Display', serif" }}
            >
                Dropdown lists
            </h2>
            <p className="text-gray-500 text-sm mb-5">
                The choices for an event's type and band. Visitors can filter events on the home page by any type or
                band that has an upcoming event.
            </p>
            {error && <p className="text-sm text-[#9B1C2E] mb-4">{error}</p>}
            <div className="grid md:grid-cols-2 gap-6">
                <OptionList kind="type" options={options.type} onChanged={onChanged} onError={setError} />
                <OptionList kind="band" options={options.band} onChanged={onChanged} onError={setError} />
            </div>
        </div>
    );
}

function OptionList({ kind, options, onChanged, onError }) {
    const [newName, setNewName] = useState("");
    const [busy, setBusy] = useState(false);
    const names = kindNames[kind];

    async function handleAdd(event) {
        event.preventDefault();
        const name = newName.trim();
        if (!name) return;
        setBusy(true);
        onError("");
        try {
            await addEventOption(kind, name);
            setNewName("");
            await onChanged();
        } catch (addError) {
            onError(`Couldn't add "${name}": ${addError.message}`);
        } finally {
            setBusy(false);
        }
    }

    async function handleDelete(name) {
        onError("");
        try {
            const count = await countEventsUsingOption(kind, name);
            const message = count
                ? `"${name}" is set on ${count} ${count === 1 ? "event" : "events"}. Deleting it also removes it from ${count === 1 ? "that event" : "those events"}. Delete it?`
                : `Delete "${name}" from the ${names.singular} list?`;
            if (!window.confirm(message)) return;
            setBusy(true);
            await deleteEventOption(kind, name);
            await onChanged();
        } catch (deleteError) {
            onError(`Couldn't delete "${name}": ${deleteError.message}`);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <h3 className="font-semibold text-[#0B1E4A] mb-2">{names.plural}</h3>
            {options.length === 0 ? (
                <p className="text-sm text-gray-500 mb-3">None yet.</p>
            ) : (
                <ul className="flex flex-wrap gap-2 mb-3">
                    {options.map((name) => (
                        <li
                            key={name}
                            className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-[#F5F1E8] text-sm text-[#0B1E4A]"
                        >
                            {name}
                            <button
                                onClick={() => handleDelete(name)}
                                disabled={busy}
                                className="p-1 rounded-full text-gray-500 hover:text-[#9B1C2E] hover:bg-white disabled:opacity-50"
                                aria-label={`Delete ${name}`}
                            >
                                <X size={14} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <form onSubmit={handleAdd} className="flex gap-2">
                <input
                    value={newName}
                    maxLength={MAX_NAME}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder={names.placeholder}
                    aria-label={`New ${names.singular}`}
                    className={`${inputClass} text-sm`}
                />
                <button
                    type="submit"
                    disabled={busy || !newName.trim()}
                    className={`${primaryButtonClass} px-3 inline-flex items-center gap-1 whitespace-nowrap`}
                >
                    <Plus size={16} /> Add
                </button>
            </form>
        </div>
    );
}

export default EventOptionsManager;
