import { Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  note: string;
  emergency: boolean;
  pending: boolean;
  feedback: { message: string; error: boolean } | null;
  onFlag: () => void;
};

export function ParkingReportNote({ note, emergency, pending, feedback, onFlag }: Props) {
  return (
    <div className="mt-3 border-t border-gray-200 pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-gray-500">User Reported</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 px-2 text-xs text-gray-500"
          aria-label="Flag this user-reported note as inappropriate or false"
          disabled={pending}
          onClick={onFlag}
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
          Flag
        </Button>
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{note}</p>
      {emergency && (
        <p className="mt-2 text-xs font-medium text-gray-600">
          Unverified user information. For emergencies, contact 911 or campus police.
        </p>
      )}
      {feedback && (
        <p role={feedback.error ? "alert" : "status"} className={`mt-2 text-xs ${feedback.error ? "text-red-700" : "text-gray-600"}`}>
          {feedback.message}
        </p>
      )}
    </div>
  );
}
