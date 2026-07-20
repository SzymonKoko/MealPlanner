"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyInviteLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      const absoluteLink = new URL(link, window.location.origin).toString();
      await navigator.clipboard.writeText(absoluteLink);
      setCopied(true);
      toast.success("Link zaproszenia skopiowany");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nie udało się skopiować linku");
    }
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? "Skopiowano" : "Kopiuj link"}
    </Button>
  );
}
