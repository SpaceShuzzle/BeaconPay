import { Injectable } from '@nestjs/common';
import { Invoice } from '../entities/invoice.entity';
// pdfkit is a CommonJS module; use require() to avoid ESM interop issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

/**
 * Shape of an individual invoice line item. `invoice.lineItems` isn't
 * strongly typed on the entity (likely `jsonb`), so we validate/narrow to
 * this shape defensively when rendering rather than trusting raw JSON.
 */
interface InvoiceLineItem {
  description?: string;
  amountNaira?: number;
  startDate?: string;
  endDate?: string;
}

// Layout constants — A4 page, 50pt margins. Centralized so column
// positions stay consistent across the header row, line items, and total.
const LAYOUT = {
  marginX: 50,
  contentRight: 545,
  descColX: 50,
  descColWidth: 300,
  amountColX: 350,
  amountColWidth: 195,
  pageBottomMargin: 50,
} as const;

// NOTE: PDFKit's built-in "standard 14" fonts (Helvetica, etc.) are
// Latin-1/WinAnsi encoded and do not include the Naira glyph (₦). Depending
// on the PDF viewer, it may render as a missing-glyph box instead of ₦. If
// that shows up in testing, embed a Unicode font that includes ₦ (e.g.
// Noto Sans) via `doc.registerFont('Noto', 'fonts/NotoSans-Regular.ttf')`
// and use it for any text containing the symbol, or fall back to the
// plain-text "NGN" prefix below instead of the symbol.
const CURRENCY_SYMBOL = '₦';

