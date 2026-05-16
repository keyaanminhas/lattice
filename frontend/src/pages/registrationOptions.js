export const SECTOR_OPTIONS = [
  'AI', 'SaaS', 'Healthtech', 'Fintech', 'EdTech', 'AgriTech',
  'CleanTech', 'Logistics', 'E-Commerce', 'Cybersecurity', 'IoT', 'Other',
];

export const STAGE_OPTIONS = ['Idea', 'MVP', 'Pre-seed', 'Seed', 'Growth'];

export const TEAM_SIZE_OPTIONS = ['1', '2-5', '6-10', '11-25', '26-50', '50+'];

export const SUPPORT_NEED_OPTIONS = [
  'Clinical pilot access', 'Investor readiness', 'Cloud infrastructure',
  'Regulatory guidance', 'Market access', 'Enterprise sales support',
  'Banking partnerships', 'Content partnerships', 'Go-to-market support',
  'Compliance support',
];

export const CHALLENGE_OPTIONS = [
  'Need pilot partner', 'Long sales cycles', 'Regulatory uncertainty',
  'Limited funding', 'Talent gaps', 'Product-market fit', 'Scaling infrastructure',
];

export const TRACTION_OPTIONS = [
  'No traction yet', 'Early conversations', 'Prototype tested',
  'Pilot customers', 'Revenue generating',
];

export const CONTRIBUTOR_TYPE_OPTIONS = [
  'Mentor', 'Strategic Partner', 'Investor / Funder', 'Professional Service Provider',
];

export const SECTOR_EXPERTISE_OPTIONS = [
  'AI', 'SaaS', 'Healthtech', 'Fintech', 'EdTech', 'AgriTech',
  'CleanTech', 'Logistics', 'E-Commerce', 'Cybersecurity', 'IoT',
  'Regulatory Strategy', 'Fundraising', 'Go-to-Market',
  'Clinical Trials', 'IP & Legal', 'Cloud & DevOps',
];

export const SUPPORT_AREA_OPTIONS = [
  'Mentoring', 'Workshops', 'Advisory', 'Technical Support',
  'Legal Services', 'Financial Advisory', 'Market Access', 'Strategic Partnerships',
];

export const SUPPORTED_STAGE_OPTIONS = ['Idea', 'MVP', 'Pre-seed', 'Seed', 'Growth'];

export const COUNTRY_OPTIONS = [
  'Malaysia', 'Singapore', 'Indonesia', 'Thailand',
  'Philippines', 'Vietnam', 'Global', 'Other',
];

export const ORG_TYPE_OPTIONS = [
  'Government Agency', 'Venture Builder', 'Corporate Accelerator',
  'University / Research', 'NGO / Foundation', 'Industry Association', 'Programme Owner',
];

export const FOCUS_SECTOR_OPTIONS = [
  'AI', 'SaaS', 'Healthtech', 'Fintech', 'EdTech', 'AgriTech',
  'CleanTech', 'Logistics', 'E-Commerce', 'Cybersecurity', 'IoT', 'Other',
];

export const CONTRIBUTOR_TYPE_MAP = {
  Mentor: 'Mentor',
  'Strategic Partner': 'Partner',
  'Investor / Funder': 'Investor',
  'Professional Service Provider': 'Service Provider',
};

export const STEP_LABELS = {
  startup: ['Account', 'Startup Basics', 'Product & Stage', 'Needs', 'Review'],
  contributor: ['Account', 'Contributor Info', 'Expertise & Coverage', 'Capacity', 'Review'],
  organisation: ['Account', 'Organisation', 'Ecosystem Scope', 'Review'],
};

export const initialRegistration = {
  accountType: 'startup',
  email: '',
  password: '',
  startupName: '',
  sector: '',
  stage: '',
  country: 'Malaysia',
  teamSize: '',
  supportNeeds: [],
  currentChallenges: [],
  problemStatement: '',
  productDescription: '',
  tractionLevel: '',
  tractionDetail: '',
  contributorName: '',
  contributorType: '',
  sectorExpertise: [],
  supportedStages: [],
  investmentThesis: '',
  ticketSize: '',
  countryCoverage: ['Malaysia'],
  supportAreas: [],
  availability: 'Available',
  globalMaxProgrammes: '1',
  globalMaxStartupAssignments: '3',
  perProgrammeStartupCapacity: '1',
  organisationName: '',
  organisationType: '',
  focusSectors: [],
};

export const demoAccounts = [
  { label: 'Ecosystem Admin', email: 'admin@lattice.demo', password: 'lattice-demo-admin' },
  { label: 'MediScan AI Startup', email: 'startup@lattice.demo', password: 'lattice-demo-startup' },
  { label: 'Dr. Sarah Lim Contributor', email: 'contributor@lattice.demo', password: 'lattice-demo-contributor' },
];
