// app/api/trials/refresh/route.ts
//
// This API route triggers the on-demand refresh of research trials via GitHub Actions.  It sends
// a repository_dispatch event to your GitHub repository, which causes the `Miami Trials uploader`
// workflow (defined in .github/workflows/miami-trials-uploader.yml) to run immediately.
//
// The route expects three environment variables to be set in your deployment:
//
//   GH_OWNER – the GitHub username or organization that owns the repository.
//   GH_REPO  – the name of your repository (e.g. "repo-x").
//   GH_PAT   – a fine-grained GitHub personal access token with `repo:actions` scope.  This
//              token must be kept secret; it is used to authenticate the request to GitHub.
//
// To use, add this file to your Next.js App Router project.  Then call the endpoint from your
// Lovable dashboard via fetch (see example button implementation in the docs).  A successful
// response indicates that GitHub has accepted the dispatch event; the workflow will handle
// uploading and ingesting trials into Supabase.

import { NextResponse } from 'next/server';

export async function POST() {
  const owner = process.env.GH_OWNER;
  const repo = process.env.GH_REPO;
  const token = process.env.GH_PAT;

  if (!owner || !repo || !token) {
    return NextResponse.json({ ok: false, error: 'Missing GH_OWNER, GH_REPO or GH_PAT env vars' }, { status: 500 });
  }

  // Compose the URL for the repository dispatch endpoint.  See
  // https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event.
  const url = `https://api.github.com/repos/${owner}/${repo}/dispatches`;

  // Define the payload.  `event_type` must match the type defined in the workflow (refresh-trials).
  // `client_payload` is optional; here you can pass parameters that override defaults in your
  // workflow or script.  Adjust facility/statuses as needed; they should align with your
  // facilities and statuses lists used when calling the Python script.
  const body = {
    event_type: 'refresh-trials',
    client_payload: {
      facility: 'University of Miami|UHealth|Sylvester|Bascom Palmer',
      statuses: ['RECRUITING','ENROLLING_BY_INVITATION','ACTIVE_NOT_RECRUITING']
    }
  };

  // Make the POST request to GitHub
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ ok: false, error: text }, { status: 500 });
  }

  // Return success JSON
  return NextResponse.json({ ok: true });
}
