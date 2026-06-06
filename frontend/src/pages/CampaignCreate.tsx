import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Send, Clock } from 'lucide-react';
import { db } from '../lib/firebase';
import { useI18n } from '../i18n/I18nContext';
import toast from 'react-hot-toast';

interface SmtpAccount {
  id: string; name: string; username: string;
  status: string; dailyLimit: number; sentToday: number;
}

interface ContactList {
  id: string; name: string; count: number;
}

interface Template {
  id: string; name: string; subject: string; htmlBody: string;
}

export default function CampaignCreate() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<SmtpAccount[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [step, setStep] = useState<'draft' | 'review'>('draft');
  const [form, setForm] = useState({
    name: '', listId: '', templateId: '', subject: '', customBody: '',
    smtpAccountIds: [] as string[], ratePerMinute: 10, scheduleNow: true, scheduledAt: '',
  });

  useEffect(() => {
    async function load() {
      const [aSnap, lSnap, tSnap] = await Promise.all([
        getDocs(collection(db, 'smtpAccounts')),
        getDocs(collection(db, 'contactLists')),
        getDocs(collection(db, 'templates')),
      ]);
      setAccounts(aSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SmtpAccount)).filter((a) => a.status === 'active'));
      setLists(lSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ContactList)));
      setTemplates(tSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Template)));
    }
    load();
  }, []);

  const handleSubmit = async () => {
    if (!form.name || !form.listId || form.smtpAccountIds.length === 0) {
      toast.error(t('required'));
      return;
    }
    try {
      const docRef = await addDoc(collection(db, 'campaigns'), {
        name: form.name,
        listId: form.listId,
        templateId: form.templateId,
        subject: form.subject,
        customBody: form.customBody,
        smtpAccounts: form.smtpAccountIds,
        ratePerMinute: form.ratePerMinute,
        scheduledAt: form.scheduleNow ? new Date().toISOString() : form.scheduledAt,
        status: form.scheduleNow ? 'sending' : 'draft',
        stats: { sent: 0, failed: 0, pending: 0 },
        createdAt: new Date().toISOString(),
      });

      toast.success(t('success'));
      if (form.scheduleNow) {
        fetch('https://onemail-onecode.web.app/api/trigger-workflow', { method: 'POST', mode: 'no-cors' }).catch(() => {});
      }
      navigate('/campaigns');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleAccount = (id: string) => {
    setForm((f) => ({
      ...f,
      smtpAccountIds: f.smtpAccountIds.includes(id)
        ? f.smtpAccountIds.filter((a) => a !== id)
        : [...f.smtpAccountIds, id],
    }));
  };

  const handleTemplateSelect = async (id: string) => {
    setForm({ ...form, templateId: id });
    if (id) {
      try {
        const snap = await getDoc(doc(db, 'templates', id));
        const tpl = snap.data() as Template;
        if (tpl) {
          setForm((f) => ({ ...f, templateId: id, subject: tpl.subject }));
        }
      } catch { /* ignore */ }
    }
  };

  const selectedTemplate = templates.find((t) => t.id === form.templateId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/campaigns')} className="btn-secondary p-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-white">{t('createCampaign')}</h1>
        <div className="flex items-center gap-2 mr-auto">
          <span className={`badge ${step === 'draft' ? 'badge-info' : 'badge-success'}`}>{t('stepDraft')}</span>
          <span className="text-gray-600">→</span>
          <span className={`badge ${step === 'review' ? 'badge-info' : 'badge-warning'}`}>{t('stepReview')}</span>
        </div>
      </div>

      {step === 'draft' ? (
        <div className="space-y-6">
          <div className="card">
            <h3 className="card-header">{t('campaignName')}</h3>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('campaignName')} />
          </div>

          <div className="card">
            <h3 className="card-header">{t('selectRecipients')}</h3>
            <select className="input-field" value={form.listId} onChange={(e) => setForm({ ...form, listId: e.target.value })}>
              <option value="">{t('selectRecipients')}</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.count})</option>)}
            </select>
          </div>

          <div className="card">
            <h3 className="card-header">{t('selectTemplate')}</h3>
            <select className="input-field" value={form.templateId} onChange={(e) => handleTemplateSelect(e.target.value)}>
              <option value="">{t('selectTemplate')}</option>
              {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
            </select>
            {selectedTemplate && (
              <div className="mt-4 p-4 bg-dark-700/50 rounded-lg">
                <p className="text-sm text-gray-400">{t('subject')}: <span className="text-gray-200">{selectedTemplate.subject}</span></p>
              </div>
            )}
          </div>

          {!form.templateId && (
            <div className="card">
              <h3 className="card-header">{t('subject')}</h3>
              <input className="input-field" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
          )}

          <div className="card">
            <h3 className="card-header">{t('selectAccounts')}</h3>
            {accounts.length === 0 ? (
              <p className="text-gray-500">{t('noAccounts')}</p>
            ) : (
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <label key={acc.id} className="flex items-center gap-3 p-3 rounded-lg bg-dark-700/50 cursor-pointer hover:bg-dark-700">
                    <input
                      type="checkbox"
                      checked={form.smtpAccountIds.includes(acc.id)}
                      onChange={() => toggleAccount(acc.id)}
                      className="rounded bg-dark-600 border-dark-400"
                    />
                    <div>
                      <span className="text-gray-200">{acc.name}</span>
                      <span className="text-xs text-gray-500 mr-2">{acc.username} | {acc.sentToday}/{acc.dailyLimit}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="card-header">{t('ratePerMinute')}</h3>
            <input
              type="range" min={1} max={60} value={form.ratePerMinute}
              onChange={(e) => setForm({ ...form, ratePerMinute: Number(e.target.value) })}
              className="w-full accent-brand-500"
            />
            <span className="text-brand-400 font-semibold">{form.ratePerMinute} {t('ratePerMinute')}</span>
          </div>

          <div className="card">
            <h3 className="card-header">{t('scheduleSend')}</h3>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-gray-300">
                <input type="radio" checked={form.scheduleNow} onChange={() => setForm({ ...form, scheduleNow: true })} className="accent-brand-500" />
                {t('sendNow')}
              </label>
              <label className="flex items-center gap-2 text-gray-300">
                <input type="radio" checked={!form.scheduleNow} onChange={() => setForm({ ...form, scheduleNow: false })} className="accent-brand-500" />
                {t('scheduleLater')}
              </label>
            </div>
            {!form.scheduleNow && (
              <input
                type="datetime-local" className="input-field mt-3"
                value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              />
            )}
          </div>

          <div className="flex justify-end">
            <button onClick={() => setStep('review')} className="btn-primary">{t('review')}</button>
          </div>
        </div>
      ) : (
        <div className="card space-y-4">
          <h3 className="card-header">{t('review')}</h3>
          <div className="space-y-3">
            <div className="flex justify-between p-3 bg-dark-700/50 rounded-lg">
              <span className="text-gray-400">{t('campaignName')}</span>
              <span className="text-gray-200">{form.name}</span>
            </div>
            <div className="flex justify-between p-3 bg-dark-700/50 rounded-lg">
              <span className="text-gray-400">{t('contactList')}</span>
              <span className="text-gray-200">{lists.find((l) => l.id === form.listId)?.name || '-'}</span>
            </div>
            <div className="flex justify-between p-3 bg-dark-700/50 rounded-lg">
              <span className="text-gray-400">{t('emailTemplate')}</span>
              <span className="text-gray-200">{selectedTemplate?.name || t('custom')}</span>
            </div>
            <div className="flex justify-between p-3 bg-dark-700/50 rounded-lg">
              <span className="text-gray-400">{t('selectAccounts')}</span>
              <span className="text-gray-200">{form.smtpAccountIds.length} accounts</span>
            </div>
            <div className="flex justify-between p-3 bg-dark-700/50 rounded-lg">
              <span className="text-gray-400">{t('ratePerMinute')}</span>
              <span className="text-gray-200">{form.ratePerMinute}/min</span>
            </div>
            <div className="flex justify-between p-3 bg-dark-700/50 rounded-lg">
              <span className="text-gray-400">{t('schedule')}</span>
              <span className="text-gray-200">
                {form.scheduleNow ? t('sendNow') : new Date(form.scheduledAt).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="flex justify-between pt-4">
            <button onClick={() => setStep('draft')} className="btn-secondary">{t('edit')}</button>
            <button onClick={handleSubmit} className="btn-primary flex items-center gap-2">
              <Send className="w-4 h-4" />
              {form.scheduleNow ? t('sendNow') : t('schedule')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
