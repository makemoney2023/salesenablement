#!/usr/bin/env python3
"""
Generate a well-formatted Word document for Chiropractor Channel Content
"""

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import fitz  # PyMuPDF
import os

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, 'b2b_sales_enablement', 'wordtracks', 'practitioners_docx')
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'Chiropractors_Channel_Content.docx')
STUDIES_DIR = os.path.join(BASE_DIR, 'Studies')
IMAGES_DIR = os.path.join(OUTPUT_DIR, 'study_images')

# Study PDF files
STUDY_PDFS = {
    'freedom': '2025-RCT-RESTORE-PAIN-STUDY.pdf',
    'rem': '2.-IMPROVED-SLEEP-Improving-sleep-and-quality-of-life-after-use-of-a-haptic-vibrotactile-trigger-technology-drugfree-topical-patch-results-from-the-2711.pdf',
    'liberty': '3.-BALANCE-AND-STABILITY-Improvement-in-Balance-and-Stability-Using-a-Novel-Sensory-Application-Haptic-Vibrotactile-Trigger-Technology.pdf',
}

# Brand colors
BRAND_BLUE = RGBColor(0, 82, 147)
BRAND_DARK = RGBColor(33, 37, 41)
BRAND_ACCENT = RGBColor(0, 123, 255)

def extract_pdf_top_portion(pdf_path, output_path, crop_ratio=0.4):
    """Extract the top portion of the first page of a PDF as an image"""
    try:
        doc = fitz.open(pdf_path)
        page = doc[0]  # First page
        
        # Get page dimensions
        rect = page.rect
        
        # Crop to top portion (crop_ratio of the page height)
        crop_rect = fitz.Rect(rect.x0, rect.y0, rect.x1, rect.y0 + (rect.height * crop_ratio))
        
        # Render at higher resolution for quality
        mat = fitz.Matrix(2, 2)  # 2x zoom
        pix = page.get_pixmap(matrix=mat, clip=crop_rect)
        
        pix.save(output_path)
        doc.close()
        print(f"  Created: {output_path}")
        return True
    except Exception as e:
        print(f"  Error extracting from {pdf_path}: {e}")
        return False

def setup_study_images():
    """Extract study images from PDFs"""
    os.makedirs(IMAGES_DIR, exist_ok=True)
    
    study_images = {}
    print("Extracting study images...")
    
    for study_key, pdf_name in STUDY_PDFS.items():
        pdf_path = os.path.join(STUDIES_DIR, pdf_name)
        image_path = os.path.join(IMAGES_DIR, f'{study_key}_study.png')
        
        if os.path.exists(pdf_path):
            if extract_pdf_top_portion(pdf_path, image_path):
                study_images[study_key] = image_path
        else:
            print(f"  Warning: PDF not found: {pdf_path}")
    
    return study_images

def set_cell_shading(cell, color):
    """Set background color for a table cell"""
    shading = OxmlElement('w:shd')
    shading.set(qn('w:fill'), color)
    cell._tc.get_or_add_tcPr().append(shading)

def create_document():
    doc = Document()
    
    # Set up styles
    styles = doc.styles
    
    # Title style
    title_style = styles['Title']
    title_style.font.size = Pt(28)
    title_style.font.bold = True
    title_style.font.color.rgb = BRAND_BLUE
    
    # Heading 1 style
    h1_style = styles['Heading 1']
    h1_style.font.size = Pt(18)
    h1_style.font.bold = True
    h1_style.font.color.rgb = BRAND_BLUE
    
    # Heading 2 style
    h2_style = styles['Heading 2']
    h2_style.font.size = Pt(14)
    h2_style.font.bold = True
    h2_style.font.color.rgb = BRAND_DARK
    
    # Heading 3 style
    h3_style = styles['Heading 3']
    h3_style.font.size = Pt(12)
    h3_style.font.bold = True
    h3_style.font.color.rgb = BRAND_ACCENT
    
    return doc

