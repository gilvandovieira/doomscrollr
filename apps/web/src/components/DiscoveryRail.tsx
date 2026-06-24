import { useQuery } from "@tanstack/react-query";
import { fetchTags } from "../app/api.ts";
import { TagLink } from "./TagLink.tsx";

// Desktop right rail: discovery. Shown only on wide screens (>=1280px) so the
// single-column feed isn't stranded in whitespace. Holds popular tags now and
// leaves room for Communities and more.
export function DiscoveryRail() {
  const tagsQuery = useQuery({
    queryKey: ["tags"],
    queryFn: fetchTags,
    staleTime: 120_000,
  });
  const tags = tagsQuery.data?.slice(0, 10) ?? [];

  return (
    <aside className="discovery-rail">
      {tags.length > 0 && (
        <div className="rail-section">
          <p className="rail-eyebrow">Popular</p>
          <div className="rail-tags">
            {tags.map((tag) => <TagLink key={tag.slug} slug={tag.slug} />)}
          </div>
        </div>
      )}

      <div className="rail-section">
        <p className="rail-eyebrow">Communities</p>
        <p className="rail-note">Coming soon — group up around what you post.</p>
      </div>
    </aside>
  );
}
