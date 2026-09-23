import { jsPDF } from "jspdf";
import {pdfRegular,pdfBold} from "./pdf-fonts";
import type {PavilionDrawings} from '@/components/pavilion/review-drawings';

export interface QuotePdfData {
  drawings?: PavilionDrawings;
  specs?: [string,string][];
  projectName?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    fulfillment: string;
    notes?: string;
  };
  quote: {
    model?: string;
    trussStyle?: string;
    roofStyle?: string;
    size?: string;
    postHeight?: string;
    timberFinish?: string;
    beamStain?: string;
    deckboardStain?: string;
    roofMaterial?: string;
    rafterTail?: string;
    snowGuards?: boolean;
    upgrades?: string[];
    lineItems?: { label: string; amount: string }[];
    total?: string;
    priceNote?: string;
    pending?: string[];
  };
}

// Brand palette (matches the configurator)
const BRAND: [number, number, number] = [25, 51, 44];        // #19332c
const BRAND_DARK: [number, number, number] = [185, 141, 68];    // #b98d44
const INK: [number, number, number] = [21, 18, 14];           // #15120e
const INK_SOFT: [number, number, number] = [60, 54, 47];
const MUTED: [number, number, number] = [120, 113, 102];
const RULE: [number, number, number] = [230, 225, 216];       // #e6e1d8
const PANEL: [number, number, number] = [250, 247, 241];      // #faf7f1
const WHITE: [number, number, number] = [255, 255, 255];