def add_title_page(doc):
    """Add title page"""
    for _ in range(3):
        doc.add_paragraph()
    
    title = doc.add_paragraph()
    title_run = title.add_run('SUPER PATCH')
    title_run.bold = True
    title_run.font.size = Pt(36)
    title_run.font.color.rgb = BRAND_BLUE
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    subtitle = doc.add_paragraph()
    subtitle_run = subtitle.add_run('Chiropractor Channel Content')
    subtitle_run.font.size = Pt(24)
    subtitle_run.font.color.rgb = BRAND_DARK
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    doc.add_paragraph()
    tagline = doc.add_paragraph()
    tagline_run = tagline.add_run('Website Content for channel.superpatch.com')
    tagline_run.font.size = Pt(14)
    tagline_run.italic = True
    tagline_run.font.color.rgb = RGBColor(108, 117, 125)
    tagline.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    for _ in range(6):
        doc.add_paragraph()
    
    footer = doc.add_paragraph()
    footer_run = footer.add_run('Drug-Free Wellness Technology\nBacked by Peer-Reviewed Clinical Evidence')
    footer_run.font.size = Pt(12)
    footer_run.font.color.rgb = RGBColor(108, 117, 125)
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    doc.add_page_break()

def add_practice_description(doc):
    """Add the practice description section"""
    doc.add_heading('How Super Patch Fits a Chiropractic Practice', level=1)
    
    description = doc.add_paragraph()
    description.add_run(
        "Chiropractic care centers on the relationship between spinal alignment and nervous system "
        "function, enabling the body's innate healing capacity. Super Patch's Vibrotactile Technology "
        "(VTT) is the ideal complement to your adjustments, providing drug-free support that works "
        "with the same neural pathways you understand."
    )
    
    doc.add_paragraph()
    
    description2 = doc.add_paragraph()
    description2.add_run(
        "Our patches offer patients take-home solutions to maintain progress between visits, manage "
        "discomfort without medication, and support the body's natural recovery process. With "
        "peer-reviewed clinical evidence backing our Freedom patch, you can confidently recommend "
        "technology that aligns with your drug-free, non-invasive philosophy."
    )
    
    doc.add_paragraph()

def add_benefits_overview(doc):
    """Add the benefits overview table"""
    doc.add_heading('Benefits Overview', level=1)
    
    table = doc.add_table(rows=5, cols=3)
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    
    headers = ['Benefit', 'Title', 'Products']
    for i, header in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = header
        cell.paragraphs[0].runs[0].bold = True
        set_cell_shading(cell, '005293')
        cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
    
    data = [
        ('Pain Management', 'Drug-Free Pain Relief', '5 products'),
        ('Balance & Mobility', 'Enhanced Stability & Movement', '4 products'),
        ('Recovery & Rehabilitation', 'Accelerated Healing Between Visits', '6 products'),
        ('Whole-Body Wellness', 'Holistic Patient Support', '7 products'),
    ]
    
    for i, row_data in enumerate(data):
        for j, cell_data in enumerate(row_data):
            cell = table.rows[i + 1].cells[j]
            cell.text = cell_data
            if j == 0:
                cell.paragraphs[0].runs[0].bold = True
    
    doc.add_paragraph()
    doc.add_page_break()

def add_benefit_section(doc, benefit_num, title, description, products, study_images):
    """Add a benefit section with products"""
    doc.add_heading(f'Benefit {benefit_num}: {title}', level=1)
    
    desc_para = doc.add_paragraph()
    desc_para.add_run(description).italic = True
    doc.add_paragraph()
    
    for product in products:
        product_heading = doc.add_heading(f"{product['name']} - {product['title']}", level=2)
        
        doc.add_paragraph(product['description'])
        
        if 'why' in product:
            why_para = doc.add_paragraph()
            why_run = why_para.add_run('Why for Chiropractors: ')
            why_run.bold = True
            why_para.add_run(product['why'])
        
        # Add publication info if present
        if 'publication' in product:
            pub_para = doc.add_paragraph()
            pub_run = pub_para.add_run('Published: ')
            pub_run.bold = True
            pub_run.font.color.rgb = BRAND_BLUE
            pub_para.add_run(product['publication'])
        
        # Clinical Evidence bullets
        if 'evidence' in product:
            evidence_para = doc.add_paragraph()
            evidence_run = evidence_para.add_run('Key Results:')
            evidence_run.bold = True
            evidence_run.font.color.rgb = BRAND_BLUE
            
            for evidence_item in product['evidence']:
                doc.add_paragraph(evidence_item, style='List Bullet')
        
        # Add study image if available
        if 'study_key' in product and product['study_key'] in study_images:
            doc.add_paragraph()
            ref_para = doc.add_paragraph()
            ref_run = ref_para.add_run('Study Reference:')
            ref_run.bold = True
            ref_run.font.size = Pt(10)
            ref_run.font.color.rgb = RGBColor(108, 117, 125)
            
            try:
                doc.add_picture(study_images[product['study_key']], width=Inches(5.5))
                last_paragraph = doc.paragraphs[-1]
                last_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            except Exception as e:
                print(f"  Warning: Could not add image for {product['study_key']}: {e}")
        
        # Key Features
        if 'features' in product:
            features_para = doc.add_paragraph()
            features_run = features_para.add_run('Key Features:')
            features_run.bold = True
            features_run.font.color.rgb = BRAND_BLUE
            
            for feature in product['features']:
                doc.add_paragraph(feature, style='List Bullet')
        
        doc.add_paragraph()
    
    doc.add_page_break()

