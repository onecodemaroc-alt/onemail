import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, getDocs, getDoc, query, where, doc } from 'firebase/firestore';
import { ArrowLeft, Send, Clock, BarChart3, Mail, CheckCircle, XCircle, Clock3, Eye, MousePointer, Users } from 'lucide-react';
import { db } from '../lib/firebase';
import { useI18n } from '../i18n/I18nContext';
import toast from 'react-hot-toast';

interface Campaign {
  id: string;
  name: string;
  status: string;
  listId: string;
  subject: string;
  ratePerMinute: number;
  scheduledAt: string;
  createdAt: string;
  stats?: { sent: number; failed: number; pending: number };
}

interface EmailLog {
  id: string;
  recipientEmail: string;
  status: string;
  smtpAccount: string;
  timestamp: string;
  error?: string;
  openedAt?: string;
  clickedAt?: string;
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactCount, setContactCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    const campaignId = id;
    async function load() {
      try {
        const campSnap = await getDoc(doc(db, 'campaigns', campaignId));
        if (!campSnap.exists()) return;
        const data = { id: campSnap.id, ...campSnap.data() } as Campaign;
        setCampaign(data);

        const logsSnap = await getDocs(query(collection(db, 'emailLogs'), where('campaignId', '==', campaignId)));
        const allLogs = logsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as EmailLog));
        allLogs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        setLogs(allLogs);

        if (data.listId) {
          const listSnap = await getDoc(doc(db, 'contactLists', data.listId));
          setContactCount(listSnap.exists() ? listSnap.data().count || 0 : 0);
        }
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!campaign) {
    return <div className="text-center py-12 text-gray-500">{t('notFound')}</div>;
  }

  const sent = logs.filter((l) => l.status === 'sent').length;
  const failed = logs.filter((l) => l.status === 'failed').length;
  const opened = logs.filter((l) => l.openedAt).length;
  const clicked = logs.filter((l) => l.clickedAt).length;
  const pending = Math.max(0, contactCount - sent - failed);
  const processed = sent + failed;
  const total = contactCount || logs.length;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  const rate = campaign.ratePerMinute || 10;
  const remaining = total - processed;
  const etaMinutes = rate > 0 ? Math.ceil(remaining / rate) : 0;

  const isSending = campaign.status === 'sending';

  const statusIcon = (s: string) => {
    switch (s) {
      case 'sent': return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
      case 'failed': return <XCircle className="w-3.5 h-3.5 text-red-400" />;
      default: return <Clock3 className="w-3.5 h-3.5 text-yellow-400" />;
    }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { sent: t('sent'), failed: t('failed'), pending: t('pending') };
    return map[s] || s;
  };

  return (
    <div className="space-y-6" dir="auto">
      <div className="flex items-center gap-4">
        <Link to="/campaigns" className="text-gray-400 hover:text-white p-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
        <span className={`badge ${isSending ? 'badge-info' : campaign.status === 'completed' ? 'badge-success' : campaign.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
          {t(campaign.status || 'draft')}
        </span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-brand-400" />
            <div>
              <p className="text-xs text-gray-500">{t('total')}</p>
              <p className="text-xl font-bold text-white">{total}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-xs text-gray-500">{t('sent')}</p>
              <p className="text-xl font-bold text-white">{sent}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-xs text-gray-500">{t('failed')}</p>
              <p className="text-xl font-bold text-white">{failed}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="text-xs text-gray-500">{t('pending')}</p>
              <p className="text-xl font-bold text-white">{pending}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-xs text-gray-500">{t('opened')}</p>
              <p className="text-xl font-bold text-white">{opened}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <MousePointer className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-xs text-gray-500">{t('clicked')}</p>
              <p className="text-xl font-bold text-white">{clicked}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-brand-400" /> {t('progress')}
        </h2>
        <div className="w-full bg-dark-700 rounded-full h-4 mb-2">
          <div className="bg-brand-500 h-4 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-sm text-gray-400">
          <span>{processed}/{total} ({pct}%)</span>
          {isSending && remaining > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {t('remainingTime')}: ~{etaMinutes} {t('minutes')}
            </span>
          )}
        </div>
        {isSending && (
          <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {t('sendingInProgress')} — {remaining} {t('remaining')}
          </p>
        )}
        {campaign.status === 'completed' && (
          <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> {t('completedAt')}: {campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString() : new Date(campaign.createdAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Campaign Info */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-3">{t('campaignDetails')}</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">{t('subject')}:</span> <span className="text-gray-200">{campaign.subject || '-'}</span></div>
          <div><span className="text-gray-500">{t('rate')}:</span> <span className="text-gray-200">{rate}/{t('minute')}</span></div>
          <div><span className="text-gray-500">{t('createdAt')}:</span> <span className="text-gray-200">{new Date(campaign.createdAt).toLocaleString()}</span></div>
          <div><span className="text-gray-500">{t('schedule')}:</span> <span className="text-gray-200">{campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString() : t('now')}</span></div>
        </div>
      </div>

      {/* Email Logs */}
      <div className="card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-brand-400" /> {t('emailLogs')} ({logs.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700 bg-dark-800">
                <th className="table-header">{t('recipient')}</th>
                <th className="table-header">{t('status')}</th>
                <th className="table-header">{t('opened')}</th>
                <th className="table-header">{t('clicked')}</th>
                <th className="table-header">{t('timestamp')}</th>
                <th className="table-header">{t('errorMsg')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-500">{t('noData')}</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="border-b border-dark-700 hover:bg-dark-700/50">
                  <td className="table-cell">{log.recipientEmail}</td>
                  <td className="table-cell">
                    <span className="flex items-center gap-1.5">
                      {statusIcon(log.status)}
                      <span className={`badge ${log.status === 'sent' ? 'badge-success' : log.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                        {statusLabel(log.status)}
                      </span>
                    </span>
                  </td>
                  <td className="table-cell">
                    {log.openedAt ? (
                      <span className="text-green-400 text-xs">{new Date(log.openedAt).toLocaleString()}</span>
                    ) : log.status === 'sent' ? (
                      <span className="text-gray-500 text-xs">{t('waiting')}</span>
                    ) : '-'}
                  </td>
                  <td className="table-cell">
                    {log.clickedAt ? (
                      <span className="text-purple-400 text-xs">{new Date(log.clickedAt).toLocaleString()}</span>
                    ) : log.status === 'sent' ? (
                      <span className="text-gray-500 text-xs">{t('waiting')}</span>
                    ) : '-'}
                  </td>
                  <td className="table-cell text-xs">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                  <td className="table-cell text-xs text-red-400 max-w-[200px] truncate">{log.error || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
