// Who runs ExamEdge AI, shown on the public pages. Razorpay and the privacy rules need real values here.
export const BUSINESS = {
  name: 'ExamEdge AI',
  legalName: 'Khushpal Singh Chouhan (trading as ExamEdge AI)',
  address: 'Parikshit Bldg, B404, Premium Park Road, Premium Park, Virar, Vasai-Virar, Maharashtra 401303, India',
  phone: '+91 8302639041',
  email: 'support@examedgeai.in',
  grievanceOfficer: 'Khushpal Singh Chouhan',
  grievanceEmail: 'support@examedgeai.in',
};

// Public address of the marketing site (robots.txt, sitemap, canonical links).
export const siteUrl = () => process.env.SITE_URL ?? `https://${process.env.ROOT_HOST ?? 'localhost'}`;
