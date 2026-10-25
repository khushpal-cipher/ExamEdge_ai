// Who runs ExamEdge AI, shown on the public pages. Razorpay and the privacy rules need real values here.
// TODO(founder): fill in before go-live (LAUNCH_PLAN step 11); the pages show them as written.
export const BUSINESS = {
  name: 'ExamEdge AI',
  legalName: '[business name]',
  address: '[registered address]',
  phone: '[phone number]',
  email: 'support@examedgeai.in',
  grievanceOfficer: '[grievance officer name]',
  grievanceEmail: 'support@examedgeai.in',
};

// Public address of the marketing site (robots.txt, sitemap, canonical links).
export const siteUrl = () => process.env.SITE_URL ?? `https://${process.env.ROOT_HOST ?? 'localhost'}`;
