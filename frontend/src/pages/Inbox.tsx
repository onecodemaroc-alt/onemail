import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, doc, updateDoc, where } from 'firebase/firestore';
import { Inbox as InboxIcon, Mail, ChevronLeft, AlertTriangle } from 'lucide-react';
import { db } from '../lib/firebase';
import { useI18n } from '../i18n/I18nContext';

interface Email {
  id: string;
  smtpAccount: string;
  smtpAccountId: string;
  from: string;
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  date: string;
  read: boolean;
  folder: string;
  spam: boolean;
  fetchedAt: string;
}

export default function Inbox() {
  const { t } = useI18n();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Email | null>(null);
  const [tab, setTab] = useState<'all' | 'inbox' | 'spam'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const constraints: any[] = [orderBy('date', 'desc')];
      if (tab === 'inbox') constraints.unshift(where('spam', '==', false));
      else if (tab === 'spam') constraints.unshift(where('spam', '==', true));
      const snap = await getDocs(query(collection(db, 'inbox'), ...constraints, limit(100)));
      setEmails(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Email)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab]);

  const openEmail = async (email: Email) => {
    setSelected(email);
    if (!email.read) {
      await updateDoc(doc(db, 'inbox', email.id), { read: true }).catch(() => {});
      email.read = true;
      setEmails((prev) => prev.map((e) => e.id === email.id ? { ...e, read: true } : e));
    }
  };

  const tabs = [
    { key: 'all' as const, label: t('all') },
    { key: 'inbox' as const, label: t('inbox') },
    { key: 'spam' as const, label: t('spam') },
  ];

  const spamCount = emails.filter(e => e.spam).length;

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
        <h1 className="text-2xl font-bold text-white">{t('inbox')}</h1>
        <span className="text-sm text-gray-500">{emails.length} {t('emails')} ({spamCount} spam)</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-dark-700 pb-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelected(null); }}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${tab === t.key ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {emails.length === 0 ? (
        <div className="card text-center py-12">
          <InboxIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">{t('noEmails')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Email list */}
          <div className="card overflow-hidden p-0 lg:col-span-1 max-h-[70vh] overflow-y-auto">
            {emails.map((email) => (
              <div
                key={email.id}
                className={`p-4 border-b border-dark-700 cursor-pointer hover:bg-dark-700/50 transition-colors ${!email.read ? 'bg-dark-700/30' : ''} ${selected?.id === email.id ? 'bg-dark-600/50' : ''} ${email.spam ? 'border-l-2 border-l-red-500/50' : ''}`}
                onClick={() => openEmail(email)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {email.spam && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                      <p className={`text-sm truncate ${!email.read ? 'font-semibold text-white' : 'text-gray-300'}`}>
                        {email.from}
                      </p>
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${!email.read ? 'font-medium text-gray-200' : 'text-gray-400'}`}>
                      {email.subject || '(no subject)'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-600">{email.smtpAccount}</span>
                      {email.spam && <span className="badge badge-danger text-[10px] px-1 py-0">spam</span>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(email.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Email detail */}
          <div className="card lg:col-span-2 min-h-[400px]">
            {selected ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setSelected(null)} className="lg:hidden btn-secondary p-1">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex gap-2">
                    {selected.spam && <span className="badge badge-danger">{t('spam')}</span>}
                    <span className="badge badge-info">{selected.smtpAccount}</span>
                  </div>
                </div>
                <h2 className="text-lg font-semibold text-white mb-4">{selected.subject || '(no subject)'}</h2>
                <div className="space-y-2 text-sm mb-6">
                  <div><span className="text-gray-500">{t('from')}:</span> <span className="text-gray-200">{selected.from}</span></div>
                  <div><span className="text-gray-500">{t('email')}:</span> <span className="text-gray-200">{selected.to}</span></div>
                  <div><span className="text-gray-500">{t('date')}:</span> <span className="text-gray-200">{new Date(selected.date).toLocaleString()}</span></div>
                  <div><span className="text-gray-500">{t('smtpAccount')}:</span> <span className="text-gray-200">{selected.smtpAccount}</span></div>
                  <div><span className="text-gray-500">{t('folder')}:</span> <span className="text-gray-200">{selected.folder}</span></div>
                </div>
                <div className="border-t border-dark-700 pt-4">
                  {selected.htmlBody ? (
                    <div className="prose prose-invert max-w-none text-sm text-gray-300" dangerouslySetInnerHTML={{ __html: selected.htmlBody }} />
                  ) : (
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">{selected.textBody}</pre>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Mail className="w-12 h-12 mx-auto mb-2 text-gray-600" />
                  <p>{t('selectEmail')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
