import { useEffect, useState } from "react";
import { Check, Download, Eye, FileText, HelpCircle, Mail, Phone, Send, Trash2, Upload, X } from "lucide-react";
import {
    addApplicationDocument,
    deleteApplication,
    deleteApplicationDocument,
    fetchApplications,
    getDocumentLink,
    respondToApplication,
    updateApplicationStatus,
} from "../../services/api";
import { checkDocumentFile, DOCUMENT_ACCEPT } from "../../services/storage";
import { mailtoHref, telHref } from "../../utils/text";
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from "./styles";

const statuses = [
    { value: "new", label: "New", color: "bg-[#FFF5E8] text-[#A86010]" },
    { value: "contacted", label: "Contacted", color: "bg-[#EEF4FF] text-[#0B1E4A]" },
    { value: "info_requested", label: "Info Requested", color: "bg-purple-50 text-purple-700" },
    { value: "approved", label: "Approved", color: "bg-green-50 text-green-700" },
    { value: "declined", label: "Declined", color: "bg-gray-100 text-gray-600" },
];

// Membership applications submitted from the Join Us page.
function FormsTab() {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState("all");

    // Reloads the list after a change.
    async function loadApplications() {
        try {
            setApplications(await fetchApplications());
        } catch (loadError) {
            setError(`Couldn't load applications: ${loadError.message}`);
        }
    }

    useEffect(() => {
        fetchApplications()
            .then(setApplications)
            .catch((loadError) => setError(`Couldn't load applications: ${loadError.message}`))
            .finally(() => setLoading(false));
    }, []);

    async function handleStatusChange(application, status) {
        try {
            await updateApplicationStatus(application.id, status);
            await loadApplications();
        } catch (updateError) {
            setError(`Couldn't update: ${updateError.message}`);
        }
    }

    // Emails the applicant, then updates the status. Returns true if it worked.
    async function handleRespond(application, action, message) {
        setError("");
        try {
            await respondToApplication(application.id, action, message);
            await loadApplications();
            return true;
        } catch (respondError) {
            setError(`Couldn't send to ${application.email}: ${respondError.message}`);
            return false;
        }
    }

    async function handleDelete(application) {
        const name = `${application.first_name} ${application.last_name}`;
        const fileCount = (application.application_documents?.length ?? 0) + (application.dd214_path ? 1 : 0);
        const extra = fileCount ? ` and ${fileCount === 1 ? "its file" : `its ${fileCount} files`}` : "";
        if (!window.confirm(`Permanently delete the application from ${name}${extra}?`)) return;
        try {
            await deleteApplication(application);
            await loadApplications();
        } catch (deleteError) {
            setError(`Couldn't delete: ${deleteError.message}`);
        }
    }

    const visible = filter === "all" ? applications : applications.filter((a) => a.status === filter);

    return (
        <div className={cardClass}>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
                <div>
                    <h2
                        className="text-2xl font-bold text-[#0B1E4A]"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                        Membership Applications
                    </h2>
                    <p className="text-gray-500 text-sm">
                        These contain applicants' personal information. Only admins can see them.
                    </p>
                </div>
                <select value={filter} onChange={(event) => setFilter(event.target.value)} className={`${inputClass} w-auto`}>
                    <option value="all">All ({applications.length})</option>
                    {statuses.map((status) => (
                        <option key={status.value} value={status.value}>
                            {status.label} ({applications.filter((a) => a.status === status.value).length})
                        </option>
                    ))}
                </select>
            </div>

            {error && <p className="text-sm text-[#9B1C2E] mb-4">{error}</p>}

            {loading ? (
                <p className="text-gray-500">Loading...</p>
            ) : visible.length === 0 ? (
                <p className="text-gray-500">No applications here.</p>
            ) : (
                <ul className="space-y-4">
                    {visible.map((application) => (
                        <ApplicationCard
                            key={application.id}
                            application={application}
                            onStatusChange={(status) => handleStatusChange(application, status)}
                            onRespond={(action, message) => handleRespond(application, action, message)}
                            onDelete={() => handleDelete(application)}
                            onDocumentsChanged={loadApplications}
                            onError={setError}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

const confirmText = {
    approved: "an acceptance",
    declined: "a decline",
};

// The applicant's DD-214 plus anything an admin attached later (e.g. a file the
// applicant emailed in). Admins can preview, download, remove, and add files.
function DocumentsSection({ application, onChanged, onError }) {
    const documents = application.application_documents ?? [];
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");

    async function handleFile(event) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        const problem = checkDocumentFile(file);
        setUploadError(problem ?? "");
        if (problem) return;

        setUploading(true);
        try {
            await addApplicationDocument(application.id, file);
            await onChanged();
        } catch (addError) {
            setUploadError(`Couldn't upload ${file.name}: ${addError.message}`);
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="sm:col-span-2 mt-2 p-3 rounded-lg bg-[#EEF4FF]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="flex items-center gap-2 text-[#0B1E4A] font-semibold">
                    <FileText size={16} /> Documents ({documents.length})
                </p>
                <label
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded border-2 border-[#0B1E4A] text-[#0B1E4A] font-semibold bg-white hover:bg-[#0B1E4A] hover:text-white transition-colors ${
                        uploading ? "opacity-60 pointer-events-none" : "cursor-pointer"
                    }`}
                >
                    <Upload size={14} /> {uploading ? "Uploading..." : "Add file"}
                    <input
                        type="file"
                        accept={DOCUMENT_ACCEPT}
                        onChange={handleFile}
                        disabled={uploading}
                        className="hidden"
                    />
                </label>
            </div>

            {documents.length === 0 ? (
                <p className="text-gray-500">
                    No files yet. If the applicant emails you a document, save it and click Add file
                    (PDF, JPG, or PNG, up to 10 MB).
                </p>
            ) : (
                <ul className="divide-y divide-[#D6E2F7]">
                    {documents.map((document) => (
                        <DocumentRow
                            key={document.id}
                            application={application}
                            document={document}
                            onChanged={onChanged}
                            onError={onError}
                        />
                    ))}
                </ul>
            )}
            {uploadError && <p className="text-[#9B1C2E] mt-2">{uploadError}</p>}
        </div>
    );
}

// Preview opens the file in a new tab; Download saves it with a readable name.
function DocumentRow({ application, document, onChanged, onError }) {
    const [busy, setBusy] = useState(false);
    const fromApplicant = document.added_by === "applicant";
    const extension = document.storage_path.split(".").pop();
    const downloadName = fromApplicant
        ? `DD-214 ${application.first_name} ${application.last_name}.${extension}`
        : document.file_name;

    async function open(download) {
        // Open the tab right away; browsers block tabs opened after waiting on the network.
        const tab = download ? null : window.open("", "_blank");
        setBusy(true);
        try {
            const link = await getDocumentLink(document.storage_path, download ? downloadName : undefined);
            if (tab) {
                tab.opener = null;
                tab.location.href = link;
            } else {
                window.location.assign(link);
            }
        } catch (linkError) {
            tab?.close();
            onError(`Couldn't open ${document.file_name}: ${linkError.message}`);
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        if (!window.confirm(`Permanently remove "${document.file_name}" from this application?`)) return;
        setBusy(true);
        try {
            await deleteApplicationDocument(document);
            await onChanged();
        } catch (removeError) {
            onError(`Couldn't remove ${document.file_name}: ${removeError.message}`);
            setBusy(false);
        }
    }

    const linkButton =
        "inline-flex items-center gap-1 px-2 py-1 rounded text-[#0B1E4A] hover:bg-white disabled:opacity-60";

    return (
        <li className="flex flex-wrap items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
                <p className="text-[#0B1E4A] truncate" title={document.file_name}>
                    {document.file_name}
                </p>
                <p className="text-xs text-gray-500">
                    {fromApplicant ? "Uploaded with application" : "Added by admin"} ·{" "}
                    {new Date(document.created_at).toLocaleDateString("en-US")}
                </p>
            </div>
            <span className="flex gap-1">
                <button onClick={() => open(false)} disabled={busy} className={linkButton}>
                    <Eye size={14} /> Preview
                </button>
                <button onClick={() => open(true)} disabled={busy} className={linkButton}>
                    <Download size={14} /> Download
                </button>
                <button
                    onClick={remove}
                    disabled={busy}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[#9B1C2E] hover:bg-white disabled:opacity-60"
                    aria-label={`Remove ${document.file_name}`}
                >
                    <Trash2 size={14} /> Remove
                </button>
            </span>
        </li>
    );
}

function ApplicationCard({ application, onStatusChange, onRespond, onDelete, onDocumentsChanged, onError }) {
    const status = statuses.find((s) => s.value === application.status) ?? statuses[0];
    const emailLink = mailtoHref(application.email);
    const phoneLink = telHref(application.phone);
    const [sending, setSending] = useState(false);
    const [askingForInfo, setAskingForInfo] = useState(false);
    const [infoMessage, setInfoMessage] = useState("");

    async function respond(action, message = "") {
        if (action !== "info_requested" && !window.confirm(`Send ${confirmText[action]} email to ${application.email}?`)) {
            return;
        }
        setSending(true);
        const sent = await onRespond(action, message);
        setSending(false);
        if (sent) {
            setAskingForInfo(false);
            setInfoMessage("");
        }
    }

    return (
        <li className="border-2 border-gray-200 rounded-lg p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                    <p className="font-semibold text-lg text-[#0B1E4A]">
                        {application.first_name} {application.last_name}
                    </p>
                    <p className="text-xs text-gray-500">
                        Submitted {new Date(application.created_at).toLocaleString("en-US")}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${status.color}`}>{status.label}</span>
                    <select
                        value={application.status}
                        onChange={(event) => onStatusChange(event.target.value)}
                        className={`${inputClass} w-auto text-sm py-1`}
                        aria-label="Change status without emailing"
                        title="Change status without emailing the applicant"
                    >
                        {statuses.map((s) => (
                            <option key={s.value} value={s.value}>
                                {s.label}
                            </option>
                        ))}
                    </select>
                    <button onClick={onDelete} className="p-2 text-[#9B1C2E] hover:bg-[#FFF0F3] rounded" aria-label="Delete">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700">
                <p className="flex items-center gap-2">
                    <Mail size={14} className="text-gray-400" />
                    {emailLink ? (
                        <a href={emailLink} className="hover:text-[#D4871A]">{application.email}</a>
                    ) : (
                        application.email
                    )}
                </p>
                <p className="flex items-center gap-2">
                    <Phone size={14} className="text-gray-400" />
                    {phoneLink ? (
                        <a href={phoneLink} className="hover:text-[#D4871A]">{application.phone}</a>
                    ) : (
                        application.phone
                    )}
                </p>
                <p className="sm:col-span-2">
                    {application.address}, {application.city}, {application.state} {application.zip}
                </p>
                {(application.military_rank || application.unit) && (
                    <p className="sm:col-span-2 text-gray-500">
                        Service: {[application.military_rank, application.unit].filter(Boolean).join(" — ")}
                    </p>
                )}
                <DocumentsSection application={application} onChanged={onDocumentsChanged} onError={onError} />
            </div>

            {application.responded_at && (
                <div className="mt-3 text-sm bg-gray-50 rounded-lg p-3 text-gray-600">
                    <p>
                        <strong>{status.label}</strong> email sent{" "}
                        {new Date(application.responded_at).toLocaleString("en-US")}
                    </p>
                    {application.admin_message && (
                        <p className="mt-1 whitespace-pre-line">"{application.admin_message}"</p>
                    )}
                </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Email the applicant at {application.email}:</p>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => respond("approved")}
                        disabled={sending}
                        className="inline-flex items-center gap-1 bg-green-700 text-white px-4 py-2 rounded-md font-semibold hover:bg-green-800 transition-colors disabled:opacity-60"
                    >
                        <Check size={16} /> Accept
                    </button>
                    <button
                        onClick={() => respond("declined")}
                        disabled={sending}
                        className="inline-flex items-center gap-1 border-2 border-gray-400 text-gray-700 px-4 py-2 rounded-md font-semibold hover:bg-gray-100 transition-colors disabled:opacity-60"
                    >
                        <X size={16} /> Decline
                    </button>
                    <button
                        onClick={() => setAskingForInfo((open) => !open)}
                        disabled={sending}
                        className={`${secondaryButtonClass} inline-flex items-center gap-1 px-4`}
                        aria-expanded={askingForInfo}
                    >
                        <HelpCircle size={16} /> Request Info
                    </button>
                </div>

                {askingForInfo && (
                    <div className="mt-3">
                        <label htmlFor={`info-${application.id}`} className="block text-sm font-semibold text-[#0B1E4A] mb-1">
                            What information do you need?
                        </label>
                        <textarea
                            id={`info-${application.id}`}
                            value={infoMessage}
                            onChange={(event) => setInfoMessage(event.target.value)}
                            rows={4}
                            maxLength={5000}
                            placeholder="e.g., Please send a copy of your DD-214 showing your overseas service dates."
                            className={inputClass}
                        />
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={() => respond("info_requested", infoMessage.trim())}
                                disabled={sending || !infoMessage.trim()}
                                className={`${primaryButtonClass} inline-flex items-center gap-1`}
                            >
                                <Send size={16} /> {sending ? "Sending..." : "Send Request"}
                            </button>
                            <button
                                onClick={() => setAskingForInfo(false)}
                                disabled={sending}
                                className="px-4 py-2 text-gray-600 hover:text-[#0B1E4A]"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
                {sending && !askingForInfo && <p className="text-sm text-gray-500 mt-2">Sending...</p>}
            </div>
        </li>
    );
}

export default FormsTab;