def add_key_messaging(doc):
    """Add key messaging section"""
    doc.add_heading('Key Messaging for Chiropractors', level=1)
    
    doc.add_heading('Philosophy Alignment', level=2)
    alignment_items = [
        'Drug-free: Aligns with chiropractic commitment to non-pharmaceutical care',
        'Non-invasive: Works externally through neural pathways',
        'Supports innate healing: Activates the body\'s own mechanisms',
        'Evidence-based: Peer-reviewed clinical studies',
    ]
    for item in alignment_items:
        doc.add_paragraph(item, style='List Bullet')
    
    doc.add_heading('Patient Value Propositions', level=2)
    patient_items = [
        'Maintain adjustment benefits between visits',
        'Drug-free pain relief without NSAIDs or opioids',
        'Better sleep for tissue repair and recovery',
        'Improved balance for fall prevention and mobility',
        'Whole-body wellness that complements spinal care',
    ]
    for item in patient_items:
        doc.add_paragraph(item, style='List Bullet')
    
    doc.add_heading('Practice Value Propositions', level=2)
    practice_items = [
        'Differentiate your practice with innovative technology',
        'Improve outcomes with take-home support',
        '25% wholesale discount for practice profitability',
        'Affiliate commissions on patient referrals',
        'Clinical evidence to share with confidence',
    ]
    for item in practice_items:
        doc.add_paragraph(item, style='List Bullet')

