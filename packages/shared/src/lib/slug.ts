// Generate a readable slug for post URLs, e.g. "When prod breaks on Friday"
// becomes "when-prod-breaks-on-friday" (spec §6.1).
export function slugify(input: string, maxLength = 80): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");

  return slug.length > 0 ? slug : "post";
}