const setFill = (doc: jsPDF, c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
const setText = (doc: jsPDF, c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
const setDraw = (doc: jsPDF, c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

export function generateQuotePdf(data: QuotePdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.addFileToVFS("KSM-Regular.ttf",pdfRegular);doc.addFont("KSM-Regular.ttf","KSM","normal");
  doc.addFileToVFS("KSM-Bold.ttf",pdfBold);doc.addFont("KSM-Bold.ttf","KSM","bold");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 54;
  const contentW = pageW - margin * 2;
  let y = 0;

  // ============= HEADER BAND =============
  const headerH = 88;
  setFill(doc, BRAND);
  doc.rect(0, 0, pageW, headerH, "F");
  // accent strip
  setFill(doc, BRAND_DARK);
  doc.rect(0, headerH, pageW, 4, "F");

  // Brand mark
  setText(doc, WHITE);
  doc.setFont("KSM", "bold");
  doc.setFontSize(9);
  doc.text("KSM LOG HOMES CO.", margin, 34, {  });

  doc.setFont("KSM", "bold");
  doc.setFontSize(22);
  doc.text("Pavilion Estimate", margin, 62);

  // Right-aligned meta in header
  doc.setFont("KSM", "normal");
  doc.setFontSize(8.5);
  doc.text("CUSTOM MADE EASY", pageW - margin, 34, { align: "right",  });
  doc.setFontSize(9);
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.text(dateStr, pageW - margin, 50, { align: "right" });
  if (data.projectName) {
    doc.setFont("KSM", "bold");
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(data.projectName, 220).slice(0, 1), pageW - margin, 66, { align: "right" });
  }

  y = headerH + 4 + 28;

  // ============= LAYOUT HELPERS =============
  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 70) {
      doc.addPage();
      y = margin;
    }
  };

  const sectionHeader = (title: string) => {
    ensureSpace(34);
    setDraw(doc, BRAND);
    doc.setLineWidth(2);
    doc.line(margin, y, margin + 22, y);
    doc.setFont("KSM", "bold");
    doc.setFontSize(9.5);
    setText(doc, BRAND);
    doc.text(title.toUpperCase(), margin + 30, y + 3, {  });
    y += 18;
  };

  const kvList = (rows: Array<[string, string]>, opts?: { twoCol?: boolean }) => {
    const twoCol = opts?.twoCol ?? false;
    if (twoCol) {
      const colW = (contentW - 24) / 2;
      const labelW = 96;
      const rowH = 19;
      const rowsPerCol = Math.ceil(rows.length / 2);
      ensureSpace(rowsPerCol * rowH + 4);
      doc.setFontSize(9.5);
      rows.forEach((row, i) => {
        const col = Math.floor(i / rowsPerCol);
        const idx = i % rowsPerCol;
        const x = margin + col * (colW + 24);
        const ry = y + idx * rowH;
        setText(doc, MUTED);
        doc.setFont("KSM", "normal");
        doc.text(row[0].toUpperCase(), x, ry, {  });
        setText(doc, INK);
        doc.setFont("KSM", "bold");
        const valLines = doc.splitTextToSize(row[1], colW - labelW);
        doc.text(valLines, x + labelW, ry);
      });
      y += rowsPerCol * rowH + 6;
    } else {
      const labelW = 130;
      doc.setFontSize(10);
      for (const [k, v] of rows) {
        const valLines = doc.splitTextToSize(v, contentW - labelW);
        const rowH = Math.max(18, valLines.length * 13);
        ensureSpace(rowH);
        setText(doc, MUTED);
        doc.setFont("KSM", "normal");
        doc.setFontSize(8.5);
        doc.text(k.toUpperCase(), margin, y, {  });
        setText(doc, INK);
        doc.setFont("KSM", "bold");
        doc.setFontSize(10);
        doc.text(valLines, margin + labelW, y);
        y += rowH;
      }
      y += 4;
    }
  };

  // ============= CUSTOMER =============
  sectionHeader("Customer");
  kvList(
    [
      ["Name", data.customer.name],
      ["Email", data.customer.email],
      ["Phone", data.customer.phone],
      ["Delivery / Pickup", data.customer.fulfillment],
    ],
    { twoCol: false },
  );
  y += 6;

  // ============= BUILD DETAILS =============
  sectionHeader("Build Details");

  // Highlight: Model + Size hero card
  const heroH = 64;
  ensureSpace(heroH + 8);
  setFill(doc, PANEL);
  setDraw(doc, RULE);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, contentW, heroH, 6, 6, "FD");

  setText(doc, MUTED);
  doc.setFont("KSM", "normal");
  doc.setFontSize(8);
  doc.text("MODEL", margin + 16, y + 18, {  });
  setText(doc, INK);
  doc.setFont("KSM", "bold");
  doc.setFontSize(14);
  doc.setFontSize(12);
  doc.text(doc.splitTextToSize(data.quote.model ?? "Custom Pavilion", 300).slice(0,2), margin + 16, y + 38);

  // size on right
  setText(doc, MUTED);
  doc.setFont("KSM", "normal");
  doc.setFontSize(8);
  doc.text("SIZE", pageW - margin - 16, y + 18, { align: "right",  });
  setText(doc, BRAND);
  doc.setFont("KSM", "bold");
  doc.setFontSize(18);
  doc.text(data.quote.size ?? "—", pageW - margin - 16, y + 40, { align: "right" });
  if (data.quote.postHeight) {
    setText(doc, MUTED);
    doc.setFont("KSM", "normal");
    doc.setFontSize(9);
    doc.text(`${data.quote.postHeight} post height`, pageW - margin - 16, y + 54, {
      align: "right",
    });
  }

  y += heroH + 16;

  // Two-column spec grid
  const specRows: Array<[string, string]> = [];
  const push = (k: string, v?: string) => {
    if (v) specRows.push([k, v]);
  };
  push("Truss Style", data.quote.trussStyle);
  push("Roof Style", data.quote.roofStyle);
  push("Wood Species", "Eastern White Pine");
  push("Timber Finish", data.quote.timberFinish);
  push("Roof Material", data.quote.roofMaterial);
  push("Beam Stain", data.quote.beamStain);
  push("Deckboard Stain", data.quote.deckboardStain);
  push("Rafter Tail", data.quote.rafterTail);
  push(
    "Snow Guards",
    data.quote.snowGuards == null ? undefined : data.quote.snowGuards ? "Included" : "No",
  );
  if (specRows.length) kvList(data.specs||specRows, { twoCol: false });

  // ============= UPGRADES =============
  if (data.quote.upgrades && data.quote.upgrades.length > 0) {
    y += 6;
    sectionHeader("Upgrades & Options");
    doc.setFont("KSM", "normal");
    doc.setFontSize(10);
    setText(doc, INK_SOFT);
    for (const u of data.quote.upgrades) {
      const lines = doc.splitTextToSize(u, contentW - 18);
      const rowH = Math.max(15, lines.length * 13);
      ensureSpace(rowH);
      setFill(doc, BRAND);
      doc.circle(margin + 3, y - 3.5, 1.8, "F");
      setText(doc, INK_SOFT);
      doc.text(lines, margin + 14, y);
      y += rowH;
    }
    y += 4;
  }

  // ============= PRICING =============
  if ((data.quote.lineItems && data.quote.lineItems.length > 0) || data.quote.total) {
    y += 6;
    sectionHeader("Pricing");

    if (data.quote.lineItems && data.quote.lineItems.length > 0) {
      doc.setFont("KSM", "normal");
      doc.setFontSize(10);
      for (const li of data.quote.lineItems) {
        const labelLines = doc.splitTextToSize(li.label, contentW - 110);
        const rowH = Math.max(18, labelLines.length * 13);
        ensureSpace(rowH);
        setText(doc, INK_SOFT);
        doc.text(labelLines, margin, y);
        setText(doc, INK);
        doc.setFont("KSM", "bold");
        doc.text(li.amount, margin + contentW, y, { align: "right" });
        doc.setFont("KSM", "normal");
        // dotted leader
        setDraw(doc, RULE);
        doc.setLineDashPattern([1, 2], 0);
        doc.setLineWidth(0.4);
        doc.line(margin, y + rowH - 4, margin + contentW, y + rowH - 4);
        doc.setLineDashPattern([], 0);
        y += rowH;
      }
      y += 4;
    }

    if (data.quote.total) {
      const boxH = 44;
      ensureSpace(boxH + 6);
      setFill(doc, INK);
      doc.roundedRect(margin, y, contentW, boxH, 6, 6, "F");
      setText(doc, WHITE);
      doc.setFont("KSM", "normal");
      doc.setFontSize(9);
      doc.text(data.quote.pending?.length?'PRICED SUBTOTAL':'ESTIMATED TOTAL', margin + 18, y + 18, {  });
      doc.setFont("KSM", "bold");
      doc.setFontSize(18);
      doc.text(data.quote.total, pageW - margin - 18, y + 28, { align: "right" });
      if (data.quote.priceNote) {
        doc.setFont("KSM", "normal");
        doc.setFontSize(8.5);
        setText(doc, [200, 195, 188]);
        doc.text(data.quote.priceNote.toUpperCase(), pageW - margin - 18, y + 40, {
          align: "right",
          
        });
      }
      y += boxH + 8;
    }
  }

  if(data.quote.pending?.length){
    y+=12;sectionHeader('Items awaiting pricing');
    doc.setFont('KSM','normal');doc.setFontSize(10);setText(doc,INK_SOFT);
    for(const item of data.quote.pending){for(const line of doc.splitTextToSize(item,contentW)){ensureSpace(14);doc.text(line,margin,y);y+=14}y+=4}
  }

  // ============= NOTES =============
  if (data.customer.notes) {
    y += 4;
    sectionHeader("Notes");
    doc.setFont("KSM", "normal");
    doc.setFontSize(10);
    setText(doc, INK_SOFT);
    const lines = doc.splitTextToSize(data.customer.notes, contentW);
    for(const line of lines){ensureSpace(14);doc.setFontSize(10);setText(doc,INK_SOFT);doc.text(line,margin,y);y+=13;}
  }

  if(data.drawings){
    const d=data.drawings;
    const drawingPage=(title:string)=>{doc.addPage();y=54;sectionHeader(title);doc.setFont('KSM','normal');doc.setFontSize(9);setText(doc,INK_SOFT);doc.text(`${data.quote.size||''} · ${data.quote.trussStyle||'Pavilion'} · ${data.quote.postHeight||''} posts`,margin,y);y+=20};
    const image=(src:string,label:string,x:number,top:number,w:number,h:number)=>{doc.addImage(src,src.startsWith('data:image/png')?'PNG':'JPEG',x,top,w,h);doc.setFont('KSM','bold');doc.setFontSize(10);setText(doc,BRAND);doc.text(label,x+w/2,top+h+16,{align:'center'})};
    drawingPage('Pavilion perspectives');
    image(d.perspective,'Front perspective',90,100,432,288);image(d.rearPerspective,'Rear perspective',90,425,432,288);
    drawingPage('Exterior elevations');
    image(d.front,'Front',54,125,244,244/1.5);image(d.rear,'Rear',314,125,244,244/1.5);
    image(d.left,'Left side',54,350,244,244/1.5);image(d.right,'Right side',314,350,244,244/1.5);
    doc.setFont('KSM','normal');doc.setFontSize(9);setText(doc,INK_SOFT);doc.text(doc.splitTextToSize('All four elevations use the same scale. Roof overhangs extend beyond the nominal pavilion size. Use stated dimensions; do not scale these views.',504),54,575);
    drawingPage('Dimensioned post and truss plan');image(d.plan,'Pavilion framing layout',54,125,504,504*960/1230);
    doc.setFont('KSM','normal');doc.setFontSize(9);setText(doc,INK_SOFT);doc.text(doc.splitTextToSize('Width is measured across the outside post faces. Length and bay dimensions follow end-post centers. Roof overhangs and furniture are omitted from the framing plan. Illustrative configuration only; not an engineered construction or foundation drawing.',504),54,570);
  }

  // ============= FOOTER ON ALL PAGES =============
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, pageW, pageH, i, total);
  }

  return doc;
}

function drawFooter(doc: jsPDF, pageW: number, pageH: number, page?: number, total?: number) {
  const footerY = pageH - 40;
  setDraw(doc, RULE);
  doc.setLineWidth(0.6);
  doc.line(54, footerY, pageW - 54, footerY);
  setText(doc, MUTED);
  doc.setFont("KSM", "normal");
  doc.setFontSize(8);
  doc.text(
    "Estimate excludes tax and delivery. KSM confirms final pricing.",
    54,
    footerY + 14,
  );
  doc.text("ksmloghomes.com", 54, footerY + 26);
  if (page && total) {
    doc.text(`Page ${page} of ${total}`, pageW - 54, footerY + 14, { align: "right" });
  }
}

export function downloadQuotePdf(data: QuotePdfData) {
  const doc = generateQuotePdf(data);
  const safe = (data.projectName || data.customer.name || "pavilion-quote")
    .replace(/[^a-z0-9\-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  doc.save(`${safe || "pavilion-quote"}.pdf`);
}
