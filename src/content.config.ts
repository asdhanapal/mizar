import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string(),
    description: z.string(),
    summary: z.string(),
    /** A direct, plain-language answer shown as "In short" (also read by search snippets and AI assistants). */
    answer: z.string().optional(),
    order: z.number(),
    features: z.array(z.object({ title: z.string(), text: z.string() })),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    related: z.object({ href: z.string(), label: z.string() }).optional(),
    /** Drafts are visible while developing but are left out of the production build. */
    draft: z.boolean().default(false),
  }),
});

export const collections = { services, blog };
