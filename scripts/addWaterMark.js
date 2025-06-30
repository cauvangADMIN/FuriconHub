const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Function to add watermark to an image
async function addWatermarkToImage(imagePath, outputPath) {
  try {
    // Load the image
    const image = await loadImage(imagePath);
    
    // Create canvas with the same dimensions as the image
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Draw the image onto the canvas
    ctx.drawImage(image, 0, 0);
    
    // Calculate font size based on image dimensions - minimum 16px, scales with image width
    const fontSize = Math.max(17, Math.floor(canvas.width * 0.05));
    
    // Add watermark text
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = 'rgba(255, 255, 255, 1)'; // Chữ trắng
    ctx.strokeStyle = 'rgba(0, 0, 0, 1)'; // Viền đen
    ctx.lineWidth = Math.max(1, Math.floor(fontSize/15)); // Độ dày viền tỷ lệ với kích thước chữ
    ctx.textAlign = 'center';
    
    // Position at 3/4 from the top
    const textY = Math.floor(canvas.height * 0.85);
    
    // Add the watermark text
    ctx.strokeText('Petmemoji', canvas.width / 2, textY); // Vẽ viền trước
    ctx.fillText('Petmemoji', canvas.width / 2, textY); // Sau đó vẽ chữ
    
    // Save the watermarked image
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    
    return true;
  } catch (error) {
    console.error(`Error processing image ${imagePath}:`, error);
    return false;
  }
}

// Process all images in a directory
async function processImages() {
  // Source directory (where original images are)
  const sourceDir = path.join(__dirname); // Current directory
  
  // Destination directory for watermarked images
  const destDir = path.join(__dirname, 'watermark');
  
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Get all image files from the source directory
  const files = fs.readdirSync(sourceDir)
    .filter(file => {
      // Filter out directories and non-image files
      const filePath = path.join(sourceDir, file);
      return (file.toLowerCase().endsWith('.webp') || 
             file.toLowerCase().endsWith('.jpg') || 
             file.toLowerCase().endsWith('.jpeg') || 
             file.toLowerCase().endsWith('.png')) && 
             fs.statSync(filePath).isFile() &&
             !file.includes('addWaterMark.js'); // Exclude this script
    });
  
  console.log(`Found ${files.length} images to process.`);
  
  // Process each image
  let successCount = 0;
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    
    // Create output filename (keep the same name but ensure .webp extension)
    const outputFileName = path.basename(file, path.extname(file)) + '.png';
    const destPath = path.join(destDir, outputFileName);
    
    console.log(`Processing: ${file} -> ${outputFileName}`);
    
    // Add watermark and save
    const success = await addWatermarkToImage(sourcePath, destPath);
    if (success) {
      successCount++;
    }
  }
  
  console.log(`\nWatermarking complete. ${successCount} of ${files.length} files processed successfully.`);
  console.log(`Watermarked images saved to: ${destDir}`);
}

// Run the script
processImages().catch(err => {
  console.error('Error running script:', err);
});