# Doctor Signature Image

## Purpose

This directory contains the doctor's signature image used for generating doctor's note PDFs.

## Required File

**Filename**: `doctor-signature.png`

Place your doctor's signature image in this directory with the filename `doctor-signature.png`.

## Image Requirements

- **Format**: PNG (recommended for transparency) or JPG
- **Recommended size**: 300x100 pixels (width x height)
- **Background**: Transparent (for PNG) or white
- **Quality**: High resolution for clear display in PDFs

## How to Create a Signature Image

1. **Option 1: Scan a physical signature**
   - Sign on white paper with black ink
   - Scan at 300 DPI or higher
   - Crop to just the signature
   - Save as PNG

2. **Option 2: Digital signature pad**
   - Use a digital signature pad or tablet
   - Export as PNG with transparent background
   - Ensure high resolution

3. **Option 3: Online signature tool**
   - Use a tool like DocuSign, SignNow, or HelloSign
   - Create your digital signature
   - Download as PNG

## Configuration

The signature image path is configured in `.env.local`:

```env
DOCTOR_SIGNATURE_URL="/images/doctor-signature.png"
```

If you change the filename or location, update the environment variable accordingly.

## Security Note

Do NOT commit your actual signature image to version control if this is a public repository. Add `doctor-signature.png` to `.gitignore` if needed.
