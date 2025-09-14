# AcroForm Templates Required

This folder needs two AcroForm PDF templates with fillable form fields:

## Files Needed:
- `15G.acro.pdf` - Form 15G with AcroForm fields
- `15H.acro.pdf` - Form 15H with AcroForm fields

## Creating the Templates:

1. **Open your blank Form 15G/15H PDFs** in Adobe Acrobat Pro or LibreOffice Draw

2. **Add Text Fields** with these exact names:
   - `fullName` - Full name field
   - `pan` - PAN number field
   - `status` - Individual/HUF status
   - `addr_line1` - Address line 1 (flat/house no)
   - `addr_line2` - Address line 2 (premises/building)
   - `addr_line3` - Address line 3 (street/road)
   - `addr_city` - City
   - `addr_state` - State
   - `addr_pin` - PIN code
   - `email` - Email address
   - `phone` - Phone number
   - `fy` - Financial year (e.g., 2023-24)
   - `ay` - Assessment year (e.g., 2024-25)
   - `fy_end` - FY end date (31/03/YYYY)
   - `income_ident` - BOID/demat account
   - `income_nature` - Nature of income (auto-filled as "Dividend")
   - `income_section` - Section (auto-filled as "194")
   - `income_amount` - Dividend amount
   - `place` - Place (auto-filled as "Mumbai")
   - `date` - Date (auto-filled as current date)

3. **Add Checkboxes** with these exact names:
   - `resident_yes` - Resident checkbox
   - `resident_no` - Non-resident checkbox
   - `assessed_yes` - Assessed to tax - Yes
   - `assessed_no` - Assessed to tax - No

4. **Do NOT add a signature field** - signature will be drawn as image at coordinates (400, 150, width: 120, height: 40)

5. **Save as** `15G.acro.pdf` and `15H.acro.pdf` in this folder

## Alternative Quick Setup:
If you don't have Adobe Acrobat, you can use the existing coordinate-based system temporarily by enabling the fallback in the code, but the AcroForm approach is much more reliable.

## Testing:
Once templates are created, try generating a form. Check the browser console for any missing field warnings and adjust field names accordingly.