import { qrCodeUrl } from '@/lib/event-links'
import { getPlatformOrigin } from '@/lib/tenant'

export type InventoryQrItem = {
  public_code: string
  name: string
  description: string | null
  points_cost: number
}

export function getInventoryItemLink(publicCode: string) {
  return `${getPlatformOrigin()}/inventory/item/${publicCode}`
}

function safeFilename(value: string) {
  return value.trim().replace(/[^a-z0-9_.-]+/gi, '_').replace(/^_+|_+$/g, '') || 'item'
}

export async function downloadInventoryQrPng(item: InventoryQrItem) {
  const response = await fetch(qrCodeUrl(getInventoryItemLink(item.public_code), 600))
  if (!response.ok) throw new Error('Could not generate the QR code.')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeFilename(item.name)}-inventory-qr.png`
  anchor.click()
  URL.revokeObjectURL(url)
}

async function imageDataUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not generate a QR code.')
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read QR code.'))
    reader.readAsDataURL(blob)
  })
}

export async function downloadInventoryQrsPdf(
  items: InventoryQrItem[],
  organizationName: string,
) {
  if (items.length === 0) throw new Error('Select at least one item.')
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 12
  const headerHeight = 22
  const gap = 6
  const columns = 2
  const rows = 2
  const cardWidth = (pageWidth - margin * 2 - gap) / columns
  const cardHeight = (pageHeight - margin * 2 - headerHeight - gap) / rows

  for (let index = 0; index < items.length; index += 1) {
    if (index > 0 && index % (columns * rows) === 0) pdf.addPage()
    const pageIndex = index % (columns * rows)
    const column = pageIndex % columns
    const row = Math.floor(pageIndex / columns)
    const x = margin + column * (cardWidth + gap)
    const y = margin + headerHeight + row * (cardHeight + gap)
    const item = items[index]
    const link = getInventoryItemLink(item.public_code)
    const qr = await imageDataUrl(qrCodeUrl(link, 800))

    if (pageIndex === 0) {
      pdf.setFillColor(255, 255, 255)
      pdf.rect(0, 0, pageWidth, pageHeight, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(17)
      pdf.setTextColor(36, 36, 36)
      pdf.text(`${organizationName} Inventory`, margin, margin + 7)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(100, 100, 100)
      pdf.text('Scan an item to purchase it with team points.', margin, margin + 13)
    }

    pdf.setDrawColor(215, 215, 215)
    pdf.setFillColor(252, 252, 252)
    pdf.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(14)
    pdf.setTextColor(28, 28, 28)
    const titleLines = pdf.splitTextToSize(item.name, cardWidth - 12).slice(0, 2)
    pdf.text(titleLines, x + cardWidth / 2, y + 11, { align: 'center' })

    pdf.setFillColor(255, 193, 7)
    pdf.roundedRect(x + cardWidth / 2 - 18, y + 22, 36, 10, 5, 5, 'F')
    pdf.setFontSize(11)
    pdf.setTextColor(35, 35, 35)
    pdf.text(`${item.points_cost} points`, x + cardWidth / 2, y + 28.5, { align: 'center' })

    const qrSize = 62
    pdf.addImage(qr, 'PNG', x + (cardWidth - qrSize) / 2, y + 37, qrSize, qrSize)

    if (item.description) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      pdf.setTextColor(80, 80, 80)
      const description = pdf.splitTextToSize(item.description, cardWidth - 14).slice(0, 3)
      pdf.text(description, x + cardWidth / 2, y + 105, { align: 'center' })
    }
  }

  pdf.save(`${safeFilename(organizationName)}-inventory-qr-codes.pdf`)
}
