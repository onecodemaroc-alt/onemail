import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { ScrollText } from 'lucide-react';
import { db } from '../lib/firebase';
import { useI18n } from '../i18n/I18nContext';

export default function EmailLogs() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, 'emailLogs'), orderBy('timestamp', 'desc'), limit(200)));
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t('logsPage')}</h1>

      {logs.length === 0 ? (
        <div className="card text-center py-12">
          <ScrollText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">{t('noData')}</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700 bg-dark-800">
                  <th className="table-header">{t('recipient')}</th>
                  <th className="table-header">{t('status')}</th>
                  <th className="table-header">{t('smtpAccount')}</th>
                  <th className="table-header">{t('campaign')}</th>
                  <th className="table-header">{t('timestamp')}</th>
                  <th className="table-header">{t('errorMsg')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-dark-700 hover:bg-dark-700/50">
                    <td className="table-cell">{log.recipientEmail}</td>
                    <td className="table-cell">
                      <span className={`badge ${log.status === 'sent' ? 'badge-success' : log.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                        {t(log.status)}
                      </span>
                    </td>
                    <td className="table-cell text-xs">{log.smtpAccount || '-'}</td>
                    <td className="table-cell text-xs">{log.campaignId?.slice(0, 8) || '-'}</td>
                    <td className="table-cell text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="table-cell text-xs text-red-400 max-w-[200px] truncate">{log.error || '-'}</td>
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
