"use client";

import { useState } from "react";
import { FeedbackForm } from "@/components/shared/feedback-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateShoppingListAction } from "@/modules/shopping/actions/shopping-actions";
import { keepDateRangeOrdered } from "@/modules/shopping/lib/date-range";

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
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);

  function handleDateFromChange(nextDateFrom: string) {
    setDateFrom(nextDateFrom);
    setDateTo((current) => keepDateRangeOrdered(nextDateFrom, current));
  }

  return (
    <FeedbackForm
      action={generateShoppingListAction}
      successMessage="Lista zakupów została wygenerowana"
      errorMessage="Nie udało się wygenerować listy zakupów"
      className="grid gap-3 sm:grid-cols-[1fr_10rem_10rem_auto]"
    >
      <Input name="name" defaultValue={defaultName} aria-label="Nazwa listy" required />
      <Input
        name="dateFrom"
        type="date"
        value={dateFrom}
        onChange={(event) => handleDateFromChange(event.target.value)}
        aria-label="Data od"
        required
      />
      <Input
        name="dateTo"
        type="date"
        value={dateTo}
        min={dateFrom || undefined}
        onChange={(event) => setDateTo(event.target.value)}
        aria-label="Data do"
        required
      />
      <Button type="submit">Generuj z planera</Button>
    </FeedbackForm>
  );
}
