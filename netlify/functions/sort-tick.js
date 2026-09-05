// netlify/functions/sort-tick.js
//
// Netlify won't let a scheduled function be opened in a browser, so the
// work lives in sort-submissions.js and this just pokes it every 8 hours.
// That keeps /api/sort-submissions testable by hand, and if you ever want a
// track live sooner, opening that URL runs it straight away.

export default async () => {
  const site = process.env.URL || "https://hypersync.live";

  const res = await fetch(`${site}/api/sort-submissions`);
  const body = await res.text();

  console.log("sort-submissions:", res.status, body);

  return new Response(null, { status: 204 });
};

export const config = { schedule: "0 */8 * * *" };
