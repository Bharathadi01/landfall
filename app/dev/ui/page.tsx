import { notFound } from "next/navigation";

import { UiKitDemo } from "./demo";

/** Living style guide for the broadcast-desk design system. Development only. */
export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiKitDemo />;
}
