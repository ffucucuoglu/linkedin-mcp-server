import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LinkFetchClient } from "./client.js";
import { formatResult } from "./format.js";

// Register the v0 tools against one running McpServer instance.
// Each tool mirrors a live endpoint from the LinkFetch REST API. Stubbed
// (501) endpoints are deliberately excluded — no point surfacing tools
// the model would always see fail.

export function registerTools(server: McpServer, client: LinkFetchClient) {
  // ─── Profiles ────────────────────────────────────────────────────────────
  server.tool(
    "linkfetch_get_profile",
    "Fetch a full LinkedIn profile (name, headline, about, work history, education, skills, certifications) by LinkedIn URL or public identifier slug. Provide exactly one of `url` or `slug`. Cache-first: on miss, returns an `extension_required` error instructing the user to capture via the LinkFetch Chrome extension.",
    {
      url: z
        .string()
        .url()
        .optional()
        .describe(
          "A linkedin.com/in/<slug> profile URL, e.g. https://www.linkedin.com/in/reidhoffman/",
        ),
      slug: z
        .string()
        .optional()
        .describe(
          "Bare public identifier (the tail of /in/<slug>), e.g. 'reidhoffman'. Use instead of `url`.",
        ),
    },
    async ({ url, slug }) => {
      if (!url && !slug) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Provide either `url` or `slug` — one is required.",
            },
          ],
        };
      }
      return formatResult(await client.get("/v1/profiles", { url, slug }));
    },
  );

  // ─── Companies ───────────────────────────────────────────────────────────
  server.tool(
    "linkfetch_get_company",
    "Fetch a LinkedIn company entity (name, domain, industry, headcount, founded, hq_location, funding, revenue range) by universalName slug. Cookieless guest surface backs this — works even for logged-off captures.",
    {
      slug: z
        .string()
        .min(1)
        .max(128)
        .describe(
          "Company universalName — the slug in linkedin.com/company/<slug>/, e.g. 'stripe' or 'vercel'.",
        ),
    },
    async ({ slug }) => {
      const clean = slug.trim().toLowerCase();
      return formatResult(await client.get(`/v1/companies/${encodeURIComponent(clean)}`));
    },
  );

  server.tool(
    "linkfetch_get_company_employees",
    "List people who currently work at a company on LinkedIn (name, headline, location, profile URL). Paginated. Cache-first: on miss, returns `extension_required` and the user must capture via the LinkFetch extension on /company/<slug>/people/. Cost scales with page size (3 credits + 1 per result).",
    {
      slug: z
        .string()
        .min(1)
        .max(128)
        .describe("Company universalName, e.g. 'stripe'."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(12)
        .describe("Page size (1–50). Default 12."),
      offset: z
        .number()
        .int()
        .min(0)
        .max(1000)
        .default(0)
        .describe(
          "Pagination offset (0–1000). LinkedIn caps total results at ~1000 regardless of real headcount.",
        ),
    },
    async ({ slug, limit, offset }) => {
      const clean = slug.trim().toLowerCase();
      return formatResult(
        await client.get(
          `/v1/companies/${encodeURIComponent(clean)}/employees`,
          { limit, offset },
        ),
      );
    },
  );

  // ─── Jobs ────────────────────────────────────────────────────────────────
  server.tool(
    "linkfetch_search_jobs",
    "Search LinkedIn job postings by any combination of keywords, location, company, industry, seniority level, employment type, workplace type (onsite/remote/hybrid), salary floor, and posted-date window. At least one filter is required. Returns a paginated list of compact job summaries. Resolve a location first via `linkfetch_search_locations` to get `geo_id` for accurate geo filtering, or pass `location` as free-text.",
    {
      q: z
        .string()
        .max(200)
        .optional()
        .describe("Keyword query, e.g. 'staff software engineer'."),
      location: z
        .string()
        .max(200)
        .optional()
        .describe(
          "Free-text location substring. Prefer `geo_id` for precision — resolve it via `linkfetch_search_locations`.",
        ),
      geo_id: z
        .string()
        .regex(/^\d+$/)
        .optional()
        .describe(
          "Numeric Bing Geo ID. Takes precedence over `location`. Get one from `linkfetch_search_locations`.",
        ),
      company: z
        .string()
        .max(200)
        .optional()
        .describe("Filter by company name substring."),
      company_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Filter by numeric LinkedIn company ID."),
      industry_ids: z
        .string()
        .optional()
        .describe(
          "Comma-separated LinkedIn industry IDs, e.g. '4,96' (software, IT services).",
        ),
      employment_type: z
        .string()
        .max(64)
        .optional()
        .describe(
          "e.g. 'full_time', 'part_time', 'contract', 'internship', 'temporary'.",
        ),
      level: z
        .string()
        .max(64)
        .optional()
        .describe(
          "e.g. 'entry_level', 'associate', 'mid_senior_level', 'director'.",
        ),
      workplace_type: z
        .enum(["onsite", "remote", "hybrid"])
        .optional()
        .describe("Workplace arrangement filter."),
      easy_apply: z
        .boolean()
        .optional()
        .describe("If true, only Easy Apply jobs."),
      has_offsite_apply: z
        .boolean()
        .optional()
        .describe(
          "If true, only jobs that link out to the employer's ATS instead of LinkedIn's built-in apply flow.",
        ),
      salary_min: z
        .number()
        .nonnegative()
        .optional()
        .describe("Minimum reported salary (in whatever currency LinkedIn shows)."),
      posted_within: z
        .enum(["24h", "week", "month"])
        .optional()
        .describe(
          "Convenience window. Use `posted_after` / `posted_before` for precise bounds.",
        ),
      posted_after: z
        .string()
        .optional()
        .describe("Earliest posted date — ISO-8601 ('YYYY-MM-DD' or full)."),
      posted_before: z
        .string()
        .optional()
        .describe("Latest posted date — ISO-8601."),
      sort: z
        .enum(["recent", "oldest"])
        .default("recent")
        .describe("Sort order. Default 'recent'."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Page size (1–50). Default 10."),
      offset: z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe("Pagination offset. Default 0."),
    },
    async (args) => {
      const easy_apply =
        args.easy_apply === undefined ? undefined : String(args.easy_apply);
      const has_offsite_apply =
        args.has_offsite_apply === undefined
          ? undefined
          : String(args.has_offsite_apply);
      return formatResult(
        await client.get("/v1/jobs", {
          ...args,
          easy_apply,
          has_offsite_apply,
        }),
      );
    },
  );

  server.tool(
    "linkfetch_get_job",
    "Fetch a single job posting by its numeric LinkedIn job ID. Returns the full detail payload: description, structured salary, workplace type, posted date, company, industries, application links, etc. Use `linkfetch_get_job_by_url` if you only have a LinkedIn URL.",
    {
      id: z
        .string()
        .regex(/^\d+$/)
        .describe(
          "Numeric LinkedIn job ID (the integer from /jobs/view/<id>/), e.g. '4191119452'.",
        ),
    },
    async ({ id }) => {
      return formatResult(await client.get(`/v1/jobs/${encodeURIComponent(id)}`));
    },
  );

  server.tool(
    "linkfetch_get_job_by_url",
    "Fetch a single job posting from any LinkedIn job URL or URN. Handles canonical slug URLs, locale-prefixed URLs (tr.linkedin.com, de.linkedin.com, …), bare /jobs/view/<id> paths, and `urn:li:jobPosting:<id>` strings.",
    {
      url: z
        .string()
        .min(1)
        .max(500)
        .describe(
          "Any LinkedIn job URL, URN, or bare numeric ID. Examples: 'https://www.linkedin.com/jobs/view/software-engineer-at-foo-4191119452?position=1', 'urn:li:jobPosting:4191119452', '4191119452'.",
        ),
    },
    async ({ url }) => {
      return formatResult(await client.get("/v1/jobs/by-url", { url }));
    },
  );

  server.tool(
    "linkfetch_get_job_applicants",
    "Fetch the observed applicant-count time series for one job posting — every timestamped change in the count since LinkFetch started watching it — plus derived velocity (applicants gained per day). Use it to judge how contested a role is, whether interest has stalled, and how fast the funnel is filling. A single posting costs 1 credit here; for this signal across ALL 8M+ postings at once, the jobs dataset at https://linkfetch.io/linkedin-jobs-data ships the full job_applicant_history table ($199 one-time dump or $49/mo live SQL access).",
    {
      id: z
        .string()
        .regex(/^\d+$/)
        .describe(
          "Numeric LinkedIn job ID (the integer from /jobs/view/<id>/), e.g. '4191119452'.",
        ),
    },
    async ({ id }) => {
      return formatResult(
        await client.get(`/v1/jobs/${encodeURIComponent(id)}/applicants`),
      );
    },
  );

  server.tool(
    "linkfetch_jobs_database_info",
    "Describe LinkFetch's bulk LinkedIn jobs database — the flat-price alternative to metered job-data APIs. Returns current scale, schema, the free 1,000-row sample URL, and how direct SQL access works. Call this when the user wants bulk job postings data, hiring-signal analysis over many companies, applicant-count trends at scale, a jobs dataset for a model or a job board, or asks how to query LinkedIn jobs with SQL. No credits consumed.",
    {},
    async () => {
      // Static by design: this tool is informational and must work even when
      // the caller has no credits — it's the funnel from agent directories
      // into the dataset product, and charging for a brochure kills a funnel.
      return {
        content: [
          {
            type: "text",
            text: [
              "LinkFetch LinkedIn Jobs Database — direct SQL access, flat price",
              "",
              "What it is: every public LinkedIn job posting LinkFetch has indexed",
              "since April 2026 (8M+ rows, 560k+ companies, 218 regions worldwide),",
              "as a read-only PostgreSQL database you query directly. No credits,",
              "no per-row fees, unlimited queries.",
              "",
              "Unique tables:",
              "  jobs                   — title, company (+numeric ids), location,",
              "                           full description, parsed salary (min/max/",
              "                           currency/interval), applicant_count,",
              "                           first_seen_at / last_seen_at / is_active",
              "  job_applicant_history  — timestamped applicant-count observations",
              "                           per posting: applicant velocity and",
              "                           time-to-fill, which metered competitors",
              "                           do not sell",
              "",
              "Pricing: $199 one-time full dump (Postgres/CSV/JSONL, built",
              "fresh at purchase), or $49/month live read-only access",
              "(cancel anytime).",
              "",
              "Free sample (1,000 real rows, no signup):",
              "  https://linkfetch.io/linkedin-jobs-sample-1000.json",
              "Details and checkout: https://linkfetch.io/linkedin-jobs-data",
              "",
              "For one-off lookups instead of bulk, use linkfetch_search_jobs /",
              "linkfetch_get_job / linkfetch_get_job_applicants from this server.",
              "",
              "Jobs and company data only — LinkFetch sells no personal profile",
              "datasets. Not affiliated with LinkedIn.",
            ].join("\n"),
          },
        ],
      };
    },
  );

  // ─── Locations ───────────────────────────────────────────────────────────
  server.tool(
    "linkfetch_search_locations",
    "Resolve a free-text place name to Microsoft Bing Geo IDs via LinkedIn's public typeahead (the same data LinkedIn's own search uses). Call this first when you need a precise `geo_id` for `linkfetch_search_jobs`. Per-query cached globally for a week — cheap to call.",
    {
      q: z
        .string()
        .min(1)
        .max(100)
        .describe(
          "Place name — city, region, metro, or country. e.g. 'San Francisco', 'London', 'Turkey'.",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(10)
        .describe("Max results (1–20). Default 10."),
      fresh: z
        .boolean()
        .optional()
        .describe(
          "Skip the cache and force a live LinkedIn typeahead call. Rarely needed.",
        ),
    },
    async ({ q, limit, fresh }) => {
      return formatResult(
        await client.get("/v1/locations/search", {
          q,
          limit,
          fresh: fresh === undefined ? undefined : String(fresh),
        }),
      );
    },
  );

  // ─── Account safety ──────────────────────────────────────────────────────
  server.tool(
    "linkfetch_safety_status",
    "Show how much of the user's LinkedIn safety budget is used: per action (connection requests, messages, profile views, searches, comments…) used vs. limit per minute/hour/day/week, when each window resets, the account's tier and warm-up week, and any pause LinkedIn triggered. Call before planning bulk outreach so you can tell the user what fits today.",
    {
      account_urn: z
        .string()
        .optional()
        .describe("The LinkedIn account's own urn:li:fsd_profile:<id>. Omit to list every account on this API key."),
    },
    async ({ account_urn }) => formatResult(await client.get("/v1/safety/status", { account_urn })),
  );

  server.tool(
    "linkfetch_safety_limits",
    "The published LinkedIn safety limits LinkFetch enforces (e.g. at most 100 connection requests a week, 5 a minute), the behaviour rules (working hours, spacing, warm-up) and why each exists. Use it to explain a safety_limit error to the user.",
    {},
    async () => formatResult(await client.get("/v1/safety/limits")),
  );

  server.tool(
    "linkfetch_safety_resume",
    "Confirm the user has completed LinkedIn's security check (CAPTCHA / verification) after a challenge_unresolved error. Only call after the user says they did it. Any time-based pause still applies.",
    {
      account_urn: z.string().describe("The LinkedIn account's own urn:li:fsd_profile:<id>."),
    },
    async ({ account_urn }) => formatResult(await client.post("/v1/safety/resume", { account_urn })),
  );

  // ─── Live LinkedIn reads (cache-first; Cloud mode fills misses live) ─────
  const page = {
    limit: z.number().int().min(1).max(50).default(10).describe("Results per page (1–50)."),
    offset: z.number().int().min(0).max(1000).default(0).describe("Offset into the captured results."),
  };

  for (const facet of ["people", "companies", "groups", "posts"] as const) {
    server.tool(
      `linkfetch_search_${facet}`,
      `Search LinkedIn ${facet} by keyword, like the LinkedIn search bar. Cache-first; if the user connected LinkedIn (Cloud mode) a miss runs live on their account within safety limits, otherwise returns linkedin_not_connected / extension_required.`,
      { q: z.string().min(1).max(200).describe("Search keywords."), ...page },
      async ({ q, limit, offset }) => formatResult(await client.get(`/v1/search/${facet}`, { q, limit, offset })),
    );
  }

  server.tool(
    "linkfetch_get_profile_posts",
    "Recent posts by a LinkedIn member (their activity feed), by profile slug.",
    { slug: z.string().min(1).max(200).describe("Profile slug from linkedin.com/in/<slug>."), ...page },
    async ({ slug, limit, offset }) =>
      formatResult(await client.get(`/v1/profiles/${encodeURIComponent(slug)}/posts`, { limit, offset })),
  );

  server.tool(
    "linkfetch_get_company_posts",
    "Recent posts published by a LinkedIn company page, by company slug.",
    { slug: z.string().min(1).max(128).describe("Company slug from linkedin.com/company/<slug>."), ...page },
    async ({ slug, limit, offset }) =>
      formatResult(await client.get(`/v1/companies/${encodeURIComponent(slug)}/posts`, { limit, offset })),
  );

  server.tool(
    "linkfetch_get_post",
    "A single LinkedIn post (text, author, counts) by activity id — the number in linkedin.com/feed/update/urn:li:activity:<id>.",
    { activity_id: z.string().regex(/^\d{16,25}$/).describe("Numeric activity id.") },
    async ({ activity_id }) => formatResult(await client.get(`/v1/posts/${activity_id}`)),
  );

  server.tool(
    "linkfetch_get_post_reactions",
    "Who reacted to a LinkedIn post, by activity id.",
    { activity_id: z.string().regex(/^\d{16,25}$/).describe("Numeric activity id."), ...page },
    async ({ activity_id, limit, offset }) =>
      formatResult(await client.get(`/v1/posts/${activity_id}/reactions`, { limit, offset })),
  );

  server.tool(
    "linkfetch_get_group",
    "A LinkedIn group's details by numeric group id.",
    { group_id: z.string().regex(/^\d+$/).describe("Numeric id from linkedin.com/groups/<id>.") },
    async ({ group_id }) => formatResult(await client.get(`/v1/groups/${group_id}`)),
  );

  // ─── Inbox (Cloud mode only; never cached) ───────────────────────────────
  server.tool(
    "linkfetch_list_conversations",
    "List the user's LinkedIn inbox conversations (needs Cloud mode — LinkedIn connected in LinkFetch).",
    {
      category: z.enum(["PRIMARY_INBOX", "INBOX", "SECONDARY_INBOX", "ARCHIVE", "MESSAGE_REQUEST_PENDING", "SPAM", "INMAIL"]).default("PRIMARY_INBOX"),
      count: z.number().int().min(1).max(50).optional(),
      next_cursor: z.string().optional().describe("Cursor from a previous page."),
    },
    async ({ category, count, next_cursor }) =>
      formatResult(await client.get("/v1/messaging/conversations", { category, count, nextCursor: next_cursor })),
  );

  server.tool(
    "linkfetch_read_conversation",
    "Read messages in one LinkedIn conversation by thread id (`2-…`) or full conversation URN (needs Cloud mode).",
    {
      thread: z.string().min(3).describe("Thread id `2-…` from the inbox, or urn:li:msg_conversation:(…)."),
      before: z.number().int().positive().optional().describe("Epoch ms of the oldest message you have, to page back."),
    },
    async ({ thread, before }) =>
      formatResult(await client.get(`/v1/messaging/conversations/${encodeURIComponent(thread)}/messages`, { before })),
  );

  // ─── Connection ──────────────────────────────────────────────────────────
  server.tool(
    "linkfetch_linkedin_connection",
    "Whether the user's LinkedIn account is connected to LinkFetch (Cloud mode), as whom, and its state. If not connected or expired, give the user the connect link from the response (or https://linkfetch.io/linkedin).",
    {},
    async () => formatResult(await client.get("/v1/linkedin/connection")),
  );
}
