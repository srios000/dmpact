import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import { SERVICE_LABELS, type Agreement } from "@/lib/schema/agreement";
import { STATE_LABELS } from "@/lib/state-machine/labels";
import type { CommissionState } from "@/lib/state-machine/rules";
import { formatSize } from "@/lib/utils";

/** Everything the evidence pack shows (FR-7.3, FR-8A.8). Plain data, no DB. */
export type EvidencePack = {
  /** ISO timestamp */
  generatedAt: string;
  commission: {
    id: string;
    state: CommissionState;
    createdAt: string;
    creatorName: string;
    clientToken: string | null;
  };
  /** The version both parties confirmed, or the latest one if none was. */
  agreement: {
    version: number;
    contentHash: string;
    confirmedByBoth: boolean;
    content: Agreement;
  } | null;
  confirmations: {
    party: "creator" | "client";
    version: number;
    contentHash: string;
    confirmedAt: string;
  }[];
  invoices: {
    kind: "deposit" | "balance";
    status: string;
    paypalInvoiceId: string | null;
    amount: string;
    currency: string;
    dueDate: string | null;
    createdAt: string;
    paidAt: string | null;
  }[];
  /** Upload evidence: what the creator delivered. */
  deliveries: {
    filename: string;
    sha256: string;
    sizeBytes: number;
    mimeType: string;
    isFinal: boolean;
    loggedAt: string;
  }[];
  /** Receipt evidence: what the client downloaded. */
  downloads: {
    filename: string;
    sha256: string;
    requestedAt: string;
    userAgent: string | null;
  }[];
  events: {
    at: string;
    type: string;
    actor: string;
    fromState: CommissionState | null;
    toState: CommissionState | null;
    reason: string | null;
  }[];
  sourceDm: string;
  followUpDms: { message: string; createdAt: string }[];
};

// A4 in points.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 30;

const INK = rgb(0.11, 0.12, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.86, 0.87, 0.9);
const ACCENT = rgb(0.0, 0.19, 0.53); // PayPal-ish blue
const PANEL = rgb(0.96, 0.97, 0.99);
const UPLOAD = rgb(0.13, 0.42, 0.29);
const RECEIPT = rgb(0.55, 0.32, 0.06);

const stamp = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const day = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatStamp(iso: string | null): string {
  return iso ? `${stamp.format(new Date(iso))} UTC` : "-";
}

