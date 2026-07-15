# TASK-026

## Title

SEO & Metadata Completion

---

## Sprint

Sprint 06

---

## Objective

Audit and complete the site's SEO metadata against the documented production requirement: descriptive titles, meta descriptions, Open Graph metadata, favicon, sitemap, and robots.txt.

---

## Rationale

`docs/17-production-deployment.md` ("SEO") requires public pages to include descriptive page titles, meta descriptions, Open Graph metadata, favicon, sitemap, and robots.txt, so "search engines should understand the product correctly." `apps/web/src/app/robots.ts` and `sitemap.ts` already exist and cover the two current routes (`/` and `/prediction-studio`). `apps/web/src/app/layout.tsx` sets a root `title`/`description`/`openGraph` block, but the Open Graph metadata has no image, and `/prediction-studio` has no page-specific metadata override (it currently inherits the root title/description verbatim).

---

## Implementation Requirements

- Add page-specific `metadata` (title and description) to `apps/web/src/app/prediction-studio/page.tsx`, distinct from the root landing page metadata, describing the Prediction Studio experience specifically.
- Add an Open Graph image to the root metadata in `layout.tsx` (and to the Prediction Studio page metadata if applicable), using an existing or newly-added static asset under `apps/web/public`.
- Verify a favicon is present and correctly referenced (Next.js App Router convention: `apps/web/src/app/favicon.ico` or `public/favicon.ico`); add one if missing.
- Confirm `robots.ts` and `sitemap.ts` remain accurate — no changes needed unless new routes were added by prior sprints.

---

## Acceptance Criteria

- [ ] `/prediction-studio` has its own descriptive `<title>` and meta description, distinct from the landing page.
- [ ] Root and Prediction Studio pages both resolve a valid Open Graph image.
- [ ] A favicon resolves correctly in a production build.
- [ ] `robots.ts` and `sitemap.ts` accurately reflect every public route in the application.
- [ ] `pnpm build` succeeds and the generated `sitemap.xml`/`robots.txt` are correct.

---

## Dependencies

None

---

## Status

TODO

---

## Notes

Do not add tracking scripts, analytics, or third-party SEO tooling — `docs/17-production-deployment.md`'s SEO section is limited to the items listed above, and CLAUDE.md prohibits adding dependencies without justification.
