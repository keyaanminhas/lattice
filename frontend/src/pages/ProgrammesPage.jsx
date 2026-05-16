import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { Badge, StatusPill, Spinner } from '../components/Shared';

export default function ProgrammesPage() {
  const [programmes, setProgrammes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [filterStatus, setFilterStatus] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [programmeSnap, appSnap, poolSnap, relSnap] = await Promise.all([
        getDocs(collection(db, 'programmes')),
        getDocs(collection(db, 'applications')),
        getDocs(collection(db, 'programmeContributors')),
        getDocs(collection(db, 'relationships')),
      ]);

      const programmeList = [];
      programmeSnap.forEach((doc) => programmeList.push({ id: doc.id, ...doc.data() }));

      const aggregates = {};
      appSnap.forEach((doc) => {
        const item = doc.data();
        aggregates[item.programmeId] ||= { applications: 0, accepted: 0, pools: 0, mentorRelationships: 0 };
        aggregates[item.programmeId].applications += 1;
        if (item.status === 'Accepted') aggregates[item.programmeId].accepted += 1;
      });
      poolSnap.forEach((doc) => {
        const item = doc.data();
        aggregates[item.programmeId] ||= { applications: 0, accepted: 0, pools: 0, mentorRelationships: 0 };
        if (item.status === 'Approved') aggregates[item.programmeId].pools += 1;
      });
      relSnap.forEach((doc) => {
        const item = doc.data();
        aggregates[item.programmeId] ||= { applications: 0, accepted: 0, pools: 0, mentorRelationships: 0 };
        if (item.relationshipType === 'Startup-to-Mentor' && item.status !== 'Rejected') {
          aggregates[item.programmeId].mentorRelationships += 1;
        }
      });

      setProgrammes(programmeList);
      setStats(aggregates);
      setLoading(false);
    }

    load();
  }, []);

  if (loading) return <Spinner />;

  const filtered = programmes.filter((programme) => !filterStatus || programme.status === filterStatus);

  return (
    <div>
      <div className="hero-panel">
        <div className="hero-kicker">Programme Directory</div>
        <div className="hero-title-row">
          <div>
            <h2>Each startup journey is governed through a defined programme context.</h2>
            <p>
              Browse the operational environments where actor pools are approved, admissions are governed,
              and mentor relationships are activated only after programme fit is confirmed.
            </p>
          </div>
          <div className="hero-chip-grid">
            <div className="hero-chip">
              <strong>{programmes.length} programme contexts</strong>
              <span>Each one defines its own sector, stage, and outcome envelope.</span>
            </div>
            <div className="hero-chip">
              <strong>Programme pools are explicit</strong>
              <span>Partners, investors, and service providers remain inside approved resource pools.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="page-header">
        <h2>Programmes</h2>
        <p>{programmes.length} active programme contexts for applications, pools, and mentor relationships</p>
      </div>

      <div className="filter-bar">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Open">Open</option>
          <option value="Active">Active</option>
          <option value="Draft">Draft</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      <div className="card-grid">
        {filtered.map((programme) => {
          const programmeStats = stats[programme.id] || { applications: 0, accepted: 0, pools: 0, mentorRelationships: 0 };
          return (
            <div key={programme.id} className="entity-card" onClick={() => navigate(`/programmes/${programme.id}`)}>
              <div className="entity-card-top">
                <div>
                  <h4>{programme.name}</h4>
                  <div className="entity-meta">{programme.type} / {programme.country || programme.region}</div>
                </div>
                <StatusPill status={programme.status} />
              </div>
              <p className="entity-summary">
                Targets {programme.targetStages?.join(', ')} startups in {programme.targetSectors?.join(', ')}.
              </p>
              <div className="entity-tags entity-tag-row">
                {programme.expectedOutcomes?.slice(0, 3).map((item) => (
                  <Badge key={item} variant="blue">{item}</Badge>
                ))}
              </div>
              <div className="resource-grid">
                <div className="resource-card">
                  <h4>{programmeStats.applications}</h4>
                  <p>applications received</p>
                </div>
                <div className="resource-card">
                  <h4>{programmeStats.accepted}</h4>
                  <p>startups admitted</p>
                </div>
                <div className="resource-card">
                  <h4>{programmeStats.pools}</h4>
                  <p>pool contributors</p>
                </div>
                <div className="resource-card">
                  <h4>{programmeStats.mentorRelationships}</h4>
                  <p>mentor links activated</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state"><p>No programmes match your current filter.</p></div>
      )}
    </div>
  );
}
