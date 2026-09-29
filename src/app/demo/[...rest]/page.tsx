import { notFound } from "next/navigation";

/** Any other address under /demo gets the demo's own not-found page, which links back into the demo. */
export default function DemoCatchAll() {
  notFound();
}
