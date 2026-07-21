import os
import datetime
from typing import Optional
from sqlalchemy.orm import Session

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing

from backend.database.models import Consultation, Patient, Doctor, Queue, Visit, MedicalReport, PrescriptionItem
from backend.services.disease_knowledge import disease_knowledge_service

REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "generated_reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

def generate_consultation_pdf(consultation_id: int, db: Session, force_regenerate: bool = False) -> str:
    """
    Generates a professional A4 Clinical Consultation PDF Report using ReportLab.
    Saves PDF to backend/generated_reports/CONSULTATION_<consultation_id>.pdf
    Returns the absolute filepath to the PDF file.
    """
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        raise ValueError(f"Consultation with ID {consultation_id} not found.")

    pdf_filename = f"CONSULTATION_{consultation_id}.pdf"
    pdf_path = os.path.join(REPORTS_DIR, pdf_filename)

    # Return existing PDF if available and not forced to regenerate
    if not force_regenerate and consultation.report_path and os.path.exists(consultation.report_path):
        return consultation.report_path

    patient = db.query(Patient).filter(Patient.id == consultation.patient_id).first()
    doctor = db.query(Doctor).filter(Doctor.id == consultation.doctor_id).first()

    # Load disease knowledge for AI recommendations summary
    disease_info = disease_knowledge_service.get_disease_info(consultation.diagnosis)

    # Fetch associated Visit, Prescriptions, and Medical Reports (Lab orders)
    visit = db.query(Visit).filter(
        Visit.patient_id == consultation.patient_id,
        Visit.doctor_id == consultation.doctor_id
    ).order_by(Visit.visit_date.desc()).first()

    prescriptions = []
    lab_reports = []
    if visit:
        prescriptions = db.query(PrescriptionItem).filter(PrescriptionItem.visit_id == visit.id).all()
        lab_reports = db.query(MedicalReport).filter(MedicalReport.visit_id == visit.id).all()

    # Document Setup
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom Color Palette
    PRIMARY = colors.HexColor('#0f172a')     # Dark Slate
    SECONDARY = colors.HexColor('#0284c7')   # Clinical Blue
    ACCENT = colors.HexColor('#059669')      # Emerald Green
    WARNING = colors.HexColor('#dc2626')     # Emergency Red
    BG_LIGHT = colors.HexColor('#f8fafc')    # Crisp Light Gray
    BORDER_COLOR = colors.HexColor('#e2e8f0')

    # Typography Styles
    title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=16, textColor=PRIMARY, spaceAfter=2)
    sub_title_style = ParagraphStyle('DocSubTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, textColor=SECONDARY, leading=10)
    section_heading_style = ParagraphStyle('SectionHeading', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=10, textColor=SECONDARY, spaceBefore=6, spaceAfter=4)
    body_style = ParagraphStyle('BodyTextCustom', parent=styles['Normal'], fontName='Helvetica', fontSize=8, textColor=colors.HexColor('#334155'), leading=11)
    bold_body_style = ParagraphStyle('BoldTextCustom', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, textColor=PRIMARY, leading=11)
    disclaimer_style = ParagraphStyle('DisclaimerText', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=7.5, textColor=colors.HexColor('#64748b'), leading=10)

    story = []

    # 1. HEADER SECTION & QR CODE
    qr_code = qr.QrCodeWidget(f"AQ-CONS-{consultation_id:06d}")
    bounds = qr_code.getBounds()
    w, h = bounds[2] - bounds[0], bounds[3] - bounds[1]
    qr_drawing = Drawing(48, 48, transform=[48/w, 0, 0, 48/h, 0, 0])
    qr_drawing.add(qr_code)

    created_time_str = consultation.created_at.strftime("%Y-%m-%d %H:%M:%S") if consultation.created_at else datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    header_text = f"""
    <b>ACURAQUEUE HEALTHCARE SYSTEM</b><br/>
    <font size=7 color="#64748b">100 Health Sciences Blvd, Medical District • Tel: +1 (800) 555-ACURA</font><br/>
    <font size=7 color="#0284c7"><b>CLINICAL CONSULTATION REPORT & MEDICAL SUMMARY</b></font>
    """

    header_meta = f"""
    <font size=7.5 color="#334155">
    <b>Report ID:</b> AQ-CONS-{consultation_id:06d}<br/>
    <b>Date/Time:</b> {created_time_str}<br/>
    <b>Status:</b> Completed
    </font>
    """

    header_table = Table([
        [Paragraph(header_text, title_style), Paragraph(header_meta, body_style), qr_drawing]
    ], colWidths=[280, 180, 60])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (2,0), (2,0), 'RIGHT')
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=SECONDARY, spaceAfter=8, spaceBefore=4))

    # 2. PATIENT & DOCTOR DEMOGRAPHICS TABLE
    patient_name = patient.name if patient else "N/A"
    patient_id_str = f"P-{patient.id:04d}" if patient else "N/A"
    age_gender = f"{patient.age or 'N/A'} yrs / {patient.gender or 'N/A'}" if patient else "N/A"
    blood_group = patient.blood_group if patient and hasattr(patient, 'blood_group') and patient.blood_group else "O+"
    mobile = patient.mobile_number if patient else "N/A"
    
    doctor_name = f"Dr. {doctor.name}" if doctor else "Attending Physician"
    department_name = doctor.department.name if doctor and doctor.department else "General Medicine"

    demo_data = [
        [
            Paragraph("<b>PATIENT INFORMATION</b>", sub_title_style),
            "",
            Paragraph("<b>CONSULTATION DETAILS</b>", sub_title_style),
            ""
        ],
        [
            Paragraph(f"<b>Name:</b> {patient_name}", body_style),
            Paragraph(f"<b>Patient ID:</b> {patient_id_str}", body_style),
            Paragraph(f"<b>Attending Doctor:</b> {doctor_name}", body_style),
            Paragraph(f"<b>Department:</b> {department_name}", body_style)
        ],
        [
            Paragraph(f"<b>Age / Gender:</b> {age_gender}", body_style),
            Paragraph(f"<b>Blood Group:</b> {blood_group}", body_style),
            Paragraph(f"<b>Room No:</b> {doctor.room_number if doctor else 'OPD-101'}", body_style),
            Paragraph(f"<b>Session Duration:</b> {consultation.duration_minutes} min", body_style)
        ],
        [
            Paragraph(f"<b>Contact:</b> {mobile}", body_style),
            Paragraph("<b>Emergency Contact:</b> +1 (555) 999-0000", body_style),
            Paragraph("<b>Visit Category:</b> Outpatient (OPD)", body_style),
            Paragraph(f"<b>Outcome:</b> {consultation.consultation_outcome or 'Discharge'}", bold_body_style)
        ]
    ]

    demo_table = Table(demo_data, colWidths=[130, 130, 130, 130])
    demo_table.setStyle(TableStyle([
        ('SPAN', (0,0), (1,0)),
        ('SPAN', (2,0), (3,0)),
        ('BACKGROUND', (0,0), (-1,0), BG_LIGHT),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(demo_table)
    story.append(Spacer(1, 8))

    # 3. CLINICAL SUMMARY & DIAGNOSIS
    story.append(Paragraph("CLINICAL DIAGNOSIS & CHIEF COMPLAINTS", section_heading_style))
    diag_data = [
        [Paragraph("<b>Chief Symptoms / Complaints:</b>", bold_body_style), Paragraph(consultation.symptoms or "None recorded", body_style)],
        [Paragraph("<b>Primary Diagnosis:</b>", bold_body_style), Paragraph(f"<b>{consultation.diagnosis}</b>", bold_body_style)],
        [Paragraph("<b>Clinical Evaluation Notes:</b>", bold_body_style), Paragraph(consultation.discharge_summary or "Patient evaluated during OPD session under standard clinical protocols.", body_style)]
    ]
    diag_table = Table(diag_data, colWidths=[140, 380])
    diag_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), BG_LIGHT),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(diag_table)
    story.append(Spacer(1, 8))

    # 4. PRESCRIPTION (Rx) TABLE
    story.append(Paragraph("PRESCRIBED MEDICATIONS (Rx)", section_heading_style))
    rx_header = [Paragraph("<b>Medicine</b>", bold_body_style), Paragraph("<b>Dosage</b>", bold_body_style), Paragraph("<b>Frequency</b>", bold_body_style), Paragraph("<b>Duration</b>", bold_body_style), Paragraph("<b>Instructions</b>", bold_body_style)]
    rx_rows = [rx_header]

    if prescriptions:
        for p in prescriptions:
            rx_rows.append([
                Paragraph(f"<b>{p.medicine_name}</b>", body_style),
                Paragraph(p.dosage or "As directed", body_style),
                Paragraph(p.frequency or "Daily", body_style),
                Paragraph(p.duration or "7 days", body_style),
                Paragraph(p.instructions or "With meals", body_style)
            ])
    elif consultation.prescription:
        for line in consultation.prescription.split('\n'):
            line_c = line.strip()
            if line_c:
                parts = [pt.strip() for pt in line_c.split(',')]
                rx_rows.append([
                    Paragraph(f"<b>{parts[0]}</b>", body_style),
                    Paragraph(parts[1] if len(parts)>1 else "As directed", body_style),
                    Paragraph(parts[2] if len(parts)>2 else "Daily", body_style),
                    Paragraph(parts[3] if len(parts)>3 else "7 days", body_style),
                    Paragraph(parts[4] if len(parts)>4 else "Follow instructions", body_style)
                ])
    else:
        rx_rows.append([Paragraph("No prescription items issued.", disclaimer_style), "", "", "", ""])

    rx_table = Table(rx_rows, colWidths=[150, 85, 95, 70, 120])
    rx_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BG_LIGHT),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(rx_table)
    story.append(Spacer(1, 8))

    # 5. LABORATORY ORDERS (IF ANY)
    if lab_reports:
        story.append(Paragraph("ORDERED LABORATORY INVESTIGATIONS", section_heading_style))
        lab_header = [Paragraph("<b>Test Name</b>", bold_body_style), Paragraph("<b>Clinical Reason / Indication</b>", bold_body_style), Paragraph("<b>Status</b>", bold_body_style)]
        lab_rows = [lab_header]
        for lr in lab_reports:
            lab_rows.append([
                Paragraph(f"<b>{lr.report_type}</b>", body_style),
                Paragraph(lr.file_path.replace("ORDERED: ", "") if lr.file_path else "Diagnostic validation", body_style),
                Paragraph("Requested", bold_body_style)
            ])
        lab_table = Table(lab_rows, colWidths=[160, 260, 100])
        lab_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), BG_LIGHT),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(lab_table)
        story.append(Spacer(1, 8))

    # 6. CONSULTATION DISPOSITION & OUTCOME DETAILS
    story.append(Paragraph("CONSULTATION OUTCOME & DISPOSITION", section_heading_style))
    outcome = consultation.consultation_outcome or "Discharge"
    disp_details = "Patient cleared to leave with home care instructions."
    if outcome == "Follow-up":
        disp_details = f"Follow-up Date: {consultation.followup_date or 'Next Week'} at {consultation.followup_time or '10:00 AM'} ({consultation.followup_priority or 'Routine'}) | Reason: {consultation.followup_reason or 'Progress review'}"
    elif outcome == "Admit":
        disp_details = f"Inpatient Admission to {consultation.ward or 'General Ward'} (Expected Stay: {consultation.expected_stay or 'N/A'}, Bed: {consultation.bed_number or 'Unassigned'}) | Indication: {consultation.admission_reason or 'Inpatient monitoring'}"
    elif outcome == "Refer":
        disp_details = f"Specialist Referral to {consultation.referral_department or 'Specialist Clinic'} (Dr. {consultation.referral_doctor or 'Attending Specialist'}) | Reason: {consultation.referral_reason or 'Specialist evaluation'}"
    elif consultation.patient_instructions:
        disp_details = consultation.patient_instructions

    disp_data = [
        [Paragraph("<b>Disposition Status:</b>", bold_body_style), Paragraph(f"<b>{outcome}</b>", bold_body_style)],
        [Paragraph("<b>Clinical Instructions:</b>", bold_body_style), Paragraph(disp_details, body_style)]
    ]
    disp_table = Table(disp_data, colWidths=[140, 380])
    disp_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), BG_LIGHT),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(disp_table)
    story.append(Spacer(1, 8))

    # 7. AI CLINICAL DECISION SUPPORT & LIFESTYLE GUIDANCE
    story.append(Paragraph("AI CLINICAL DECISION SUPPORT & LIFESTYLE GUIDANCE", section_heading_style))
    prec_str = ", ".join(disease_info.get("precautions", ["Rest & maintain hydration"]))
    diet_str = disease_info.get("diet", {}).get("recommended", "Balanced nutritious diet") if isinstance(disease_info.get("diet"), dict) else str(disease_info.get("diet"))
    workout_str = str(disease_info.get("workout", "30-minute daily light activity"))

    ai_data = [
        [Paragraph("<b>Recommended Precautions:</b>", bold_body_style), Paragraph(prec_str, body_style)],
        [Paragraph("<b>Nutritional Guidance:</b>", bold_body_style), Paragraph(diet_str, body_style)],
        [Paragraph("<b>Physical Exercise:</b>", bold_body_style), Paragraph(workout_str, body_style)],
        [Paragraph("<b>Disclaimer:</b>", disclaimer_style), Paragraph("<i>AI Clinical Decision Support. The treating physician makes the final clinical decision.</i>", disclaimer_style)]
    ]
    ai_table = Table(ai_data, colWidths=[140, 380])
    ai_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), BG_LIGHT),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(ai_table)
    story.append(Spacer(1, 8))

    # 8. EMERGENCY WARNING SIGNS BOX
    warning_html = """
    <b>EMERGENCY WARNING SIGNS - SEEK IMMEDIATE MEDICAL ATTENTION IF YOU EXPERIENCE:</b><br/>
    • Sudden Severe Chest Pain or Pressure • Acute Difficulty Breathing or Shortness of Breath<br/>
    • Sudden Loss of Consciousness or Confusion • Persistent High Fever Unresponsive to Medication
    """
    warning_table = Table([[Paragraph(warning_html, ParagraphStyle('WarnText', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#991b1b'), leading=10))]], colWidths=[520])
    warning_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#fef2f2')),
        ('BORDER', (0,0), (-1,-1), 1, colors.HexColor('#fca5a5')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(warning_table)
    story.append(Spacer(1, 14))

    # 9. SIGNATURE & FOOTER AREA
    sig_data = [
        [
            Paragraph("___________________________________<br/><b>Attending Physician Signature</b><br/><font size=7 color='#64748b'>Licensed Medical Practitioner</font>", body_style),
            Paragraph("___________________________________<br/><b>Hospital Official Seal & Date</b><br/><font size=7 color='#64748b'>AcuraQueue Clinical Services</font>", body_style)
        ]
    ]
    sig_table = Table(sig_data, colWidths=[260, 260])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (0,0), 'LEFT'),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
    ]))
    story.append(KeepTogether(sig_table))

    # Build Document
    doc.build(story)

    # Update database record
    consultation.report_path = pdf_path
    consultation.generated_at = datetime.datetime.utcnow()
    db.commit()

    print(f"[PDFReportService] PDF generated successfully for Consultation #{consultation_id} at {pdf_path}")
    return pdf_path
