// Netlify Function. Runs automatically when the site is deployed on Netlify.
declare const process: { env: Record<string, string | undefined> };
import { handleContact } from '../../src/server/contact';

export default (request: Request) => handleContact(request, process.env);

export const config = { path: '/api/contact' };
