import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  User, QrCode, ShieldCheck, Mail, Phone, Loader2,
  Home, ArrowLeft, CheckCircle2, Car, FileText,
  Image as ImageIcon, Edit3, X, Save, Lock,
  AlertCircle, ChevronRight, Shield, Upload, Trash2,
  Eye, EyeOff, KeyRound, RefreshCw, Timer, UploadCloud, Rocket
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";

/* ─── supabase setup (For Upgrade feature) ───────────────────────── */
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

/* ─── File Drop Zone Component (For Modal) ───────────────────────── */
function FileDropZone({
                        label, accept, file, onChange,
                      }: {
  label: string; accept?: string; file: File | null; onChange: (f: File | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</label>
      <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 transition-colors ${
        file ? "border-primary/40 bg-primary/5" : "border-slate-200 hover:border-primary/30 hover:bg-slate-50"
      }`}>
        <input type="file" accept={accept} className="hidden" onChange={e => onChange(e.target.files?.[0] || null)} />
        {file ? (
          <>
            <FileText className="h-5 w-5 text-primary" />
            <span className="text-xs font-semibold text-primary text-center truncate max-w-[180px]">{file.name}</span>
          </>
        ) : (
          <>
            <UploadCloud className="h-5 w-5 text-slate-400" />
            <span className="text-xs font-medium text-slate-500">Click to upload</span>
          </>
        )}
      </label>
    </div>
  );
}

/* ─── tiny design-token helpers ──────────────────────────────────── */
const card = "rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden";
const fieldBox = "flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 transition-colors hover:bg-slate-100/60";

function maskUpiId(upiId: string): string {
  if (!upiId) return "••••••••";
  const atIndex = upiId.indexOf("@");
  if (atIndex === -1) return "••••••••";
  const provider = upiId.slice(atIndex);
  return "•".repeat(Math.min(8, atIndex)) + provider;
}

function KycBadge({ status }: { status?: string }) {
  const approved = status === "APPROVED";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase ${
      approved ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
    }`}>
      {approved ? <ShieldCheck className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
      KYC {approved ? "Verified" : status || "Pending"}
    </span>
  );
}

function Section({ icon, title, subtitle, children, accent }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode; accent?: string; }) {
  return (
    <div className={card}>
      <div className={`flex items-center gap-3 border-b border-slate-100 px-6 py-4 ${accent ?? ""}`}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm">{icon}</div>
        <div>
          <p className="text-sm font-bold text-slate-800">{title}</p>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function ModalField({ label, icon, value, onChange, placeholder }: { label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; placeholder?: string; }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="pl-9 font-medium bg-slate-50 border-slate-200 focus:bg-white transition-colors" placeholder={placeholder} />
      </div>
    </div>
  );
}

function PhotoPicker({ value, onChange, initials }: { value: string; onChange: (v: string) => void; initials: string; }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgError, setImgError] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { onChange(reader.result as string); setImgError(false); };
    reader.readAsDataURL(file);
  };

  const hasImage = !!value && !imgError;

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Profile Photo</label>
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-200 flex items-center justify-center text-xl font-black text-slate-400 shadow-sm">
          {hasImage
            ? <img src={value} alt="Preview" className="h-full w-full object-cover" onError={() => setImgError(true)} />
            : <span>{initials}</span>}
        </div>
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-sm w-full justify-center">
            <Upload className="h-3.5 w-3.5 text-slate-500" /> Select Photo
          </button>
          {hasImage && (
            <button type="button" onClick={() => { onChange(""); setImgError(false); }} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors w-full justify-center">
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input value={value.startsWith("data:") ? "" : value} onChange={(e) => { onChange(e.target.value); setImgError(false); }} className="pl-9 font-medium bg-slate-50 border-slate-200 focus:bg-white text-sm" placeholder="Or paste an image URL…" />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   OTP REVEAL MODAL
   ══════════════════════════════════════════════════════════════════════ */
const OTP_LENGTH = 6;
const REVEAL_DURATION_SEC = 15;
const RESEND_COOLDOWN_SEC = 30;

function OtpRevealModal({ email, onVerified, onClose }: { email: string; onVerified: () => void; onClose: () => void; }) {
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendOtp = useCallback(async () => {
    if (isSending || resendCooldown > 0) return;
    setIsSending(true); setError(null);
    try {
      const res = await fetch("http://localhost:9090/api/auth/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type: "login" }),
      });
      if (!res.ok) throw new Error("Failed to send OTP.");
      setOtpSent(true); toast.success(`OTP sent to ${email}`);
      setResendCooldown(RESEND_COOLDOWN_SEC);
      cooldownRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
          return prev - 1;
        });
      }, 1000);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (e: any) {
      setError(e.message ?? "Could not send OTP.");
      toast.error("Failed to send OTP. Please try again.");
    } finally { setIsSending(false); }
  }, [email, isSending, resendCooldown]);

  useEffect(() => {
    sendOtp();
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const handleOtpChange = (idx: number, val: string) => {
    const digits = val.replace(/\D/g, "");
    if (digits.length > 1) {
      const next = [...otp];
      for (let i = 0; i < OTP_LENGTH && i < digits.length; i++) next[idx + i] = digits[i];
      setOtp(next.slice(0, OTP_LENGTH));
      const focusIdx = Math.min(idx + digits.length, OTP_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
      return;
    }
    const next = [...otp]; next[idx] = digits; setOtp(next);
    if (digits && idx < OTP_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
  };

  const fullOtp = otp.join("");

  const handleVerify = async () => {
    if (fullOtp.length !== OTP_LENGTH) { setError("Enter all 6 digits."); return; }
    setIsVerifying(true); setError(null);
    try {
      const res = await fetch("http://localhost:9090/api/auth/verify-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: fullOtp }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Invalid OTP. Please try again.");
      }
      toast.success("Identity verified!");
      onVerified();
    } catch (e: any) {
      setError(e.message ?? "Verification failed.");
      setOtp(Array(OTP_LENGTH).fill(""));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally { setIsVerifying(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && fullOtp.length === OTP_LENGTH) handleVerify(); };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="relative bg-gradient-to-br from-slate-900 to-slate-700 px-6 pt-6 pb-8 text-center">
          <button onClick={onClose} className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"><X className="h-3.5 w-3.5" /></button>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 border border-white/20"><KeyRound className="h-7 w-7 text-white" /></div>
          <h3 className="text-lg font-extrabold text-white tracking-tight">Verify Identity</h3>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">{otpSent ? <>OTP sent to <span className="font-bold text-white">{email}</span></> : "Sending OTP to your email…"}</p>
        </div>

        <div className="-mt-4 mx-4 mb-0 rounded-xl bg-white border border-slate-200 shadow-sm px-5 py-5 space-y-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 text-center">Enter 6-digit OTP</p>
            <div className="flex justify-center gap-2" onKeyDown={handleKeyDown}>
              {Array.from({ length: OTP_LENGTH }).map((_, idx) => (
                <input key={idx} ref={(el) => { inputRefs.current[idx] = el; }} type="text" inputMode="numeric" maxLength={6} value={otp[idx]} onChange={(e) => handleOtpChange(idx, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(idx, e)} onFocus={(e) => e.target.select()} className={`h-12 w-11 rounded-xl border-2 text-center text-lg font-black text-slate-900 outline-none transition-all ${otp[idx] ? "border-primary bg-primary/5 text-primary" : "border-slate-200 bg-slate-50"} focus:border-primary focus:bg-white focus:shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.12)]`} disabled={isVerifying || isSending} autoComplete="one-time-code" />
              ))}
            </div>
            {error && <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2"><AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" /><p className="text-xs text-red-600 font-medium">{error}</p></div>}
          </div>

          <Button className="w-full h-11 font-bold bg-slate-900 hover:bg-slate-800 text-white gap-2 rounded-xl shadow-sm" onClick={handleVerify} disabled={fullOtp.length !== OTP_LENGTH || isVerifying || isSending}>
            {isVerifying ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</> : <><ShieldCheck className="h-4 w-4" /> Verify & Reveal</>}
          </Button>

          <div className="text-center">
            {resendCooldown > 0 ? (
              <p className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1.5"><Timer className="h-3.5 w-3.5" />Resend in <span className="font-bold text-slate-600 tabular-nums">{resendCooldown}s</span></p>
            ) : (
              <button type="button" onClick={sendOtp} disabled={isSending} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors disabled:opacity-50">
                {isSending ? <><Loader2 className="h-3 w-3 animate-spin" /> Sending…</> : <><RefreshCw className="h-3 w-3" /> Resend OTP</>}
              </button>
            )}
          </div>
        </div>

        <div className="px-4 py-4 text-center">
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Your UPI ID will be visible for {REVEAL_DURATION_SEC} seconds after verification for security.</p>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN PROFILE COMPONENT
   ══════════════════════════════════════════════════════════════════════ */
export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  const [newUpiInput, setNewUpiInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingUpi, setIsSavingUpi] = useState(false);
  const [showUpiInput, setShowUpiInput] = useState(false);

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [isUpiRevealed, setIsUpiRevealed] = useState(false);
  const [revealCountdown, setRevealCountdown] = useState(0);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "",
    phone: "",
    vehicleNumber: "",
    profileImageUrl: "",
  });

  // 🔥 Upgrade to Driver Modal State
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeData, setUpgradeData] = useState({
    vehicleNumber: "",
  });
  const [files, setFiles] = useState<{ license: File | null; rc: File | null }>({
    license: null, rc: null,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ridelink:auth");
      if (!raw || raw === "null") { navigate("/login"); return; }
      const authObj = JSON.parse(raw);
      setUser(authObj);
      fetchUserProfile(authObj);
    } catch {
      navigate("/login");
    }
  }, []);

  const fetchUserProfile = async (authObj: any) => {
    try {
      const res = await fetch(`http://localhost:9090/api/users/${authObj.id || authObj.userId}`, { headers: { Authorization: `Bearer ${authObj.token}` } });
      if (res.ok) {
        const data = await res.json();
        setUser(data);

        // Also update local storage so global state remains fresh
        const updatedAuth = { ...authObj, ...data };
        localStorage.setItem("ridelink:auth", JSON.stringify(updatedAuth));
      }
    } catch {
      console.log("Using LocalStorage details.");
    } finally {
      setIsLoading(false);
    }
  };

  const startRevealTimer = useCallback(() => {
    if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    setRevealCountdown(REVEAL_DURATION_SEC);
    revealTimerRef.current = setInterval(() => {
      setRevealCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(revealTimerRef.current!);
          setIsUpiRevealed(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => { if (revealTimerRef.current) clearInterval(revealTimerRef.current); };
  }, []);

  const handleOtpVerified = useCallback(() => {
    setShowOtpModal(false);
    setIsUpiRevealed(true);
    startRevealTimer();
  }, [startRevealTimer]);

  const handleHideUpi = useCallback(() => {
    if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    setIsUpiRevealed(false);
    setRevealCountdown(0);
  }, []);

  const handleSaveUpi = async () => {
    const trimmed = newUpiInput.trim();
    if (!trimmed || !trimmed.includes("@")) { toast.error("Enter a valid UPI ID (e.g. name@okicici)."); return; }
    setIsSavingUpi(true);
    try {
      const authData = JSON.parse(localStorage.getItem("ridelink:auth") || "{}");
      const userId = authData?.id || authData?.userId;
      const res = await fetch(`http://localhost:9090/api/users/${userId}/upi`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authData.token}` },
        body: JSON.stringify({ upiId: trimmed }),
      });
      if (res.ok) {
        toast.success("UPI ID saved successfully!");
        const updatedUser = { ...user, upiId: trimmed };
        setUser(updatedUser);
        authData.upiId = trimmed;
        localStorage.setItem("ridelink:auth", JSON.stringify(authData));
        setNewUpiInput("");
        setShowUpiInput(false);
      } else { toast.error("Failed to update UPI."); }
    } catch { toast.error("Server connection error."); } finally { setIsSavingUpi(false); }
  };

  const openEditModal = () => {
    setEditForm({
      fullName: user?.fullName || "",
      phone: user?.phone || "",
      vehicleNumber: user?.vehicleNumber || "",
      profileImageUrl: user?.profileImageUrl || "",
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateProfile = async () => {
    if (!editForm.fullName) { toast.error("Full Name is required."); return; }
    setIsUpdatingProfile(true);
    try {
      const authData = JSON.parse(localStorage.getItem("ridelink:auth") || "{}");
      const userId = authData?.id || authData?.userId;
      const res = await fetch(`http://localhost:9090/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authData.token}` },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const updated = await res.json();
        toast.success("Profile updated successfully!");
        setUser(updated);
        setIsEditModalOpen(false);
        authData.fullName = updated.fullName;
        authData.phone = updated.phone;
        authData.vehicleNumber = updated.vehicleNumber;
        authData.profileImageUrl = updated.profileImageUrl;
        localStorage.setItem("ridelink:auth", JSON.stringify(authData));
      } else { toast.error("Failed to update profile."); }
    } catch { toast.error("Server connection error."); } finally { setIsUpdatingProfile(false); }
  };

  // 🔥 Handle Upgrade to Driver
  const handleUpgradeToDriver = async () => {
    if (!upgradeData.vehicleNumber.trim()) { toast.error("Vehicle Number is required."); return; }
    if (!files.license || !files.rc) { toast.error("Please upload both Driving License and Vehicle RC."); return; }

    setIsUpgrading(true);
    toast.info("Uploading documents securely...");

    try {
      const authData = JSON.parse(localStorage.getItem("ridelink:auth") || "{}");
      const userId = authData?.id || authData?.userId;

      // 1. Upload files to Supabase
      const [licenseUrl, rcUrl] = await Promise.all([
        uploadToSupabase(files.license),
        uploadToSupabase(files.rc),
      ]);

      // 2. Call existing update-kyc API
      const resKyc = await fetch(`http://localhost:9090/api/auth/update-kyc?userId=${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authData.token}` },
        body: JSON.stringify({ licenseUrl, rcUrl }),
      });

      if (!resKyc.ok) throw new Error("Failed to submit documents.");

      // 3. Update Vehicle Number & Role via User update API
      const updatedProfilePayload = {
        fullName: user.fullName,
        phone: user.phone,
        vehicleNumber: upgradeData.vehicleNumber,
        role: "DRIVER" // 🔥 Promoting role to driver
      };

      const resUser = await fetch(`http://localhost:9090/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authData.token}` },
        body: JSON.stringify(updatedProfilePayload),
      });

      if (!resUser.ok) throw new Error("Failed to upgrade role.");

      const updatedUser = await resUser.json();

      // Merge all new data into local storage
      authData.role = "DRIVER";
      authData.vehicleNumber = upgradeData.vehicleNumber;
      authData.licenseUrl = licenseUrl;
      authData.rcUrl = rcUrl;
      authData.kycStatus = "PENDING";
      localStorage.setItem("ridelink:auth", JSON.stringify(authData));

      setUser(authData);
      toast.success("Successfully upgraded! Your KYC is pending approval.");
      setIsUpgradeModalOpen(false);
      setFiles({ license: null, rc: null });
      setUpgradeData({ vehicleNumber: "" });

    } catch (err: any) {
      toast.error(err.message || "Upgrade failed. Check network and try again.");
    } finally {
      setIsUpgrading(false);
    }
  };


  if (isLoading)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <Loader2 className="h-9 w-9 animate-spin text-primary" />
        <p className="text-sm font-medium text-slate-500">Loading your profile…</p>
      </div>
    );

  const isDriver =
    String(user?.role).toUpperCase().includes("DRIVER") ||
    String(user?.role).toUpperCase().includes("RIDER");

  const initials =
    user?.fullName?.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white pb-16 font-sans">
      <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 rounded-full hover:bg-slate-100">
              <ArrowLeft className="h-4 w-4 text-slate-600" />
            </Button>
            <span className="text-lg font-extrabold tracking-tight text-slate-800">My Profile</span>
          </div>
          <Link to="/" className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
            <Home className="h-3.5 w-3.5" /> Home
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-4 pt-8 space-y-6">

        {/* PROFILE HEADER */}
        <div className={`${card} relative`}>
          <div className="h-28 w-full bg-gradient-to-br from-slate-800 via-slate-700 to-slate-600" />
          <div className="flex items-end justify-between px-6 -mt-12 pb-5">
            <div className="relative">
              <div className="h-24 w-24 rounded-2xl border-4 border-white shadow-md overflow-hidden bg-slate-200 flex items-center justify-center">
                {user?.profileImageUrl
                  ? <img src={user.profileImageUrl} alt="Profile" className="h-full w-full object-cover" />
                  : <span className="text-2xl font-black text-slate-500">{initials}</span>}
              </div>
              <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />
            </div>
            <Button onClick={openEditModal} size="sm" className="gap-2 rounded-xl bg-slate-900 text-white hover:bg-slate-700 font-semibold shadow-sm mt-14">
              <Edit3 className="h-3.5 w-3.5" /> Edit Profile
            </Button>
          </div>
          <div className="px-6 pb-6 -mt-1">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{user?.fullName || "Your Name"}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                <User className="h-3 w-3" />{user?.role || "USER"}
              </span>
              {isDriver && <KycBadge status={user?.kycStatus} />}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className={fieldBox}>
                <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email</p>
                  <p className="truncate text-sm font-semibold text-slate-800">{user?.email || "Not provided"}</p>
                </div>
              </div>
              <div className={fieldBox}>
                <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Phone</p>
                  <p className="text-sm font-semibold text-slate-800">{user?.phone || <span className="text-slate-400 font-normal">Not added</span>}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* VEHICLE & DOCUMENTS SECTION */}
        <Section icon={<Car className="h-4 w-4 text-slate-600" />} title="Vehicle & Documents" subtitle="Your registered vehicle and KYC documents">
          {isDriver ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Vehicle Number</p>
                <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-3">
                  <Car className="h-4 w-4 text-slate-400" />
                  <span className="font-mono text-sm font-bold tracking-widest text-slate-700">{user?.vehicleNumber || "—"}</span>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Driving License", url: user?.licenseUrl },
                  { label: "Vehicle RC", url: user?.rcUrl },
                ].map(({ label, url }) => (
                  <div key={label}>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors">
                        <FileText className="h-3.5 w-3.5" /> View Document <ChevronRight className="h-3 w-3 opacity-60" />
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400">
                        <AlertCircle className="h-3.5 w-3.5" /> Not uploaded
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {/* Note for drivers: updates happen in safety tab */}
              <div className="sm:col-span-2 mt-2 flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <p>To update your KYC documents, please visit the <Link to="/safety" className="font-bold underline">Trust & Safety</Link> page.</p>
              </div>
            </div>
          ) : (
            // 🔥 Passenger Upgrade UI
            <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 border-dashed rounded-xl p-6 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Rocket className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800">Want to start earning?</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Upgrade to a Driver account by providing your vehicle number and KYC documents to start offering rides.</p>
              </div>
              <Button onClick={() => setIsUpgradeModalOpen(true)} className="mt-2 bg-blue-600 hover:bg-blue-700 font-bold text-white shadow-sm rounded-xl">
                Upgrade to Driver
              </Button>
            </div>
          )}
        </Section>

        {/* PAYMENT SETTINGS */}
        <Section icon={<QrCode className="h-4 w-4 text-emerald-600" />} title="Payment Settings" subtitle="Manage your UPI ID for receiving ride payments">
          {isDriver ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Add or Update UPI</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input type={showUpiInput ? "text" : "password"} value={newUpiInput} onChange={(e) => setNewUpiInput(e.target.value)} placeholder="e.g. 9876543210@ybl" className="pl-9 pr-10 font-medium bg-slate-50 border-slate-200 focus:bg-white tracking-wider" autoComplete="off" />
                    <button type="button" onClick={() => setShowUpiInput((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none" tabIndex={-1} aria-label={showUpiInput ? "Hide" : "Show"}>
                      {showUpiInput ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button onClick={handleSaveUpi} disabled={isSavingUpi || !newUpiInput} className="min-w-[110px] rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700 shrink-0">
                    {isSavingUpi ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1.5" />Save UPI</>}
                  </Button>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  Your UPI ID is masked for security. Click the eye icon to preview.
                </p>
              </div>

              {user?.upiId && (
                <div className={`rounded-xl border p-4 transition-all duration-300 ${isUpiRevealed ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <CheckCircle2 className={`h-5 w-5 shrink-0 mt-0.5 ${isUpiRevealed ? "text-emerald-500" : "text-slate-400"}`} />
                      <div className="min-w-0">
                        <p className={`text-sm font-bold ${isUpiRevealed ? "text-emerald-800" : "text-slate-700"}`}>
                          {isUpiRevealed ? "UPI ID (Revealed)" : "UPI Linked"}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <p className={`text-xs font-mono font-bold tracking-wider ${isUpiRevealed ? "text-emerald-700" : "text-slate-500"}`}>
                            {isUpiRevealed ? user.upiId : maskUpiId(user.upiId)}
                          </p>
                          {isUpiRevealed && revealCountdown > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              <Timer className="h-2.5 w-2.5" />
                              Hides in {revealCountdown}s
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isUpiRevealed ? (
                      <button type="button" onClick={handleHideUpi} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors">
                        <EyeOff className="h-3.5 w-3.5" /> Hide
                      </button>
                    ) : (
                      <button type="button" onClick={() => setShowOtpModal(true)} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-white transition-colors shadow-sm">
                        <Eye className="h-3.5 w-3.5" /> Show
                      </button>
                    )}
                  </div>
                  {!isUpiRevealed && (
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium border-t border-slate-200 pt-3">
                      <ShieldCheck className="h-3 w-3 text-slate-400 shrink-0" />
                      OTP verification required to reveal your UPI ID.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <Shield className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
              <p><span className="font-bold text-slate-700">Passenger account — </span>you don't need to save a UPI ID. Pay drivers directly via any UPI app.</p>
            </div>
          )}
        </Section>
      </div>

      {showOtpModal && <OtpRevealModal email={user?.email || ""} onVerified={handleOtpVerified} onClose={() => setShowOtpModal(false)} />}

      {/* ─── Edit Profile Modal ─────────────────────────────────────────────── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && setIsEditModalOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white"><Edit3 className="h-4 w-4" /></div>
                <h3 className="font-bold text-slate-900">Edit Profile</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-y-auto max-h-[65vh] p-5 space-y-4 bg-white">
              <ModalField label="Full Name" icon={<User className="h-4 w-4" />} value={editForm.fullName} onChange={(v) => setEditForm({ ...editForm, fullName: v })} placeholder="Enter full name" />
              <ModalField label="Phone Number" icon={<Phone className="h-4 w-4" />} value={editForm.phone} onChange={(v) => setEditForm({ ...editForm, phone: v })} placeholder="Enter phone number" />

              {/* Only let them edit vehicle number here if they are already a driver. Otherwise hide it. */}
              {isDriver && (
                <ModalField label="Vehicle Number" icon={<Car className="h-4 w-4" />} value={editForm.vehicleNumber} onChange={(v) => setEditForm({ ...editForm, vehicleNumber: v })} placeholder="e.g. MP09 AB 1234" />
              )}

              <PhotoPicker value={editForm.profileImageUrl} onChange={(v) => setEditForm({ ...editForm, profileImageUrl: v })} initials={editForm.fullName?.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "U"} />
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <p>Email and KYC documents cannot be edited here for security reasons.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <Button variant="outline" className="rounded-xl font-semibold text-slate-700 border-slate-200" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateProfile} disabled={isUpdatingProfile} className="min-w-[120px] rounded-xl bg-slate-900 font-bold text-white hover:bg-slate-700">
                {isUpdatingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1.5" />Save Changes</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 🔥 Upgrade to Driver Modal ─────────────────────────────────────── */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && setIsUpgradeModalOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-blue-700 to-blue-600 px-6 pt-6 pb-8 text-center relative">
              <button onClick={() => setIsUpgradeModalOpen(false)} className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 border border-white/20">
                <Rocket className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-lg font-extrabold text-white tracking-tight">Become a Driver</h3>
              <p className="mt-1 text-xs text-blue-100 leading-relaxed max-w-xs mx-auto">Upload your vehicle details to start offering rides and earning money.</p>
            </div>

            <div className="-mt-4 mx-4 mb-4 rounded-xl bg-white border border-slate-200 shadow-sm p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <ModalField
                label="Vehicle Number"
                icon={<Car className="h-4 w-4" />}
                value={upgradeData.vehicleNumber}
                onChange={(v) => setUpgradeData({ vehicleNumber: v })}
                placeholder="e.g. MP09 AB 1234"
              />
              <div className="pt-2">
                <FileDropZone
                  label="Driving License"
                  accept=".pdf,.jpg,.jpeg,.png"
                  file={files.license}
                  onChange={f => setFiles(p => ({ ...p, license: f }))}
                />
              </div>
              <div className="pt-2">
                <FileDropZone
                  label="Vehicle RC"
                  accept=".pdf,.jpg,.jpeg,.png"
                  file={files.rc}
                  onChange={f => setFiles(p => ({ ...p, rc: f }))}
                />
              </div>
            </div>

            <div className="px-5 pb-5">
              <Button onClick={handleUpgradeToDriver} disabled={isUpgrading} className="w-full h-11 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 shadow-sm">
                {isUpgrading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing Upgrade…</> : "Submit Documents"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}