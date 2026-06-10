import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Send, Paperclip, X, Users, Plus, Mail } from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { useI18n } from '../i18n/I18nContext';
import toast from 'react-hot-toast';

  interface Contact { id: string; name: string; email: string; listId: string; }
interface SmtpAccount { id: string; name: string; username: string; }
interface Attachment { file: File; name: string; uploading?: boolean; url?: string; }

export default function Compose() {
  const { t } = useI18n();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<SmtpAccount[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [smtpId, setSmtpId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [manualEmails, setManualEmails] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, 'contacts')),
      getDocs(collection(db, 'smtpAccounts')),
    ]).then(([cSnap, aSnap]) => {
      setContacts(cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Contact)));
      const accs = aSnap.docs.map(d => ({ id: d.id, ...d.data() } as SmtpAccount));
      setAccounts(accs);
      if (accs.length > 0) setSmtpId(accs[0].id);
    });
  }, []);

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const addManualEmail = () => {
    const email = manualInput.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(t('invalidEmail')); return;
    }
    if (manualEmails.includes(email)) { toast.error(t('duplicateEmail')); return; }
    setManualEmails([...manualEmails, email]);
    setManualInput('');
  };

  const removeManualEmail = (email: string) => {
    setManualEmails(manualEmails.filter(e => e !== email));
  };

  const handleManualKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addManualEmail(); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files.map(f => ({ file: f, name: f.name }))]);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachment = async (att: Attachment): Promise<string> => {
    const path = `attachments/${Date.now()}_${att.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, att.file);
    return getDownloadURL(storageRef);
  };

  const handleSend = async () => {
    if (selectedContacts.length === 0) { toast.error(t('selectRecipients')); return; }
    if (!smtpId) { toast.error(t('selectAccounts')); return; }

    setSending(true);
    try {
      const selectedContactDocs = contacts.filter(c => selectedContacts.includes(c.id));
      const contactEmails = selectedContactDocs.map(c => c.email).filter(Boolean);
      const emails = [...contactEmails, ...manualEmails];
      if (emails.length === 0) { toast.error(t('selectRecipients')); setSending(false); return; }

      const uploaded = [];
      for (const att of attachments) {
        const url = await uploadAttachment(att);
        uploaded.push({ name: att.name, url });
      }

      await addDoc(collection(db, 'quickSends'), {
        to: emails,
        smtpAccountId: smtpId,
        subject,
        body,
        attachments: uploaded,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      triggerWorkflow();
      toast.success(t('success'));
      setSelectedContacts([]);
      setManualEmails([]);
      setSubject('');
      setBody('');
      setAttachments([]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const triggerWorkflow = async () => {
    try {
      await fetch('/api/trigger-workflow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    } catch {}
  };

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t('compose')}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Contact selection */}
        <div className="card lg:col-span-1">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> {t('selectRecipients')} ({selectedContacts.length})
          </h2>
          <input className="input-field mb-3 text-sm" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          {/* Manual email input */}
          <div className="flex gap-2 mb-3">
            <input className="input-field text-sm flex-1" placeholder={t('addEmailPlaceholder')} value={manualInput} onChange={(e) => setManualInput(e.target.value)} onKeyDown={handleManualKeyDown} />
            <button onClick={addManualEmail} className="btn-secondary p-2 shrink-0"><Plus className="w-4 h-4" /></button>
          </div>
          {manualEmails.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {manualEmails.map(email => (
                <span key={email} className="inline-flex items-center gap-1 bg-brand-600/20 text-brand-400 text-xs px-2 py-1 rounded-full">
                  <Mail className="w-3 h-3" />
                  {email}
                  <button onClick={() => removeManualEmail(email)} className="hover:text-red-400"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {filtered.map(c => (
              <label key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-dark-700/50 cursor-pointer">
                <input type="checkbox" checked={selectedContacts.includes(c.id)} onChange={() => toggleContact(c.id)} className="rounded bg-dark-700 border-dark-400" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 truncate">{c.email}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Compose form */}
        <div className="card lg:col-span-2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('smtpAccount')}</label>
            <select className="input-field" value={smtpId} onChange={(e) => setSmtpId(e.target.value)}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.username})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('subject')}</label>
            <input className="input-field" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('body')}</label>
            <textarea className="input-field min-h-[200px]" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => fileRef.current?.click()} className="btn-secondary text-sm flex items-center gap-2">
                <Paperclip className="w-4 h-4" /> {t('attachFile')}
              </button>
              <input ref={fileRef} type="file" multiple onChange={handleFileSelect} hidden />
            </div>
            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center justify-between bg-dark-700/50 rounded-lg p-2 text-sm">
                    <span className="text-gray-300 truncate">{att.name}</span>
                    <button onClick={() => removeAttachment(i)} className="text-red-400 hover:text-red-300 p-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-dark-700">
            <button onClick={handleSend} disabled={sending} className="btn-primary flex items-center gap-2">
              <Send className="w-4 h-4" /> {sending ? t('sending') : t('send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
