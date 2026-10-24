import { parseCustomFeeling, CUSTOM_FEELING_LIMIT } from "@/lib/feelings";
import { Button, fieldClass } from "@/components/ui";

export function CustomFeelingField({
  id,
  value,
  onChange,
  onClear,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  const parsed = value.trim() ? parseCustomFeeling(value) : { ok: true as const, value: null };
  const error = parsed.ok ? null : parsed.message;
  return (
    <div className="mt-4 max-w-md">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        Your feeling, in your words
      </label>
      <input
        id={id}
        value={value}
        maxLength={CUSTOM_FEELING_LIMIT}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldClass} mt-2`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : `${id}-hint`}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="mt-2 text-sm text-muted">
          Up to {CUSTOM_FEELING_LIMIT} characters. You can keep a preset label as well, edit this, or clear it.
        </p>
      )}
      <Button variant="quiet" className="mt-2 px-0" onClick={onClear}>
        Clear feeling
      </Button>
    </div>
  );
}
