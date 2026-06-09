import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ShieldCheck, IdCard, FileCheck2, PhoneCall, BellRing,
  Siren, Loader2, UploadCloud, Car, Home, Menu, X,
  CheckCircle2, Clock, AlertTriangle, Lock,
  ChevronDown, FileText, Zap, Users, MapPin
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";

/* ─── supabase ───────────────────────────────────────────────────── */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase    = createClient(supabaseUrl, supabaseKey);

const uploadToSupabase = async (file: File): Promise<string> => {
  const ext      = file.name.split(".").pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${ext}`;
  const { error } = await supabase.storage
    .from("KYC-Document")
    .upload(fileName, file, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from("KYC-Document").getPublicUrl(fileName);
  return data.publicUrl;
};

/* ─── auth helper ────────────────────────────────────────────────── */
interface AuthUser {
  id: number; token: string; role: string;
  name: string; phone: string; email: string;
  kycStatus?: string; licenseUrl?: string | null; rcUrl?: string | null;
}
function readAuth(): AuthUser | null {
  try { return JSON.parse(localStorage.getItem("ridelink:auth") || "null"); }
  catch { return null; }
}

/* ─── KYC status config ──────────────────────────────────────────── */
const KYC_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string; bar: string }> = {
  APPROVED: {
    label: "KYC Verified",
    icon:  <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    cls:   "border-emerald-200 bg-emerald-50 text-emerald-800",
    bar:   "bg-emerald-500",
  },
  PENDING: {
    label: "Under Review",
    icon:  <Clock className="h-5 w-5 text-amber-500" />,
    cls:   "border-amber-200 bg-amber-50 text-amber-800",
    bar:   "bg-amber-400",
  },
  REJECTED: {
    label: "Documents Rejected",
    icon:  <AlertTriangle className="h-5 w-5 text-red-500" />,
    cls:   "border-red-200 bg-red-50 text-red-800",
    bar:   "bg-red-500",
  },
};

/* ─── file drop zone ─────────────────────────────────────────────── */
function FileDropZone({
                        label, accept, file,
                        onChange,
                      }: {
  label: string; accept?: string; file: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</label>
      <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 transition-colors ${
        file ? "border-primary/40 bg-primary/5" : "border-slate-200 hover:border-primary/30 hover:bg-slate-50"
      }`}>
        <input type="file" accept={accept} className="hidden"
               onChange={e => onChange(e.target.files?.[0] || null)} />
        {file ? (
          <>
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-xs font-semibold text-primary text-center truncate max-w-[180px]">{file.name}</span>
            <span className="text-[10px] text-slate-400">Click to change</span>
          </>
        ) : (
          <>
            <UploadCloud className="h-6 w-6 text-slate-400" />
            <span className="text-xs font-medium text-slate-500">Click to upload</span>
            <span className="text-[10px] text-slate-400">PDF, JPG or PNG</span>
          </>
        )}
      </label>
    </div>
  );
}

