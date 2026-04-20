/**
 * Convert SVG logo to PNG for PDF generation
 * @react-pdf/renderer doesn't support SVG, so we need PNG
 *
 * NOTE: This is a ONE-TIME utility script, not part of the build process.
 * The generated logo.png is already committed to the repository.
 *
 * To use this script:
 * 1. Install sharp: npm install --save-dev sharp
 * 2. Run: npx tsx scripts/convert-logo.ts
 * 3. Commit the updated public/images/logo.png if needed
 */

import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join } from 'path'

async function convertLogo() {
  try {
    const svgPath = join(process.cwd(), 'src/app/icon.svg')
    const outputPath = join(process.cwd(), 'public/images/logo.png')

    console.log('📄 Reading SVG file...')
    const svgBuffer = readFileSync(svgPath)

    console.log('🔄 Converting SVG to PNG...')
    await sharp(svgBuffer)
      .resize(200, 200, {
        // Higher resolution for better quality in PDF
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparent background
      })
      .png()
      .toFile(outputPath)

    console.log(`✅ Logo converted successfully!`)
    console.log(`   Output: ${outputPath}`)
  } catch (error) {
    console.error('❌ Error converting logo:', error)
    process.exit(1)
  }
}

convertLogo()
