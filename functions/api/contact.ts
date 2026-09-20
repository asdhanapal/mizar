// Cloudflare Pages Function. Runs automatically when the site is deployed on Cloudflare Pages.
import { handleContact, type MailEnv } from '../../src/server/contact';

export const onRequest = (ctx: { request: Request; env: MailEnv }) => handleContact(ctx.request, ctx.env);
