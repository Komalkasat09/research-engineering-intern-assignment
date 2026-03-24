/**
 * Client helper for /api/live/inject
 *
 * Usage:
 *   const injected = await injectPosts('ukraine', 10);
 *   console.log(injected.posts); // InjectedPost[]
 */

import type { LiveInjectResponse, InjectedPost } from '@/types';

export interface InjectOptions {
  signal?: AbortSignal;
}

/**
 * Fetch and classify Reddit posts into narrative clusters.
 *
 * @param query - Reddit search query
 * @param limit - Maximum posts to fetch (default 25, max 100)
 * @param options - Fetch options (AbortSignal, etc)
 * @returns Posts with cluster assignments
 */
export async function injectPosts(
  query: string,
  limit: number = 25,
  options?: InjectOptions
): Promise<LiveInjectResponse> {
  const response = await fetch('/api/live/inject', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, limit }),
    signal: options?.signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(
      error.error || `Inject failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<LiveInjectResponse>;
}

/**
 * Stream posts as they arrive (for UI that wants to show results progressively).
 *
 * @param query - Reddit search query
 * @param limit - Maximum posts to fetch
 * @param onPost - Callback fired for each injected post
 * @param options - Fetch options
 */
export async function injectPostsStream(
  query: string,
  limit: number,
  onPost: (post: InjectedPost, index: number) => void,
  options?: InjectOptions
): Promise<void> {
  const result = await injectPosts(query, limit, options);

  for (let i = 0; i < result.posts.length; i++) {
    onPost(result.posts[i]!, i);
    // Small delay to simulate streaming
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
