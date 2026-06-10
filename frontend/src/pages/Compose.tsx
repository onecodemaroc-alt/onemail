import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Send, Paperclip, X, Users } from 'lucide-react';
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
  const [signature, setSignature] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
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
      // Resolve contact emails
      const selectedContactDocs = contacts.filter(c => selectedContacts.includes(c.id));
      const emails = selectedContactDocs.map(c => c.email).filter(Boolean);
      if (emails.length === 0) { toast.error('No valid email addresses'); setSending(false); return; }

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
        signature,
        attachments: uploaded,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      triggerWorkflow();
      toast.success(t('success'));
      setSelectedContacts([]);
      setSubject('');
      setBody('');
      setSignature('');
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
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
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

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('signature')}</label>
            <textarea className="input-field min-h-[80px]" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={t('signaturePlaceholder')} />
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
