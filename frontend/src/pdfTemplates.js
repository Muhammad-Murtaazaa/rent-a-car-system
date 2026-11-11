import { jsPDF } from "jspdf";

function hexToRgb(hex) {
  const clean = (hex || "#e68a1e").replace("#", "");
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16)
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16)
    ];
  }
  return [230, 138, 30];
}

async function loadLogoDataUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getAgencyInfo(branding) {
  const s = branding?.branding_settings || {};
  return {
    name: branding?.name || "Rent A Car Management System",
    logo_url: branding?.logo_url || "",
    tagline: s.tagline || "TOURS & TRAVELS",
    address: s.address || "Lahore, Pakistan",
    phone: s.support_phone || "0300-1234567",
    email: s.support_email || "support@rentacarmanagement.com",
    website: s.website || "racms.omnysync.com",
    ntn: s.ntn || "",
    bank_name: s.bank_name || "",
    account_title: s.account_title || branding?.name || "Rent A Car Management System",
    account_number: s.account_number || "",
    sign_label: s.sign_label || "sign",
    terms: s.terms_and_conditions || "By accepting this invoice, you agree to the rental period, payment terms, security deposit, responsible vehicle use, damage responsibility, maintenance coverage, insurance terms, liability waiver, cancellation policy, and dispute resolution.",
    accentRgb: hexToRgb(s.pdf_accent_color || "#e68a1e")
  };
}

