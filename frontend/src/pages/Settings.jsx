import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  Mail,
  Save,
  ShieldAlert,
  Trash2,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

const MAX_PROFILE_PICTURE_SIZE = 1024 * 1024;

export default function Settings() {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    profile_picture: null,
  });
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const imageInput = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await API.get("/auth/me");
        setProfile({
          name: response.data.name ?? "",
          email: response.data.email ?? "",
          profile_picture: response.data.profile_picture ?? null,
        });
        setProfileLoaded(true);
      } catch (requestError) {
        setError(
          requestError.response?.data?.detail ??
            "Could not load your profile. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handlePictureChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > MAX_PROFILE_PICTURE_SIZE) {
      setError("Profile pictures must be 1 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("Could not read this image. Please try another file.");
        return;
      }
      setProfile((current) => ({
        ...current,
        profile_picture: reader.result,
      }));
      setError("");
      setSuccess("");
    };
    reader.onerror = () => {
      setError("Could not read this image. Please try another file.");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await API.patch("/auth/me", profile);
      setProfile({
        name: response.data.name,
        email: response.data.email,
        profile_picture: response.data.profile_picture,
      });
      window.dispatchEvent(
        new CustomEvent("profile-updated", { detail: response.data }),
      );
      setSuccess("Your profile has been updated.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ??
          "Could not save your profile. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError("");

    try {
      await API.delete("/auth/me");
      localStorage.removeItem("token");
      localStorage.removeItem("workspace");
      navigate("/login", { replace: true });
    } catch (requestError) {
      setDeleteError(
        requestError.response?.data?.detail ??
          "Could not delete your account. Please try again.",
      );
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="settings-page-header">
        <div>
          <p className="text-sm font-medium text-blue-600">Account</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
            Profile settings
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your personal details and account.
          </p>
        </div>
      </header>

      {error && <FeedbackMessage tone="error" message={error} />}
      {success && <FeedbackMessage tone="success" message={success} />}

      <form
        onSubmit={handleSave}
        className="settings-card overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
      >
        <section className="border-b border-gray-100 p-6 sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <UserRound size={18} aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Personal information</h3>
              <p className="mt-1 text-sm text-gray-500">
                Update your name, email, and profile picture.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-gray-500">
              <LoaderCircle className="mr-2 animate-spin" size={18} />
              Loading profile…
            </div>
          ) : (
            <div className="space-y-7">
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-blue-700 ring-4 ring-gray-50">
                  {profile.profile_picture ? (
                    <img
                      src={profile.profile_picture}
                      alt="Your profile"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-semibold">
                      {profile.name.trim() ? (
                        profile.name.trim().charAt(0).toUpperCase()
                      ) : (
                        <UserRound size={28} aria-hidden="true" />
                      )}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Profile picture
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    PNG, JPEG, or WebP. Maximum size 1 MB.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      ref={imageInput}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handlePictureChange}
                      disabled={!profileLoaded}
                      className="sr-only"
                      aria-label="Choose a profile picture"
                    />
                    <button
                      type="button"
                      disabled={!profileLoaded}
                      onClick={() => imageInput.current?.click()}
                      className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ImagePlus size={16} aria-hidden="true" />
                      Upload photo
                    </button>
                    {profile.profile_picture && (
                      <button
                        type="button"
                        onClick={() =>
                          setProfile((current) => ({
                            ...current,
                            profile_picture: null,
                          }))
                        }
                        className="rounded-md px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium text-gray-700">
                  Full name
                  <input
                    type="text"
                    autoComplete="name"
                    maxLength={120}
                    required
                    disabled={!profileLoaded}
                    value={profile.name}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Your name"
                    className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Email address
                  <span className="relative mt-2 block">
                    <Mail
                      size={16}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      disabled={!profileLoaded}
                      value={profile.email}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      placeholder="you@example.com"
                      className="block w-full rounded-md border border-gray-300 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </span>
                  <span className="mt-1.5 block text-xs font-normal text-gray-500">
                    This email is used to sign in to your account.
                  </span>
                </label>
              </div>
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/70 px-6 py-4 sm:px-8">
          <p className="text-xs text-gray-500">Your changes are saved to your account.</p>
          <button
            type="submit"
            disabled={!profileLoaded || loading || saving}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Save size={16} aria-hidden="true" />
            )}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 p-6 sm:p-8">
          <div className="rounded-lg bg-red-50 p-2 text-red-600">
            <ShieldAlert size={18} aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Delete account</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
              Permanently delete your account. If you are the last user in your
              workspace, its agents, calls, phone numbers, API keys, and related
              data will also be deleted.
            </p>
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => {
                  setDeleteError("");
                  setConfirmingDelete(true);
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete account
              </button>
            ) : (
              <div
                className="mt-5 rounded-lg border border-red-200 bg-red-50/70 p-4"
                role="alertdialog"
                aria-labelledby="delete-account-title"
                aria-describedby="delete-account-description"
              >
                <h4
                  id="delete-account-title"
                  className="text-sm font-semibold text-red-900"
                >
                  This action cannot be undone
                </h4>
                <p
                  id="delete-account-description"
                  className="mt-1 text-sm text-red-800"
                >
                  Type <strong>DELETE</strong> to permanently delete your account.
                </p>
                {deleteError && (
                  <p className="mt-3 text-sm font-medium text-red-700" role="alert">
                    {deleteError}
                  </p>
                )}
                <input
                  type="text"
                  autoComplete="off"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  aria-label="Type DELETE to confirm account deletion"
                  placeholder="Type DELETE"
                  className="mt-3 block w-full max-w-xs rounded-md border border-red-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(false);
                      setDeleteConfirmation("");
                      setDeleteError("");
                    }}
                    disabled={deleting}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deleting || deleteConfirmation !== "DELETE"}
                    className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting ? (
                      <LoaderCircle
                        size={16}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Trash2 size={16} aria-hidden="true" />
                    )}
                    {deleting ? "Deleting…" : "Permanently delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function FeedbackMessage({ tone, message }) {
  const isError = tone === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-green-200 bg-green-50 text-green-700"
      }`}
    >
      <Icon size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}