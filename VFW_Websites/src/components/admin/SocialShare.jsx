// "Also post to Facebook / Instagram" checkboxes for the event and photo forms.
function SocialShareOptions({ value, onChange, disabled, instagramNote }) {
    return (
        <fieldset className="rounded-lg bg-[#F5F1E8] p-3">
            <legend className="sr-only">Share on social media</legend>
            <p className="text-sm font-semibold text-[#0B1E4A] mb-2">Also post this to:</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 text-sm text-[#0B1E4A]">
                    <input
                        type="checkbox"
                        checked={value.facebook}
                        disabled={disabled}
                        onChange={(event) => onChange({ ...value, facebook: event.target.checked })}
                    />
                    Facebook
                </label>
                <label className="flex items-center gap-2 text-sm text-[#0B1E4A]">
                    <input
                        type="checkbox"
                        checked={value.instagram}
                        disabled={disabled}
                        onChange={(event) => onChange({ ...value, instagram: event.target.checked })}
                    />
                    Instagram
                </label>
            </div>
            {instagramNote && <p className="text-xs text-gray-500 mt-2">{instagramNote}</p>}
        </fieldset>
    );
}

export default SocialShareOptions;
