import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { ScoreBadge, StatusPill, Spinner } from '../components/Shared';

export default function CompanyDashboard({ user }) {
  const [applications, setApplications] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [programmeNames, setProgrammeNames] = useState({});
  const [contributorNames, setContributorNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function load() {
      const [programmeSnap, contributorSnap, appSnap, recSnap, relSnap] = await Promise.all([
        getDocs(query(collection(db, 'programmes'), where('status', 'in', ['Open', 'Active']))),
        getDocs(collection(db, 'contributors')),
        getDocs(query(collection(db, 'applications'), where('startupId', '==', user.id))),
        getDocs(query(collection(db, 'recommendations'), where('sourceEntityId', '==', user.id))),
        getDocs(query(collection(db, 'relationships'), where('sourceEntityId', '==', user.id))),
      ]);

      const programmeMap = {};
      programmeSnap.forEach((item) => { programmeMap[item.id] = item.data().name; });
      const contributorMap = {};
      contributorSnap.forEach((item) => { contributorMap[item.id] = item.data().name; });
      setProgrammeNames(programmeMap);
      setContributorNames(contributorMap);

      const appList = [];
      appSnap.forEach((item) => appList.push({ id: item.id, ...item.data() }));
      const recList = [];
      recSnap.forEach((item) => recList.push({ id: item.id, ...item.data() }));
      const relList = [];
      relSnap.forEach((item) => relList.push({ id: item.id, ...item.data() }));

      setApplications(appList);
      setRecommendations(recList);
      setRelationships(relList);
      setLoading(false);
    }

    load();
  }, [user.id]);

  async function generateProgrammeRecommendations() {
    setGenerating(true);
    try {
      const recommend = httpsCallable(functions, 'recommend_programmes_for_startup');
      await recommend({ startupId: user.id });
      const recSnap = await getDocs(query(collection(db, 'recommendations'), where('sourceEntityId', '==', user.id)));
      const recList = [];
      recSnap.forEach((item) => recList.push({ id: item.id, ...item.data() }));
      setRecommendations(recList);
    } catch (error) {
      console.error('Programme recommendation failed:', error);
      alert('Failed to generate programme recommendations for this startup.');
    }
    setGenerating(false);
  }

  if (loading) return <Spinner />;

  const mentorRecommendations = recommendations.filter((item) => item.recommendationType === 'Startup-to-Mentor');
  const mentorRelationships = relationships.filter((item) => item.relationshipType === 'Startup-to-Mentor');

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Welcome, {user.name}</h2>
          <p>Your programme applications, accepted cohorts, and mentor assignments.</p>
        </div>
        <button className="btn btn-primary" onClick={generateProgrammeRecommendations} disabled={generating}>
          {generating ? 'Generating...' : 'Find Programmes'}
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Programme Applications</div>
          <div className="stat-value">{applications.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Accepted Programmes</div>
          <div className="stat-value">{applications.filter((item) => item.status === 'Accepted').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Mentor Recommendations</div>
          <div className="stat-value">{mentorRecommendations.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Mentor Links</div>
          <div className="stat-value">{mentorRelationships.filter((item) => item.status === 'Active').length}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3>My Programmes</h3>
        </div>
        {applications.length === 0 ? (
          <div className="empty-state"><p>No programme applications yet.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Programme</th>
                <th>AI Fit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{programmeNames[item.programmeId] || item.programmeId}</td>
                  <td><ScoreBadge score={item.aiFitScore} /></td>
                  <td><StatusPill status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Mentor Path</h3>
        </div>
        {(mentorRecommendations.length === 0 && mentorRelationships.length === 0) ? (
          <div className="empty-state"><p>No mentor recommendations yet.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Mentor</th>
                <th>Programme</th>
                <th>Score / Status</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {mentorRecommendations.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{contributorNames[item.targetEntityId] || item.targetEntityId}</td>
                  <td>{programmeNames[item.programmeId] || item.programmeId}</td>
                  <td><ScoreBadge score={item.matchScore} /></td>
                  <td className="match-explanation">{item.explanation}</td>
                </tr>
              ))}
              {mentorRelationships.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{contributorNames[item.targetEntityId] || item.targetEntityId}</td>
                  <td>{programmeNames[item.programmeId] || item.programmeId}</td>
                  <td><StatusPill status={item.status} /></td>
                  <td className="match-explanation">{item.expectedOutcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
