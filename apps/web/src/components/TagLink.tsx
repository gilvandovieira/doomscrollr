import { Link } from "@tanstack/react-router";

export function TagLink({ slug, className = "tag-chip" }: { slug: string; className?: string }) {
  return (
    <Link to="/tags/$tagSlug" params={{ tagSlug: slug }} className={className}>
      #{slug}
    </Link>
  );
}