function drawDocChrome(doc, titleTop, titleBottom, agency, logoDataUrl) {
  const [r, g, b] = agency.accentRgb;

  // Top-left slanted accent ribbon
  doc.setFillColor(r, g, b);
  doc.triangle(0, 0, 115, 0, 103, 10, "F");
  doc.rect(0, 0, 103, 10, "F");

  // Optional Logo + Agency Title & Address (Top Left)
  let textX = 18;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 18, 17, 22, 16, undefined, "FAST");
      textX = 44;
    } catch {
      textX = 18;
    }
  }
  doc.setTextColor(25, 25, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(agency.name.toUpperCase(), textX, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 90);
  doc.text(agency.address, textX, 32);

  // Document Main Title (Top Right)
  doc.setTextColor(25, 25, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(titleTop, 192, 24, { align: "right" });
  doc.setFontSize(22);
  doc.text(titleBottom, 192, 33, { align: "right" });
}

function drawFooter(doc, agency, termsText) {
  const [r, g, b] = agency.accentRgb;

  // Terms & Conditions (Bottom Left)
  doc.setTextColor(25, 25, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TERMS & CONDITIONS:", 18, 240);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(70, 70, 80);
  const splitTerms = doc.splitTextToSize(termsText || agency.terms, 98);
  doc.text(splitTerms, 18, 246);

  // Thank You! (Bottom Right)
  doc.setTextColor(r, g, b);
  doc.setFont("times", "bolditalic");
  doc.setFontSize(34);
  doc.text("Thank You!", 190, 260, { align: "right" });

  // Bottom bar (Dark + Accent Slant)
  doc.setFillColor(30, 30, 34);
  doc.rect(0, 281, 138, 16, "F");
  doc.setFillColor(r, g, b);
  doc.triangle(126, 297, 138, 281, 210, 281, "F");
  doc.rect(138, 281, 72, 16, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${agency.website}      ${agency.phone}`, 18, 291);
}

// 1. OFFICIAL LETTERHEAD PDF (Matches PDF 1)
export async function generateLetterheadPDF(letter, branding) {
  const doc = new jsPDF();
  const agency = getAgencyInfo(branding);
  const [r, g, b] = agency.accentRgb;
  const logoDataUrl = await loadLogoDataUrl(agency.logo_url);

  // Top accent banner
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, 210, 56, "F");

  // Bold dark geometric stripes on left
  doc.setFillColor(20, 20, 22);
  doc.triangle(0, 0, 38, 0, 62, 56, "F");
  doc.triangle(0, 0, 0, 56, 38, 56, "F");
  doc.setFillColor(r, g, b);
  doc.triangle(18, 0, 30, 0, 48, 44, "F");
  doc.triangle(18, 0, 36, 44, 48, 44, "F");

  // Agency Name & Tagline
  const titleRight = logoDataUrl ? 168 : 194;
  doc.setTextColor(20, 20, 22);
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.text(agency.name.toUpperCase(), 64, 18, { maxWidth: titleRight - 64 });
  doc.setFontSize(15);
  doc.text((agency.tagline || "TOURS & TRAVELS").toUpperCase(), 64, 27);

  // Optional Logo top-right
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 174, 8, 26, 20, undefined, "FAST");
    } catch {
      // ignore invalid image
    }
  }

  // Contact Details
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(agency.website, 126, 39, { align: "right" });
  doc.text(agency.phone, 194, 39, { align: "right" });
  doc.text(agency.address, 126, 47, { align: "right" });
  doc.text(agency.email, 194, 47, { align: "right" });

  // Letter Body
  doc.setTextColor(30, 30, 35);
  let y = 74;
  if (letter?.letter_number || letter?.letter_date) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    if (letter.letter_number) doc.text(`Ref: ${letter.letter_number}`, 18, y);
    if (letter.letter_date) doc.text(`Date: ${letter.letter_date}`, 192, y, { align: "right" });
    y += 12;
  }
  if (letter?.recipient) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("To:", 18, y);
    doc.setFont("helvetica", "normal");
    doc.text(letter.recipient, 28, y);
    y += 10;
  }
  if (letter?.subject) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Subject: ${letter.subject}`, 18, y);
    y += 12;
  }
  if (letter?.body) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(letter.body, 174);
    doc.text(lines, 18, y);
  }

  // Signature line bottom-left
  doc.setTextColor(20, 20, 22);
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  const sigText = agency.sign_label || "sign";
  doc.text(sigText, 18, 255);
  const sigWidth = doc.getTextWidth(sigText);
  doc.setLineWidth(0.7);
  doc.line(20 + sigWidth, 256, 62 + sigWidth, 256);

  // Bottom accent bar with dark geometric right blocks
  doc.setFillColor(r, g, b);
  doc.rect(0, 274, 210, 23, "F");
  doc.setFillColor(20, 20, 22);
  doc.triangle(138, 274, 158, 274, 174, 297, "F");
  doc.triangle(138, 274, 154, 297, 174, 297, "F");
  doc.triangle(166, 274, 194, 274, 206, 297, "F");
  doc.triangle(166, 274, 178, 297, 206, 297, "F");

  const fname = letter?.letter_number ? `Letterhead_${letter.letter_number}.pdf` : "Official_Letterhead.pdf";
  doc.save(fname);
}

