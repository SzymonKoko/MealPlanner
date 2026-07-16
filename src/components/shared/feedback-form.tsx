"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";

type ServerAction = (formData: FormData) => void | Promise<void | unknown>;

type FeedbackFormProps = Omit<ComponentProps<"form">, "action"> & {
  action: ServerAction;
  successMessage: string;
  errorMessage?: string;
  children: ReactNode;
};

function isNextRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

function errorText(error: unknown, fallback: string) {
  if (error instanceof Error && error.message && !isNextRedirect(error)) {
    return error.message;
  }
  return fallback;
}

export function FeedbackForm({
  action,
  successMessage,
  errorMessage = "Nie udało się zapisać. Spróbuj ponownie.",
  children,
  ...props
}: FeedbackFormProps) {
  const router = useRouter();

  return (
    <form
      {...props}
      action={async (formData) => {
        try {
          await action(formData);
          toast.success(successMessage);
          router.refresh();
        } catch (error) {
          if (isNextRedirect(error)) throw error;
          toast.error(errorText(error, errorMessage));
        }
      }}
    >
      {children}
    </form>
  );
}
