"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const API_BASE = "/api/v1";

interface CofRequest {
  id: string;
  beneficiary_id: string;
  from_facility_id: string;
  to_facility_id: string;
  reason: string;
  request_status: "Submitted" | "Under Review" | "Approved" | "Rejected";
  requested_on: string;
  approved_by: string | null;
  approved_on: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  Submitted: "bg-blue-100 text-blue-800",
  "Under Review": "bg-yellow-100 text-yellow-800",
  Approved: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
};

export default function CofRequestList() {
  const [requests, setRequests] = useState<CofRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "Submitted" | "Approved" | "Rejected">("Submitted");
  const [selectedRequest, setSelectedRequest] = useState<CofRequest | null>(null);
  const [approvalNote, setApprovalNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  // Fetch CoF requests
  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filter !== "all") {
          params.append("status", filter);
        }
        const res = await fetch(`${API_BASE}/cof/?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setRequests(data);
        }
      } catch (err) {
        console.error("Failed to fetch CoF requests:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, [filter]);

  const handleApprove = async (request: CofRequest) => {
    setProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/cof/${request.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved_by: approvalNote || "PRS Unit",
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setRequests((prev) => prev.map((r) => (r.id === request.id ? updated : r)));
        setSelectedRequest(null);
        setApprovalNote("");
      }
    } catch (err) {
      console.error("Failed to approve CoF:", err);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (request: CofRequest) => {
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/cof/${request.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved_by: "PRS Unit",
          rejection_reason: rejectionReason.trim(),
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setRequests((prev) => prev.map((r) => (r.id === request.id ? updated : r)));
        setSelectedRequest(null);
        setRejectionReason("");
      }
    } catch (err) {
      console.error("Failed to reject CoF:", err);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-600">Loading CoF requests...</div>;
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4 text-slate-800">Change of Facility Requests</h2>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 border-b pb-4">
        {(["Submitted", "all", "Approved", "Rejected"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status as any)}
            className={`px-4 py-2 font-medium text-sm rounded ${
              filter === status
                ? "bg-green-700 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {status === "all" ? "All" : status}
          </button>
        ))}
      </div>

      {/* Request List */}
      <div className="space-y-3">
        {requests.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No CoF requests found</p>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => setSelectedRequest(request)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono font-bold text-sm">{request.beneficiary_id}</span>
                  <Badge className={statusColors[request.request_status]}>
                    {request.request_status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-700 mb-1">{request.reason}</p>
                <p className="text-xs text-gray-500">
                  {request.from_facility_id} → {request.to_facility_id}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Requested: {new Date(request.requested_on).toLocaleDateString()}
                </p>
              </div>
              <Button variant="outline" size="sm">
                View Details
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">CoF Request Details</h3>

            <div className="space-y-3 mb-6 text-sm">
              <div>
                <span className="font-medium">Beneficiary:</span> {selectedRequest.beneficiary_id}
              </div>
              <div>
                <span className="font-medium">From Facility:</span> {selectedRequest.from_facility_id}
              </div>
              <div>
                <span className="font-medium">To Facility:</span> {selectedRequest.to_facility_id}
              </div>
              <div>
                <span className="font-medium">Reason:</span>
                <p className="mt-1 p-2 bg-gray-50 rounded text-gray-700">{selectedRequest.reason}</p>
              </div>
              <div>
                <Badge className={statusColors[selectedRequest.request_status]}>
                  {selectedRequest.request_status}
                </Badge>
              </div>
            </div>

            {/* Action Forms */}
            {selectedRequest.request_status === "Submitted" && (
              <div className="space-y-4">
                {/* Approve Section */}
                <div className="border-b pb-4">
                  <label className="text-sm font-medium block mb-2">Approved By (optional)</label>
                  <Input
                    type="text"
                    placeholder="Your name/initials"
                    value={approvalNote}
                    onChange={(e) => setApprovalNote(e.target.value)}
                    className="mb-2"
                  />
                  <Button
                    onClick={() => handleApprove(selectedRequest)}
                    disabled={processing}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {processing ? "Processing..." : "Approve"}
                  </Button>
                </div>

                {/* Reject Section */}
                <div>
                  <label className="text-sm font-medium block mb-2">Rejection Reason</label>
                  <Textarea
                    placeholder="Why is this transfer being rejected?"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="mb-2 min-h-20"
                  />
                  <Button
                    onClick={() => handleReject(selectedRequest)}
                    disabled={processing || !rejectionReason.trim()}
                    variant="destructive"
                    className="w-full"
                  >
                    {processing ? "Processing..." : "Reject"}
                  </Button>
                </div>
              </div>
            )}

            {selectedRequest.request_status === "Approved" && (
              <div className="p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
                ✓ Approved by {selectedRequest.approved_by} on{" "}
                {selectedRequest.approved_on &&
                  new Date(selectedRequest.approved_on).toLocaleDateString()}
              </div>
            )}

            {selectedRequest.request_status === "Rejected" && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                ✗ Rejection Reason: {selectedRequest.rejection_reason}
              </div>
            )}

            <Button
              onClick={() => setSelectedRequest(null)}
              variant="outline"
              className="w-full mt-4"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
