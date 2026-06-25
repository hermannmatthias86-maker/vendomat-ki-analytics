import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, CheckCircle, XCircle, Clock, FileText, Trash2 } from 'lucide-react'
import { uploadAndProcess } from '../lib/upload'
import { useCustomer } from '../hooks/useCustomer'
import { useAuth } from '../hooks/useAuth'
import { fetchUploads } from '../lib/queries'

interface UploadItem {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  message?: string
}

interface HistoryItem {
  id: string
  filename: string | null
  status: string
  created_at: string
  report_type: string | null
  year: number | null
}

const REPORT_TYPES: Record<string, string> = {
  sales: 'Umsatzbericht',
  products: 'Artikelbericht',
  employees: 'Mitarbeiterbericht',
  payments: 'Zahlungsarten',
  product_groups: 'Warengruppen',
  unknown: 'Unbekannt',
}

export default function UploadPage() {
  const { customer } = useCustomer()
  const { user } = useAuth()
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])

  useEffect(() => {
    if (customer) loadHistory()
  }, [customer])

  async function loadHistory() {
    if (!customer) return
    const data = await fetchUploads(customer.id)
    setHistory(data as HistoryItem[])
  }

  const processFile = useCallback(async (file: File, index: number) => {
    if (!customer || !user) return
    setUploads((prev) => prev.map((u, i) => i === index ? { ...u, status: 'uploading' as const } : u))
    try {
      const result = await uploadAndProcess(file, customer.id, user.id, (progress) => {
        setUploads((prev) => prev.map((u, i) => i === index ? { ...u, progress } : u))
      })
      setUploads((prev) => prev.map((u, i) =>
        i === index ? { ...u, status: result.success ? 'done' as const : 'error' as const, message: result.message, progress: 100 } : u
      ))
      loadHistory()
    } catch (err: unknown) {
      setUploads((prev) => prev.map((u, i) =>
        i === index ? { ...u, status: 'error' as const, message: err instanceof Error ? err.message : 'Fehler', progress: 0 } : u
      ))
    }
  }, [customer, user])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploads((prev) => {
      const startIndex = prev.length
      const newItems: UploadItem[] = acceptedFiles.map((f) => ({ file: f, progress: 0, status: 'pending' as const }))
      acceptedFiles.forEach((file, i) => processFile(file, startIndex + i))
      return [...prev, ...newItems]
    })
  }, [processFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] },
    multiple: true,
  })

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Daten hochladen</h2>
        <p className="text-sm text-gray-500">Laden Sie Ihre Lightspeed G-Serie Berichte im CSV- oder Excel-Format hoch.</p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Upload size={24} className="text-blue-600" />
        </div>
        {isDragActive ? (
          <p className="text-blue-600 font-medium">Dateien hier ablegen…</p>
        ) : (
          <>
            <p className="font-medium text-gray-700 mb-1">Dateien hier ablegen oder klicken zum Auswählen</p>
            <p className="text-sm text-gray-400">CSV, XLSX oder XLS · Mehrere Dateien gleichzeitig möglich</p>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Object.entries(REPORT_TYPES).filter(([k]) => k !== 'unknown').map(([key, label]) => (
          <div key={key} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-100 rounded-lg text-xs text-gray-600">
            <FileText size={14} className="text-blue-500" />
            {label}
          </div>
        ))}
      </div>

      {uploads.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Aktuelle Uploads</h3>
          <div className="space-y-3">
            {uploads.map((u, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {u.status === 'done' ? (
                    <CheckCircle size={18} className="text-green-500" />
                  ) : u.status === 'error' ? (
                    <XCircle size={18} className="text-red-500" />
                  ) : (
                    <Clock size={18} className="text-blue-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{u.file.name}</p>
                  {u.status === 'uploading' && (
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                      <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${u.progress}%` }} />
                    </div>
                  )}
                  {u.message && <p className="text-xs text-gray-400 mt-0.5">{u.message}</p>}
                </div>
                <button onClick={() => setUploads((prev) => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-gray-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Upload-Verlauf</h3>
        {history.length === 0 ? (
          <p className="text-xs text-gray-400">Noch keine Uploads vorhanden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium">Dateiname</th>
                  <th className="pb-2 font-medium">Typ</th>
                  <th className="pb-2 font-medium">Jahr</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Datum</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-700 truncate max-w-xs">{h.filename || '—'}</td>
                    <td className="py-2 text-gray-500">{h.report_type ? REPORT_TYPES[h.report_type] || h.report_type : '—'}</td>
                    <td className="py-2 text-gray-500">{h.year || '—'}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        h.status === 'done' ? 'bg-green-50 text-green-700' :
                        h.status === 'error' ? 'bg-red-50 text-red-700' :
                        'bg-blue-50 text-blue-700'
                      }`}>
                        {h.status === 'done' ? 'Fertig' : h.status === 'error' ? 'Fehler' : 'Verarbeitung'}
                      </span>
                    </td>
                    <td className="py-2 text-gray-400">
                      {new Date(h.created_at).toLocaleDateString('de-DE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
