import { useEffect, useRef, useState } from 'react';
import { FileText, Upload, Trash2, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadPolicy, getPolicyDocuments, deletePolicy } from '../../api/ai';
import EmptyState from '../../components/EmptyState';
import Spinner from '../../components/Spinner';

export default function PolicyManagement() {
  const [documents, setDocuments]   = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [deleting, setDeleting]     = useState('');
  const [file, setFile]             = useState(null);
  const [title, setTitle]           = useState('');
  const [titleErr, setTitleErr]     = useState('');
  const fileInputRef                = useRef(null);

  const load = async () => {
    setLoadingDocs(true);
    try {
      const { data } = await getPolicyDocuments();
      setDocuments(data);
    } catch (_) {
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) { toast.error('Please select a PDF file'); return; }
    if (!title.trim()) { setTitleErr('Title is required'); return; }
    setTitleErr('');
    setUploading(true);
    try {
      const { data } = await uploadPolicy(file, title.trim());
      toast.success(`"${data.title}" uploaded — ${data.chunks_created} chunks indexed`);
      setFile(null);
      setTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docTitle) => {
    if (!window.confirm(`Delete "${docTitle}"? This cannot be undone.`)) return;
    setDeleting(docTitle);
    try {
      await deletePolicy(docTitle);
      toast.success(`"${docTitle}" deleted`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Delete failed');
    } finally {
      setDeleting('');
    }
  };

  return (
    <div className="space-y-6" data-testid="policy-management-page">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">AI Tools</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
          Policy Management
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload company policy PDFs. Employees can then ask the HR chatbot questions about them.
        </p>
      </div>

      {/* Upload card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Outfit' }}>
          Upload new policy document
        </h2>
        <form onSubmit={handleUpload} className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Policy title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleErr(''); }}
              placeholder="e.g. Leave Policy 2025"
              className={`mt-1 h-10 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                titleErr ? 'border-red-400' : 'border-slate-300'
              }`}
            />
            {titleErr && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle size={11} /> {titleErr}
              </p>
            )}
          </div>

          {/* File input */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              PDF file <span className="text-red-500">*</span>
            </label>
            <div
              className="mt-1 flex items-center gap-3 h-11 w-full rounded-md border border-slate-300 px-3 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText size={16} className="text-slate-400 shrink-0" />
              <span className={`text-sm truncate ${file ? 'text-slate-800' : 'text-slate-400'}`}>
                {file ? file.name : 'Click to choose a PDF file…'}
              </span>
              {file && (
                <span className="text-xs text-slate-400 shrink-0">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60 transition-colors"
          >
            {uploading ? (
              <><Loader2 size={14} className="animate-spin" /> Processing & indexing…</>
            ) : (
              <><Upload size={14} /> Upload Policy</>
            )}
          </button>
          {uploading && (
            <p className="text-xs text-slate-400">
              Extracting text and generating embeddings — this may take 10–30 seconds for large documents.
            </p>
          )}
        </form>
      </div>

      {/* Documents table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
            Uploaded policies
          </h2>
        </div>

        {loadingDocs ? (
          <Spinner />
        ) : documents.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={FileText}
              title="No policies uploaded yet"
              description="Upload a PDF above to enable the HR chatbot to answer employee questions."
            />
          </div>
        ) : (
          <table className="w-full" data-testid="policy-table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="text-left px-5 py-3 font-semibold">Title</th>
                <th className="text-left px-5 py-3 font-semibold">Uploaded</th>
                <th className="text-right px-5 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.title} className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded bg-blue-50 flex items-center justify-center shrink-0">
                        <FileText size={14} className="text-blue-600" />
                      </div>
                      <p className="text-sm font-medium text-slate-900">{doc.title}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">
                    {new Date(doc.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.title)}
                      disabled={deleting === doc.title}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-rose-600 border border-rose-200 hover:bg-rose-50 disabled:opacity-50 transition-colors"
                      data-testid={`delete-policy-${doc.title}`}
                    >
                      {deleting === doc.title
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Trash2 size={12} />
                      }
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
