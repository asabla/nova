import { useTranslation } from "react-i18next";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger";
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirmVariant = "danger",
  isLoading,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-text-secondary mb-4">{description}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          variant={confirmVariant}
          size="sm"
          loading={isLoading}
          onClick={onConfirm}
        >
          {confirmLabel ?? t("common.confirm", { defaultValue: "Confirm" })}
        </Button>
      </div>
    </Dialog>
  );
}
