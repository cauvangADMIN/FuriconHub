const fs = require('fs');
const path = require('path');

// Function to rename images
function renameImages(startingName) {
    // Extract the base name and starting number
    const match = startingName.match(/^(.+?)(\d+)$/);
    if (!match) {
        console.error('Invalid starting name format. Please use a format like "ecchi-432"');
        return;
    }
    
    const baseName = match[1]; // e.g., "ecchi-"
    let counter = parseInt(match[2]); // e.g., 432
    
    // Source and destination directories
    const sourceDir = path.join(__dirname, 'rename');
    const destDir = path.join(__dirname, 'rename', 'result');
    
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Get all jpg files from the source directory
    const files = fs.readdirSync(sourceDir)
        .filter(file => {
            // Filter out directories and non-jpg files
            const filePath = path.join(sourceDir, file);
            return (file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.png')) && 
                   fs.statSync(filePath).isFile() &&
                   file !== 'result'; // Exclude the result directory
        });
    
    console.log(`Found ${files.length} images to rename.`);
    
    // Rename and copy each file
    files.forEach(file => {
        const sourcePath = path.join(sourceDir, file);
        const newFileName = `${baseName}${counter}.jpg`;
        const destPath = path.join(destDir, newFileName);
        
        // Copy the file with the new name
        fs.copyFileSync(sourcePath, destPath);
        console.log(`Renamed: ${file} -> ${newFileName}`);
        
        // Increment counter for next file
        counter++;
    });
    
    console.log(`Renaming complete. ${files.length} files processed.`);
}

// Get the starting name from command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Please provide a starting name, e.g., "node rename.js ecchi-432"');
} else {
    renameImages(args[0]);
}