/* ─── FAQ accordion ──────────────────────────────────────────────── */
const FAQS = [
  {
    q: "Before the ride",
    a: "Verify the vehicle number and driver photo before boarding. Ensure the OTP matches what the driver says.",
  },
  {
    q: "During the ride",
    a: "Share your live trip link with a trusted contact, keep your GPS on, and don't hesitate to use SOS if you feel unsafe.",
  },
  {
    q: "After the ride",
    a: "Rate your experience and report any issues within 24 hours. Your feedback keeps the community safe.",
  },
  {
    q: "How is my data protected?",
    a: "All documents are stored securely on Supabase with restricted access. Phone numbers are partially masked to other users.",
  },
];

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between py-4 text-left text-sm font-semibold text-slate-800 hover:text-primary transition-colors"
      >
        {q}
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="pb-4 text-sm text-slate-500 leading-relaxed">{a}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function Safety() {
  const [auth, setAuth] = useState<AuthUser | null>(() => readAuth());
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<{ license: File | null; rc: File | null }>({
    license: null, rc: null,
  });

  useEffect(() => {
    const onStorage = () => setAuth(readAuth());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isDriver = !!(
    auth?.role?.toLowerCase().includes("rider") ||
    auth?.role?.toLowerCase().includes("driver")
  );

  const kycStatus = (auth?.kycStatus || "").toUpperCase();
  const kycCfg    = KYC_CONFIG[kycStatus] ?? null;

  const handleUpdateDocuments = async () => {
    if (!auth) return;
    if (!files.license || !files.rc) {
      toast.error("Please select both your Driving License and Vehicle RC files.");
      return;
    }
    try {
      setIsUploading(true);
      toast.info("Uploading documents securely…");
      const [licenseUrl, rcUrl] = await Promise.all([
        uploadToSupabase(files.license),
        uploadToSupabase(files.rc),
      ]);
      const res = await fetch(`https://ride-link-backend.onrender.com/api/users/update-kyc?userId=${auth.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ licenseUrl, rcUrl }),
      });
      if (!res.ok) throw new Error("Backend update failed.");
      const updatedAuth = { ...auth, kycStatus: "PENDING", licenseUrl, rcUrl };
      localStorage.setItem("ridelink:auth", JSON.stringify(updatedAuth));
      setAuth(updatedAuth);
      toast.success("Documents submitted! Admin will verify them shortly.");
      setFiles({ license: null, rc: null });
    } catch (err: any) {
      toast.error(err.message || "Upload failed. Check your network and try again.");
    } finally {
      setIsUploading(false);
    }
  };

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── hero ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-neutral-950 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_200px_at_50%_0px,hsla(46,95%,55%,0.12),transparent)]" />
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary mb-3">
            Trust & Safety
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Safety & Security
          </h1>
          <p className="mt-2 text-white/50 text-sm max-w-lg">
            OTP-verified boarding, live GPS tracking, document verification, and 24/7 emergency support — your safety is our priority.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {[
              { icon: <ShieldCheck className="h-4 w-4 text-primary/80" />, label: "OTP Verified" },
              { icon: <Zap         className="h-4 w-4 text-primary/80" />, label: "Live Tracking" },
              { icon: <Users       className="h-4 w-4 text-primary/80" />, label: "Verified Community" },
            ].map(({ icon, label }) => (
              <span key={label} className="flex items-center gap-2 text-sm text-white/50">
                {icon} {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">

        {/* ── KYC status banner (🔥 FIX APPLIED HERE) ───────────── */}
        {auth && !isDriver ? (
          <div className="flex items-center gap-3 rounded-2xl border px-5 py-4 border-slate-200 bg-slate-100/50 text-slate-800">
            <ShieldCheck className="h-5 w-5 text-slate-400" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Passenger Account</p>
              <p className="text-xs text-slate-500 mt-0.5">KYC verification is only required for drivers and riders.</p>
            </div>
            <span className="hidden sm:block text-[11px] font-bold uppercase tracking-widest opacity-60 shrink-0">
              Not Required
            </span>
          </div>
        ) : auth && kycCfg && (
          <div className={`flex items-center gap-3 rounded-2xl border px-5 py-4 ${kycCfg.cls}`}>
            {kycCfg.icon}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{kycCfg.label}</p>
              {kycStatus === "APPROVED" && (
                <p className="text-xs opacity-70 mt-0.5">Your account is fully verified. You can offer rides.</p>
              )}
              {kycStatus === "PENDING" && (
                <p className="text-xs opacity-70 mt-0.5">Your documents are under review. This usually takes 24–48 hours.</p>
              )}
              {kycStatus === "REJECTED" && (
                <p className="text-xs opacity-70 mt-0.5">Please re-upload clear, valid documents.</p>
              )}
            </div>
            <span className="hidden sm:block text-[11px] font-bold uppercase tracking-widest opacity-60 shrink-0">
              {kycStatus}
            </span>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">

          {/* ── VERIFICATION CARD ────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 text-white shrink-0">
                <IdCard className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Verification Portal</p>
                <p className="text-[11px] text-slate-500">Submit KYC documents to offer rides</p>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* current status row (🔥 FIX APPLIED HERE) */}
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">KYC Status</span>
                {!isDriver ? (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 uppercase">
                    Not Required
                  </span>
                ) : kycCfg ? (
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${kycCfg.cls}`}>
                    {kycCfg.label}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 uppercase">
                    Not Submitted
                  </span>
                )}
              </div>

              {(auth?.licenseUrl || auth?.rcUrl) && (
                <div className="space-y-2">
                  {auth.licenseUrl && (
                    <a href={auth.licenseUrl} target="_blank" rel="noreferrer"
                       className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors">
                      <FileText className="h-3.5 w-3.5" /> View Driving License
                    </a>
                  )}
                  {auth.rcUrl && (
                    <a href={auth.rcUrl} target="_blank" rel="noreferrer"
                       className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors">
                      <FileText className="h-3.5 w-3.5" /> View Vehicle RC
                    </a>
                  )}
                </div>
              )}

              {isDriver ? (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    {kycStatus === "APPROVED" ? "Update Documents" : "Upload Documents"}
                  </p>
                  <FileDropZone
                    label="Driving License"
                    accept=".pdf,.jpg,.jpeg,.png"
                    file={files.license}
                    onChange={f => setFiles(p => ({ ...p, license: f }))}
                  />
                  <FileDropZone
                    label="Vehicle RC"
                    accept=".pdf,.jpg,.jpeg,.png"
                    file={files.rc}
                    onChange={f => setFiles(p => ({ ...p, rc: f }))}
                  />
                  <Button
                    onClick={handleUpdateDocuments}
                    disabled={isUploading || !files.license || !files.rc}
                    className="w-full h-11 rounded-xl font-bold text-sm"
                  >
                    {isUploading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
                    ) : (
                      <><UploadCloud className="mr-2 h-4 w-4" /> Submit for Verification</>
                    )}
                  </Button>
                  <p className="text-[10px] text-center text-slate-400">
                    Files are encrypted and stored securely on Supabase.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <FileCheck2 className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-slate-700">Passenger Account</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      KYC verification is only required for drivers and riders who offer rides.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── EMERGENCY CARD ───────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shrink-0">
                <BellRing className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Emergency Support</p>
                <p className="text-[11px] text-slate-500">Available 24/7 for your safety</p>
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div className="space-y-3">
                {[
                  { icon: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />, text: "Share live location with family during trips." },
                  { icon: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />, text: "OTP verification is required before every ride starts." },
                  { icon: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />, text: "24/7 incident reporting and support system." },
                  { icon: <Lock         className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />, text: "Phone numbers are masked for all other users." },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-start gap-2.5 text-sm text-slate-600">
                    {icon} {text}
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-red-100 bg-red-50 p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-red-600">Emergency Contact</p>
                <div className="grid grid-cols-2 gap-2">
                  <a href="tel:112"
                     className="flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 transition-colors shadow-sm">
                    <Siren className="h-4 w-4" /> SOS 112
                  </a>
                  <a href="sms:112"
                     className="flex items-center justify-center gap-2 rounded-xl border-2 border-red-300 py-3 text-sm font-bold text-red-700 hover:bg-red-100 transition-colors">
                    <PhoneCall className="h-4 w-4" /> SMS Help
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <p>
                  In an emergency, tap <b>SOS</b> in the Live Track screen to instantly alert your emergency contacts and admin with your GPS coordinates.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── SAFETY GUIDELINES / FAQ ───────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 text-white shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Safety Guidelines</p>
              <p className="text-[11px] text-slate-500">Best practices for a safe journey</p>
            </div>
          </div>
          <div className="px-5">
            {FAQS.map(faq => <Faq key={faq.q} q={faq.q} a={faq.a} />)}
          </div>
        </div>

      </div>
    </div>
  );
}