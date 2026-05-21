import { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, UserCheck, FileText, ExternalLink, Loader2, RefreshCw, FileWarning, CalendarCheck, CalendarClock } from "lucide-react";
import { toast } from "sonner";

export default function AdminKyc() {
  const [pendingDrivers, setPendingDrivers] = useState<any[]>([]);
  const [verifiedDrivers, setVerifiedDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewDoc, setViewDoc] = useState<string | null>(null);

  const auth = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("ridelink:auth") || "{}");
    } catch {
      return {};
    }
  }, []);

  const fetchData = useCallback(async (showToast = false) => {
    if (!auth?.token) {
      setLoading(false);
      return;
    }

    try {
      if (showToast) setIsRefreshing(true);

      const headers = {
        "Authorization": `Bearer ${auth.token}`,
        "Content-Type": "application/json"
      };

      const [pendingRes, verifiedRes] = await Promise.all([
        fetch("http://localhost:9090/api/admin/pending-drivers", { method: "GET", headers }),
        fetch("http://localhost:9090/api/admin/verified-drivers", { method: "GET", headers })
      ]);

      if (!pendingRes.ok || !verifiedRes.ok) throw new Error("Failed to fetch data");

      const pendingData = await pendingRes.json();
      const verifiedData = await verifiedRes.json();

      setPendingDrivers(Array.isArray(pendingData) ? pendingData : []);
      setVerifiedDrivers(Array.isArray(verifiedData) ? verifiedData : []);

      if (showToast) toast.success("Data synced successfully!");
    } catch (error: any) {
      console.error("Fetch Error:", error.message);
      toast.error("Failed to sync with server");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [auth.token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 🔥 UPDATE: Includes use kiya taaki URL mein query param ho toh bhi chal jaye
  const isPDF = (url: string) => url?.toLowerCase().includes(".pdf");

  const formatDate = (dateString: string) => {
    if (!dateString) return "Not Available";
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const handleAction = async (userId: number, status: string) => {
    try {
      const res = await fetch(`http://localhost:9090/api/admin/verify-driver/${userId}?status=${status}`, {
        method: 'PUT',
        headers: { "Authorization": `Bearer ${auth.token}` }
      });
      if (res.ok) {
        toast.success(`Driver ${status} successfully!`);
        fetchData();
      } else {
        toast.error("Update failed");
      }
    } catch (error) {
      toast.error("Connection error");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 font-medium">Fetching KYC records...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="flex items-center justify-between mb-8 border-b pb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <UserCheck className="text-primary" /> Driver KYC Portal
          </h1>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Sync Data
        </Button>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 h-12 bg-slate-100">
          <TabsTrigger value="pending" className="text-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Pending Requests <Badge variant="secondary" className="ml-2">{pendingDrivers.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="verified" className="text-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Verified History <Badge variant="secondary" className="ml-2">{verifiedDrivers.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingDrivers.length === 0 ? (
            <div className="text-center py-24 bg-slate-50/50 rounded-3xl border-2 border-dashed">
              <UserCheck className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-800">No Pending Requests</h3>
              <p className="text-slate-500 mt-1">All drivers are verified or no new requests found.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {pendingDrivers.map((driver) => (
                <Card key={driver.id} className="overflow-hidden shadow-md">
                  <CardHeader className="bg-slate-50/80 border-b">
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="text-lg font-bold">{driver.fullName}</CardTitle>
                        <p className="text-sm text-slate-500">{driver.email} • {driver.phone}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleAction(driver.id, "APPROVED")}>
                          <Check className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAction(driver.id, "REJECTED")}>
                          <X className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid md:grid-cols-2 gap-8">
                      {[
                        { label: "Driving License", url: driver.licenseUrl },
                        { label: "Vehicle RC", url: driver.rcUrl }
                      ].map((doc, idx) => (
                        <div key={idx} className="space-y-3">
                          <p className="text-sm font-bold flex items-center gap-2 text-slate-700">
                            <FileText className="h-4 w-4 text-primary" /> {doc.label}
                          </p>
                          <div className="relative group rounded-xl border-2 border-slate-100 bg-slate-200 flex items-center justify-center min-h-52 overflow-hidden">
                            {isPDF(doc.url) ? (
                              <div className="text-center p-4">
                                <FileWarning className="h-10 w-10 text-orange-500 mx-auto mb-2" />
                                <p className="text-xs font-bold text-slate-600 mb-3">PDF Document</p>
                                <Button size="sm" variant="secondary" onClick={() => setViewDoc(doc.url)}>
                                  View PDF <ExternalLink className="ml-1 h-3 w-3"/>
                                </Button>
                              </div>
                            ) : (
                              <img src={doc.url || "https://placehold.co/400x300?text=No+Image"} alt={doc.label} className="w-full h-52 object-contain" />
                            )}
                            <button onClick={() => setViewDoc(doc.url)} className="absolute inset-0 w-full h-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-all cursor-pointer">
                              <span className="flex items-center gap-2 font-medium bg-black/60 px-4 py-2 rounded-lg">
                                <ExternalLink className="h-5 w-5" /> Click to View
                              </span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="verified">
          {verifiedDrivers.length === 0 ? (
            <div className="text-center py-24 bg-slate-50/50 rounded-3xl border-2 border-dashed">
              <CalendarCheck className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-800">No Verified Drivers Yet</h3>
              <p className="text-slate-500 mt-1">Approved drivers will appear here.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {verifiedDrivers.map((driver) => (
                <Card key={driver.id} className="shadow-md border-emerald-100">
                  <CardHeader className="bg-emerald-50/40 border-b">
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="text-emerald-800 flex items-center gap-2">{driver.fullName} <Check className="h-5 w-5 text-emerald-600" /></CardTitle>
                        <p className="text-sm text-slate-600">{driver.email} • {driver.phone}</p>
                      </div>
                      <Badge className="bg-emerald-600 px-3 py-1">APPROVED</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6 mb-8 p-4 bg-white shadow-sm rounded-xl border border-slate-100">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="bg-blue-50 p-3 rounded-full"><CalendarClock className="h-6 w-6 text-blue-600" /></div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Applied On</p>
                          <p className="text-sm font-semibold text-slate-700">{formatDate(driver.kycAppliedAt)}</p>
                        </div>
                      </div>
                      <div className="w-px bg-slate-200 hidden md:block"></div>
                      <div className="flex items-center gap-4 flex-1">
                        <div className="bg-emerald-50 p-3 rounded-full"><CalendarCheck className="h-6 w-6 text-emerald-600" /></div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Verified On</p>
                          <p className="text-sm font-semibold text-slate-700">{formatDate(driver.kycVerifiedAt)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      {[
                        { label: "View Driving License", url: driver.licenseUrl },
                        { label: "View Vehicle RC", url: driver.rcUrl }
                      ].map((doc, idx) => (
                        <Button key={idx} variant="outline" className="w-full justify-between group" onClick={() => setViewDoc(doc.url)}>
                          <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-emerald-600" /> {doc.label}</span>
                          <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ======================= DOCUMENT VIEWER MODAL ======================= */}
      {viewDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="relative bg-white w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <FileText className="h-5 w-5 text-primary"/>
                </div>
                <h3 className="font-bold text-lg text-slate-800">Document Viewer</h3>
              </div>
              <div className="flex items-center gap-2">
                {/* 🔥 NAYA UPDATE: Supabase ke liye direct URL open/download hoga 🔥 */}
                {isPDF(viewDoc) && (
                  <Button asChild variant="outline" size="sm" className="gap-2 border-primary text-primary hover:bg-primary/5">
                    <a href={viewDoc} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" /> Open / Download
                    </a>
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setViewDoc(null)} className="hover:bg-red-100 hover:text-red-600 rounded-full">
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 bg-slate-100 p-2 md:p-6 overflow-hidden flex items-center justify-center">
              {isPDF(viewDoc) ? (
                /* 🔥 NAYA UPDATE: Supabase PDFs standard HTML iframe me directly chalengi 🔥 */
                <iframe
                  src={viewDoc}
                  className="w-full h-full border-0 rounded-xl shadow-inner bg-white"
                  title="PDF Viewer"
                />
              ) : (
                <img
                  src={viewDoc}
                  alt="Document View"
                  className="max-w-full max-h-full object-contain rounded-xl shadow-2xl bg-white p-2"
                />
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}