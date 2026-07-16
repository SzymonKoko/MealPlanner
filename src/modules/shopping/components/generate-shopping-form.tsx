"use client";

import { FeedbackForm } from "@/components/shared/feedback-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateShoppingListAction } from "@/modules/shopping/actions/shopping-actions";

interface GenerateShoppingFormProps {
  defaultName: string;
  defaultDateFrom: string;
  defaultDateTo: string;
}

export function GenerateShoppingForm({
  defaultName,
  defaultDateFrom,
  defaultDateTo,
}: GenerateShoppingFormProps) {
  return (
    <FeedbackForm
      action={generateShoppingListAction}
      successMessage="Lista zakupów została wygenerowana"
      errorMessage="Nie udało się wygenerować listy zakupów"
      className="grid gap-3 sm:grid-cols-[1fr_10rem_10rem_auto]"
    >
      <Input name="name" defaultValue={defaultName} aria-label="Nazwa listy" required />
      <Input name="dateFrom" type="date" defaultValue={defaultDateFrom} aria-label="Data od" required />
      <Input name="dateTo" type="date" defaultValue={defaultDateTo} aria-label="Data do" required />
      <Button type="submit">Generuj z planera</Button>
    </FeedbackForm>
  );
}
