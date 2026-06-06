import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import {
  Users,
  Send,
  Mail,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { db } from '../lib/firebase';
import { useI18n } from '../i18n/I18nContext';

const COLORS = ['#6366f1', '#22c55e', '#eab308', '#ef4444', '#3b82f6'];

export default function Dashboard() {
  const { t } = useI18n();
  const [stats, setStats] = useState({ contacts: 0, campaigns: 0, sent: 0, failed: 0, pending: 0 });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [contactsSnap, campaignsSnap, logsSnap, todaySnap] = await Promise.all([
          getDocs(collection(db, 'contacts')),
          getDocs(collection(db, 'campaigns')),
          getDocs(query(collection(db, 'emailLogs'), orderBy('timestamp', 'desc'), limit(100))),
          getDocs(query(
            collection(db, 'emailLogs'),
            where('timestamp', '>=', new Date(Date.now() - 86400000).toISOString())
          )),
        ]);

        const logs = logsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const todayLogs = todaySnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        setStats({
          contacts: contactsSnap.size,
          campaigns: campaignsSnap.size,
          sent: logs.filter((l: any) => l.status === 'sent').length,
          failed: logs.filter((l: any) => l.status === 'failed').length,
          pending: logs.filter((l: any) => l.status === 'pending').length,
        });

        setRecentLogs(logs.slice(0, 10));

        const dayMap: Record<string, number> = {};
        todayLogs.forEach((l: any) => {
          const day = l.timestamp?.slice(0, 10) || 'unknown';
          dayMap[day] = (dayMap[day] || 0) + 1;
        });
        setDailyData(Object.entries(dayMap).map(([date, count]) => ({ date, count })));
      } catch (err) {
        console.error('Dashboard load error:', err);
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

  const cards = [
    { label: t('totalContacts'), value: stats.contacts, icon: Users, color: 'text-blue-400', bg: 'bg-blue-900/20' },
    { label: t('campaignsSent'), value: stats.campaigns, icon: Send, color: 'text-purple-400', bg: 'bg-purple-900/20' },
    { label: t('emailsToday'), value: stats.sent, icon: Mail, color: 'text-green-400', bg: 'bg-green-900/20' },
    { label: t('successRate'), value: stats.sent + stats.failed > 0 ? `${Math.round((stats.sent / (stats.sent + stats.failed)) * 100)}%` : '0%', icon: TrendingUp, color: 'text-brand-400', bg: 'bg-brand-900/20' },
  ];

  const pieData = [
    { name: t('sent'), value: stats.sent, color: '#22c55e' },
    { name: t('failed'), value: stats.failed, color: '#ef4444' },
    { name: t('pending'), value: stats.pending, color: '#eab308' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t('dashboard')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card flex items-center gap-4">
            <div className={`p-3 rounded-xl ${card.bg}`}>
              <card.icon className={`w-6 h-6 ${card.color}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-2xl font-bold text-white">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="card-header">{t('emailsToday')}</h3>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-8">{t('noData')}</p>
          )}
        </div>

        <div className="card">
          <h3 className="card-header">{t('successRate')}</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-8">{t('noData')}</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="card-header">{t('logsPage')}</h3>
        {recentLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="table-header">{t('recipient')}</th>
                  <th className="table-header">{t('status')}</th>
                  <th className="table-header">{t('timestamp')}</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log: any) => (
                  <tr key={log.id} className="border-b border-dark-700 hover:bg-dark-700/50">
                    <td className="table-cell">{log.recipientEmail}</td>
                    <td className="table-cell">
                      <span className={`badge ${log.status === 'sent' ? 'badge-success' : log.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                        {t(log.status)}
                      </span>
                    </td>
                    <td className="table-cell">{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">{t('noData')}</p>
        )}
      </div>
    </div>
  );
}
