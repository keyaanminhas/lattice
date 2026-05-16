/**
 * Registration Service — Creates Firestore profiles for new users
 * and triggers AI analysis (embeddings + profile summary).
 * 
 * Called after a new user completes the onboarding form.
 * The Firebase Auth UID is stored in the document for lookup.
 */
import { collection, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';

/**
 * Register a new startup/company.
 * Creates the Firestore document, then triggers AI embedding + profile summary.
 * 
 * @param {string} authUid - Firebase Auth UID
 * @param {object} profile - { name, sector, stage, country, teamSize, problemStatement, productDescription, supportNeeds, currentChallenges, traction }
 * @returns {object} - { id, role, name, aiProfile }
 */
export async function registerCompany(authUid, profile) {
  const companyData = {
    authUid,
    name: profile.name,
    sector: profile.sector || '',
    industry: profile.sector || '',
    stage: profile.stage || 'Idea',
    country: profile.country || '',
    teamSize: profile.teamSize || 1,
    problemStatement: profile.problemStatement || '',
    productDescription: profile.productDescription || '',
    supportNeeds: profile.supportNeeds || [],
    currentChallenges: profile.currentChallenges || [],
    traction: profile.traction || '',
    verificationStatus: 'Pending',
    createdAt: serverTimestamp(),
  };

  // Create the Firestore document
  const docRef = await addDoc(collection(db, 'companies'), companyData);
  const companyId = docRef.id;

  // Trigger AI analysis in the background
  let aiProfile = null;
  try {
    // 1. Generate embedding vector for semantic matching
    const summarise = httpsCallable(functions, 'summarise_startup_profile');
    const result = await summarise({ startupId: companyId });
    aiProfile = result.data.profile;
  } catch (e) {
    console.warn('AI analysis failed (non-blocking):', e.message);
  }

  // Create platform user mapping
  await setDoc(doc(db, 'platformUsers', authUid), {
    role: 'company',
    entityType: 'company',
    entityId: companyId,
    name: profile.name,
    email: profile.email || '',
    createdAt: serverTimestamp(),
  });

  return {
    id: companyId,
    role: 'company',
    name: profile.name,
    aiProfile,
  };
}

/**
 * Register a new contributor (mentor, partner, investor, service provider).
 * Creates the Firestore document, then triggers AI embedding.
 * 
 * @param {string} authUid - Firebase Auth UID
 * @param {object} profile - { name, contributorTypes, expertise, supportedStages, countryCoverage, availability, capacity, investmentThesis, ticketSize, canSupport }
 * @returns {object} - { id, role, name }
 */
export async function registerContributor(authUid, profile) {
  const contributorData = {
    authUid,
    name: profile.name,
    contributorTypes: profile.contributorTypes || ['Mentor'],
    expertise: profile.expertise || [],
    supportedStages: profile.supportedStages || [],
    countryCoverage: profile.countryCoverage || [],
    canSupport: profile.canSupport || [],
    availability: profile.availability || 'Available',
    status: 'Pending',
    capacity: {
      globalMaxProgrammes: profile.maxProgrammes || 5,
      globalMaxStartupAssignments: profile.maxStartups || 10,
      perProgrammeStartupCapacity: profile.perProgrammeCapacity || 3,
    },
    // Investor-specific
    investmentThesis: profile.investmentThesis || [],
    ticketSize: profile.ticketSize || '',
    rating: 0,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'contributors'), contributorData);
  const contributorId = docRef.id;

  // Trigger AI to generate embedding vector
  try {
    const suggestProgrammes = httpsCallable(functions, 'recommend_contributor_to_programmes');
    // This will auto-generate the embedding as a side effect
    await suggestProgrammes({ contributorId });
  } catch (e) {
    console.warn('AI contributor analysis failed (non-blocking):', e.message);
  }

  // Create platform user mapping
  await setDoc(doc(db, 'platformUsers', authUid), {
    role: 'contributor',
    entityType: 'contributor',
    entityId: contributorId,
    name: profile.name,
    email: profile.email || '',
    createdAt: serverTimestamp(),
  });

  return {
    id: contributorId,
    role: 'contributor',
    name: profile.name,
  };
}

/**
 * Register a platform admin user.
 * Only called by existing admins (invite flow).
 * 
 * @param {string} authUid - Firebase Auth UID
 * @param {object} profile - { name, email, role }
 */
export async function registerAdmin(authUid, profile) {
  await setDoc(doc(db, 'platformUsers', authUid), {
    role: profile.role || 'admin',
    entityType: null,
    entityId: null,
    name: profile.name,
    email: profile.email,
    createdAt: serverTimestamp(),
  });

  return {
    id: authUid,
    role: profile.role || 'admin',
    name: profile.name,
  };
}
