// netlify/functions/sort-tick.js
//
// Netlify won't let a scheduled function be opened in a browser, so the
// work lives in sort-submissions.js and this just pokes it every 5 minutes.
// That keeps /api/sort-submissions testable by hand.

export default async () => {
  const site = process.env.URL || "https://hypersync.live";

  const res = await fetch(`${site}/api/sort-submissions`);
  const body = await res.text();

  console.log("sort-submissions:", res.status, body);

  return new Response(null, { status: 204 });
};

export const config = { schedule: "*/5 * * * *" };
