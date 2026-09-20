export const site = {
  name: 'Skandava',
  url: 'https://www.skandava.com',
  tagline: 'Software engineering and digital marketing that grows your business.',
  description:
    'Skandava is an engineering-led team building custom software, AWS cloud systems, WhatsApp messaging platforms and SEO-driven marketing for growing businesses.',
  email: 'hariprasad@skandava.com',
  phone: '',
  /** WhatsApp business number with country code, digits only, e.g. '919876543210'. Empty hides the chat button. */
  whatsapp: '',
  /** Analytics: fill ONE of these to switch it on. Empty = no analytics. Update /privacy/ automatically. */
  analytics: { ga4: '', plausibleDomain: '' },
  /** Public profiles (LinkedIn, YouTube, Instagram, Google Business Profile, Clutch...). Added to the structured data. */
  social: [] as string[],
  /** Search engine ownership tags. Paste the token only if you verify by HTML tag. Verifying by DNS (Search Console "Domain" property) needs none. */
  verification: { google: '', bing: '' },
  /** Where the business is based. Only the city and region go in the structured data: no street address or postcode is published. */
  location: { neighbourhood: 'Ashok Nagar', locality: 'Chennai', region: 'Tamil Nadu', country: 'IN' },
  /** Places you serve. Empty = left out of the structured data. */
  areaServed: ['Ashok Nagar, Chennai', 'Chennai', 'Tamil Nadu'] as string[],
  locale: 'en_IN',
  nav: [
    { label: 'Services', href: '/services/' },
    { label: 'CORE', href: '/core/' },
    { label: 'About', href: '/about/' },
    { label: 'Blog', href: '/blog/' },
    { label: 'Contact', href: '/contact/' },
  ],
};