// 2. VEHICLES QUOTATION PDF (Matches PDF 2)
export async function generateVehiclesQuotationPDF(q, branding) {
  const doc = new jsPDF();
  const agency = getAgencyInfo(branding);
  const [r, g, b] = agency.accentRgb;
  const logoDataUrl = await loadLogoDataUrl(agency.logo_url);

  drawDocChrome(doc, "VEHICLES", "QUOTATION", agency, logoDataUrl);

  // Quotation To (Left) & From (Right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(25, 25, 28);
  doc.text("Quotation To:", 18, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(q.company_name || q.customer_name || "Valued Client", 18, 61);
  if (q.customer_phone) {
    doc.setFontSize(9.5);
    doc.setTextColor(80, 80, 90);
    doc.text(q.customer_phone, 18, 68);
  }

  doc.setTextColor(25, 25, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("From:", 192, 52, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(agency.name, 192, 59, { align: "right" });
  doc.text(agency.phone, 192, 65, { align: "right" });
  doc.text(agency.address, 192, 71, { align: "right" });
  if (agency.ntn) doc.text(`NTN: ${agency.ntn}`, 192, 77, { align: "right" });

  // Table Header: NAME | DAYS | AMOUNT
  let y = 88;
  doc.setFillColor(r, g, b);
  doc.rect(18, y, 174, 11, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("NAME", 24, y + 7.5);
  doc.text("DAYS", 125, y + 7.5, { align: "center" });
  doc.text("AMOUNT", 172, y + 7.5, { align: "center" });
  y += 11;

  const items = Array.isArray(q.items) && q.items.length > 0
    ? q.items
    : [{ name: q.vehicle_description, days_label: `${q.days || 1} Day(s)`, amount: q.total_amount }];

  doc.setTextColor(25, 25, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);

  items.forEach((item) => {
    doc.setDrawColor(90, 90, 95);
    doc.setLineWidth(0.25);
    doc.rect(18, y, 86, 10);
    doc.rect(104, y, 42, 10);
    doc.rect(146, y, 46, 10);
    doc.text(String(item.name || ""), 22, y + 6.8);
    doc.text(String(item.days_label || item.period || "Per Day"), 125, y + 6.8, { align: "center" });
    doc.text(Number(item.amount || 0).toLocaleString(), 169, y + 6.8, { align: "center" });
    y += 10;
  });

  if (q.valid_until) {
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 100);
    doc.text(`Quote #${q.quote_number || q.id} · Valid Until: ${q.valid_until}`, 18, y + 10);
  }

  drawFooter(doc, agency, q.notes || agency.terms);
  doc.save(`Quotation_${q.quote_number || q.id}_${(q.company_name || q.customer_name || "Client").replace(/\s+/g, "_")}.pdf`);
}

// 3. VEHICLES INVOICE PDF — Client Invoice & Owner/Settlement Invoice (Matches PDF 3, 4 & 5)
export async function generateVehiclesInvoicePDF(inv, branding) {
  const doc = new jsPDF();
  const agency = getAgencyInfo(branding);
  const [r, g, b] = agency.accentRgb;
  const logoDataUrl = await loadLogoDataUrl(agency.logo_url);

  drawDocChrome(doc, "VEHICLES", "INVOICE", agency, logoDataUrl);

  // Invoice To (Left) & From (Right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(25, 25, 28);
  doc.text("Invoice To:", 18, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(inv.invoice_to || "Client", 18, 60);
  if (inv.period_label) {
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 70);
    doc.text(inv.period_label, 18, 67);
  }

  doc.setTextColor(25, 25, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("From:", 192, 52, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(agency.name, 192, 59, { align: "right" });
  doc.text(agency.phone, 192, 65, { align: "right" });
  doc.text(agency.address, 192, 71, { align: "right" });
  if (agency.ntn) doc.text(`NTN: ${agency.ntn}`, 192, 77, { align: "right" });

  // Vehicles Table: NAME | DAYS/MONTH | AMOUNT
  let y = 86;
  const periodColHeader = inv.period_label && inv.period_label.toLowerCase().includes("month") ? "MONTH" : "DAYS";
  doc.setFillColor(r, g, b);
  doc.rect(18, y, 174, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("NAME", 24, y + 6.8);
  doc.text(periodColHeader, 128, y + 6.8, { align: "center" });
  doc.text("AMOUNT", 172, y + 6.8, { align: "center" });
  y += 10;

  doc.setTextColor(25, 25, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const vehicles = inv.vehicle_items || [];
  vehicles.forEach((v) => {
    doc.setDrawColor(90, 90, 95);
    doc.setLineWidth(0.25);
    doc.rect(18, y, 90, 9.5);
    doc.rect(108, y, 42, 9.5);
    doc.rect(150, y, 42, 9.5);
    doc.text(String(v.name || ""), 22, y + 6.5);
    doc.text(String(v.period || ""), 129, y + 6.5, { align: "center" });
    doc.text(Number(v.amount || 0).toLocaleString(), 171, y + 6.5, { align: "center" });
    y += 9.5;
  });

  // Vehicles TOTAL row
  doc.setFont("helvetica", "bold");
  doc.rect(18, y, 132, 9.5);
  doc.rect(150, y, 42, 9.5);
  doc.text("TOTAL", 22, y + 6.5);
  doc.text(Number(inv.total_rent || 0).toLocaleString(), 171, y + 6.5, { align: "center" });
  y += 9.5;

  // Expense Table (if settlement mode or expenses present)
  const expenses = inv.expense_items || [];
  if (expenses.length > 0) {
    doc.setFillColor(r, g, b);
    doc.rect(18, y, 174, 9.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.text("EXPENSE", 105, y + 6.5, { align: "center" });
    y += 9.5;

    doc.setTextColor(25, 25, 28);
    doc.setFont("helvetica", "normal");
    expenses.forEach((exp) => {
      doc.rect(18, y, 132, 9.5);
      doc.rect(150, y, 42, 9.5);
      doc.text(String(exp.description || ""), 22, y + 6.5);
      doc.text(Number(exp.amount || 0).toLocaleString(), 171, y + 6.5, { align: "center" });
      y += 9.5;
    });

    doc.setFont("helvetica", "bold");
    doc.rect(18, y, 132, 9.5);
    doc.rect(150, y, 42, 9.5);
    doc.text("TOTAL", 22, y + 6.5);
    doc.text(Number(inv.total_expense || 0).toLocaleString(), 171, y + 6.5, { align: "center" });
    y += 12;
  } else {
    y += 10;
  }

  const boxY = Math.max(y + 4, 178);

  // Account Details Box (Bottom Left above Terms, if enabled)
  if (inv.show_bank_details && (inv.bank_name || agency.bank_name || inv.account_number || agency.account_number)) {
    doc.setFillColor(r, g, b);
    doc.roundedRect(32, boxY + 6, 56, 8, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Account Details", 60, boxY + 11.5, { align: "center" });

    doc.setTextColor(25, 25, 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const bName = inv.bank_name || agency.bank_name;
    const aTitle = inv.account_title || agency.account_title;
    const aNum = inv.account_number || agency.account_number;
    if (bName) doc.text(`Bank Name: ${bName}`, 60, boxY + 21, { align: "center" });
    if (aTitle) doc.text(`Account Title: ${aTitle}`, 60, boxY + 27, { align: "center" });
    if (aNum) doc.text(`Account No: ${aNum}`, 60, boxY + 33, { align: "center" });
  }

  // Right Accent Summary Card
  doc.setFillColor(r, g, b);
  doc.rect(100, boxY, 92, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);

  if (inv.invoice_mode === "settlement" || expenses.length > 0) {
    doc.text("Total Rent", 108, boxY + 10);
    doc.text(Number(inv.total_rent || 0).toLocaleString(), 184, boxY + 10, { align: "right" });
    doc.text("Expense", 108, boxY + 19);
    doc.text(Number(inv.total_expense || 0).toLocaleString(), 184, boxY + 19, { align: "right" });
    doc.text("Payable Amount", 108, boxY + 28);
    doc.text(Number(inv.payable_or_balance || 0).toLocaleString(), 184, boxY + 28, { align: "right" });
  } else {
    doc.text("Total", 108, boxY + 10);
    doc.text(Number(inv.total_rent || 0).toLocaleString(), 184, boxY + 10, { align: "right" });
    doc.text("Received", 108, boxY + 19);
    doc.text(Number(inv.received_amount || 0).toLocaleString(), 184, boxY + 19, { align: "right" });
    doc.text("Balance", 108, boxY + 28);
    doc.text(Number(inv.payable_or_balance || 0).toLocaleString(), 184, boxY + 28, { align: "right" });
  }

  drawFooter(doc, agency, inv.terms_text || agency.terms);
  doc.save(`Invoice_${inv.invoice_number || inv.id}_${(inv.invoice_to || "Client").replace(/\s+/g, "_")}.pdf`);
}