const nairaFormatter = new Intl.NumberFormat('en-NG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

@Injectable()
export class PdfInvoiceProvider {
  /**
   * Generates a PDF buffer for the given invoice.
   */
  generate(invoice: Invoice): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: LAYOUT.marginX });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this.renderPdf(doc, invoice);
        doc.end();
      } catch (error) {
        // Rendering failed part-way through — reject with the real cause
        // rather than letting the stream hang or resolve with a partial
        // buffer, and still end() the stream so it isn't left dangling.
        reject(error);
        doc.end();
      }
    });
  }

  private renderPdf(doc: PDFKit.PDFDocument, invoice: Invoice): void {
    const amountNaira = formatNaira(invoice.amountKobo);

    this.renderHeader(doc);
    this.renderInvoiceMeta(doc, invoice);

    // Divider
    doc.moveTo(LAYOUT.marginX, doc.y).lineTo(LAYOUT.contentRight, doc.y).stroke().moveDown(1);

    this.renderTableHeader(doc);
    this.renderLineItems(doc, invoice, amountNaira);
    this.renderTotal(doc, amountNaira);
    this.renderFooter(doc);
  }

  private renderHeader(doc: PDFKit.PDFDocument): void {
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('BeaconPay', 50, 50)
      .fontSize(10)
      .font('Helvetica')
      .text('Coworking Space Management', 50, 76)
      .moveDown(2);
  }

  private renderInvoiceMeta(doc: PDFKit.PDFDocument, invoice: Invoice): void {
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('INVOICE', { align: 'right' })
      .fontSize(10)
      .font('Helvetica')
      .text(`Invoice #: ${invoice.invoiceNumber}`, { align: 'right' })
      .text(
        `Date: ${invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : '—'}`,
        { align: 'right' },
      )
      .text(`Status: ${invoice.status.toUpperCase()}`, { align: 'right' })
      .moveDown(2);
  }

  /**
   * Renders the line-item table's column headers. Extracted so it can be
   * reprinted at the top of any page a long invoice overflows onto.
   */
  private renderTableHeader(doc: PDFKit.PDFDocument): void {
    const headerY = doc.y;

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Description', LAYOUT.descColX, headerY, { width: LAYOUT.descColWidth })
      .text('Amount', LAYOUT.amountColX, headerY, {
        width: LAYOUT.amountColWidth,
        align: 'right',
      });

    doc.y = headerY + doc.currentLineHeight() + 4;
    doc.moveTo(LAYOUT.marginX, doc.y).lineTo(LAYOUT.contentRight, doc.y).stroke().moveDown(0.5);
    doc.font('Helvetica');
  }

  private renderLineItems(doc: PDFKit.PDFDocument, invoice: Invoice, amountNaira: string): void {
    const lineItems = normalizeLineItems(invoice.lineItems);

    if (lineItems.length === 0) {
      this.renderLineItemRow(doc, {
        description: 'Workspace booking',
        amount: amountNaira,
      });
      return;
    }

    for (const item of lineItems) {
      const description = item.description?.trim() || 'Workspace booking';
      const amount = item.amountNaira != null ? nairaFormatter.format(item.amountNaira) : amountNaira;
      const dateRange = item.startDate && item.endDate ? `${item.startDate} → ${item.endDate}` : undefined;

      this.renderLineItemRow(doc, { description, amount, dateRange });
    }
  }

  /**
   * Renders a single line-item row, breaking to a new page (and reprinting
   * the table header) if there isn't enough vertical space left — long
   * invoices would otherwise run into the footer or off the page.
   */
  private renderLineItemRow(
    doc: PDFKit.PDFDocument,
    row: { description: string; amount: string; dateRange?: string },
  ): void {
    const estimatedHeight = doc.currentLineHeight() * (row.dateRange ? 2 : 1) + 8;
    this.ensureSpace(doc, estimatedHeight);

    const lineY = doc.y;
    doc.font('Helvetica').fontSize(10);
    doc.text(row.description, LAYOUT.descColX, lineY, { width: LAYOUT.descColWidth });
    doc.text(`${CURRENCY_SYMBOL}${row.amount}`, LAYOUT.amountColX, lineY, {
      width: LAYOUT.amountColWidth,
      align: 'right',
    });

    if (row.dateRange) {
      doc
        .fontSize(9)
        .fillColor('#666666')
        .text(row.dateRange, LAYOUT.descColX, doc.y, { width: LAYOUT.descColWidth })
        .fillColor('#000000')
        .fontSize(10);
    }

    doc.moveDown(0.5);
  }

  private renderTotal(doc: PDFKit.PDFDocument, amountNaira: string): void {
    this.ensureSpace(doc, doc.currentLineHeight() + 20);

    doc.moveTo(LAYOUT.marginX, doc.y).lineTo(LAYOUT.contentRight, doc.y).stroke().moveDown(0.5);

    const totalY = doc.y;
    doc
      .font('Helvetica-Bold')
      .text('Total', LAYOUT.descColX, totalY, { width: LAYOUT.descColWidth })
      .text(`${CURRENCY_SYMBOL}${amountNaira}`, LAYOUT.amountColX, totalY, {
        width: LAYOUT.amountColWidth,
        align: 'right',
      })
      .moveDown(2);
  }

  private renderFooter(doc: PDFKit.PDFDocument): void {
    this.ensureSpace(doc, doc.currentLineHeight() + 10);

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#999999')
      .text('Thank you for choosing BeaconPay.', { align: 'center' });
  }

  /**
   * Adds a new page (and re-renders the table header for continuity) if
   * the next block of content wouldn't fit above the bottom margin.
   */
  private ensureSpace(doc: PDFKit.PDFDocument, neededHeight: number): void {
    const usableBottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y + neededHeight <= usableBottom) {
      return;
    }

    doc.addPage();
    this.renderTableHeader(doc);
  }
}

function normalizeLineItems(lineItems: unknown): InvoiceLineItem[] {
  if (!Array.isArray(lineItems)) {
    return [];
  }

  return lineItems.filter(
    (item): item is InvoiceLineItem => typeof item === 'object' && item !== null,
  );
}

/**
 * Formats a kobo amount (integer, 1/100 of a Naira) as a Naira string with
 * thousands separators, e.g. 250000 -> "2,500.00". Converts to Naira via
 * integer division/remainder rather than `kobo / 100` directly, to avoid
 * binary floating-point rounding artifacts on large amounts.
 */
function formatNaira(amountKobo: number): string {
  const whole = Math.trunc(amountKobo / 100);
  const remainder = Math.abs(amountKobo % 100);
  const naira = whole + remainder / 100;
  return nairaFormatter.format(naira);
}