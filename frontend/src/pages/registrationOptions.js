import countries from 'world-countries';

export const SECTOR_OPTIONS = [
  'AI',
  'SaaS',
  'Healthtech',
  'Fintech',
  'EdTech',
  'AgriTech',
  'CleanTech',
  'Logistics',
  'E-Commerce',
  'Cybersecurity',
  'IoT',
  'Other',
];

export const STAGE_OPTIONS = ['Idea', 'MVP', 'Pre-seed', 'Seed', 'Growth'];

export const TEAM_SIZE_OPTIONS = ['1', '2–5', '6–10', '11–25', '26–50', '50+', 'Prefer not to say'];

export const TEAM_SIZE_RANGE_META = {
  '1': { min: 1, max: 1, known: true, compatibility: 1 },
  '2–5': { min: 2, max: 5, known: true, compatibility: 2 },
  '6–10': { min: 6, max: 10, known: true, compatibility: 6 },
  '11–25': { min: 11, max: 25, known: true, compatibility: 11 },
  '26–50': { min: 26, max: 50, known: true, compatibility: 26 },
  '50+': { min: 50, max: null, known: true, compatibility: 50 },
  'Prefer not to say': { min: null, max: null, known: false, compatibility: 1 },
};

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
  'Mentor / Advisor',
  'Investor / Funder',
  'Corporate Partner',
  'Technology / Infrastructure Provider',
  'Professional Service Provider',
  'Government / Public Agency',
  'Academic / Research Institution',
  'Community / Network Partner',
  'Programme Delivery Partner',
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

export const COUNTRY_OPTIONS = countries
  .map((item) => item?.name?.common)
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b));

export const COUNTRY_COVERAGE_OPTIONS = [...COUNTRY_OPTIONS, 'Global / Remote'];

export const ORG_TYPE_OPTIONS = [
  'Government Agency', 'Venture Builder', 'Corporate Accelerator',
  'University / Research', 'NGO / Foundation', 'Industry Association', 'Programme Owner', 'Other',
];

export const FOCUS_SECTOR_OPTIONS = [
  'AI', 'SaaS', 'Healthtech', 'Fintech', 'EdTech', 'AgriTech',
  'CleanTech', 'Logistics', 'E-Commerce', 'Cybersecurity', 'IoT', 'Other',
];

export const CONTRIBUTOR_TYPE_MAP = {
  'Mentor / Advisor': 'Mentor',
  'Investor / Funder': 'Investor',
  'Technology / Infrastructure Provider': 'Service Provider',
  'Professional Service Provider': 'Service Provider',
  'Corporate Partner': 'Partner',
  'Government / Public Agency': 'Partner',
  'Academic / Research Institution': 'Partner',
  'Community / Network Partner': 'Partner',
  'Programme Delivery Partner': 'Partner',
};

export const STEP_LABELS = {
  startup: ['Account', 'Startup Basics', 'Product & Stage', 'Needs', 'Review'],
  contributor: ['Account', 'Contributor Info', 'Expertise & Coverage', 'Review'],
  organisation: ['Account', 'Organisation', 'Ecosystem Scope', 'Review'],
};

export const initialRegistration = {
  accountType: 'startup',
  email: '',
  password: '',
  startupName: '',
  sector: '',
  customSector: '',
  stage: '',
  country: '',
  teamSizeRange: '',
  teamSize: '',
  teamSizeMin: null,
  teamSizeMax: null,
  teamSizeKnown: false,
  supportNeeds: [],
  customSupportNeeds: [],
  supportNeedsCustomInput: '',
  currentChallenges: [],
  customChallenges: [],
  challengesCustomInput: '',
  problemStatement: '',
  productDescription: '',
  tractionLevel: '',
  tractionDetail: '',
  contributorName: '',
  contributorType: '',
  primaryContributorType: '',
  sectorExpertise: [],
  customExpertise: [],
  expertiseCustomInput: '',
  supportedStages: [],
  investmentThesis: '',
  ticketSize: '',
  countryCoverage: [],
  supportAreas: [],
  customSupportAreas: [],
  supportAreasCustomInput: '',
  organisationName: '',
  organisationType: '',
  customOrganisationType: '',
  focusSectors: [],
  customFocusSectors: [],
  focusSectorsCustomInput: '',
  mainSupportAreas: [],
  customMainSupportAreas: [],
  mainSupportAreasCustomInput: '',
};

export const demoAccounts = [
  { label: 'Ecosystem Admin', email: 'admin@lattice.demo', password: 'lattice-demo-admin' },
  { label: 'MediScan AI Startup', email: 'startup@lattice.demo', password: 'lattice-demo-startup' },
  { label: 'Dr. Sarah Lim Contributor', email: 'contributor@lattice.demo', password: 'lattice-demo-contributor' },
];
