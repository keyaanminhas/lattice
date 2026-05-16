import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { ScoreBadge, StatusPill, Spinner } from '../components/Shared';

export default function ContributorDashboard({ user }) {
  const [poolAssignments, setPoolAssignments] = useState([]);
  const [mentorLinks, setMentorLinks] = useState([]);
  const [programmeNames, setProgrammeNames] = useState({});
  const [startupNames, setStartupNames] = useState({});
  const [recommendationScores, setRecommendationScores] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [programmeSnap, startupSnap, poolSnap, relSnap, recSnap] = await Promise.all([
        getDocs(query(collection(db, 'programmes'), where('status', 'in', ['Open', 'Active']))),
        getDocs(collection(db, 'companies')),
        getDocs(query(collection(db, 'programmeContributors'), where('contributorId', '==', user.id))),
        getDocs(query(collection(db, 'relationships'), where('targetEntityId', '==', user.id))),
        getDocs(query(collection(db, 'recommendations'), where('targetEntityId', '==', user.id))),
      ]);

      const programmeMap = {};
      programmeSnap.forEach((item) => { programmeMap[item.id] = item.data().name; });
      const startupMap = {};
      startupSnap.forEach((item) => { startupMap[item.id] = item.data().name; });
      const scoreMap = {};
      recSnap.forEach((item) => {
        const data = item.data();
        if (data.recommendationType === 'Startup-to-Mentor') {
          scoreMap[`${data.sourceEntityId}_${data.programmeId}`] = data.matchScore;
        }
      });

      const pools = [];
      poolSnap.forEach((item) => pools.push({ id: item.id, ...item.data() }));
      const links = [];
      relSnap.forEach((item) => {
        const data = item.data();
        if (data.relationshipType === 'Startup-to-Mentor') links.push({ id: item.id, ...data });
      });

      setProgrammeNames(programmeMap);
      setStartupNames(startupMap);
      setRecommendationScores(scoreMap);
      setPoolAssignments(pools);
      setMentorLinks(links);
      setLoading(false);
    }
    load();
  }, [user.id]);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="page-header">
        <h2>Welcome, {user.name}</h2>
        <p>Your approved programme pools and startup mentorship assignments.</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Programme Pools</div>
          <div className="stat-value">{poolAssignments.filter((item) => item.status === 'Approved').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Startup Mentor Links</div>
          <div className="stat-value">{mentorLinks.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Links</div>
          <div className="stat-value">{mentorLinks.filter((item) => item.status === 'Active').length}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3>Programme Assignments</h3>
        </div>
        {poolAssignments.length === 0 ? (
          <div className="empty-state"><p>No programme assignments yet.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Programme</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {poolAssignments.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{programmeNames[item.programmeId] || item.programmeId}</td>
                  <td>{item.contributorType}</td>
                  <td><StatusPill status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Startup Mentorship Relationships</h3>
        </div>
        {mentorLinks.length === 0 ? (
          <div className="empty-state"><p>No startup mentorship assignments yet.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Startup</th>
                <th>Programme</th>
                <th>Recommendation Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {mentorLinks.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{startupNames[item.sourceEntityId] || item.sourceEntityId}</td>
                  <td>{programmeNames[item.programmeId] || item.programmeId}</td>
                  <td>
                    {recommendationScores[`${item.sourceEntityId}_${item.programmeId}`]
                      ? <ScoreBadge score={recommendationScores[`${item.sourceEntityId}_${item.programmeId}`]} />
                      : 'Approved'}
                  </td>
                  <td><StatusPill status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
