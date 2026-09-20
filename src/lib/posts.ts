import { getCollection } from 'astro:content';

/** Published posts, newest first. Drafts appear only in `npm run dev`. */
export async function getPosts() {
  const posts = await getCollection('blog', ({ data }) => (import.meta.env.PROD ? !data.draft : true));
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}
