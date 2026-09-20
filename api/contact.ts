// Vercel Function. Runs automatically when the site is deployed on Vercel.
declare const process: { env: Record<string, string | undefined> };
import { handleContact } from '../src/server/contact';

export function POST(request: Request) {
  return handleContact(request, process.env);
}
