import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

export function exportToPDF(title: string, data: Record<string, unknown>[], columns: string[]) {
  const doc = new jsPDF()
  const dateStr = format(new Date(), 'dd.MM.yyyy', { locale: de })

  doc.setFontSize(18)
  doc.setTextColor(13, 27, 42)
  doc.text('vendomat KI ANALYTICS', 14, 20)

  doc.setFontSize(13)
  doc.setTextColor(60, 60, 60)
  doc.text(title, 14, 30)
  doc.setFontSize(9)
  doc.text(`Erstellt am: ${dateStr}`, 14, 38)

  doc.line(14, 42, 196, 42)

  // Distribute columns evenly across the usable page width (14mm … 196mm)
  const colWidth = Math.floor(182 / columns.length)

  // Headers
  let y = 50
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  columns.forEach((col, i) => {
    doc.text(col, 14 + i * colWidth, y)
  })

  // Data rows
  doc.setFont('helvetica', 'normal')
  y += 8
  data.forEach((row) => {
    if (y > 270) {
      doc.addPage()
      y = 20
    }
    columns.forEach((col, i) => {
      const val = row[col]
      const text = String(val ?? '')
      doc.text(text, 14 + i * colWidth, y)
    })
    y += 7
  })

  doc.save(`${title.replace(/\s+/g, '_')}_${dateStr}.pdf`)
}

export function exportToExcel(title: string, data: Record<string, unknown>[], sheetName = 'Bericht') {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const dateStr = format(new Date(), 'yyyy-MM-dd')
  XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}_${dateStr}.xlsx`)
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-DE').format(value)
}
