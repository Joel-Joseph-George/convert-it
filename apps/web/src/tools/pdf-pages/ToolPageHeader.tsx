import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { EngineBadge } from "@/components/shared/EngineBadge";
import { PrivacyLine } from "@/components/shared/PrivacyLine";

/** Breadcrumb, title and privacy line shared by the custom PDF tool pages. */
export function ToolPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}): React.ReactElement {
  return (
    <>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          to="/tools"
          search={{ q: "", category: "pdf" }}
          className="flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Tools</span>
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">PDF</span>
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <EngineBadge engine="browser" />
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        <PrivacyLine engine="browser" />
      </div>
    </>
  );
}

export function ErrorBanner({
  message,
}: {
  message: string;
}): React.ReactElement {
  return (
    <div
      role="alert"
      className="rounded-card border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </div>
  );
}
