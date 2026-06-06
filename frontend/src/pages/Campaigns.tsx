import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Plus, Send, Trash2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { useI18n } from '../i18n/I18nContext';
import toast from 'react-hot-toast';

interface Campaign {
  id: string;
  name: string;
  status: string;
  scheduledAt: string;
  createdAt: string;
  stats?: { sent: number; failed: number; pending: number };
}

export default function Campaigns() {
  const { t } = useI18n();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'campaigns'), orderBy('createdAt', 'desc')));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign));
      setCampaigns(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirm'))) return;
    try {
      await deleteDoc(doc(db, 'campaigns', id));
      toast.success(t('success'));
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      draft: 'badge-warning', sending: 'badge-info', completed: 'badge-success', failed: 'badge-danger',
    };
    return <span className={`badge ${map[s] || 'badge-warning'}`}>{t(s) || s}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t('campaigns')}</h1>
        <Link to="/campaigns/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> {t('createCampaign')}
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="card text-center py-12">
          <Send className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">{t('noCampaigns')}</p>
          <Link to="/campaigns/new" className="btn-primary mt-4 inline-block">{t('createFirstCampaign')}</Link>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700 bg-dark-800">
                  <th className="table-header">{t('campaignName')}</th>
                  <th className="table-header">{t('status')}</th>
                  <th className="table-header">Sent/Failed/Pending</th>
                  <th className="table-header">{t('schedule')}</th>
                  <th className="table-header">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-dark-700 hover:bg-dark-700/50">
                    <td className="table-cell font-medium text-gray-100">{c.name}</td>
                    <td className="table-cell">{statusBadge(c.status)}</td>
                    <td className="table-cell">
                      <div className="flex gap-2 text-xs">
                        <span className="text-green-400">{c.stats?.sent || 0}</span>
                        <span className="text-red-400">{c.stats?.failed || 0}</span>
                        <span className="text-yellow-400">{c.stats?.pending || 0}</span>
                      </div>
                    </td>
                    <td className="table-cell">{c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : t('now')}</td>
                    <td className="table-cell">
                      <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-300 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