function formatDay(isoDate: string | null): string {
  return isoDate
    ? day.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`))
    : "-";
}

const EVENT_TITLES: Record<string, string> = {
  created: "Commission created",
  version_saved: "Agreement version saved",
  client_confirmed: "Client confirmed the agreement",
  change_requested: "Client requested changes",
  invoice_sent: "Invoice sent",
  invoice_paid: "Invoice paid",
  invoice_cancelled: "Invoice cancelled",
  invoice_reminded: "Payment reminder sent",
  delivery_logged: "Delivery logged",
  dispute_evidence_sent: "Evidence sent to PayPal dispute",
  effect_failed: "PayPal action failed",
};

function eventTitle(event: EvidencePack["events"][number]): string {
  if (event.type === "transition" && event.toState) {
    return event.fromState
      ? `${STATE_LABELS[event.fromState]} -> ${STATE_LABELS[event.toState]}`
      : STATE_LABELS[event.toState];
  }
  return EVENT_TITLES[event.type] ?? event.type.replace(/_/g, " ");
}

/** Lays text out top to bottom and adds pages as needed. */
class Writer {
  private page!: PDFPage;
  private y = 0;
  private readonly encodable = new Map<string, boolean>();

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  /** Standard PDF fonts only cover Latin text; anything else becomes "?". */
  clean(text: string, font: PDFFont = this.fonts.regular): string {
    let out = "";
    for (const ch of text.replace(/\r\n?/g, "\n").replace(/\t/g, "  ")) {
      if (ch === "\n") {
        out += ch;
        continue;
      }
      const key = `${font.name}:${ch}`;
      let ok = this.encodable.get(key);
      if (ok === undefined) {
        try {
          font.encodeText(ch);
          ok = true;
        } catch {
          ok = false;
        }
        this.encodable.set(key, ok);
      }
      out += ok ? ch : "?";
    }
    return out;
  }

  private wrap(text: string, font: PDFFont, size: number, width: number) {
    const lines: string[] = [];
    for (const paragraph of this.clean(text, font).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/(\s+)/)) {
        const next = line + word;
        if (font.widthOfTextAtSize(next, size) <= width) {
          line = next;
          continue;
        }
        if (line.trim()) lines.push(line.trimEnd());
        // Break words longer than a line (hashes, URLs).
        let rest = word.trimStart();
        while (font.widthOfTextAtSize(rest, size) > width) {
          let cut = rest.length;
          while (
            cut > 1 &&
            font.widthOfTextAtSize(rest.slice(0, cut), size) > width
          ) {
            cut--;
          }
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
      lines.push(line.trimEnd());
    }
    return lines;
  }

  ensure(height: number) {
    if (this.y - height < MARGIN + FOOTER_H) this.newPage();
  }

  space(points: number) {
    this.y -= points;
  }

  text(
    text: string,
    opts: {
      font?: PDFFont;
      size?: number;
      color?: RGB;
      x?: number;
      width?: number;
      lineGap?: number;
    } = {},
  ) {
    const font = opts.font ?? this.fonts.regular;
    const size = opts.size ?? 9.5;
    const x = opts.x ?? MARGIN;
    const width = opts.width ?? CONTENT_W - (x - MARGIN);
    const lineHeight = size * 1.35 + (opts.lineGap ?? 0);
    for (const line of this.wrap(text, font, size, width)) {
      this.ensure(lineHeight);
      this.page.drawText(line, {
        x,
        y: this.y - size,
        size,
        font,
        color: opts.color ?? INK,
      });
      this.y -= lineHeight;
    }
  }

  rule(color: RGB = RULE) {
    this.ensure(8);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y - 4 },
      end: { x: PAGE_W - MARGIN, y: this.y - 4 },
      thickness: 0.6,
      color,
    });
    this.y -= 8;
  }

  section(number: number, title: string, subtitle?: string, color = ACCENT) {
    this.ensure(70);
    this.space(14);
    this.text(`${number}. ${title}`, {
      font: this.fonts.bold,
      size: 13,
      color,
    });
    if (subtitle) this.text(subtitle, { color: MUTED, size: 9 });
    this.rule(color);
    this.space(2);
  }

  /** Label on the left, value on the right. */
  field(label: string, value: string, opts: { mono?: boolean } = {}) {
    const labelW = 130;
    const font = opts.mono ? this.fonts.mono : this.fonts.regular;
    const size = opts.mono ? 8.5 : 9.5;
    const lines = this.wrap(value || "-", font, size, CONTENT_W - labelW);
    const lineHeight = size * 1.35;
    this.ensure(lineHeight * Math.min(lines.length, 3));
    const top = this.y;
    this.page.drawText(this.clean(label), {
      x: MARGIN,
      y: top - 9.5,
      size: 9,
      font: this.fonts.regular,
      color: MUTED,
    });
    for (const line of lines) {
      this.ensure(lineHeight);
      this.page.drawText(line, {
        x: MARGIN + labelW,
        y: this.y - size,
        size,
        font,
        color: INK,
      });
      this.y -= lineHeight;
    }
    this.space(2);
  }

  /** A block for one record: bold title, muted meta, then fields. */
  record(title: string, meta: string, color: RGB = INK) {
    this.ensure(40);
    this.space(4);
    this.text(title, { font: this.fonts.bold, size: 10, color });
    if (meta) this.text(meta, { size: 8.5, color: MUTED });
  }

  muted(text: string) {
    this.text(text, { color: MUTED, size: 9 });
  }

  panel(lines: [string, string][]) {
    const lineHeight = 15;
    const height = lines.length * lineHeight + 16;
    this.ensure(height + 6);
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - height,
      width: CONTENT_W,
      height,
      color: PANEL,
      borderColor: RULE,
      borderWidth: 0.6,
    });
    let y = this.y - 8;
    for (const [label, value] of lines) {
      this.page.drawText(this.clean(label), {
        x: MARGIN + 12,
        y: y - 10,
        size: 9,
        font: this.fonts.regular,
        color: MUTED,
      });
      this.page.drawText(this.clean(value, this.fonts.bold), {
        x: MARGIN + 150,
        y: y - 10,
        size: 9.5,
        font: this.fonts.bold,
        color: INK,
      });
      y -= lineHeight;
    }
    this.y -= height + 6;
  }

  footer(commissionId: string, generatedAt: string) {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      page.drawLine({
        start: { x: MARGIN, y: MARGIN + 6 },
        end: { x: PAGE_W - MARGIN, y: MARGIN + 6 },
        thickness: 0.5,
        color: RULE,
      });
      page.drawText(
        `DMpact evidence pack  |  Commission ${commissionId}  |  Generated ${formatStamp(generatedAt)}`,
        {
          x: MARGIN,
          y: MARGIN - 6,
          size: 7.5,
          font: this.fonts.regular,
          color: MUTED,
        },
      );
      const label = `Page ${index + 1} of ${pages.length}`;
      page.drawText(label, {
        x: PAGE_W - MARGIN - this.fonts.regular.widthOfTextAtSize(label, 7.5),
        y: MARGIN - 6,
        size: 7.5,
        font: this.fonts.regular,
        color: MUTED,
      });
    });
  }
}

function money(currency: string | null, amount: string | null | undefined) {
  return amount ? `${amount} ${currency ?? ""}`.trim() : "-";
}

function depositTerms(a: Agreement): string {
  const d = a.deposit;
  if (d.type === "none") return "No deposit";
  if (d.type === "percent")
    return `${d.percent}% upfront (${money(a.price.currency, d.amount)})`;
  return `Fixed ${money(a.price.currency, d.fixed_amount)} upfront`;
}

function yesNo(value: boolean | null | undefined) {
  return value === true ? "Yes" : value === false ? "No" : "Not stated";
}

/** Renders the evidence pack as a PDF. */
export async function renderEvidencePdf(
  pack: EvidencePack,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    mono: await doc.embedFont(StandardFonts.Courier),
  };
  const title = pack.agreement?.content.title ?? "Commission";
  doc.setTitle(`Evidence pack - ${title}`);
  doc.setAuthor("DMpact");
  doc.setSubject(`Commission ${pack.commission.id}`);
  doc.setCreationDate(new Date(pack.generatedAt));

  const w = new Writer(doc, fonts);
  const a = pack.agreement?.content ?? null;
  const client = a?.parties?.client;

  // Cover
  w.text("EVIDENCE PACK", { font: fonts.bold, size: 9, color: ACCENT });
  w.space(2);
  w.text(title, { font: fonts.bold, size: 20 });
  w.space(4);
  w.muted(
    `Commission ${pack.commission.id} between ${pack.commission.creatorName} (creator) and ${client?.display_name ?? client?.handle ?? "the client"} (client). Generated ${formatStamp(pack.generatedAt)} from DMpact's append-only records.`,
  );
  w.space(10);

  const paid = pack.invoices.filter((i) => i.status === "paid");
  w.panel([
    ["Status", STATE_LABELS[pack.commission.state]],
    [
      "Agreement in force",
      pack.agreement
        ? `Version ${pack.agreement.version}${pack.agreement.confirmedByBoth ? ", confirmed by both parties" : ", not confirmed by both"}`
        : "None",
    ],
    ["Total price", a ? money(a.price.currency, a.price.total) : "-"],
    [
      "Paid through PayPal",
      paid.length
        ? paid.map((i) => `${i.kind} ${money(i.currency, i.amount)}`).join(", ")
        : "Nothing yet",
    ],
    [
      "Files delivered",
      `${pack.deliveries.length} (${pack.deliveries.filter((d) => d.isFinal).length} final)`,
    ],
    ["Client downloads", String(pack.downloads.length)],
  ]);

  w.muted(
    "SHA-256 fingerprints identify content exactly: changing a single byte of an agreement or file produces a different fingerprint. All timestamps are recorded by the server in UTC.",
  );

  // 1. Agreement
  w.section(
    1,
    "Final agreement",
    pack.agreement ? `Version ${pack.agreement.version}` : undefined,
  );
  if (!pack.agreement || !a) {
    w.muted("No agreement version exists.");
  } else {
    w.field("Content hash (SHA-256)", pack.agreement.contentHash, {
      mono: true,
    });
    w.field(
      "Service",
      a.service_type === "other"
        ? (a.service_other ?? "Other")
        : SERVICE_LABELS[a.service_type],
    );
    w.field(
      "Deliverables",
      a.deliverables
        .map(
          (d) =>
            `${d.quantity} x ${d.description}${d.format ? ` (${d.format})` : ""}`,
        )
        .join("\n"),
    );
    w.field("Price", money(a.price.currency, a.price.total));
    w.field("Deposit", depositTerms(a));
    w.field("Balance", money(a.price.currency, a.balance_amount));
    w.field(
      "Deadline",
      a.deadline.date ? formatDay(a.deadline.date) : "Not set",
    );
    w.field(
      "Revisions",
      a.revisions.included === null
        ? "Not stated"
        : `${a.revisions.included} included${a.revisions.extra_fee ? `, extra ${money(a.price.currency, a.revisions.extra_fee)} each` : ""}`,
    );
    w.field("Commercial use", yesNo(a.usage_rights?.commercial));
    w.field("Credit required", yesNo(a.usage_rights?.credit_required));
    if (a.usage_rights?.notes) w.field("Usage notes", a.usage_rights.notes);
    w.field(
      "Client",
      [client?.display_name, client?.handle, client?.email]
        .filter(Boolean)
        .join("  |  ") || "-",
    );
  }

  // 2. Confirmations
  w.section(
    2,
    "Confirmations",
    "Each party confirmed this exact content hash.",
  );
  if (pack.confirmations.length === 0) {
    w.muted("No confirmations recorded.");
  }
  for (const c of pack.confirmations) {
    w.record(
      `${c.party === "creator" ? "Creator" : "Client"} confirmed version ${c.version}`,
      formatStamp(c.confirmedAt),
    );
    w.field("Content hash", c.contentHash, { mono: true });
  }

  // 3. Payments
  w.section(3, "Payments (PayPal invoices)");
  if (pack.invoices.length === 0) w.muted("No invoices.");
  for (const i of pack.invoices) {
    w.record(
      `${i.kind === "deposit" ? "Deposit" : "Balance"} invoice: ${money(i.currency, i.amount)}`,
      `Status: ${i.status}${i.paidAt ? `  |  Paid ${formatStamp(i.paidAt)}` : ""}`,
    );
    w.field("PayPal invoice ID", i.paypalInvoiceId ?? "Not created at PayPal", {
      mono: !!i.paypalInvoiceId,
    });
    w.field("Created", formatStamp(i.createdAt));
    w.field("Due", formatDay(i.dueDate));
  }

  // 4. Upload evidence
  w.section(
    4,
    "Upload evidence: files the creator delivered",
    "Logged by the server when each file was stored. Files can't be edited or deleted; a revision is a new entry.",
    UPLOAD,
  );
  if (pack.deliveries.length === 0) w.muted("No files delivered.");
  pack.deliveries.forEach((d, index) => {
    w.record(
      `#${index + 1}  ${d.filename}`,
      `${d.isFinal ? "Final file" : "Preview"}  |  ${formatSize(d.sizeBytes)}  |  ${d.mimeType}  |  Logged ${formatStamp(d.loggedAt)}`,
      UPLOAD,
    );
    w.field("SHA-256", d.sha256, { mono: true });
  });

  // 5. Receipt evidence
  w.section(
    5,
    "Receipt evidence: files the client downloaded",
    "Recorded each time the client opened a download link from their agreement page.",
    RECEIPT,
  );
  if (pack.downloads.length === 0)
    w.muted("The client hasn't downloaded any file.");
  for (const d of pack.downloads) {
    w.record(d.filename, `Downloaded ${formatStamp(d.requestedAt)}`, RECEIPT);
    w.field("SHA-256", d.sha256, { mono: true });
    if (d.userAgent) w.field("Browser", d.userAgent);
  }

  // 6. Timeline
  w.section(6, "Event timeline", "Every recorded step, oldest first.");
  if (pack.events.length === 0) w.muted("No events.");
  for (const e of pack.events) {
    w.ensure(28);
    w.text(`${formatStamp(e.at)}   ${eventTitle(e)}  (${e.actor})`, {
      size: 9,
    });
    if (e.reason) w.text(e.reason, { size: 8.5, color: MUTED, x: MARGIN + 14 });
  }

  // 7. Messages
  w.section(
    7,
    "Original messages",
    "The client's DM as pasted into DMpact, stored unchanged.",
  );
  const messages = [pack.sourceDm, ...pack.followUpDms.map((f) => f.message)];
  if (
    messages.some(
      (m) =>
        w.clean(m, fonts.mono) !==
        m.replace(/\r\n?/g, "\n").replace(/\t/g, "  "),
    )
  ) {
    w.muted(
      'Characters this PDF font can\'t show (emoji, non-Latin scripts) appear as "?". The original text is kept unchanged in DMpact.',
    );
    w.space(4);
  }
  w.text(pack.sourceDm || "-", { font: fonts.mono, size: 8.5 });
  for (const f of pack.followUpDms) {
    w.record("Follow-up message", formatStamp(f.createdAt));
    w.text(f.message, { font: fonts.mono, size: 8.5 });
  }

  w.footer(pack.commission.id, pack.generatedAt);
  return doc.save();
}