def main():
    # Extract study images first
    study_images = setup_study_images()
    
    # Create document
    doc = create_document()
    
    # Add title page
    add_title_page(doc)
    
    # Add practice description
    add_practice_description(doc)
    
    # Add benefits overview
    add_benefits_overview(doc)
    
    # Benefit 1: Pain Management
    pain_products = [
        {
            'name': 'Freedom',
            'title': 'Extend Your Adjustment',
            'description': 'Clinically proven to reduce pain severity and improve range of motion, helping patients maintain progress between visits.',
            'publication': 'Pain Therapeutics (2025) - Peer-reviewed RCT, ClinicalTrials.gov: NCT06505005',
            'study_key': 'freedom',
            'evidence': [
                '118 participants, 14-day double-blind study',
                'Significant pain reduction AND ROM improvement vs. placebo',
            ]
        },
        {
            'name': 'Peace',
            'title': 'Calm the Tension',
            'description': 'Supports stress reduction that can exacerbate muscle tension and spinal misalignment.',
            'why': 'Chronic stress causes muscle guarding and tension that works against adjustments. Peace helps patients maintain a relaxed state that supports spinal health.',
            'evidence': [
                '33% reduction in Perceived Stress Scale (PSS)',
                '24% improvement in mental health domain',
            ]
        },
        {
            'name': 'Liberty',
            'title': 'Move Without Limits',
            'description': 'Improves balance and stability, reducing compensatory movements that cause pain.',
            'why': 'Poor balance leads to compensatory movement patterns that strain the spine. Liberty supports proper biomechanics.',
            'publication': "International Journal of Physical Medicine & Rehabilitation (2022)",
            'study_key': 'liberty',
            'evidence': [
                '31% improvement in balance scores (p<0.05)',
                'Measured using validated Sway Medical Balance Assessment',
            ]
        },
        {
            'name': 'REM',
            'title': 'Rest to Repair',
            'description': 'Deeper sleep accelerates the body\'s natural healing process after adjustments.',
            'why': 'Sleep is when the body repairs tissue and consolidates the benefits of spinal care. Poor sleep undermines adjustment outcomes.',
            'publication': 'HARMONI Study - Prospective Clinical Trial (113 participants)',
            'study_key': 'rem',
            'evidence': [
                '46% faster sleep onset (69 min → 37 min)',
                '+1.5 hours additional sleep per night',
                '80% of participants stopped sleep medications',
            ]
        },
        {
            'name': 'Victory',
            'title': 'Recover Stronger',
            'description': 'Supports athletic patients with performance recovery and reduced muscle soreness.',
            'why': 'Athletes and active patients need support for post-adjustment recovery and ongoing performance.',
            'evidence': [
                '17% improvement in average concentric and eccentric force',
                '22% improvement in average power',
            ]
        },
    ]
    add_benefit_section(doc, 1, 'Pain Management', 
                       'Support your patients\' pain management between adjustments with clinically-studied, non-pharmaceutical solutions that work with the body\'s neural pathways.',
                       pain_products, study_images)
    
    # Benefit 2: Balance & Mobility
    balance_products = [
        {
            'name': 'Liberty',
            'title': '31% Better Balance',
            'description': 'Clinically shown to improve balance and stability, ideal for seniors and fall-risk patients.',
            'why': 'Falls are the #1 cause of injury death in adults 65+. Many chiropractic patients present with balance concerns that affect their daily function and safety.',
            'publication': "International Journal of Physical Medicine & Rehabilitation (2022)",
            'study_key': 'liberty',
            'evidence': [
                '31% improvement in balance scores (p<0.05)',
                '69 subjects using Sway Medical Balance Assessment',
            ]
        },
        {
            'name': 'Freedom',
            'title': 'Pain-Free Mobility',
            'description': 'Reduces discomfort that limits movement, helping patients stay active.',
            'why': 'Pain restricts movement patterns and discourages activity. Freedom supports mobility by addressing the pain that holds patients back.',
            'publication': 'Pain Therapeutics (2025)',
            'evidence': [
                'Significant ROM improvement at Day 7 and Day 14',
            ]
        },
        {
            'name': 'Victory',
            'title': 'Strength & Stability',
            'description': 'Supports improved strength and agility for better functional movement.',
            'why': 'Strong, agile patients maintain better posture and have fewer compensatory patterns that lead to spinal issues.',
            'evidence': [
                '17% improvement in peak force',
                '22% improvement in average power',
            ]
        },
        {
            'name': 'Boost',
            'title': 'Energy for Activity',
            'description': 'Clean, sustained energy to encourage patients to stay active and mobile.',
            'why': 'Fatigue leads to inactivity, which leads to deconditioning and poor posture. Boost supports the energy patients need to stay moving.',
            'features': [
                '12+ hours of clean energy',
                'No sugar, no caffeine, no taurine',
                'No crashes or slumps',
            ]
        },
    ]
    add_benefit_section(doc, 2, 'Balance & Mobility',
                       'Help patients improve balance and mobility for better quality of life, reduced fall risk, and enhanced outcomes from your care.',
                       balance_products, study_images)
    
    # Benefit 3: Recovery & Rehabilitation
    recovery_products = [
        {
            'name': 'Freedom',
            'title': 'At-Home Pain Support',
            'description': 'Drug-free relief between adjustment sessions to maintain treatment gains.',
            'why': 'Patients often lose 50% of their adjustment benefits between visits due to pain and muscle tension. Freedom provides ongoing support.',
            'publication': 'Pain Therapeutics (2025) - Peer-reviewed RCT',
            'evidence': [
                'Significant pain severity reduction vs. placebo',
                'No drug interactions or contraindications',
            ]
        },
        {
            'name': 'REM',
            'title': 'Restorative Sleep',
            'description': 'Better sleep quality supports tissue repair and nervous system recovery.',
            'why': 'Sleep is when the body does its deepest healing work. Poor sleep undermines every adjustment you make.',
            'publication': 'HARMONI Study - Prospective Clinical Trial',
            'evidence': [
                '74% reduction in night waking',
                '+1.5 hours additional sleep per night',
                '70% of participants preferred patch over sleep medications',
            ]
        },
        {
            'name': 'Liberty',
            'title': 'Restore Balance',
            'description': 'Helps rebuild proprioception and stability after injury or adjustment.',
            'why': 'Many patients present with compromised proprioception. Liberty supports the neuromuscular coordination needed for proper function.',
            'publication': "International Journal of Physical Medicine & Rehabilitation (2022)",
            'evidence': [
                '31% improvement in balance scores',
                'Enhances proprioceptive pathways',
            ]
        },
        {
            'name': 'Victory',
            'title': 'Rehabilitation Support',
            'description': 'Enhances strength and recovery for patients in active rehab programs.',
            'why': 'Patients recovering from injury or surgery need support for both strength and coordination as they progress through care.',
            'evidence': [
                '17% improvement in average force',
                'Supports post-injury recovery protocols',
            ]
        },
        {
            'name': 'Peace',
            'title': 'Relaxation for Healing',
            'description': 'Reduces stress that can inhibit the body\'s natural healing response.',
            'why': 'The stress response causes muscle tension and inflammation that work against healing. Peace supports a calm state conducive to recovery.',
            'evidence': [
                '33% reduction in Perceived Stress Scale',
            ]
        },
        {
            'name': 'Boost',
            'title': 'Energy for Rehab',
            'description': 'Provides clean energy for physical therapy exercises and daily activities.',
            'why': 'Rehabilitation requires energy. Patients who are fatigued don\'t do their home exercises. Boost supports the vitality needed for active recovery.',
            'features': [
                'Drug-free, no stimulants',
                '12+ hours of sustained energy',
            ]
        },
    ]
    add_benefit_section(doc, 3, 'Recovery & Rehabilitation',
                       'Provide patients with at-home support that enhances the effectiveness of your adjustments and speeds their recovery journey.',
                       recovery_products, study_images)
    
    # Benefit 4: Whole-Body Wellness (now with 7 products including Liberty)
    wellness_products = [
        {
            'name': 'Peace',
            'title': 'Stress & Spine Health',
            'description': 'Chronic stress contributes to muscle tension and spinal issues – help patients find calm.',
            'why': 'Stress is a major contributor to the muscle guarding, tension headaches, and postural problems you see daily. Addressing stress addresses the root.',
            'evidence': [
                '33% reduction in Perceived Stress Scale (PSS)',
                '24% improvement in mental health domain',
            ]
        },
        {
            'name': 'Liberty',
            'title': 'Foundation for Active Living',
            'description': 'Better balance and stability supports an active lifestyle and independence at any age.',
            'why': 'Balance is fundamental to quality of life. Patients who feel stable and confident move more, exercise more, and maintain better overall health – creating a positive cycle that supports spinal wellness.',
            'publication': "International Journal of Physical Medicine & Rehabilitation (2022)",
            'study_key': 'liberty',
            'evidence': [
                '31% improvement in balance scores (p<0.05)',
                'Supports longevity and vitality through enhanced mobility',
            ]
        },
        {
            'name': 'Joy',
            'title': 'Positive Healing Mindset',
            'description': 'Emotional well-being supports better treatment compliance and healing outcomes.',
            'why': 'Patients with positive emotional states are more likely to follow through on home care recommendations and experience better outcomes.',
            'features': [
                'Supports general feelings of well-being and contentment',
                'Drug-free mood support',
            ]
        },
        {
            'name': 'Defend',
            'title': 'Immune Support',
            'description': 'A healthy immune system supports overall wellness and recovery.',
            'why': 'The nervous system and immune system are intimately connected. Spinal health supports immunity, and immune health supports healing.',
            'features': [
                'Supports natural immune function',
                'Drug-free wellness support',
            ]
        },
        {
            'name': 'Focus',
            'title': 'Mental Clarity',
            'description': 'Helps patients stay present and follow through on home care instructions.',
            'why': 'Patients need mental clarity to remember and execute home care recommendations – posture reminders, exercises, and ergonomic adjustments.',
            'features': [
                'Supports concentration and attention',
                'Helps manage daily distractions',
            ]
        },
        {
            'name': 'Ignite',
            'title': 'Metabolic Health',
            'description': 'Weight management reduces spinal load and supports overall wellness.',
            'why': 'Excess weight places additional stress on the spine. Supporting healthy metabolism supports spinal health.',
            'evidence': [
                '25% improvement in Resting Metabolic Rate (RMR)',
            ]
        },
        {
            'name': 'Boost',
            'title': 'Drug-Free Energy',
            'description': 'Clean energy without caffeine to support active, healthy lifestyles.',
            'why': 'Active patients are healthier patients. Boost provides the energy for exercise, proper posture maintenance, and active living.',
            'features': [
                '12+ hours of clean energy',
                'No sugar, caffeine, or taurine',
            ]
        },
    ]
    add_benefit_section(doc, 4, 'Whole-Body Wellness',
                       'Address the full spectrum of patient wellness with solutions for stress, energy, immunity, and overall vitality that complement your spinal care.',
                       wellness_products, study_images)
    
    # Add key messaging
    add_key_messaging(doc)
    
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Save document
    doc.save(OUTPUT_FILE)
    print(f"\nDocument saved to: {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
