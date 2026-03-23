import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const API_BASE = "/api/v1";

interface Beneficiary {
  id: string;
  enrollee_number: string;
  full_name: string;
  current_facility_id: string;
}

interface Facility {
  id: string;
  facility_code: string;
  facility_name: string;
}

export default function FacilityChangeForm() {
  const [beneficiarySearch, setBeneficiarySearch] = useState("");
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [targetFacility, setTargetFacility] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch facilities on mount
  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const res = await fetch(`${API_BASE}/facilities`);
        if (res.ok) {
          const data = await res.json();
          setFacilities(data);
        }
      } catch (err) {
        console.error("Failed to fetch facilities:", err);
      }
    };
    fetchFacilities();
  }, []);

  // Search beneficiaries as user types
  const handleBeneficiarySearch = async (value: string) => {
    setBeneficiarySearch(value);
    if (value.length < 2) {
      setBeneficiaries([]);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/beneficiaries?search=${encodeURIComponent(value)}`);
      if (res.ok) {
        const data = await res.json();
        setBeneficiaries(data.slice(0, 10));
      }
    } catch (err) {
      console.error("Failed to search beneficiaries:", err);
    }
  };

  const selectBeneficiary = (beneficiary: Beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setBeneficiarySearch(beneficiary.enrollee_number);
    setBeneficiaries([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!selectedBeneficiary || !targetFacility || !reason.trim()) {
      setMessage({ type: "error", text: "Please fill all required fields" });
      return;
    }

    if (selectedBeneficiary.current_facility_id === targetFacility) {
      setMessage({ type: "error", text: "Target facility must be different from current facility" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/cof/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiary_id: selectedBeneficiary.enrollee_number,
          from_facility_id: selectedBeneficiary.current_facility_id,
          to_facility_id: targetFacility,
          reason: reason.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage({
          type: "success",
          text: `CoF request #${data.id.substring(0, 8)} submitted successfully for PRS review`,
        });
        // Reset form
        setSelectedBeneficiary(null);
        setBeneficiarySearch("");
        setTargetFacility("");
        setReason("");
      } else {
        const error = await res.json();
        setMessage({ type: "error", text: error.detail || "Failed to submit CoF request" });
      }
    } catch (err) {
      setMessage({ type: "error", text: `Error: ${err instanceof Error ? err.message : "Unknown error"}` });
    } finally {
      setLoading(false);
    }
  };

  const currentFacility = facilities.find(
    (f) => f.id === selectedBeneficiary?.current_facility_id
  );
  const targetFacilityObj = facilities.find((f) => f.id === targetFacility);

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border-t-4 border-green-700">
      <h2 className="text-xl font-bold mb-1 text-slate-800">Change of Facility Request</h2>
      <p className="text-sm text-gray-600 mb-6">Submit a request to transfer beneficiary to a new facility</p>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Beneficiary Search */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">Beneficiary</label>
          <Input
            type="text"
            placeholder="Search by ID or name..."
            value={beneficiarySearch}
            onChange={(e) => handleBeneficiarySearch(e.target.value)}
            className="mb-1"
          />
          {beneficiaries.length > 0 && (
            <div className="absolute top-12 left-0 right-0 bg-white border rounded shadow-lg z-10">
              {beneficiaries.map((ben) => (
                <button
                  key={ben.id}
                  type="button"
                  onClick={() => selectBeneficiary(ben)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b"
                >
                  <span className="font-medium">{ben.enrollee_number}</span> - {ben.full_name}
                </button>
              ))}
            </div>
          )}
          {selectedBeneficiary && <p className="text-xs text-green-600">✓ {selectedBeneficiary.full_name}</p>}
        </div>

        {/* Current Facility (Display Only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Current Facility</label>
          <div className="p-3 bg-gray-50 border rounded text-gray-700">
            {currentFacility ? (
              <>
                <div className="font-medium">{currentFacility.facility_name}</div>
                <div className="text-sm text-gray-600">{currentFacility.facility_code}</div>
              </>
            ) : (
              <span className="text-gray-400">Select beneficiary first...</span>
            )}
          </div>
        </div>

        {/* Target Facility Dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Target Facility</label>
          <Select value={targetFacility} onValueChange={setTargetFacility}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select new facility..." />
            </SelectTrigger>
            <SelectContent>
              {facilities
                .filter((f) => f.id !== selectedBeneficiary?.current_facility_id)
                .map((facility) => (
                  <SelectItem key={facility.id} value={facility.id}>
                    {facility.facility_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {targetFacilityObj && (
            <p className="text-xs text-green-600 mt-1">✓ {targetFacilityObj.facility_code}</p>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Transfer</label>
          <Textarea
            placeholder="Explain the reason for this facility change..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-24"
          />
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={loading || !selectedBeneficiary || !targetFacility}
          className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-2 rounded"
        >
          {loading ? "Submitting..." : "Submit for PRS Review"}
        </Button>
      </form>
    </div>
  );
}
